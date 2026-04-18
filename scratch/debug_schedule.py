import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv()
import app.state_store as ss
from datetime import date

# Today's weekday number (1=Mon, 7=Sun in the DB)
today = date.today()
weekday_num = today.isoweekday()  # 1=Mon ... 7=Sun
print(f"Today: {today}, weekday: {weekday_num}")

# Get employees
emps = ss.list_employees()
teachers = [e for e in emps if e.get('role') == 'teacher']
print(f"\nTotal teachers: {len(teachers)}")
print("Sample teacher names:")
for t in teachers[:5]:
    print(f"  name={t.get('name')!r}  available={t.get('is_available')}")

# Get schedule rows
rows = ss.list_schedule_rows()
print(f"\nTotal schedule rows: {len(rows)}")

# Check a sample teacher's schedule
if teachers:
    t_name = teachers[0].get('name')
    from app.state_store import WEEKDAY_NUM_TO_LABEL
    weekday_label = WEEKDAY_NUM_TO_LABEL.get(weekday_num, str(weekday_num))
    print(f"\nLooking up teacher: {t_name!r}, weekday label: {weekday_label!r}")
    teacher_rows = [r for r in rows if r.get('teacher') == t_name]
    print(f"  All lessons for this teacher: {len(teacher_rows)}")
    for r in teacher_rows[:6]:
        print(f"    {r}")
    today_rows = [r for r in teacher_rows if r.get('day') == weekday_label]
    print(f"  Lessons today ({weekday_label}): {len(today_rows)}")
