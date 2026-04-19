import os
from supabase import create_client

url = "https://tutzawhhpklqodjagtha.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dHphd2hocGtscW9kamFndGhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQzNDMyNSwiZXhwIjoyMDkyMDEwMzI1fQ.jcHpPsu6s1h-lzycNYZ8oAheCE2kLVBer1KSbkN7J0o"

supabase = create_client(url, key)

print("--- Lenta Groups ---")
res = supabase.table("lenta_groups").select("*").execute()
print(res.data)

print("\n--- Lenta Group Members ---")
res = supabase.table("lenta_group_members").select("*, classes(name), employees(name), rooms(number)").execute()
print(res.data)
