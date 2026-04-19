import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const classId    = searchParams.get('class_id')
    const teacherId  = searchParams.get('teacher_id')
    const weekDate   = searchParams.get('week_date') // null = base schedule

    let query = sb
      .from('schedule_slots')
      .select(`
        id, day_of_week, period, slot_type, note, is_substitute, week_date,
        classes   ( id, name, grade ),
        employees ( id, name, role ),
        subjects  ( id, name, short_name ),
        rooms     ( id, name, number )
      `)
      .order('day_of_week')
      .order('period')

    if (classId)   query = query.eq('class_id', classId)
    if (teacherId) query = query.eq('teacher_id', teacherId)
    if (weekDate)  query = query.eq('week_date', weekDate)
    else           query = query.is('week_date', null)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ slots: data || [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg, slots: [] }, { status: 500 })
  }
}
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, day_of_week, period } = body

    if (!id || day_of_week === undefined || period === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await sb
      .from('schedule_slots')
      .update({ day_of_week, period })
      .eq('id', id)
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, slot: data[0] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
