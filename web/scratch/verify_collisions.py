import requests
import json

SUPABASE_URL = "https://tutzawhhpklqodjagtha.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dHphd2hocGtscW9kamFndGhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQzNDMyNSwiZXhwIjoyMDkyMDEwMzI1fQ.jcHpPsu6s1h-lzycNYZ8oAheCE2kLVBer1KSbkN7J0o"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# Fetching all slots with teacher name, slot type, and created_at
url = f"{SUPABASE_URL}/rest/v1/schedule_slots?select=day_of_week,period,teacher_id,class_id,slot_type,created_at,teacher:employees!schedule_slots_teacher_id_fkey(name)&week_date=is.null"
resp = requests.get(url, headers=headers)
slots = resp.json()

collisions = {}
for s in slots:
    key = (s['day_of_week'], s['period'], s['teacher_id'])
    if key not in collisions:
        collisions[key] = []
    collisions[key].append(s)

# Filter only real collisions
actual_errors = []
ribbon_dist = {} # (day, period) -> count

for s in slots:
    if s['slot_type'] == 'lenta':
        key = (s['day_of_week'], s['period'])
        ribbon_dist[key] = ribbon_dist.get(key, 0) + 1

for (day, per, tid), list_slots in collisions.items():
    if len(list_slots) <= 1:
        continue
    
    slot_types = [s['slot_type'] for s in list_slots]
    if all(st == 'lenta' for st in slot_types):
        continue
    
    actual_errors.append(((day, per, tid), list_slots))

print("--- RIBBON DISTRIBUTION ---")
for (d, p), count in sorted(ribbon_dist.items()):
    print(f"Day {d}, Period {p}: {count} slots (classes)")

print("\n--- COLLISION CHECK ---")
if not actual_errors:
    print("NO REAL COLLISIONS FOUND!")
else:
    print(f"FOUND {len(actual_errors)} REAL COLLISIONS!")
    for (day, per, tid), list_slots in actual_errors:
        t_name = list_slots[0]['teacher']['name']
        print(f"Day {day}, Period {per}: Teacher '{t_name}' ({tid})")
        for s in list_slots:
             print(f"  - ClassID: {s['class_id']}, SlotType: {s['slot_type']}, CreatedAt: {s['created_at']}")
