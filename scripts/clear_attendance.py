import os
import httpx
from dotenv import load_dotenv
from pathlib import Path

# Load env
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

def clear_attendance():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Error: Supabase config not found in .env")
        return

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    
    # Check current count
    try:
        resp = httpx.get(f"{SUPABASE_URL}/rest/v1/attendance_logs?select=count", headers=headers)
        resp.raise_for_status()
        count = resp.json()
        print(f"Current logs in attendance_logs: {count}")
    except Exception as e:
        print(f"Error fetching count: {e}")

    # Delete all
    print("Clearing attendance_logs...")
    try:
        # To delete all rows with Supabase REST API, we need to provide a filter that matches all rows
        # Since 'id' is always not null, id=not.is.null works
        resp = httpx.delete(f"{SUPABASE_URL}/rest/v1/attendance_logs?id=not.is.null", headers=headers)
        resp.raise_for_status()
        print("Successfully cleared attendance_logs.")
    except Exception as e:
        print(f"Error clearing logs: {e}")

if __name__ == "__main__":
    clear_attendance()
