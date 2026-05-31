# main.py
import os, re
import psycopg2
import pandas as pd
import requests
import chromadb
from chromadb.utils import embedding_functions
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv


load_dotenv()

# Database configuration (now 100% from env)
DB_CONFIG = {
    "dbname": os.getenv("PGDATABASE"),
    "user": os.getenv("PGUSER"),
    "password": os.getenv("PGPASSWORD"),
    "host": os.getenv("PGHOST"),
    "port": int(os.getenv("PGPORT", "5432")),
}

# ✅ Build SQLAlchemy engine
pg_url = URL.create(
    "postgresql+psycopg2",
    username=DB_CONFIG["user"],
    password=DB_CONFIG["password"],
    host=DB_CONFIG["host"],
    port=DB_CONFIG["port"],
    database=DB_CONFIG["dbname"],
)
engine = create_engine(pg_url, future=True)

# ======================
# ======================
# Gemini API
# ======================
GEMINI_MODEL   = "gemini-2.0-flash"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    f"/{GEMINI_MODEL}:generateContent"
)

def _get_gemini_key() -> str | None:
    return os.getenv("GEMINI_API_KEY", "").strip() or None

# ======================
# Ollama (local fallback)
# ======================
OLLAMA_BASE  = (os.getenv("OLLAMA_HOST") or os.getenv("OLLAMA_API_URL") or "http://host.docker.internal:11434")
OLLAMA_MODEL = (os.getenv("OLLAMA_MODEL") or os.getenv("OLLAMA_PRIMARY_MODEL") or "llama3.2")

def _ollama_available() -> bool:
    try:
        r = requests.get(f"{OLLAMA_BASE}/api/tags", timeout=3)
        return r.ok
    except Exception:
        return False

def _call_ollama(prompt: str) -> str:
    url = f"{OLLAMA_BASE}/v1/chat/completions"
    payload = {
        "model":       OLLAMA_MODEL,
        "temperature": 0,
        "stream":      False,
        "messages": [
            {"role": "system", "content": (
                "You are a PostgreSQL expert. "
                "Return ONLY the SQL query — no explanation, no markdown, no code fences."
            )},
            {"role": "user", "content": prompt},
        ],
    }
    resp = requests.post(url, json=payload,
                         headers={"Content-Type": "application/json"}, timeout=120)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


# ======================
# ChromaDB (vector DB for schema)
# ======================
chroma_client = chromadb.PersistentClient(path="./schema_db")
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)
collection = chroma_client.get_or_create_collection(
    name="db_schema", embedding_function=embedding_fn
)

# ======================
# Global schema extraction (admin) — used only for initial indexing
# ======================
def extract_schema():
    """
    Admin-wide schema snapshot for indexing (not permission filtered).
    """
    with psycopg2.connect(
        dbname=DB_CONFIG["dbname"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        host=DB_CONFIG["host"],
        port=DB_CONFIG["port"],
    ) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT n.nspname AS schema, c.relname AS table, a.attname AS column_name,
                   pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
            WHERE c.relkind IN ('r','p','v','m')
              AND n.nspname NOT IN ('pg_catalog','information_schema')
            ORDER BY n.nspname, c.relname, a.attnum;
            """
        )
        rows = cur.fetchall()

    schema_dict = {}
    for schema, table, col, dtype in rows:
        key = f"{schema}.{table}"
        schema_dict.setdefault(key, []).append(f"{col} ({dtype})")

    docs = [f"Table: {t}\nColumns: {', '.join(cols)}" for t, cols in schema_dict.items()]
    return docs

def populate_schema_if_empty():
    count = collection.count()
    if count == 0:
        print("📥 Inserting schema into vector DB...")
        docs = extract_schema()
        for i, doc in enumerate(docs):
            collection.add(documents=[doc], ids=[f"table_{i}"])
        print("✅ Schema stored in ChromaDB")
    else:
        print(f"✅ Schema already in ChromaDB ({count} tables)")

# ======================
# Permission-aware helpers
# ======================
def list_accessible_schemas_and_tables(username: str, eng=None) -> dict[str, list[str]]:
    """
    Return {schema: [table,...]} for which `username` has USAGE on schema
    and SELECT on table. Accepts optional engine override.
    """
    _eng = eng or engine
    with _eng.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT n.nspname AS schema, c.relname AS table
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relkind IN ('r','p','v','m')
                  AND n.nspname NOT IN ('pg_catalog','information_schema')
                  AND has_schema_privilege(:u, n.nspname, 'USAGE')
                  AND has_table_privilege(:u, c.oid, 'SELECT')
                ORDER BY n.nspname, c.relname
                """
            ),
            {"u": username},
        ).fetchall()

    out: dict[str, list[str]] = {}
    for schema, table in rows:
        out.setdefault(schema, []).append(table)
    return out

def extract_schema_for_user(username: str, eng=None) -> list[str]:
    """
    Build docs like "Table: schema.table\nColumns: ..." but filtered to user's privileges.
    Accepts optional engine override.
    """
    _eng = eng or engine
    with _eng.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT n.nspname AS schema, c.relname AS table, a.attname AS column_name,
                       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
                WHERE c.relkind IN ('r','p','v','m')
                  AND n.nspname NOT IN ('pg_catalog','information_schema')
                  AND has_schema_privilege(:u, n.nspname, 'USAGE')
                  AND has_table_privilege(:u, c.oid, 'SELECT')
                ORDER BY n.nspname, c.relname, a.attnum
                """
            ),
            {"u": username},
        ).fetchall()

    schema_dict: dict[str, list[str]] = {}
    for schema, table, col, dtype in rows:
        key = f"{schema}.{table}"
        schema_dict.setdefault(key, []).append(f"{col} ({dtype})")

    docs = [f"Table: {t}\nColumns: {', '.join(cols)}" for t, cols in schema_dict.items()]
    return docs

# ======================
# LLM / SQL helpers
# ======================

def _get_pplx_key() -> str | None:
    """
    Read the Perplexity API key from env. Supports either PERPLEXITY_API_KEY or PPLX_API_KEY.
    Returns None if not set or empty.
    """
    key = os.getenv("PERPLEXITY_API_KEY") or os.getenv("PPLX_API_KEY")
    key = (key or "").strip()
    return key or None


def clean_sql_output(raw_sql: str) -> str:
    """
    Normalize model output to a single clean SQL statement:
    - strip ```sql fences
    - drop helper/explanatory lines (e.g. 'To get ...')
    - ensure trailing semicolon
    """
    cleaned = re.sub(r"```sql|```", "", raw_sql, flags=re.IGNORECASE).strip()
    lines = [line for line in cleaned.splitlines() if not line.strip().lower().startswith("to get")]
    sql = "\n".join(lines).strip().rstrip(";") + ";"
    return sql


def english_to_sql(
    prompt: str,
    schema_context: str,
    allowed_tables_note: str | None = None,
) -> str:
    """
    Convert English to SQL.
    Tries Gemini first — if quota exceeded or unavailable, falls back to Ollama.
    """
    rules = (
        "- Return ONLY the SQL query, nothing else.\n"
        "- No explanations, no markdown, no code fences.\n"
        "- Always prefix table names with schema (e.g. public.patients).\n"
        "- Use standard PostgreSQL syntax.\n"
        "- End with a semicolon."
    )
    if allowed_tables_note:
        rules += f"\n- Only use these tables: {allowed_tables_note}"

    full_prompt = (
        f"You are a PostgreSQL expert.\n"
        f"Schema:\n{schema_context}\n\n"
        f"Rules:\n{rules}\n\n"
        f"Question: {prompt}\n\nSQL:"
    )

    gemini_key = _get_gemini_key()

    # ── 1. Try Gemini ────────────────────────────────────────────────
    if gemini_key:
        payload = {
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {"temperature": 0.0, "maxOutputTokens": 512},
        }
        try:
            resp = requests.post(
                f"{GEMINI_API_URL}?key={gemini_key}",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
        except Exception as e:
            raise RuntimeError(f"Gemini connection error: {str(e).replace(gemini_key, '***')}")

        if resp.status_code == 429:
            # Try Ollama if available, otherwise raise a clear message
            if _ollama_available():
                print("⏳ Gemini quota reached — using Ollama")
            else:
                raise RuntimeError(
                    "Gemini quota reached for today. "
                    "Create a NEW key at aistudio.google.com/apikey "
                    "(use 'Create in new project') and update .env file."
                )
        elif not resp.ok:
            raise RuntimeError(
                f"Gemini returned status {resp.status_code}. "
                f"Check that your API key is valid and from aistudio.google.com."
            )
        else:
            try:
                sql_raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                return clean_sql_output(sql_raw)
            except (KeyError, IndexError):
                raise RuntimeError("Gemini returned an unexpected response format.")

    # ── 2. Fallback: Ollama (local) ──────────────────────────────────
    if _ollama_available():
        print(f"✅ Using Ollama ({OLLAMA_MODEL})")
        try:
            sql_raw = _call_ollama(full_prompt)
            return clean_sql_output(sql_raw)
        except Exception as e:
            raise RuntimeError(f"Ollama error: {e}")

    # ── 3. Nothing available ─────────────────────────────────────────
    raise RuntimeError(
        "No AI key configured. Add GEMINI_API_KEY=your_key in the .env file."
    )


def run_query(sql: str, eng=None):
    """
    Execute SQL via SQLAlchemy and return a pandas DataFrame, or None on error.
    Accepts an optional engine override for per-user external DB connections.
    """
    _eng = eng or engine
    try:
        with _eng.connect() as conn:
            df = pd.read_sql_query(sql, conn)
        return df
    except Exception as e:
        print("❌ Error executing query:", e)
        return None


# ----------------------
# Lightweight SQL permission guard
# ----------------------
_schema_token = r'\"?([a-zA-Z_][\w$]*)\"?'
_table_token  = r'\"?([a-zA-Z_][\w$]*)\"?'
_schema_table_regex = re.compile(fr"{_schema_token}\s*\.\s*{_table_token}")

# SQL keywords that are never schema or table names
_SQL_KEYWORDS = {
    'select','from','where','and','or','not','join','on','as','group','order',
    'by','having','limit','offset','insert','update','delete','create','drop',
    'alter','into','values','set','case','when','then','else','end','null',
    'true','false','distinct','count','sum','avg','max','min','inner','outer',
    'left','right','full','cross','union','all','exists','in','between','like',
    'is','asc','desc','with','over','partition','filter','extract','date',
    'time','timestamp','interval','return','do','begin','commit','rollback',
}

def _extract_schema_tables(sql: str) -> set[tuple[str, str]]:
    """
    Finds schema.table references in SQL.
    Skips anything where schema or table is a SQL keyword (e.g. gender.SELECT).
    """
    found = set()
    for m in _schema_table_regex.finditer(sql):
        schema, table = m.group(1), m.group(2)
        if schema.lower() not in _SQL_KEYWORDS and table.lower() not in _SQL_KEYWORDS:
            found.add((schema, table))
    return found

def _allowed_pairs(username: str, eng=None) -> set[tuple[str, str]]:
    m = list_accessible_schemas_and_tables(username, eng=eng)
    return {(s, t) for s, tables in m.items() for t in tables}

def _verify_sql_access(sql: str, username: str, eng=None) -> tuple[bool, list[str]]:
    required = _extract_schema_tables(sql)
    allowed = _allowed_pairs(username, eng=eng)
    violations = [(s, t) for (s, t) in required if (s, t) not in allowed]
    return (len(violations) == 0, [f"{s}.{t}" for s, t in violations])

# ======================
# Main pipeline (permission-aware)
# ======================
def ask_database_structured_for_user(username: str, english_prompt: str, eng=None):
    """
    Returns: dict with { sql, columns, rows, empty, error } for a given Postgres role.
    Accepts optional engine override for external DB connections.
    """
    try:
        # Build a schema context only from user-visible tables
        user_docs = extract_schema_for_user(username, eng=eng)
        if not user_docs:
            return {
                "sql": None,
                "columns": [],
                "rows": [],
                "empty": True,
                "error": "No accessible tables found for your account.",
            }

        # Keep context to a sane size
        context = "\n\n".join(user_docs[:40])
        allowlist = ", ".join([doc.splitlines()[0].replace("Table: ", "") for doc in user_docs[:200]])

        sql = english_to_sql(english_prompt, context, allowed_tables_note=allowlist)

        ok, bad = _verify_sql_access(sql, username, eng=eng)
        if not ok:
            return {
                "sql": sql,
                "columns": [],
                "rows": [],
                "empty": True,
                "error": f"Query references objects you don't have access to: {', '.join(bad)}",
            }

        df = run_query(sql, eng=eng)
        if df is None:
            return {"sql": sql, "columns": [], "rows": [], "empty": True, "error": "Query failed."}
        if df.empty:
            return {"sql": sql, "columns": list(df.columns), "rows": [], "empty": True, "error": None}

        return {
            "sql": sql,
            "columns": list(df.columns),
            "rows": df.where(pd.notnull(df), None).values.tolist(),
            "empty": False,
            "error": None,
        }
    except Exception as e:
        return {"sql": None, "columns": [], "rows": [], "empty": True, "error": str(e)}

# ======================
# Legacy helper (kept)
# ======================
def get_schema_context(user_question, n=3):
    results = collection.query(query_texts=[user_question], n_results=n)
    return "\n\n".join(results["documents"][0]) if results["documents"] else ""

def ask_database(english_prompt: str):
    print(f"\n📝 English Prompt: {english_prompt}")
    schema_context = get_schema_context(english_prompt)
    print("📚 Retrieved schema context:\n", schema_context)
    sql = english_to_sql(english_prompt, schema_context)
    print("🔹 Generated SQL:", sql)
    df = run_query(sql)
    if df is not None and not df.empty:
        print(df.to_string(index=False))
    else:
        print("⚠️ No results or error in query.")
