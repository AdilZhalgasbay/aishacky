import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

def find_aigul():
    # Fetch all employees
    res = supabase.table("employees").select("*").execute()
    employees = res.data
    
    # Filter for names containing 'Айгуль' (using both Cyrillic and Latin if needed, but here it's Cyrillic)
    target = "Айгуль"
    matches = [e for e in employees if target in e['name']]
    
    print(f"Found {len(matches)} matches for '{target}':")
    for m in matches:
        print(f"ID: {m['id']}, Role: {m['role']}, Name: {m['name']}, TG: {m.get('tg_chat_id')}")

if __name__ == "__main__":
    find_aigul()
