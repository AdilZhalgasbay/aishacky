import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { absent_teacher_name, message, date } = await request.json(); 
    
    // Parse target date and day of week
    let targetDate = new Date();
    if (date) targetDate = new Date(date);
    let day_of_week = targetDate.getDay();
    if (day_of_week === 0 || day_of_week === 6) day_of_week = 1;

    // 1. Resolve Sick Teacher
    let resolvedTeacherName = absent_teacher_name;
    let fallbackSubject = "";

    // If natural language command, do a basic regex/string match
    if (message && !resolvedTeacherName) {
        const words = message.toLowerCase().split(' ');
        // Find teacher in DB
        const { data: searchTeachers } = await supabase.from('employees').select('id, name');
        for (const t of (searchTeachers || [])) {
             const tNames = t.name.toLowerCase().split(' ');
             if (tNames.some((n: string) => words.includes(n))) {
                 resolvedTeacherName = t.name;
                 break;
             }
        }
        if (!resolvedTeacherName) {
             return NextResponse.json({ error: "Не удалось распознать учителя из текста." }, { status: 400 });
        }
    }

    if (!resolvedTeacherName) {
       return NextResponse.json({ error: "absent_teacher_name is required" }, { status: 400 });
    }

    // Get Teacher ID
    const { data: teacherData, error: te } = await supabase
        .from('employees')
        .select('id, role')
        .ilike('name', `%${resolvedTeacherName.trim()}%`)
        .limit(1)
        .single();

    if (te || !teacherData) {
        return NextResponse.json({ error: "Учитель не найден в базе." }, { status: 404 });
    }

    const teacher_id = teacherData.id;

    // 2. Get sick teacher's lessons for the day
    const { data: sickSlots, error: e1 } = await supabase
      .from('schedule_slots')
      .select('*, subjects(*), classes(*), rooms(*)')
      .eq('teacher_id', teacher_id)
      .eq('day_of_week', day_of_week);

    if (e1) throw e1;

    if (!sickSlots || sickSlots.length === 0) {
      return NextResponse.json({ 
          absent_teacher: resolvedTeacherName,
          substitutions_created: 0, 
          conflict_free: true,
          message: "У учителя нет уроков в этот день." 
      });
    }

    // 3. Fetch all teachers to find replacements
    const { data: allTeachers, error: e2 } = await supabase
        .from('employees')
        .select('*')
        .in('role', ['teacher', 'admin', 'deputy', 'director']);
        
    if (e2) throw e2;

    const replacements = [];
    const substituteOptions = [];
    let updatedCount = 0;

    for (const slot of sickSlots) {
       // Find busy teachers for this specific period
       const { data: busySlotsThatPeriod } = await supabase
         .from('schedule_slots')
         .select('teacher_id')
         .eq('day_of_week', slot.day_of_week)
         .eq('period', slot.period);
         
       const busyTeacherIds = busySlotsThatPeriod?.map(s => s.teacher_id) || [];

       // Filter candidate teachers
       const availableCandidates = allTeachers?.filter(t => {
           if (t.id === teacher_id) return false;
           if (busyTeacherIds.includes(t.id)) return false;
           if (t.is_available === false) return false;
           if (t.role !== 'teacher') return false; // prefer teachers first

           const slotSubName = slot.subjects?.name?.toLowerCase() || '';
           const hasPrimarySubject = t.subject?.toLowerCase() === slotSubName;
           const hasSpecialty = Array.isArray(t.subject_specialties) 
                                && t.subject_specialties.some((sp: string) => sp.toLowerCase() === slotSubName);
                                
           return hasPrimarySubject || hasSpecialty;
       });

       let replacement = availableCandidates?.[0];

       if (!replacement) {
           // Fallback to any free staff member (admin, director, free teacher)
           const fallbackCandidates = allTeachers?.filter(t => t.id !== teacher_id && !busyTeacherIds.includes(t.id) && t.is_available !== false);
           if (fallbackCandidates && fallbackCandidates.length > 0) {
               replacement = fallbackCandidates[0];
           }
       }

       if (replacement) {
           // Update DB
           const { error: updateError } = await supabase
             .from('schedule_slots')
             .update({
                teacher_id: replacement.id,
                is_substitute: true,
                original_teacher_id: teacher_id,
                note: 'Замена (Авто)',
                slot_type: 'lesson'
             })
             .eq('id', slot.id);

           if (!updateError) {
               updatedCount++;
               replacements.push({
                   class_name: slot.classes?.name || 'Класс',
                   period: slot.period,
                   subject: slot.subjects?.name || 'Предмет',
                   original_teacher_name: resolvedTeacherName,
                   substitute_name: replacement.name,
                   reason: 'Срочная автоматическая замена',
                   status: 'confirmed',
                   notified: true,
                   room: slot.rooms?.number || null,
                   date: targetDate.toISOString()
               });

               substituteOptions.push({
                   name: replacement.name,
                   subject: replacement.subject || replacement.role
               });
           }
       }
    }

    // Console logging mimicking a WhatsApp send
    console.log(`[WHATSAPP-MOCK] Sent 🚨 Emergency substitution notifications to ${updatedCount} teachers.`);

    return NextResponse.json({ 
        absent_teacher: resolvedTeacherName,
        substitutions_created: updatedCount,
        substitute_options: substituteOptions,
        conflict_free: true,
        substitutions: replacements
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

