import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

def cleanup_directors():
    # 1. List all directors
    res = supabase.table("employees").select("*").eq("role", "director").execute()
    directors = res.data
    
    print(f"Found {len(directors)} directors:")
    for d in directors:
        print(f"ID: {d['id']}, Name: {d['name']}, TG: {d.get('tg_chat_id')}")
    
    if len(directors) <= 1:
        print("No duplicates found.")
        return

    # 2. Logic to keep only one
    # Keep the one with a tg_chat_id if exists, otherwise keep the first one
    to_keep = None
    for d in directors:
        if d.get("tg_chat_id"):
            to_keep = d
            break
    
    if not to_keep:
        to_keep = directors[0]
        
    print(f"\nKeeping: {to_keep['id']} ({to_keep['name']})")
    
    for d in directors:
        if d['id'] != to_keep['id']:
            print(f"Deleting duplicate: {d['id']} ({d['name']})")
            supabase.table("employees").delete().eq("id", d['id']).execute()

if __name__ == "__main__":
    cleanup_directors()
