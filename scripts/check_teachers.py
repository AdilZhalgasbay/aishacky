from supabase import create_client
import os; from dotenv import load_dotenv; load_dotenv()
sb = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY'))

classes = sb.table('classes').select('id,name').order('grade').execute().data
cls = classes[0]
slots = sb.table('schedule_slots').select('day_of_week,period,teacher:employees!schedule_slots_teacher_id_fkey(name),subjects(name)').eq('class_id', cls['id']).is_('week_date', 'null').order('day_of_week').order('period').execute().data

print(f"Class: {cls['name']}")
for s in slots[:10]:
    teacher = s.get('teacher')['name'] if s.get('teacher') else '???'
    subject = s.get('subjects')['name'] if s.get('subjects') else '???'
    print(f"  Day {s['day_of_week']} Period {s['period']}: {subject[:20]:20} -> {teacher}")

teachers_in_class = set()
for s in slots:
    if s.get('teacher'):
        teachers_in_class.add(s['teacher']['name'])
print(f"Unique teachers for {cls['name']}: {len(teachers_in_class)}")
