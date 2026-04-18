"""
seed_module3.py  (v2 - fixed teacher assignment)
Each subject gets its own teacher, based on teacher_subjects mapping.
Falls back to round-robin if no mapping found.
"""
import os, sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
sb = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY"),
)

def upsert(table, rows, conflict_col):
    try:
        sb.table(table).upsert(rows, on_conflict=conflict_col).execute()
        print(f"  OK  {len(rows):3d} rows -> {table}")
    except Exception as e:
        print(f"  ERR {table}: {str(e)[:100]}")

# ── ROOMS ──────────────────────────────────────────────────────
ROOMS = [
    {"number":"101","name":"Kab. 101",           "capacity":28,"room_type":"classroom","floor":1},
    {"number":"102","name":"Kab. 102",           "capacity":28,"room_type":"classroom","floor":1},
    {"number":"103","name":"Kab. 103",           "capacity":28,"room_type":"classroom","floor":1},
    {"number":"201","name":"Kab. 201",           "capacity":28,"room_type":"classroom","floor":2},
    {"number":"202","name":"Kab. 202",           "capacity":28,"room_type":"classroom","floor":2},
    {"number":"203","name":"Kab. 203",           "capacity":28,"room_type":"classroom","floor":2},
    {"number":"204","name":"Kab. 204",           "capacity":28,"room_type":"classroom","floor":2},
    {"number":"301","name":"Kab. 301",           "capacity":28,"room_type":"classroom","floor":3},
    {"number":"302","name":"Kab. matematiki",    "capacity":28,"room_type":"classroom","floor":3},
    {"number":"303","name":"Kab. 303",           "capacity":28,"room_type":"classroom","floor":3},
    {"number":"304","name":"Kab. 304",           "capacity":28,"room_type":"classroom","floor":3},
    {"number":"305","name":"Kab. 305",           "capacity":28,"room_type":"classroom","floor":3},
    {"number":"lang1","name":"Lingafonnyy 1",    "capacity":16,"room_type":"language","floor":2},
    {"number":"lang2","name":"Lingafonnyy 2",    "capacity":16,"room_type":"language","floor":2},
    {"number":"lang3","name":"Lingafonnyy 3",    "capacity":16,"room_type":"language","floor":2},
    {"number":"lang4","name":"Lingafonnyy 4",    "capacity":16,"room_type":"language","floor":2},
    {"number":"gym", "name":"Sportivnyy zal",    "capacity":60,"room_type":"gym",    "floor":1},
    {"number":"hall","name":"Aktovyy zal",        "capacity":120,"room_type":"hall",  "floor":1},
    {"number":"lab", "name":"Laboratoriya",       "capacity":24,"room_type":"lab",   "floor":3},
]
upsert("rooms", ROOMS, "number")

# ── SUBJECTS ───────────────────────────────────────────────────
SUBJECTS = [
    {"name":"Matematika",            "short_name":"Mat"},
    {"name":"Singapurskaya mat.",    "short_name":"Sing"},
    {"name":"Kazakhskiy yazyk",      "short_name":"Kaz"},
    {"name":"Russkiy yazyk",         "short_name":"Rus"},
    {"name":"Angliyskiy yazyk",      "short_name":"Angl"},
    {"name":"Literaturnoe chtenie",  "short_name":"Cht"},
    {"name":"Okruzhayuschiy mir",    "short_name":"OM"},
    {"name":"Fizkultura",            "short_name":"Fiz"},
    {"name":"Muzyka",                "short_name":"Muz"},
    {"name":"IZO",                   "short_name":"IZO"},
    {"name":"Tekhnologiya",          "short_name":"Tekh"},
    {"name":"Logika",                "short_name":"Log"},
    {"name":"Informatika",           "short_name":"IKT"},
    {"name":"Dezhurstvo",            "short_name":"Dezh"},
    {"name":"Metodicheskoe",         "short_name":"Met"},
]
upsert("subjects", SUBJECTS, "name")

# ── FETCH REFERENCE DATA ────────────────────────────────────────
print("\nFetching reference data...")
classes_r   = sb.table("classes").select("id,name,grade").order("grade").execute().data
teachers_r  = sb.table("employees").select("id,name,role,subject").eq("role","teacher").execute().data
rooms_r     = sb.table("rooms").select("id,number").execute().data
subjects_r  = sb.table("subjects").select("id,name").execute().data

sub_map  = {s["name"]: s["id"] for s in subjects_r}
sub_id_to_name = {s["id"]: s["name"] for s in subjects_r}
room_map = {r["number"]: r["id"] for r in rooms_r}

print(f"  Classes: {len(classes_r)}, Teachers: {len(teachers_r)}, Subjects: {len(subjects_r)}")

# ── BUILD SUBJECT → TEACHER MAPPING ────────────────────────────
# Try to match teachers with their subjects
# Each teacher can teach 1-2 subjects based on their "subject" field

# Subject rotation for a weekly schedule
# For each class, each day has 6 periods with different subjects
WEEKLY_TEMPLATE = [
    # day 1 (Mon)  periods 1-6
    ["Matematika",       "Kazakhskiy yazyk",  "Russkiy yazyk",    "Angliyskiy yazyk",  "Fizkultura",        "Okruzhayuschiy mir"],
    # day 2 (Tue)
    ["IZO",              "Muzyka",            "Logika",            "Informatika",        "Matematika",        "Kazakhskiy yazyk"],
    # day 3 (Wed)
    ["Russkiy yazyk",    "Fizkultura",        "Angliyskiy yazyk",  "Okruzhayuschiy mir","IZO",               "Muzyka"],
    # day 4 (Thu)
    ["Logika",           "Matematika",        "Kazakhskiy yazyk",  "Russkiy yazyk",     "Angliyskiy yazyk",  "Fizkultura"],
    # day 5 (Fri)
    ["Fizkultura",       "Okruzhayuschiy mir","IZO",               "Muzyka",            "Logika",            "Informatika"],
]

# Build subject → list of teacher_ids who can teach it
subj_teachers: dict[str, list[str]] = {}
for t in teachers_r:
    subj = (t.get("subject") or "").strip()
    if subj:
        # Normalize: match to subjects list by partial match or exact
        for s_name in sub_map:
            if subj.lower() in s_name.lower() or s_name.lower() in subj.lower():
                subj_teachers.setdefault(s_name, []).append(t["id"])
                break
        else:
            # No match — add to a "general" pool
            subj_teachers.setdefault("__general__", []).append(t["id"])
    else:
        subj_teachers.setdefault("__general__", []).append(t["id"])

general_pool = subj_teachers.get("__general__", [t["id"] for t in teachers_r])
print(f"  Subject->teacher map: {len(subj_teachers)} entries")
print(f"  General pool: {len(general_pool)} teachers")

# Counters for round-robin per subject (to vary across classes)
subj_counters: dict[str, int] = {}

def get_teacher_for_subject(subj_name: str, class_offset: int) -> str:
    candidates = subj_teachers.get(subj_name, general_pool)
    if not candidates:
        candidates = [t["id"] for t in teachers_r]
    n = subj_counters.get(subj_name, 0)
    teacher_id = candidates[(n + class_offset) % len(candidates)]
    subj_counters[subj_name] = n + 1
    return teacher_id

# Room assignment: different rooms for different subject types
SUBJECT_ROOMS = {
    "Fizkultura":        "gym",
    "Muzyka":            "hall",
    "Informatika":       "lab",
    "Angliyskiy yazyk":  "lang1",
    "Singapurskaya mat.":"302",
}
CLASSROOM_NUMBERS = ["201", "202", "203", "204", "301", "303", "304", "305", "101", "102", "103"]

print(f"\nBuilding schedule for {len(classes_r)} classes...")
demo_classes = classes_r  # All classes

# Delete old base slots
print("Clearing old slots...")
for cls in demo_classes:
    try:
        sb.table("schedule_slots").delete()\
          .eq("class_id", cls["id"]).is_("week_date", "null").execute()
    except:
        pass

# Build slots
all_slots = []
for i, cls in enumerate(demo_classes):
    # Assign a dedicated classroom for this class
    classroom_num = CLASSROOM_NUMBERS[i % len(CLASSROOM_NUMBERS)]
    default_room_id = room_map.get(classroom_num)

    for day_idx, day_subjects in enumerate(WEEKLY_TEMPLATE):
        day = day_idx + 1  # 1=Mon
        for period_idx, subj_name in enumerate(day_subjects):
            period = period_idx + 1
            subject_id = sub_map.get(subj_name)
            if not subject_id:
                continue

            # Get room: special for some subjects
            # Get room: special for some subjects
            special_room_num = SUBJECT_ROOMS.get(subj_name)
            room_id = room_map.get(special_room_num, default_room_id) if special_room_num else default_room_id

            # Get teacher: specific to subject, varying per class
            teacher_id = get_teacher_for_subject(subj_name, i)

            # Use 'lenta' slot_type for English to visualize streaming
            slot_type = "lesson"
            if subj_name == "Angliyskiy yazyk":
                slot_type = "lenta"

            all_slots.append({
                "class_id":    cls["id"],
                "teacher_id":  teacher_id,
                "subject_id":  subject_id,
                "room_id":     room_id,
                "day_of_week": day,
                "period":      period,
                "slot_type":   slot_type,
                "week_date":   None,
            })

print(f"  Generated {len(all_slots)} slots for {len(demo_classes)} classes")

# Insert in batches of 50
ok = 0
for i in range(0, len(all_slots), 50):
    try:
        sb.table("schedule_slots").insert(all_slots[i:i+50]).execute()
        ok += min(50, len(all_slots) - i)
    except Exception as e:
        print(f"  ERR batch {i}: {str(e)[:80]}")

print(f"  OK  {ok} slots inserted")
print("\nDONE - Schedule reseeded with proper teacher assignments!")
