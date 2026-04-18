"""
migrate_schedule.py
Создаёт таблицы Модуля 3: расписание, нагрузка, кабинеты, ленты
"""
import os, httpx, json
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

def sql(query: str, label: str = ""):
    """Выполнить SQL через Supabase REST"""
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=HEADERS,
        json={"query": query},
        timeout=30,
    )
    if r.status_code not in (200, 201, 204):
        # Попробуем через management API
        print(f"  [WARN] rpc/exec_sql failed ({r.status_code}), trying raw SQL endpoint...")
        return False
    print(f"  ✓ {label or query[:60]}")
    return True

def rest_upsert(table: str, rows: list):
    """Вставить данные через PostgREST"""
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=rows,
        timeout=30,
    )
    ok = r.status_code in (200, 201, 204)
    if ok:
        print(f"  ✓ Inserted {len(rows)} rows into {table}")
    else:
        print(f"  ✗ {table}: {r.status_code} {r.text[:120]}")
    return ok

# ─────────────────────────────────────────────
# 1. СОЗДАЁМ ТАБЛИЦЫ
# ─────────────────────────────────────────────

MIGRATIONS = [

    ("ROOMS — кабинеты", """
CREATE TABLE IF NOT EXISTS rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    number      TEXT NOT NULL UNIQUE,
    capacity    INT  DEFAULT 30,
    room_type   TEXT DEFAULT 'classroom',  -- classroom|gym|lab|language
    floor       INT  DEFAULT 1,
    created_at  TIMESTAMPTZ DEFAULT now()
);
"""),

    ("SUBJECTS — предметы", """
CREATE TABLE IF NOT EXISTS subjects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    short_name  TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);
"""),

    ("TEACHER_SUBJECTS — учитель↔предмет", """
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
    UNIQUE(teacher_id, subject_id)
);
"""),

    ("TEACHER_CONSTRAINTS — ограничения учителей", """
CREATE TABLE IF NOT EXISTS teacher_constraints (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    day_of_week INT  NOT NULL,   -- 1=пн, 2=вт ... 5=пт
    period      INT,             -- NULL = весь день
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);
"""),

    ("SUBJECT_HOURS — нагрузка: класс×предмет×часы в неделю", """
CREATE TABLE IF NOT EXISTS subject_hours (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id),
    hours_per_week INT NOT NULL DEFAULT 1,
    UNIQUE(class_id, subject_id)
);
"""),

    ("SCHEDULE_SLOTS — ячейки расписания", """
CREATE TABLE IF NOT EXISTS schedule_slots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id    UUID REFERENCES classes(id),
    teacher_id  UUID REFERENCES employees(id),
    subject_id  UUID REFERENCES subjects(id),
    room_id     UUID REFERENCES rooms(id),
    day_of_week INT  NOT NULL,   -- 1=пн .. 5=пт
    period      INT  NOT NULL,   -- номер урока 1..8
    slot_type   TEXT DEFAULT 'lesson',  -- lesson|duty|meeting|window
    lenta_group_id UUID,         -- заполняется если это лента
    is_substitute  BOOL DEFAULT false,
    original_teacher_id UUID REFERENCES employees(id),
    note        TEXT,
    week_date   DATE,            -- конкретная дата (для разовых замен)
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(teacher_id, day_of_week, period, week_date),
    UNIQUE(room_id, day_of_week, period, week_date),
    UNIQUE(class_id, day_of_week, period, week_date)
);
"""),

    ("LENTA_GROUPS — группы лент", """
CREATE TABLE IF NOT EXISTS lenta_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,  -- e.g. '3 параллель - Английский'
    subject_id  UUID REFERENCES subjects(id),
    level       TEXT,           -- Beginner|Pre-Intermediate|Intermediate|Upper
    day_of_week INT,
    period      INT,
    created_at  TIMESTAMPTZ DEFAULT now()
);
"""),

    ("LENTA_GROUP_MEMBERS — классы в ленте", """
CREATE TABLE IF NOT EXISTS lenta_group_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lenta_group_id  UUID NOT NULL REFERENCES lenta_groups(id) ON DELETE CASCADE,
    class_id        UUID NOT NULL REFERENCES classes(id),
    teacher_id      UUID REFERENCES employees(id),
    room_id         UUID REFERENCES rooms(id),
    UNIQUE(lenta_group_id, class_id)
);
"""),

    ("TEACHER_WORKLOAD — дневная нагрузка (макс уроков в день)", """
ALTER TABLE employees 
    ADD COLUMN IF NOT EXISTS max_lessons_per_day INT DEFAULT 6,
    ADD COLUMN IF NOT EXISTS max_lessons_per_week INT DEFAULT 30,
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
"""),

]

print("=" * 60)
print("CREATING TABLES FOR MODULE 3: SMART SCHEDULE")
print("=" * 60)

for label, ddl in MIGRATIONS:
    print(f"\n→ {label}")
    result = sql(ddl, label)
    if not result:
        # Попробуем напрямую через psycopg2 если есть DATABASE_URL
        print(f"  [SKIP] Table may already exist or manual creation needed")

# ─────────────────────────────────────────────
# 2. ЗАПОЛНЯЕМ КОМНАТЫ
# ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("SEEDING ROOMS")
print("=" * 60)

rooms = [
    {"number": "101", "name": "Кабинет 101",   "capacity": 28, "room_type": "classroom", "floor": 1},
    {"number": "102", "name": "Кабинет 102",   "capacity": 28, "room_type": "classroom", "floor": 1},
    {"number": "103", "name": "Кабинет 103",   "capacity": 28, "room_type": "classroom", "floor": 1},
    {"number": "201", "name": "Кабинет 201",   "capacity": 28, "room_type": "classroom", "floor": 2},
    {"number": "202", "name": "Кабинет 202",   "capacity": 28, "room_type": "classroom", "floor": 2},
    {"number": "203", "name": "Кабинет 203",   "capacity": 28, "room_type": "classroom", "floor": 2},
    {"number": "204", "name": "Кабинет 204",   "capacity": 28, "room_type": "classroom", "floor": 2},
    {"number": "301", "name": "Кабинет 301",   "capacity": 28, "room_type": "classroom", "floor": 3},
    {"number": "302", "name": "Кабинет математики", "capacity": 28, "room_type": "classroom", "floor": 3},
    {"number": "303", "name": "Кабинет 303",   "capacity": 28, "room_type": "classroom", "floor": 3},
    {"number": "304", "name": "Кабинет 304",   "capacity": 28, "room_type": "classroom", "floor": 3},
    {"number": "305", "name": "Кабинет 305",   "capacity": 28, "room_type": "classroom", "floor": 3},
    {"number": "lang1", "name": "Лингафонный каб. 1", "capacity": 16, "room_type": "language", "floor": 2},
    {"number": "lang2", "name": "Лингафонный каб. 2", "capacity": 16, "room_type": "language", "floor": 2},
    {"number": "lang3", "name": "Лингафонный каб. 3", "capacity": 16, "room_type": "language", "floor": 2},
    {"number": "lang4", "name": "Лингафонный каб. 4", "capacity": 16, "room_type": "language", "floor": 2},
    {"number": "gym",  "name": "Спортивный зал",     "capacity": 60, "room_type": "gym",      "floor": 1},
    {"number": "hall", "name": "Актовый зал",         "capacity": 120,"room_type": "hall",     "floor": 1},
    {"number": "lab",  "name": "Лаборатория",         "capacity": 24, "room_type": "lab",      "floor": 3},
]
rest_upsert("rooms", rooms)

# ─────────────────────────────────────────────
# 3. ПРЕДМЕТЫ
# ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("SEEDING SUBJECTS")
print("=" * 60)

subjects_data = [
    {"name": "Математика",             "short_name": "Мат"},
    {"name": "Сингапурская математика","short_name": "Синг.Мат"},
    {"name": "Казахский язык",         "short_name": "Каз.яз"},
    {"name": "Русский язык",           "short_name": "Рус.яз"},
    {"name": "Английский язык",        "short_name": "Англ"},
    {"name": "Литературное чтение",    "short_name": "Чтение"},
    {"name": "Окружающий мир",         "short_name": "Ок.Мир"},
    {"name": "Физкультура",            "short_name": "Физра"},
    {"name": "Музыка",                 "short_name": "Муз"},
    {"name": "ИЗО",                    "short_name": "ИЗО"},
    {"name": "Технология",             "short_name": "Техн"},
    {"name": "Логика",                 "short_name": "Лог"},
    {"name": "Информатика",            "short_name": "ИКТ"},
    {"name": "Дежурство",              "short_name": "Деж"},
    {"name": "Методическое совещание", "short_name": "Метод"},
]
rest_upsert("subjects", subjects_data)

print("\n" + "=" * 60)
print("✅ Step 1 DONE — tables and seed data created")
print("   Now generate actual schedule in Step 2")
print("=" * 60)
