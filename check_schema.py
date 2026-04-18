import os
import sys, requests, json
from dotenv import load_dotenv
sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

TOKEN = os.getenv('SUPABASE_MANAGEMENT_TOKEN', '')
PROJECT = os.getenv('SUPABASE_PROJECT_ID', '')
SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')

# Query information_schema directly via PostgREST
BASE = f'https://{PROJECT}.supabase.co'
headers = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json'
}

sql = """
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
"""

r = requests.post(
    f'{BASE}/rest/v1/rpc/exec_sql',
    headers=headers,
    json={'sql': sql}
)

if not r.ok:
    # Try direct SQL via pg endpoint
    r2 = requests.post(
        f'https://api.supabase.com/v1/projects/{PROJECT}/database/query',
        headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'},
        json={'query': sql}
    )
    print('Query status:', r2.status_code)
    if r2.ok:
        rows = r2.json()
        current_table = None
        for row in rows:
            t = row.get('table_name')
            if t != current_table:
                current_table = t
                print(f'\nTABLE: {t}')
            print(f"  - {row.get('column_name')}: {row.get('data_type')}")
    else:
        print('Error:', r2.text[:500])
else:
    print(r.json())
