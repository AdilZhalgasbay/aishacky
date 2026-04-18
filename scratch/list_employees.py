import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

def list_all():
    res = supabase.table("employees").select("*").execute()
    employees = res.data
    
    print(f"Total employees: {len(employees)}")
    for e in employees:
        # Avoid printing corrupted non-ascii characters directly in a way that breaks output
        safe_name = e['name'].encode('ascii', errors='replace').decode()
        print(f"ID: {e['id']}, Role: {e['role']}, Name: {safe_name}, TG: {e.get('tg_chat_id')}")

if __name__ == "__main__":
    list_all()
