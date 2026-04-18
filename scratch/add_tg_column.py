
import os
import httpx
from dotenv import load_dotenv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_PROJECT_ID = os.getenv("SUPABASE_PROJECT_ID", "")
SUPABASE_MANAGEMENT_TOKEN = os.getenv("SUPABASE_MANAGEMENT_TOKEN", "")

def run_sql(sql):
    if not SUPABASE_PROJECT_ID or not SUPABASE_MANAGEMENT_TOKEN:
        print("Missing SUPABASE_PROJECT_ID or SUPABASE_MANAGEMENT_TOKEN")
        return
    
    url = f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_ID}/database/query"
    headers = {
        "Authorization": f"Bearer {SUPABASE_MANAGEMENT_TOKEN}",
        "Content-Type": "application/json",
    }
    print(f"Executing SQL on project {SUPABASE_PROJECT_ID}...")
    try:
        response = httpx.post(url, headers=headers, json={"query": sql}, timeout=30)
        response.raise_for_status()
        print("SQL executed successfully!")
        print(response.json())
    except Exception as e:
        print(f"Error executing SQL: {e}")
        if hasattr(e, 'response'):
            print(e.response.text)

if __name__ == "__main__":
    sql = "ALTER TABLE employees ADD COLUMN IF NOT EXISTS telegram_username TEXT;"
    run_sql(sql)
