import { safeBackendJson } from '@/lib/backend'
import { getDemoDate } from '@/lib/dateUtils'
import ScheduleClient from './ScheduleClient'
import DashboardWrapper from '@/components/layout/DashboardWrapper'

export const dynamic = 'force-dynamic'
export default async function SchedulePage({ searchParams }: { searchParams: { date?: string } }) {
  const selectedDate = searchParams?.date || getDemoDate()

  const [substitutions, employees, classes] = await Promise.all([
    safeBackendJson('/schedule/substitutions', { substitutions: [] }, { searchParams: { date_from: selectedDate, date_to: selectedDate } }),
    safeBackendJson('/employees', { employees: [] }),
    safeBackendJson('/classes', { classes: [] }),
  ])

  return (
    <DashboardWrapper>
      <ScheduleClient
        initialDate={selectedDate}
        substitutions={substitutions.substitutions || []}
        employees={employees.employees || []}
        classes={classes.classes || []}
      />
    </DashboardWrapper>
  )
}
