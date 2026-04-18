import { safeBackendJson } from '@/lib/backend'
import { getDemoDate } from '@/lib/dateUtils'
import AttendanceClient from './AttendanceClient'
import DashboardWrapper from '@/components/layout/DashboardWrapper'

export const dynamic = 'force-dynamic'
export default async function AttendancePage() {
  const today = getDemoDate()

  const [attendance, classes] = await Promise.all([
    safeBackendJson('/attendance', { classes: [] }, { searchParams: { date: today } }),
    safeBackendJson('/classes', { classes: [] }),
  ])

  return (
    <DashboardWrapper>
      <AttendanceClient attendance={attendance.classes || []} classes={classes.classes || []} />
    </DashboardWrapper>
  )
}
