import { safeBackendJson } from '@/lib/backend'
import { getDemoDate } from '@/lib/dateUtils'
import ScheduleClient from './ScheduleClient'
import DashboardWrapper from '@/components/layout/DashboardWrapper'

export const dynamic = 'force-dynamic'
export default async function SchedulePage() {
  const today = getDemoDate()

  const [substitutions, employees, classes] = await Promise.all([
    safeBackendJson('/schedule/substitutions', { substitutions: [] }, { searchParams: { date_from: today } }),
    safeBackendJson('/employees', { employees: [] }),
    safeBackendJson('/classes', { classes: [] }),
  ])

  return (
    <DashboardWrapper>
      <ScheduleClient
        substitutions={substitutions.substitutions || []}
        employees={employees.employees || []}
        classes={classes.classes || []}
      />
    </DashboardWrapper>
  )
}
