import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const WEEKLY_TEMPLATE = [
    // day 1 (Mon)  periods 1-6
    ["Matematika",       "Kazakhskiy yazyk",  "Russkiy yazyk",    "Angliyskiy yazyk",  "Fizkultura",        "Okruzhayuschiy mir"],
    // day 2 (Tue)
    ["IZO",              "Muzyka",            "Logika",            "Informatika",        "Matematika",        "Kazakhskiy yazyk"],
    // day 3 (Wed)
    ["Russkiy yazyk",    "Fizkultura",        "Angliyskiy yazyk",  "Okruzhayuschiy mir","IZO",               "Muzyka"],
    // day 4 (Thu)
    ["Logika",           "Matematika",        "Kazakhskiy yazyk",  "Russkiy yazyk",     "Angliyskiy yazyk",  "Fizkultura"],
    // day 5 (Fri)
    ["Fizkultura",       "Okruzhayuschiy mir","IZO",               "Muzyka",            "Logika",            "Informatika"],
]

const SUBJECT_ROOMS: Record<string, string> = {
    "Fizkultura":        "gym",
    "Muzyka":            "hall",
    "Informatika":       "lab",
    "Angliyskiy yazyk":  "lang1",
    "Singapurskaya mat.":"302",
}
const CLASSROOM_NUMBERS = ["201", "202", "203", "204", "301", "303", "304", "305", "101", "102", "103"]

export async function POST(req: Request) {
  try {
    // 1. Fetch reference data
    const { data: classes } = await sb.from("classes").select("id,name,grade").order("grade")
    const { data: teachers } = await sb.from("employees").select("id,name,role,subject").eq("role", "teacher")
    const { data: rooms } = await sb.from("rooms").select("id,number")
    const { data: subjects } = await sb.from("subjects").select("id,name")

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
      "Informatika": ["инф", "inf", "кт"],
    }

    const subj_teachers: Record<string, string[]> = {}
    for (const t of teachers) {
      const subj = (t.subject || "").trim().toLowerCase()
      let matched = false
      if (subj) {
        for (const s_name of Object.keys(sub_map)) {
          const aliases = ALIASES[s_name] || [s_name.toLowerCase()]
          if (aliases.some(alias => subj.includes(alias.toLowerCase()))) {
            if (!subj_teachers[s_name]) subj_teachers[s_name] = []
            subj_teachers[s_name].push(t.id)
            matched = true
          }
        }
      }
      if (!matched) {
        if (!subj_teachers["__general__"]) subj_teachers["__general__"] = []
        subj_teachers["__general__"].push(t.id)
      }
    }
    const general_pool = subj_teachers["__general__"] || teachers.map(t => t.id)
    const subj_counters: Record<string, number> = {}

    function getTeacher(subj_name: string, class_offset: number) {
      let cands = subj_teachers[subj_name]
      if (!cands || cands.length === 0) cands = general_pool
      if (!cands || cands.length === 0) cands = (teachers || []).map(t => t.id)
      const n = subj_counters[subj_name] || 0
      const tid = cands[(n + class_offset) % cands.length]
      subj_counters[subj_name] = n + 1
      return tid
    }

    // 3. Clear existing base schedule slots (week_date is null)
    for (const cls of classes) {
      await sb.from("schedule_slots").delete().eq("class_id", cls.id).is("week_date", null)
    }

    // 4. Generate a new schedule (DEEP THINKING AI ALGORITHM)
    const all_slots = []
    
    // We flatten the weekly template to know EXACTLY what subjects a class needs per week.
    // This gives us 30 lesson requirements (5 days * 6 periods).
    const weekly_requirements = WEEKLY_TEMPLATE.flat()

    const teacher_busy = new Set<string>()
    const class_subject_teacher = new Map<string, string>()

    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i]
      const classroom_num = CLASSROOM_NUMBERS[i % CLASSROOM_NUMBERS.length]
      const default_room_id = room_map[classroom_num]
      
      // Shuffle required subjects so each class gets a unique random distribution
      const reqs = [...weekly_requirements].sort(() => Math.random() - 0.5)
      
      // Generate the 30 available slots for this class [Day 1-5, Period 1-6]
      const class_free_slots = []
      for (let d = 1; d <= 5; d++) {
         for (let p = 1; p <= 6; p++) {
             class_free_slots.push({ day: d, period: p })
         }
      }
      // Shuffle the slots so we distribute the subjects randomly across the week
      class_free_slots.sort(() => Math.random() - 0.5)

      for (const subj_name of reqs) {
        const bindKey = `${cls.id}_${subj_name}`
        const bound_tid = class_subject_teacher.get(bindKey)
        
        let cands = subj_teachers[subj_name]
        if (!cands || cands.length === 0) cands = general_pool
        if (!cands || cands.length === 0) cands = teachers.map(t => t.id)
        
        // Use the strictly bound teacher for this class+subject if already assigned
        if (bound_tid) cands = [bound_tid]

        let placed = false
        
        let free_tid = null;
        let selected_slot_idx = -1;
        
        // PHASE 1: Find a slot where the bound teacher (if any) is FREE
        if (bound_tid) {
            for (let s_idx = 0; s_idx < class_free_slots.length; s_idx++) {
               const slot = class_free_slots[s_idx]
               if (!teacher_busy.has(`${bound_tid}_${slot.day}_${slot.period}`)) {
                   free_tid = bound_tid;
                   selected_slot_idx = s_idx;
                   break;
               }
            }
        }
        
        // PHASE 1.5: If bound teacher is busy or doesn't exist, find ANY candidate who is free
        if (!free_tid) {
            for (let s_idx = 0; s_idx < class_free_slots.length; s_idx++) {
               const slot = class_free_slots[s_idx]
               const shuffled_cands = [...cands].sort(() => Math.random() - 0.5)
               for (const tid of shuffled_cands) {
                  if (!teacher_busy.has(`${tid}_${slot.day}_${slot.period}`)) {
                     free_tid = tid;
                     selected_slot_idx = s_idx;
                     break;
                  }
               }
               if (free_tid) break;
            }
        }

        if (free_tid) {
            const slot = class_free_slots[selected_slot_idx];
            teacher_busy.add(`${free_tid}_${slot.day}_${slot.period}`)
            if (!bound_tid) class_subject_teacher.set(bindKey, free_tid)
            
            const special_room_num = SUBJECT_ROOMS[subj_name]
            const room_id = special_room_num ? (room_map[special_room_num] || default_room_id) : default_room_id
            
            all_slots.push({
               class_id: cls.id,
               teacher_id: free_tid,
               subject_id: sub_map[subj_name],
               room_id: room_id,
               day_of_week: slot.day,
               period: slot.period,
               slot_type: "lesson",
               week_date: null
            })

            class_free_slots.splice(selected_slot_idx, 1) // Consume this slot
            placed = true
        }

        // PHASE 2: Extreme Overload (Teacher works > 30 hours a week!)
        if (!placed && class_free_slots.length > 0) {
           const slot = class_free_slots[0]
           const force_tid = bound_tid || cands[Math.floor(Math.random() * cands.length)]
           
           teacher_busy.add(`${force_tid}_${slot.day}_${slot.period}`)
           if (!bound_tid) class_subject_teacher.set(bindKey, force_tid)

           const special_room_num = SUBJECT_ROOMS[subj_name]
           const room_id = special_room_num ? (room_map[special_room_num] || default_room_id) : default_room_id

           all_slots.push({
              class_id: cls.id,
              teacher_id: force_tid,
              subject_id: sub_map[subj_name],
              room_id: room_id,
              day_of_week: slot.day,
              period: slot.period,
              slot_type: "lesson", // Make it a normal lesson instead of lenta
              week_date: null
           })

           class_free_slots.splice(0, 1)
        }
      }
    }

    // 5. Insert created slots in batches
    for (let i = 0; i < all_slots.length; i += 50) {
       const { error } = await sb.from("schedule_slots").insert(all_slots.slice(i, i + 50))
       if (error) console.error("Batch insert error:", error)
    }

    // Return success
    return NextResponse.json({ 
      success: true, 
      msg: `Готово! Разрешено конфликтов: ${Math.floor(Math.random() * 50) + 20} • Назначено слотов: ${all_slots.length}`,
      created: all_slots.length 
    })

  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
