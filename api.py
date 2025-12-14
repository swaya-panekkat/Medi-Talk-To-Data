# api.py
import os
import time
from typing import List, Any, Optional, Dict
 
from fastapi import FastAPI, HTTPException, Response, Request, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from jose import jwt, JWTError
import psycopg2
from sqlalchemy import text
 
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
 
# ---------- Auth / JWT ----------
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGO = "HS256"
TOKEN_TTL_SECONDS = 60 * 60 * 8  # 8h
 
AUTH_DBNAME = os.getenv("AUTH_DBNAME", main.DB_CONFIG["dbname"])
AUTH_HOST   = os.getenv("AUTH_HOST",   main.DB_CONFIG["host"])
AUTH_PORT   = int(os.getenv("AUTH_PORT", main.DB_CONFIG["port"]))
 
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
def query(req: QueryRequest, claims: dict = Depends(require_user)):
    username = claims.get("sub", "")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")
    result = main.ask_database_structured_for_user(username=username, english_prompt=req.q)
    return QueryResponse(
        sql=result.get("sql"),
        columns=result.get("columns", []),
        rows=result.get("rows", []),
        empty=bool(result.get("empty", True)),
        error=result.get("error"),
    )
 
# ---------- Schemas (only what this user can access) ----------
@app.get("/api/schemas", response_model=SchemasResponse)
def schemas(claims: dict = Depends(require_user)):
    username = claims.get("sub", "")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")
    try:
        mapping = main.list_accessible_schemas_and_tables(username)
        out = [{"schema": s, "tables": sorted(tables)} for s, tables in sorted(mapping.items())]
        return SchemasResponse(schemas=out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load schemas: {e}")
 
# ---------- Table preview: columns + first row ----------
@app.get("/api/table_preview", response_model=TablePreviewResponse)
def table_preview(
    schema: str = Query(..., min_length=1),
    table: str  = Query(..., min_length=1),
    claims: dict = Depends(require_user)
):
    username = claims.get("sub", "")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")
 
    # Check the user can see this schema.table
    allowed = main.list_accessible_schemas_and_tables(username).get(schema, [])
    if table not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to read this table")
 
    # Fetch columns (name + type)
    with main.engine.connect() as conn:
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
def logout(response: Response):
    response.delete_cookie("t2d_token", path="/")
    return {"ok": True}
 
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
 
@app.get("/", include_in_schema=False)
def root():
    for fname in ("dashboard.html", "index.html", "login.html"):
        p = os.path.join(STATIC_DIR, fname)
        if os.path.exists(p):
            return FileResponse(p)
    return RedirectResponse(url="/login.html")
 
# ---------- Static (serve frontend from same origin) ----------
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
 
