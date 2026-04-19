import requests
import json

SUPABASE_URL = "https://tutzawhhpklqodjagtha.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dHphd2hocGtscW9kamFndGhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQzNDMyNSwiZXhwIjoyMDkyMDEwMzI1fQ.jcHpPsu6s1h-lzycNYZ8oAheCE2kLVBer1KSbkN7J0o"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# Inspect Day 1 Period 5
url = f"{SUPABASE_URL}/rest/v1/schedule_slots?day_of_week=eq.1&period=eq.5&week_date=is.null&select=*,teacher:employees(name),class:classes(name),subject:subjects(name)"

resp = requests.get(url, headers=headers)
slots = resp.json()

print(json.dumps(slots, indent=2, ensure_ascii=False))
