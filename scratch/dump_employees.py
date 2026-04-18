import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

def dump_employees():
    res = supabase.table("employees").select("*").execute()
    with open("scratch/employees_dump.json", "w", encoding="utf-8") as f:
        json.dump(res.data, f, ensure_ascii=False, indent=2)
    print(f"Dumped {len(res.data)} employees to scratch/employees_dump.json")

if __name__ == "__main__":
    dump_employees()
