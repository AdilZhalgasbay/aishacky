-- ============================================================
-- MODULE 3: SMART SCHEDULE — DATABASE MIGRATION
-- Запусти в Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Кабинеты
CREATE TABLE IF NOT EXISTS rooms (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    number     TEXT NOT NULL UNIQUE,
    capacity   INT DEFAULT 30,
    room_type  TEXT DEFAULT 'classroom',
    floor      INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Предметы
CREATE TABLE IF NOT EXISTS subjects (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    short_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Учитель -> Предметы (многие-ко-многим)
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
    UNIQUE(teacher_id, subject_id)
);

-- 4. Ограничения учителей (недоступность)
CREATE TABLE IF NOT EXISTS teacher_constraints (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    day_of_week INT  NOT NULL,
    period      INT,
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 5. Нагрузка: сколько часов в неделю предмет идёт у класса
CREATE TABLE IF NOT EXISTS subject_hours (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id     UUID NOT NULL REFERENCES subjects(id),
    hours_per_week INT NOT NULL DEFAULT 1,
    UNIQUE(class_id, subject_id)
);

-- 6. Группы "лент" (параллельный английский по уровням)
CREATE TABLE IF NOT EXISTS lenta_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    subject_id  UUID REFERENCES subjects(id),
    day_of_week INT,
    period      INT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 7. Классы внутри ленты
CREATE TABLE IF NOT EXISTS lenta_group_members (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lenta_group_id UUID NOT NULL REFERENCES lenta_groups(id) ON DELETE CASCADE,
    class_id       UUID NOT NULL REFERENCES classes(id),
    teacher_id     UUID REFERENCES employees(id),
    room_id        UUID REFERENCES rooms(id),
    level_name     TEXT DEFAULT 'Beginner',
    UNIQUE(lenta_group_id, class_id)
);

-- 8. Ячейки расписания (основная таблица)
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
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_schedule_teacher   ON schedule_slots(teacher_id, day_of_week, period);
CREATE INDEX IF NOT EXISTS idx_schedule_class      ON schedule_slots(class_id,   day_of_week, period);
CREATE INDEX IF NOT EXISTS idx_schedule_room       ON schedule_slots(room_id,    day_of_week, period);
CREATE INDEX IF NOT EXISTS idx_schedule_week_date  ON schedule_slots(week_date);

-- 9. Расширяем таблицу employees
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS max_lessons_per_day  INT DEFAULT 6,
    ADD COLUMN IF NOT EXISTS max_lessons_per_week INT DEFAULT 30,
    ADD COLUMN IF NOT EXISTS subject_specialties  TEXT[];

-- RLS (пока открытые, для хакатона)
ALTER TABLE rooms                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_constraints   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_hours         ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lenta_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lenta_group_members   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rooms'              AND policyname='service_all_rooms')               THEN CREATE POLICY "service_all_rooms"               ON rooms               FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subjects'           AND policyname='service_all_subjects')            THEN CREATE POLICY "service_all_subjects"            ON subjects             FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_subjects'   AND policyname='service_all_teacher_subjects')    THEN CREATE POLICY "service_all_teacher_subjects"    ON teacher_subjects     FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_constraints'AND policyname='service_all_teacher_constraints') THEN CREATE POLICY "service_all_teacher_constraints" ON teacher_constraints  FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subject_hours'      AND policyname='service_all_subject_hours')       THEN CREATE POLICY "service_all_subject_hours"       ON subject_hours        FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_slots'     AND policyname='service_all_schedule_slots')      THEN CREATE POLICY "service_all_schedule_slots"      ON schedule_slots       FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lenta_groups'       AND policyname='service_all_lenta_groups')        THEN CREATE POLICY "service_all_lenta_groups"        ON lenta_groups         FOR ALL USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lenta_group_members'AND policyname='service_all_lenta_members')       THEN CREATE POLICY "service_all_lenta_members"       ON lenta_group_members  FOR ALL USING (true); END IF;
END $$;

