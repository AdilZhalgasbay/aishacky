import { safeBackendJson } from '@/lib/backend'
import { getDemoDate } from '@/lib/dateUtils'
import ScheduleClient from './ScheduleClient'
import DashboardWrapper from '@/components/layout/DashboardWrapper'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams
  const selectedDate = params?.date || getDemoDate()

  // Service-role client for server-side queries
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://tutzawhhpklqodjagtha.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dHphd2hocGtscW9kamFndGhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQzNDMyNSwiZXhwIjoyMDkyMDEwMzI1fQ.jcHpPsu6s1h-lzycNYZ8oAheCE2kLVBer1KSbkN7J0o',
  )

  const [substitutions, employees, classes] = await Promise.all([
    safeBackendJson('/schedule/substitutions', { substitutions: [] }, { searchParams: { date_from: selectedDate, date_to: selectedDate } }),
    safeBackendJson('/employees', { employees: [] }),
    safeBackendJson('/classes', { classes: [] }),
  ])

  // Fetch slots directly — log error if any
  const { data: slotsData, error: slotsError } = await sb
    .from('schedule_slots')
    .select(`
      id, day_of_week, period, slot_type, note, is_substitute, week_date,
      classes   ( id, name, grade ),
      employees!schedule_slots_teacher_id_fkey ( id, name, role ),
      subjects  ( id, name, short_name ),
      rooms     ( id, name, number )
    `)
    .is('week_date', null)
    .order('day_of_week')
    .order('period')


  if (slotsError) {
    console.error('[schedule/page] slots error:', slotsError)
  }

  const { data: subjectsData } = await sb
    .from('subjects')
    .select('id, name, short_name')
    .order('name')
    
  const { data: roomsData } = await sb
    .from('rooms')
    .select('id, number, name, capacity, room_type, floor')
    .order('number')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slots = (slotsData ?? []) as any[]

  return (
    <DashboardWrapper>
      <ScheduleClient
        initialDate={selectedDate}
        substitutions={substitutions.substitutions || []}
        employees={employees.employees || []}
        classes={classes.classes || []}
        slots={slots}
        subjects={subjectsData || []}
        rooms={roomsData || []}
      />
    </DashboardWrapper>
  )
}
