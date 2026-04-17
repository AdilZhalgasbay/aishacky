import { safeBackendJson } from '@/lib/backend'
import AttendanceClient from './AttendanceClient'

export const dynamic = 'force-dynamic'
export default async function AttendancePage() {
  const today = new Date().toISOString().split('T')[0]

  const [attendance, classes] = await Promise.all([
    safeBackendJson('/attendance', { classes: [] }, { searchParams: { date: today } }),
    safeBackendJson('/classes', { classes: [] }),
  ])

  return <AttendanceClient attendance={attendance.classes || []} classes={classes.classes || []} />
}
