"""
migrate_module3.py
Создаёт все таблицы для Модуля 3: расписание, кабинеты, предметы, ленты
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url  = os.getenv("SUPABASE_URL")
key  = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

sb: Client = create_client(url, key)

def run_sql(label: str, query: str):
    try:
        sb.rpc("exec_sql", {"query": query}).execute()
        print(f"  ✓ {label}")
    except Exception as e:
        err = str(e)
        if "already exists" in err or "duplicate" in err.lower():
            print(f"  ~ {label} (already exists)")
        else:
            print(f"  ✗ {label}: {err[:100]}")

# ─── DDL ────────────────────────────────────────────────────────
MIGRATIONS = [
("rooms", """
CREATE TABLE IF NOT EXISTS rooms (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    number     TEXT NOT NULL UNIQUE,
    capacity   INT DEFAULT 30,
    room_type  TEXT DEFAULT 'classroom',
    floor      INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
)
"""),
("subjects", """
CREATE TABLE IF NOT EXISTS subjects (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    short_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
)
"""),
("teacher_subjects", """
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
    UNIQUE(teacher_id, subject_id)
)
"""),
("teacher_constraints", """
CREATE TABLE IF NOT EXISTS teacher_constraints (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    day_of_week INT  NOT NULL,
    period      INT,
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
)
"""),
("subject_hours", """
CREATE TABLE IF NOT EXISTS subject_hours (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id     UUID NOT NULL REFERENCES subjects(id),
    hours_per_week INT NOT NULL DEFAULT 1,
    UNIQUE(class_id, subject_id)
)
"""),
("lenta_groups", """
CREATE TABLE IF NOT EXISTS lenta_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    subject_id  UUID REFERENCES subjects(id),
    day_of_week INT,
    period      INT,
    created_at  TIMESTAMPTZ DEFAULT now()
)
"""),
("lenta_group_members", """
CREATE TABLE IF NOT EXISTS lenta_group_members (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lenta_group_id UUID NOT NULL REFERENCES lenta_groups(id) ON DELETE CASCADE,
    class_id       UUID NOT NULL REFERENCES classes(id),
    teacher_id     UUID REFERENCES employees(id),
    room_id        UUID REFERENCES rooms(id),
    level_name     TEXT DEFAULT 'Beginner',
    UNIQUE(lenta_group_id, class_id)
)
"""),
("schedule_slots", """
CREATE TABLE IF NOT EXISTS schedule_slots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id            UUID REFERENCES classes(id),
    teacher_id          UUID REFERENCES employees(id),
    subject_id          UUID REFERENCES subjects(id),
    room_id             UUID REFERENCES rooms(id),
    day_of_week         INT  NOT NULL,
    period              INT  NOT NULL,
    slot_type           TEXT DEFAULT 'lesson',
    lenta_group_id      UUID REFERENCES lenta_groups(id),
    is_substitute       BOOL DEFAULT false,
    original_teacher_id UUID REFERENCES employees(id),
    note                TEXT,
    week_date           DATE,
    created_at          TIMESTAMPTZ DEFAULT now()
)
"""),
("employees columns", """
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS max_lessons_per_day  INT  DEFAULT 6,
    ADD COLUMN IF NOT EXISTS max_lessons_per_week INT  DEFAULT 30,
    ADD COLUMN IF NOT EXISTS subject_specialties  TEXT[]
"""),
]

print("=" * 55)
print("  MODULE 3 — DATABASE MIGRATION")
print("=" * 55)
for label, ddl in MIGRATIONS:
    print(f"\n→ {label}")
    run_sql(label, ddl.strip())

# ─── SEED: ROOMS ────────────────────────────────────────────────
print("\n" + "=" * 55)
print("  SEEDING ROOMS")
print("=" * 55)
rooms = [
    {"number":"101","name":"Кабинет 101",         "capacity":28,"room_type":"classroom","floor":1},
    {"number":"102","name":"Кабинет 102",         "capacity":28,"room_type":"classroom","floor":1},
    {"number":"103","name":"Кабинет 103",         "capacity":28,"room_type":"classroom","floor":1},
    {"number":"201","name":"Кабинет 201",         "capacity":28,"room_type":"classroom","floor":2},
    {"number":"202","name":"Кабинет 202",         "capacity":28,"room_type":"classroom","floor":2},
    {"number":"203","name":"Кабинет 203",         "capacity":28,"room_type":"classroom","floor":2},
    {"number":"204","name":"Кабинет 204",         "capacity":28,"room_type":"classroom","floor":2},
    {"number":"301","name":"Кабинет 301",         "capacity":28,"room_type":"classroom","floor":3},
    {"number":"302","name":"Кабинет математики",  "capacity":28,"room_type":"classroom","floor":3},
    {"number":"303","name":"Кабинет 303",         "capacity":28,"room_type":"classroom","floor":3},
    {"number":"304","name":"Кабинет 304",         "capacity":28,"room_type":"classroom","floor":3},
    {"number":"305","name":"Кабинет 305",         "capacity":28,"room_type":"classroom","floor":3},
    {"number":"lang1","name":"Лингафонный каб. 1","capacity":16,"room_type":"language","floor":2},
    {"number":"lang2","name":"Лингафонный каб. 2","capacity":16,"room_type":"language","floor":2},
    {"number":"lang3","name":"Лингафонный каб. 3","capacity":16,"room_type":"language","floor":2},
    {"number":"lang4","name":"Лингафонный каб. 4","capacity":16,"room_type":"language","floor":2},
    {"number":"gym", "name":"Спортивный зал",     "capacity":60,"room_type":"gym",     "floor":1},
    {"number":"hall","name":"Актовый зал",         "capacity":120,"room_type":"hall",   "floor":1},
    {"number":"lab", "name":"Лаборатория",         "capacity":24,"room_type":"lab",    "floor":3},
]
try:
    sb.table("rooms").upsert(rooms, on_conflict="number").execute()
    print(f"  ✓ {len(rooms)} rooms inserted")
except Exception as e:
    print(f"  ✗ rooms: {e}")

# ─── SEED: SUBJECTS ─────────────────────────────────────────────
print("  SEEDING SUBJECTS")
subjects_data = [
    {"name":"Математика",              "short_name":"Мат"},
    {"name":"Сингапурская математика", "short_name":"Синг."},
    {"name":"Казахский язык",          "short_name":"Каз."},
    {"name":"Русский язык",            "short_name":"Рус."},
    {"name":"Английский язык",         "short_name":"Англ"},
    {"name":"Литературное чтение",     "short_name":"Чтен"},
    {"name":"Окружающий мир",          "short_name":"ОМ"},
    {"name":"Физкультура",             "short_name":"Физ"},
    {"name":"Музыка",                  "short_name":"Муз"},
    {"name":"ИЗО",                     "short_name":"ИЗО"},
    {"name":"Технология",              "short_name":"Техн"},
    {"name":"Логика",                  "short_name":"Лог"},
    {"name":"Информатика",             "short_name":"ИКТ"},
    {"name":"Дежурство по этажу",      "short_name":"Деж"},
    {"name":"Методическое совещание",  "short_name":"Мет"},
]
try:
    sb.table("subjects").upsert(subjects_data, on_conflict="name").execute()
    print(f"  ✓ {len(subjects_data)} subjects inserted")
except Exception as e:
    print(f"  ✗ subjects: {e}")

# ─── SEED: SCHEDULE SLOTS (тестовое расписание) ─────────────────
print("\n" + "=" * 55)
print("  SEEDING SAMPLE SCHEDULE")
print("=" * 55)

# Получаем ID объектов
classes_r  = sb.table("classes").select("id,name,grade").order("grade").execute().data
teachers_r = sb.table("employees").select("id,name,role").eq("role","teacher").execute().data
rooms_r    = sb.table("rooms").select("id,number").execute().data
subjects_r = sb.table("subjects").select("id,name").execute().data

def find_id(lst, key, val):
    for x in lst:
        if x.get(key) == val:
            return x["id"]
    return None

# Маппинг для быстрого доступа
sub_map = {s["name"]: s["id"] for s in subjects_r}
room_map = {r["number"]: r["id"] for r in rooms_r}

# Берём первые 4 класса для демо-расписания
demo_classes = [c for c in classes_r if c["grade"] in (5,6,7,8)][:4]
demo_teachers = teachers_r[:4] if teachers_r else []

if not demo_classes or not demo_teachers:
    print("  ⚠ Not enough classes/teachers for demo schedule")
else:
    # Предметы для начальной/средней школы
    subject_list = [
        "Математика","Казахский язык","Русский язык",
        "Английский язык","Физкультура","Окружающий мир","ИЗО","Музыка"
    ]
    room_numbers = ["201","202","203","204"]
    
    slots = []
    for i, cls in enumerate(demo_classes):
        teacher_id = demo_teachers[i % len(demo_teachers)]["id"] if demo_teachers else None
        room_id    = room_map.get(room_numbers[i % len(room_numbers)])
        
        period_subj = 0
        for day in range(1, 6):      # пн-пт
            for period in range(1, 7): # 6 уроков
                subj_name = subject_list[period_subj % len(subject_list)]
                subject_id = sub_map.get(subj_name)
                period_subj += 1
                if not subject_id:
                    continue
                slots.append({
                    "class_id":   cls["id"],
                    "teacher_id": teacher_id,
                    "subject_id": subject_id,
                    "room_id":    room_id,
                    "day_of_week": day,
                    "period":     period,
                    "slot_type":  "lesson",
                })
    
    # Чистим старые демо-слоты и вставляем новые
    if demo_classes:
        class_ids = [c["id"] for c in demo_classes]
        for cid in class_ids:
            try:
                sb.table("schedule_slots").delete().eq("class_id", cid).is_("week_date", "null").execute()
            except: pass
    
    try:
        # Вставляем по 100 за раз
        for i in range(0, len(slots), 100):
            sb.table("schedule_slots").insert(slots[i:i+100]).execute()
        print(f"  ✓ {len(slots)} schedule slots inserted for {len(demo_classes)} classes")
    except Exception as e:
        print(f"  ✗ schedule_slots: {str(e)[:100]}")

print("\n✅ STEP 1 DONE — база данных готова")
print("   Запусти сервер и открой /schedule")
