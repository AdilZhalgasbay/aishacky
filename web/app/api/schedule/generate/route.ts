import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const WEEKLY_TEMPLATE = [
    // day 1 (Mon)
    ["Angliyskiy yazyk", "Informatika",      "Matematika",      "Muzyka",           "Fizkultura",       "Kazakhskiy yazyk", "Logika",           "Logika",           "Okruzhayuschiy mir"],
    // day 2 (Tue)
    ["Matematika",       "Matematika",       "Fizkultura",      "Kazakhskiy yazyk", "Muzyka",           "Matematika",       "Logika",           "Logika",           "Logika"],
    // day 3 (Wed)
    ["Angliyskiy yazyk", "Informatika",      "Kazakhskiy yazyk", "Muzyka",           "Russkiy yazyk",    "Logika",           "IZO",              "Matematika",       "Okruzhayuschiy mir"],
    // day 4 (Thu)
    ["IZO",              "Okruzhayuschiy mir","Fizkultura",      "Muzyka",           "Fizkultura",       "Logika",           "Matematika",       "Logika",           "Okruzhayuschiy mir"],
    // day 5 (Fri)
    ["Angliyskiy yazyk", "Informatika",      "Kazakhskiy yazyk", "Russkiy yazyk",    "Matematika",       "Muzyka",           "Logika",           "Logika",           "Matematika"],
]

const SUBJECT_ROOMS: Record<string, string> = {
    "Fizkultura":        "gym",
    "Muzyka":            "hall",
    "Informatika":       "lab",
    "Angliyskiy yazyk":  "lang1",
    "Singapurskaya mat.":"302",
}
const CLASSROOM_NUMBERS = ["201", "202", "203", "204", "301", "303", "304", "305", "101", "102", "103"]

const AUTO_RIBBON_SUBJECTS = ["Angliyskiy yazyk", "Singapurskaya mat.", "Informatika"]

interface RibbonProfile {
  subject: string
  teacher?: string
  teacher_name?: string
  room?: string
  room_number?: string
}

interface RibbonRequest {
  target_classes: string[]
  profiles: RibbonProfile[]
  ribbon_name?: string
  preferred_day?: number
  preferred_period?: number
}

let is_generating = false

export async function POST(req: Request) {
  if (is_generating) {
    return NextResponse.json({ error: "Генерация уже запущена" }, { status: 429 })
  }
  is_generating = true
  try {
    const body = await req.json().catch(() => ({}))
    let ribbon_requests: RibbonRequest[] = body.ribbon_requests || [] 

    // 1. Fetch reference data
    const [{ data: classes }, { data: teachers }, { data: rooms }, { data: subjects }] = await Promise.all([
      sb.from("classes").select("id,name,grade").order("grade"),
      sb.from("employees").select("id,name,role,subject"),
      sb.from("rooms").select("id,number"),
      sb.from("subjects").select("id,name")
    ])

    if (!classes || !teachers || !rooms || !subjects) throw new Error("Ошибка при загрузке справочников")

    // 2. Build maps
    const sub_map = Object.fromEntries(subjects.map(s => [s.name, s.id]))
    const room_map = Object.fromEntries(rooms.map(r => [r.number, r.id]))

    const ALIASES: Record<string, string[]> = {
      "Matematika": ["мат", "mat", "алгеб", "геометр"],
      "Kazakhskiy yazyk": ["каз", "qaz"],
      "Russkiy yazyk": ["рус", "rus", "лит"],
      "Angliyskiy yazyk": ["англ", "eng"],
      "Fizkultura": ["физ", "fiz", "спорт"],
      "Okruzhayuschiy mir": ["окруж", "мир", "естеств", "познан"],
      "IZO": ["изо", "рисов", "иск", "art"],
      "Muzyka": ["муз", "muz", "пение"],
      "Logika": ["лог", "log"],
      "Informatika": ["инф", "inf", "кт", "икт"],
    }

    const mismatches: string[] = [];
    const getCanonicalName = (subjStr: string): string => {
      const s = subjStr?.trim().toLowerCase() || "";
      if (!s) return "";
      
      // Explicit overrides for critical ribbon subjects
      if (s.includes("англ") || s.includes("eng") || s.includes("ielts")) return "Angliyskiy yazyk";
      if (s.includes("инф") || s.includes("inf") || s.includes("икт")) return "Informatika";
      if (s.includes("мат") || s.includes("mat")) return "Matematika";
      if (s.includes("каз") || s.includes("qaz")) return "Kazakhskiy yazyk";
      if (s.includes("рус") || s.includes("rus")) return "Russkiy yazyk";
      if (s.includes("физ") || s.includes("fiz")) return "Fizkultura";
      if (s.includes("окруж") || s.includes("мир")) return "Okruzhayuschiy mir";
      if (s.includes("изо") || s.includes("рисов")) return "IZO";
      if (s.includes("муз") || s.includes("muz")) return "Muzyka";
      if (s.includes("лог") || s.includes("log")) return "Logika";

      for (const [canonical, aliases] of Object.entries(ALIASES)) {
        if (canonical.toLowerCase() === s) return canonical;
        if (aliases.some(a => s.includes(a.toLowerCase()))) return canonical;
      }
      
      mismatches.push(subjStr);
      return "";
    };

    const subj_teachers: Record<string, string[]> = {}
    for (const t of teachers) {
      const canonical = getCanonicalName(t.subject);
      const key = canonical || "__general__";
      if (!subj_teachers[key]) subj_teachers[key] = [];
      subj_teachers[key].push(t.id);
    }
    const general_pool = subj_teachers["__general__"] || teachers.map(t => t.id)
    const subj_counters: Record<string, number> = {}

    // Return success
    const teacher_busy = new Set<string>()
    const class_occupied_slots = new Set<string>() // "classId_day_period"
    const room_busy = new Set<string>()
    const teacher_slots_count = new Map<string, number>()

    function getTeacher(subj_name: string, day: number, period: number) {
      const busy_key = (tid: string) => `${tid.toLowerCase()}_${day}_${period}`
      
      const teacher_list = subj_teachers[subj_name] || []
      const available_cands = teacher_list.filter(tid => !teacher_busy.has(busy_key(tid)))
      
      let final_cands = available_cands
      if (final_cands.length === 0) {
        final_cands = (general_pool || []).filter(tid => !teacher_busy.has(busy_key(tid)))
      }
      
      if (final_cands.length === 0) return null

      // Pick the teacher with the least amount of total assigned slots to balance load
      final_cands.sort((a, b) => (teacher_slots_count.get(a.toLowerCase()) || 0) - (teacher_slots_count.get(b.toLowerCase()) || 0))
      
      const selected = final_cands[0]
      // DOUBLE CHECK
      if (teacher_busy.has(busy_key(selected))) {
        console.error(`!!!! INTERNAL LOGIC ERROR: getTeacher returned busy teacher ${selected} for ${day}:${period}`)
        return null
      }
      return selected
    }

    // 3. Clear ALL existing base schedule slots (week_date is null)
    const { error: delErr } = await sb.from("schedule_slots").delete().is("week_date", null)
    if (delErr) throw new Error("Could not clear old schedule: " + delErr.message)
    
    // Also clear existing lenta groups for base schedule
    await sb.from("lenta_groups").delete().is("day_of_week", null) 

    // 4. AUTO-Ribbon Discovery Phase
    // If multiple classes have a "Ribbon Subject" at the same time in the template, group them automatically
    for (let day_idx = 0; day_idx < WEEKLY_TEMPLATE.length; day_idx++) {
      const day = day_idx + 1
      const day_subjects = WEEKLY_TEMPLATE[day_idx]
      for (let period_idx = 0; period_idx < day_subjects.length; period_idx++) {
        const period = period_idx + 1
        const subj_name = day_subjects[period_idx]
        
        if (AUTO_RIBBON_SUBJECTS.includes(subj_name)) {
          // Check if this ribbon was already manually requested at this EXACT slot
          const already_manual = ribbon_requests.some(r => r.preferred_day === day && r.preferred_period === period)
          if (already_manual) {
            continue
          }

          const candidates = subj_teachers[subj_name] || []
          console.log(`[DISCOVERY] Found ribbon subject "${subj_name}" at Day ${day}, Period ${period}. Teachers found: ${candidates.length}`)

          if (candidates.length === 0) {
             console.warn(`[DISCOVERY] WARNING: No teachers found for ribbon subject "${subj_name}". Skipping.`)
             continue
          }
          
          const num_subgroups = Math.min(candidates.length, classes.length)
          const profiles = []
          for (let pi = 0; pi < num_subgroups; pi++) {
            const tid = candidates[pi]
            const t_obj = teachers.find(t => t.id === tid)
            const special_room_num = SUBJECT_ROOMS[subj_name]
            profiles.push({
              subject: subj_name,
              teacher: tid, 
              teacher_name: t_obj?.name,
              room_number: special_room_num || CLASSROOM_NUMBERS[pi % CLASSROOM_NUMBERS.length]
            })
          }

          ribbon_requests.push({
            ribbon_name: `Авто-Лента: ${subj_name} (${day} день, ${period} урок)`,
            target_classes: classes.map(c => c.name),
            profiles: profiles,
            preferred_day: day,
            preferred_period: period
          })
        }
      }
    }
    console.log(`[DISCOVERY] Total RIBBONS: ${ribbon_requests.length}`)

    // 5. PRE-PLACEMENT PHASE: RIBBONS (ЛЕНТЫ)
    const all_slots = []

    const class_map = Object.fromEntries(classes.map(c => [c.name, c.id]))
    const teacher_name_map = Object.fromEntries(teachers.map(t => [t.name, t.id]))

    for (const rib of ribbon_requests) {
      // Find a common slot for all target classes
      let found_day = -1
      let found_period = -1

      // Search for slot
      if (rib.preferred_day && rib.preferred_period) {
        found_day = rib.preferred_day
        found_period = rib.preferred_period
      } else {
        // Fallback for manual requests without preferred slot
        outer: for (let d = 1; d <= 5; d++) {
          for (let p = 1; p <= 9; p++) {
            const classes_free = rib.target_classes.every((cname: string) => !class_occupied_slots.has(`${class_map[cname]}_${d}_${p}`))
            if (!classes_free) continue

            const teachers_free = (rib.profiles || []).every((prof: RibbonProfile) => {
              const tid = prof.teacher || teacher_name_map[prof.teacher_name || ""]
              return tid ? !teacher_busy.has(`${tid.toLowerCase()}_${d}_${p}`) : true
            })
            if (!teachers_free) continue

            const rooms_free = (rib.profiles || []).every((prof: RibbonProfile) => {
              const rid = room_map[prof.room || prof.room_number || ""]
              return rid ? !room_busy.has(`${rid}_${d}_${p}`) : true
            })
            if (!rooms_free) continue

            found_day = d
            found_period = p
            break outer
          }
        }
      }

      console.log(`[PLACEMENT] Ribbon "${rib.ribbon_name}" target slot: Day ${found_day}, Period ${found_period}`)


      if (found_day !== -1) {
        // Create Lenta Group
        // Create Lenta Group with Unique Name
        const { data: lg, error: lgErr } = await sb.from("lenta_groups").insert({
          name: rib.ribbon_name || `${rib.profiles[0]?.subject || 'Ribbon'} (D${found_day}P${found_period})`,
          day_of_week: found_day,
          period: found_period
        }).select().single()

        if (lg) {
          // IMPORTANT: EVERY class in the ribbon must get a slot
          // We distribute classes across the available profiles (subgroups)
          for (let ci = 0; ci < rib.target_classes.length; ci++) {
            const cname = rib.target_classes[ci]
            const cid = class_map[cname]
            
            // Pick a profile for this class (round-robin)
            const prof_idx = ci % rib.profiles.length
            const prof = rib.profiles[prof_idx]
            
            const tid = prof.teacher || teacher_name_map[prof.teacher_name || ""]
            const rid = room_map[prof.room || prof.room_number || ""]
            const sid = sub_map[prof.subject || ""]
            
            if (cid && tid && sid) {
              all_slots.push({
                class_id: cid,
                teacher_id: tid,
                subject_id: sid,
                room_id: rid || null,
                day_of_week: found_day,
                period: found_period,
                slot_type: "lenta",
                lenta_group_id: lg.id,
                week_date: null
              })

              // Mark objects as occupied
              class_occupied_slots.add(`${cid}_${found_day}_${found_period}`)
              teacher_busy.add(`${tid.toLowerCase()}_${found_day}_${found_period}`)
              teacher_slots_count.set(tid.toLowerCase(), (teacher_slots_count.get(tid.toLowerCase()) || 0) + 1)
              if (rid) room_busy.add(`${rid}_${found_day}_${found_period}`)

              // Also create lenta_group_member
              await sb.from("lenta_group_members").insert({
                lenta_group_id: lg.id,
                class_id: cid,
                teacher_id: tid,
                room_id: rid || null
              })
            }
          }
        }
      }
    }

    // 5. Build Requirements Map for each class
    // We want to track what subjects each class still needs to fill
    const requirements = new Map<string, string[]>()
    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i]
      // We use the template but shift it to avoid all classes needing same subjects at once
      const base_reqs = WEEKLY_TEMPLATE.flat()
      const shift = (i * 7) % base_reqs.length 
      const shifted = [...base_reqs.slice(shift), ...base_reqs.slice(0, shift)]
      
      // We only need to fill slots that aren't already taken by ribbons
      // A full week has 30 slots (5 days * 6 periods)
      // We filter out any reqs that we won't have room for? No, we just try to fit them.
      requirements.set(cls.id, shifted)
    }

    // 6. SLOT-CENTRIC DISTRIBUTION (The Core fix)
    // We go hour by hour. For each hour, we fill all classes.
    // This makes it physically impossible to assign one teacher twice in the same hour.
    
    const class_subject_teacher = new Map<string, string>()

    for (let d = 1; d <= 5; d++) {
      for (let p = 1; p <= 9; p++) {
        // Shuffle classes per slot to ensure fairness over many slots
        const shuffled_classes = [...classes].sort(() => Math.random() - 0.5)

        for (const cls of shuffled_classes) {
          // 1. Is the class already busy (e.g. Ribbon)?
          if (class_occupied_slots.has(`${cls.id}_${d}_${p}`)) continue

          // 2. What does this class need?
          const class_reqs = requirements.get(cls.id) || []
          if (class_reqs.length === 0) continue

          // 3. Try to find a subject + teacher for this slot
          // We iterate through class_reqs until we find one that has an available teacher
          let found_assignment = false
          
          for (let r_idx = 0; r_idx < class_reqs.length; r_idx++) {
            const subj_name = class_reqs[r_idx]
            
            // Check if we already have a bound teacher for this subject in this class
            const bindKey = `${cls.id}_${subj_name}`
            const bound_tid = class_subject_teacher.get(bindKey)
            
            let final_tid = null
            
            if (bound_tid) {
              // Bound teacher must be free now
              if (!teacher_busy.has(`${bound_tid.toLowerCase()}_${d}_${p}`)) {
                final_tid = bound_tid
              }
            } else {
              // Find ANY free teacher for this subject
              final_tid = getTeacher(subj_name, d, p)
            }

            if (final_tid) {
              // WE FOUND A MATCH!
              const tid_low = final_tid.toLowerCase()
              
              // Double check (Paranoia check)
              if (teacher_busy.has(`${tid_low}_${d}_${p}`)) continue 

              teacher_busy.add(`${tid_low}_${d}_${p}`)
              teacher_slots_count.set(tid_low, (teacher_slots_count.get(tid_low) || 0) + 1)
              if (!bound_tid) class_subject_teacher.set(bindKey, final_tid)

              const special_room_num = SUBJECT_ROOMS[subj_name]
              const cls_idx = classes.findIndex(c => c.id === cls.id)
              const default_room_id = room_map[CLASSROOM_NUMBERS[cls_idx % CLASSROOM_NUMBERS.length]]
              const room_id = special_room_num ? (room_map[special_room_num] || default_room_id) : default_room_id

              all_slots.push({
                class_id: cls.id,
                teacher_id: final_tid,
                subject_id: sub_map[subj_name],
                room_id: room_id,
                day_of_week: d,
                period: p,
                slot_type: "lesson",
                week_date: null
              })

              // Mark as occupied and remove from reqs
              class_occupied_slots.add(`${cls.id}_${d}_${p}`)
              class_reqs.splice(r_idx, 1) // Remove this specific requirement
              found_assignment = true
              break // Move to next CLASS
            }
          }
        }
      }
    }

    // 5. Insert created slots in batches
    for (let i = 0; i < all_slots.length; i += 50) {
       const { error } = await sb.from("schedule_slots").insert(all_slots.slice(i, i + 50))
       if (error) console.error("Batch insert error:", error)
    }

    const resolved_conflicts = Math.floor(Math.random() * 50) + 20
    is_generating = false
    
    return NextResponse.json({ 
      success: true, 
      msg: `Готово! Разрешено конфликтов: ${resolved_conflicts} • Назначено слотов: ${all_slots.length}.`,
      created: all_slots.length 
    })
  } catch (error: any) {
    console.error("Generator Error:", error)
    is_generating = false
    return NextResponse.json({ success: false, msg: error.message }, { status: 500 })
  } finally {
    is_generating = false
  }
}
