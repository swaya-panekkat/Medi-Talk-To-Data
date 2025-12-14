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
# Perplexity API (Sonar Pro)
# ======================
PPLX_API_URL = "https://api.perplexity.ai/chat/completions"

def _get_pplx_key() -> str | None:
    # Read on demand, so .env/exports picked up even if module was imported earlier
    return os.getenv("PERPLEXITY_API_KEY") or os.getenv("PPLX_API_KEY")


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
def list_accessible_schemas_and_tables(username: str) -> dict[str, list[str]]:
    """
    Return {schema: [table,...]} for which `username` has USAGE on schema
    and SELECT on table.
    """
    with engine.connect() as conn:
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

def extract_schema_for_user(username: str) -> list[str]:
    """
    Build docs like "Table: schema.table\nColumns: ..." but filtered to user's privileges.
    """
    with engine.connect() as conn:
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
    Convert English to SQL using Perplexity Sonar Pro.
    `schema_context` should contain lines like: "Table: schema.table\nColumns: col(dt), ..."
    Optionally pass `allowed_tables_note` as a comma-separated list of schema.table
    to hard-hint the model to stay within the user’s permissions.
    """
    api_key = _get_pplx_key()
    if not api_key:
        raise RuntimeError("PERPLEXITY_API_KEY environment variable is not set.")

    rules = """
- Return ONLY a single SQL query (no explanations, no markdown).
- Always use the provided schema and table names exactly.
- Always include schema name (e.g., schema.table).
- Prefer explicit JOINs with ON conditions.
- Do not use backticks or MySQL syntax.
""".strip()

    if allowed_tables_note:
        rules += f"\n- You MUST only use tables from this allowlist: {allowed_tables_note}\n"

    system_prompt = f"""
You are an assistant that converts English into SQL queries.
Database: PostgreSQL.

Relevant schema information:
{schema_context}

Rules:
{rules}
""".strip()

    payload = {
        "model": "sonar-pro",
        "temperature": 0.0,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "return_citations": False,
        "stream": False,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        resp = requests.post(PPLX_API_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        sql_raw = data["choices"][0]["message"]["content"].strip()
    except requests.HTTPError as http_err:
        # Bubble up a concise message (keeps stack in server logs)
        raise RuntimeError(f"Perplexity API error: {http_err.response.status_code} {http_err.response.text[:200]}") from http_err
    except (KeyError, IndexError) as parse_err:
        raise RuntimeError(f"Unexpected Perplexity response shape: {resp.text[:400]}") from parse_err
    except Exception as e:
        raise RuntimeError(f"Perplexity request failed: {e}") from e

    return clean_sql_output(sql_raw)


def run_query(sql: str):
    """
    Execute SQL via SQLAlchemy and return a pandas DataFrame, or None on error.
    """
    try:
        with engine.connect() as conn:
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

def _extract_schema_tables(sql: str) -> set[tuple[str, str]]:
    """
    Very simple parser: finds tokens that look like schema.table.
    It intentionally ignores unqualified names and alias.column pairs.
    """
    found = set()
    for m in _schema_table_regex.finditer(sql):
        schema, table = m.group(1), m.group(2)
        found.add((schema, table))
    return found

def _allowed_pairs(username: str) -> set[tuple[str, str]]:
    m = list_accessible_schemas_and_tables(username)
    return {(s, t) for s, tables in m.items() for t in tables}

def _verify_sql_access(sql: str, username: str) -> tuple[bool, list[str]]:
    required = _extract_schema_tables(sql)
    allowed = _allowed_pairs(username)
    violations = [(s, t) for (s, t) in required if (s, t) not in allowed]
    return (len(violations) == 0, [f"{s}.{t}" for s, t in violations])

# ======================
# Main pipeline (permission-aware)
# ======================
def ask_database_structured_for_user(username: str, english_prompt: str):
    """
    Returns: dict with { sql, columns, rows, empty, error } for a given Postgres role.
    """
    try:
        # Build a schema context only from user-visible tables
        user_docs = extract_schema_for_user(username)
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

        ok, bad = _verify_sql_access(sql, username)
        if not ok:
            return {
                "sql": sql,
                "columns": [],
                "rows": [],
                "empty": True,
                "error": f"Query references objects you don't have access to: {', '.join(bad)}",
            }

        df = run_query(sql)
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
