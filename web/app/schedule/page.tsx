import { safeBackendJson } from '@/lib/backend'
import ScheduleClient from './ScheduleClient'

export const dynamic = 'force-dynamic'
export default async function SchedulePage() {
  const today = new Date().toISOString().split('T')[0]

  const [substitutions, employees, classes] = await Promise.all([
    safeBackendJson('/schedule/substitutions', { substitutions: [] }, { searchParams: { date_from: today } }),
    safeBackendJson('/employees', { employees: [] }),
    safeBackendJson('/classes', { classes: [] }),
  ])

  return (
    <ScheduleClient
      substitutions={substitutions.substitutions || []}
      employees={employees.employees || []}
      classes={classes.classes || []}
    />
  )
}
