"""
parse_schedule.py
=================
Парсит расписание из Excel-файла сложной структуры Aqbobek
и импортирует в Supabase.

Структура Excel:
  Col 0: Время / День / Перемена
  Col 1: Номер урока (1-9)
  Col 2,4,6,8...: Предмет + ФИО учителя (для каждого класса)
  Col 3,5,7,9...: Кабинет

Заголовки классов — в строке 1: 7A, 7B, 7C, 8A, 8B, 8C, 8D, 9A, 9B, 10A, 10B, 11A, 11B
"""
import sys, re
sys.stdout.reconfigure(encoding='utf-8')

import openpyxl
from supabase import create_client

SUPABASE_URL = "https://tutzawhhpklqodjagtha.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dHphd2hocGtscW9kamFndGhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQzNDMyNSwiZXhwIjoyMDkyMDEwMzI1fQ.jcHpPsu6s1h-lzycNYZ8oAheCE2kLVBer1KSbkN7J0o"

sb = create_client(SUPABASE_URL, SERVICE_KEY)

def clean(v):
    if v is None: return None
    s = str(v).replace('\xa0', '').strip()
    return s if s else None

DAY_MAP = {
    'дүйсенбі': 1, 'сейсенбі': 2, 'сәрсенбі': 3, 'бейсенбі': 4, 'жұма': 5,
    'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4, 'пятница': 5,
}

# ── Загружаем маппинги из БД ────────────────────────────────────────────────
print("Загружаем данные из БД...")
emp_res = sb.table("employees").select("id, name, subject").execute()
emp_map = {}  # часть_имени -> id
for e in emp_res.data:
    name = e["name"]
    emp_map[name.lower()] = e["id"]
    # Добавляем фамилию отдельно
    parts = name.split()
    if parts:
        emp_map[parts[0].lower()] = e["id"]

cls_res = sb.table("classes").select("id, name").execute()
cls_map = {c["name"]: c["id"] for c in cls_res.data}
print(f"Учителей: {len(emp_res.data)}, Классов: {len(cls_res.data)}")
print(f"Классы в БД: {list(cls_map.keys())}")

def find_teacher(text):
    """Ищет teacher_id по тексту 'Предмет ФамилияИ.О.'"""
    if not text: return None
    t = text.lower()
    # Сначала полное совпадение
    for name_lower, uid in emp_map.items():
        if name_lower in t:
            return uid
    return None

def find_class(name):
    """Ищет class_id по имени класса."""
    if not name: return None
    clean_name = name.strip().upper()
    trans = str.maketrans('АВСЕКМНОРТХ', 'ABCEKMHOPTX')
    clean_name = clean_name.translate(trans)
    return cls_map.get(clean_name) or cls_map.get(name)

def extract_subject(text):
    """Извлекает название предмета из 'Предмет ФамилияИ.О.'"""
    if not text: return None
    # Убираем ФИО в конце (Слово с заглавной + инициалы)
    # Формат: "алгебра Нажмадинов М.А." или "Физика Сунгариева А.Б."
    m = re.match(r'^(.*?)\s+[А-ЯЁҚҮҰӘІҢҒҺа-яёқүұәіңғһ][а-яёқүұәіңғһ]+(?:\s+[А-ЯЁҚ]\.[А-ЯЁҚ]\.?)?$', text)
    if m:
        return m.group(1).strip()
    # Просто берём первое слово/словосочетание до имени
    parts = text.split()
    if len(parts) >= 2:
        # Если последнее слово похоже на инициалы (А.Б.)
        if re.match(r'^[А-ЯЁҚ]\.[А-ЯЁҚ]', parts[-1]):
            return ' '.join(parts[:-2])  # убираем фамилию и инициалы
    return parts[0] if parts else text

# ── Парсим расписание ────────────────────────────────────────────────────────
wb = openpyxl.load_workbook("для хакатона расписание.xlsx", data_only=True)
ws = wb["сабақ кестесі"]

all_rows = list(ws.iter_rows(values_only=True))

# Строка 4 — заголовки классов (индекс 3)
# Структура: [Время, №, 7A, каб, 7B, каб, 7C, каб, 8A, каб, ...]
header_row = [clean(c) for c in all_rows[3]]
print(f"\nЗаголовки: {header_row[:24]}")

# Определяем какие классы и в каких колонках
class_cols = []  # список (col_idx_subject, col_idx_room, class_name)
i = 2
while i < len(header_row):
    h = header_row[i]
    if h and re.match(r'^\d+[А-ЯA-Z]', h, re.IGNORECASE):
        room_col = i + 1 if (i + 1) < len(header_row) else None
        class_cols.append((i, room_col, h))
    i += 1

print(f"Классы найдены: {[(c[2], c[0]) for c in class_cols]}")

# ── Парсим строки ─────────────────────────────────────────────────────────
schedule_records = []
current_day = 1  # По умолчанию понедельник

for row_idx, raw_row in enumerate(all_rows[1:], start=2):
    row = [clean(c) for c in raw_row]
    
    col0 = row[0] if row else None
    col1 = row[1] if len(row) > 1 else None
    
    if not col0:
        continue
    
    # Проверяем — это строка с днём недели?
    col0_lower = col0.lower().strip()
    for day_kz, day_num in DAY_MAP.items():
        if day_kz in col0_lower:
            current_day = day_num
            break
    
    # Проверяем — это строка с уроком? (col1 — цифра 1-9)
    period_num = None
    if col1 and re.match(r'^\d$', col1.strip()):
        period_num = int(col1.strip())
    
    if period_num is None:
        continue  # Это перемена или заголовок
    
    # Обходим все классы
    for subj_col, room_col, class_name in class_cols:
        if subj_col >= len(row):
            continue
        
        cell_text = row[subj_col]
        room_text = row[room_col] if room_col and room_col < len(row) else None
        
        if not cell_text or cell_text in {'.', '-', 'None'}:
            continue
        
        # Пропускаем перемены/завтраки
        skip_words = ['ас ', 'прогулка', 'тиін', 'танғы', 'таңғы', 'түскі', 'полдник']
        if any(w in cell_text.lower() for w in skip_words):
            continue
        
        subject = extract_subject(cell_text)[:100]
        teacher_id = find_teacher(cell_text)
        class_id = find_class(class_name)
        
        # Убираем мусорные кабинеты
        room = None
        if room_text and room_text not in {'.', '-', 'None'} and len(room_text) < 20:
            room = room_text[:20]
        
        schedule_records.append({
            "class_id":    class_id,
            "employee_id": teacher_id,
            "subject":     subject,
            "day_of_week": current_day,
            "period":      period_num,
            "room":        room,
        })

print(f"\nРасписаний распарсено: {len(schedule_records)}")

# Примеры
print("\nПримеры:")
for r in schedule_records[:5]:
    print(f"  {r}")

# ── Записываем в БД ──────────────────────────────────────────────────────────
if schedule_records:
    # Сначала удаляем старые
    sb.table("schedules").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    
    batch = 100
    for i in range(0, len(schedule_records), batch):
        sb.table("schedules").insert(schedule_records[i:i+batch]).execute()
    
    print(f"\nВставлено в БД: {len(schedule_records)} записей расписания")

r = sb.table("schedules").select("id", count="exact").execute()
print(f"Итого в schedules: {r.count}")
