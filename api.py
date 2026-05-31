# api.py
import os
import time
from typing import List, Any, Optional, Dict

import io
import re as _re
from fastapi import FastAPI, HTTPException, Response, Request, Depends, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from jose import jwt, JWTError
import psycopg2
from sqlalchemy import text, create_engine
from sqlalchemy.engine import URL
 
# Optional: load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass
 
# Your pipeline / DB code (SQLAlchemy engine + helpers live here)
import main
 
# ---------- App ----------
app = FastAPI(title="Talk2Data API", version="1.1")
 
# ---------- CORS (adjust in prod) ----------
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# ---------- Models ----------
class QueryRequest(BaseModel):
    q: str
 
class QueryResponse(BaseModel):
    sql: Optional[str]
    columns: List[str]
    rows: List[List[Any]]
    empty: bool
    error: Optional[str] = None
 
class LoginRequest(BaseModel):
    username: str  # Postgres role name
    password: str
 
class MeResponse(BaseModel):
    email: str
    full_name: str
 
class SchemasResponse(BaseModel):
    schemas: List[Dict[str, Any]]
 
class TablePreviewResponse(BaseModel):
    schema: str
    table: str
    columns: List[Dict[str, str]]   # [{name, type}]
    sample: Optional[Dict[str, Any]] # first row as {col:value} or None
 
# ---------- Per-user session store (password + optional custom DB config) ----------
# Structure: { token_string: {"password": str, "db_config": None | {host, port, dbname}} }
USER_SESSIONS: Dict[str, dict] = {}

def _get_token(request: Request) -> Optional[str]:
    token = request.cookies.get("t2d_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    return token

def _get_user_engine(request: Request, username: str):
    """Return a per-user SQLAlchemy engine if the user configured a custom DB, else None."""
    token = _get_token(request)
    session = USER_SESSIONS.get(token or "")
    if session and session.get("db_config") and session.get("password"):
        cfg = session["db_config"]
        url = URL.create(
            "postgresql+psycopg2",
            username=username,
            password=session["password"],
            host=cfg["host"],
            port=int(cfg.get("port", 5432)),
            database=cfg["dbname"],
        )
        return create_engine(url, future=True, pool_pre_ping=True,
                             pool_size=1, max_overflow=2)
    return None  # caller falls back to default engine

# ---------- Auth / JWT ----------
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGO = "HS256"
TOKEN_TTL_SECONDS = 60 * 60 * 8  # 8h
 
AUTH_DBNAME = os.getenv("AUTH_DBNAME", main.DB_CONFIG["dbname"])
AUTH_HOST = os.getenv("AUTH_HOST", main.DB_CONFIG["host"])
AUTH_PORT = int(os.getenv("AUTH_PORT", str(main.DB_CONFIG["port"])))
 
# 🔓 Allow any pg role to login (with valid password):
LOGIN_REQUIRED_ROLE = None  # <- force disabled
 
def create_token(sub: str, name: str) -> str:
    now = int(time.time())
    payload = {"sub": sub, "name": name or sub, "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGO)
 
def read_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGO])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
 
def require_user(request: Request):
    token = request.cookies.get("t2d_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")
    return read_token(token)
 
# ---------- Role checks against pg_roles ----------
def role_exists_and_can_login(username: str) -> bool:
    try:
        with main.engine.connect() as conn:
            row = conn.execute(
                text("SELECT rolcanlogin FROM pg_roles WHERE rolname = :u"),
                {"u": username},
            ).fetchone()
            return bool(row and row[0])
    except Exception as e:
        print("⚠️ role_exists_and_can_login error:", e)
        return False
 
def role_member_of(username: str, required_role: str) -> bool:
    try:
        with main.engine.connect() as conn:
            row = conn.execute(
                text("SELECT pg_has_role(:u, :g, 'member')"),
                {"u": username, "g": required_role},
            ).fetchone()
            return bool(row and row[0])
    except Exception as e:
        print("⚠️ role_member_of error:", e)
        return False
 
# ---------- Startup ----------
@app.on_event("startup")
def startup():
    try:
        main.populate_schema_if_empty()
    except Exception as e:
        print("⚠️  Skipping schema populate on startup:", e)
 
# ---------- Health ----------
@app.get("/api/health")
def health():
    return JSONResponse({"ok": True})
 
# ---------- Query route (permission-aware) ----------
@app.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest, request: Request, claims: dict = Depends(require_user)):
    username = claims.get("sub", "")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")
    eng = _get_user_engine(request, username)
    result = main.ask_database_structured_for_user(username=username, english_prompt=req.q, eng=eng)
    return QueryResponse(
        sql=result.get("sql"),
        columns=result.get("columns", []),
        rows=result.get("rows", []),
        empty=bool(result.get("empty", True)),
        error=result.get("error"),
    )
 
# ---------- Schemas (only what this user can access) ----------
@app.get("/api/schemas", response_model=SchemasResponse)
def schemas(request: Request, claims: dict = Depends(require_user)):
    username = claims.get("sub", "")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")
    eng = _get_user_engine(request, username)
    try:
        mapping = main.list_accessible_schemas_and_tables(username, eng=eng)
        out = [{"schema": s, "tables": sorted(tables)} for s, tables in sorted(mapping.items())]
        return SchemasResponse(schemas=out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load schemas: {e}")
 
# ---------- Table preview: columns + first row ----------
@app.get("/api/table_preview", response_model=TablePreviewResponse)
def table_preview(
    request: Request,
    schema: str = Query(..., min_length=1),
    table: str  = Query(..., min_length=1),
    claims: dict = Depends(require_user)
):
    username = claims.get("sub", "")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")

    eng = _get_user_engine(request, username)
    active_engine = eng or main.engine

    allowed = main.list_accessible_schemas_and_tables(username, eng=eng).get(schema, [])
    if table not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to read this table")

    with active_engine.connect() as conn:
        cols = conn.execute(
            text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = :s AND table_name = :t
                ORDER BY ordinal_position
            """),
            {"s": schema, "t": table},
        ).fetchall()
        columns = [{"name": c[0], "type": c[1]} for c in cols]
 
        # Fetch first row (if any)
        # Safe because we already verified membership and we only interpolate identifiers
        ident = f'"{schema}"."{table}"'
        sample_row = conn.execute(text(f"SELECT * FROM {ident} LIMIT 1")).mappings().first()
        sample = dict(sample_row) if sample_row else None
 
    return TablePreviewResponse(schema=schema, table=table, columns=columns, sample=sample)
 
# ---------- Auth routes ----------
@app.post("/api/login")
def login(req: LoginRequest, response: Response):
    user = (req.username or "").strip()
    if not user or not req.password:
        raise HTTPException(status_code=400, detail="Username and password required")
    if not role_exists_and_can_login(user):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if LOGIN_REQUIRED_ROLE and not role_member_of(user, LOGIN_REQUIRED_ROLE):
        raise HTTPException(status_code=403, detail="Not allowed for this application")
    try:
        conn = psycopg2.connect(
            dbname=AUTH_DBNAME,
            user=user,
            password=req.password,
            host=AUTH_HOST,
            port=AUTH_PORT,
            connect_timeout=5,
        )
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.close()
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")
 
    token = create_token(sub=user, name=user)
    # Store password in session so dynamic DB connections can use it later
    USER_SESSIONS[token] = {"password": req.password, "db_config": None}
    response.set_cookie(
        key="t2d_token",
        value=token,
        httponly=True,
        samesite="Lax",
        secure=False,
        max_age=TOKEN_TTL_SECONDS,
        path="/",
    )
    return {"ok": True, "name": user, "token": token}
 
@app.get("/api/me", response_model=MeResponse)
def me(claims: dict = Depends(require_user)):
    u = claims.get("sub", "")
    return MeResponse(email=u, full_name=u)
 
@app.post("/api/logout")
def logout(request: Request, response: Response):
    token = _get_token(request)
    if token:
        USER_SESSIONS.pop(token, None)   # clean up session on logout
    response.delete_cookie("t2d_token", path="/")
    return {"ok": True}

# ---------- External database connection ----------

class DbConnectRequest(BaseModel):
    host: str
    port: int = 5432
    dbname: str

@app.post("/api/db_connect")
def db_connect(req: DbConnectRequest, request: Request, claims: dict = Depends(require_user)):
    username = claims.get("sub", "")
    token = _get_token(request)
    session = USER_SESSIONS.get(token or "")
    if not session:
        raise HTTPException(status_code=400,
                            detail="Session not found — please log out and back in.")
    password = session.get("password", "")
    # Test the connection with the user's credentials
    try:
        conn = psycopg2.connect(
            dbname=req.dbname,
            user=username,
            password=password,
            host=req.host,
            port=req.port,
            connect_timeout=8,
        )
        with conn.cursor() as cur:
            cur.execute("SELECT version()")
            ver = (cur.fetchone() or [""])[0]
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {e}")
    # Save config in session
    USER_SESSIONS[token]["db_config"] = {
        "host": req.host, "port": req.port, "dbname": req.dbname
    }
    return {"ok": True, "message": f"Connected to {req.dbname} on {req.host}",
            "version": ver[:80]}

@app.post("/api/db_disconnect")
def db_disconnect(request: Request, claims: dict = Depends(require_user)):
    token = _get_token(request)
    if token and token in USER_SESSIONS:
        USER_SESSIONS[token]["db_config"] = None
    return {"ok": True, "message": "Disconnected — using default database."}

@app.get("/api/db_status")
def db_status(request: Request, claims: dict = Depends(require_user)):
    token = _get_token(request)
    session = USER_SESSIONS.get(token or "")
    if session and session.get("db_config"):
        return {"connected": True,  "config": session["db_config"]}
    return {"connected": False, "config": {
        "host":   main.DB_CONFIG.get("host",   "localhost"),
        "port":   main.DB_CONFIG.get("port",   5432),
        "dbname": main.DB_CONFIG.get("dbname", "default"),
    }}
 
# ---------- File upload: SQL ----------
@app.post("/api/upload/sql")
async def upload_sql(
    file: UploadFile = File(...),
    claims: dict = Depends(require_user),
):
    if file.size and file.size > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    raw = await file.read()
    try:
        sql_text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    # Execute via psycopg2 — handles multi-statement SQL dumps correctly
    try:
        conn = psycopg2.connect(
            dbname=main.DB_CONFIG["dbname"],
            user=main.DB_CONFIG["user"],
            password=main.DB_CONFIG["password"],
            host=main.DB_CONFIG["host"],
            port=main.DB_CONFIG["port"],
        )
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute(sql_text)
        conn.commit()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL error: {e}")

    return {"ok": True, "message": f"'{file.filename}' executed successfully"}


# ---------- File upload: CSV ----------
@app.post("/api/upload/csv")
async def upload_csv(
    file: UploadFile = File(...),
    table_name: str = Query(None),
    claims: dict = Depends(require_user),
):
    import pandas as pd

    if file.size and file.size > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    raw = await file.read()
    try:
        df = pd.read_csv(io.StringIO(raw.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parse error: {e}")

    # Derive a safe table name
    base = table_name or (file.filename or "imported").rsplit(".", 1)[0]
    name = _re.sub(r"[^a-zA-Z0-9]", "_", base).lower().strip("_") or "imported_data"
    if name[0].isdigit():
        name = "t_" + name

    try:
        df.to_sql(name, main.engine, if_exists="replace", index=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {e}")

    return {
        "ok":      True,
        "table":   name,
        "rows":    len(df),
        "columns": list(df.columns),
        "message": f"Imported {len(df)} rows into table '{name}'",
    }


# ---------- Noise-suppression + convenience ----------
@app.get("/hybridaction/zybTrackerStatisticsAction", include_in_schema=False)
def zyb_tracker_statistics_action(request: Request):
    cb = request.query_params.get("__callback__")
    if cb:
        return Response(content=f"{cb}({{}});", media_type="application/javascript", status_code=200)
    return Response(status_code=204)
 
STATIC_DIR = os.getenv("STATIC_DIR", ".")
 
@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    path = os.path.join(STATIC_DIR, "favicon.ico")
    if os.path.exists(path):
        return FileResponse(path)
    return Response(status_code=204)
 
# ---------- SPA catch-all — must be last route ----------
# Serves real static files (assets/*.js, logo.png, …) by exact path,
# and falls back to index.html for every React Router path (/login, /dashboard, …)
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    file_path = os.path.join(STATIC_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    index = os.path.join(STATIC_DIR, "index.html")
    if os.path.isfile(index):
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Not found")
 
