import { safeBackendJson } from '@/lib/backend'
import DashboardClient, {
  type DashboardIncident,
  type DashboardSubstitution,
  type DashboardTask,
} from './DashboardClient'

export const dynamic = 'force-dynamic'

interface AttendanceRow {
  id: string
  class_name: string
  present_count: number
  absent_count: number
}

interface AttendanceSummary {
  date: string
  classes: AttendanceRow[]
  total_present: number
  total_absent: number
}

interface IncidentsResponse {
  incidents: DashboardIncident[]
}

interface TasksResponse {
  tasks: DashboardTask[]
}

interface SubstitutionsResponse {
  substitutions: DashboardSubstitution[]
}

export default async function DashboardPage() {
  const today = new Date().toISOString().split('T')[0]

  const [attendance, incidents, tasks, substitutions] = await Promise.all([
    safeBackendJson<AttendanceSummary>(
      '/attendance',
      { date: today, classes: [], total_present: 0, total_absent: 0 },
      { searchParams: { date: today } },
    ),
    safeBackendJson<IncidentsResponse>('/incidents', { incidents: [] }),
    safeBackendJson<TasksResponse>('/tasks', { tasks: [] }),
    safeBackendJson<SubstitutionsResponse>('/schedule/substitutions', { substitutions: [] }, { searchParams: { date_from: today } }),
  ])

  const attendanceRows = attendance.classes || []
  const recentIncidents = (incidents.incidents || []).slice(0, 5)
  const activeTasks = (tasks.tasks || []).filter(task => task.status !== 'completed')
  const recentTasks = activeTasks.slice(0, 5)
  const todaySubstitutions = substitutions.substitutions || []

  const totalPresent = attendance.total_present || 0
  const totalAbsent = attendance.total_absent || 0
  const openIncidents = recentIncidents.filter(incident => incident.status === 'open').length
  const pendingTasks = activeTasks.filter(task => task.status === 'pending').length
  const subCount = todaySubstitutions.length

  return (
    <DashboardClient
      stats={{ totalPresent, totalAbsent, openIncidents, pendingTasks, subCount, classCount: attendanceRows.length }}
      recentIncidents={recentIncidents}
      recentTasks={recentTasks}
      recentSubstitutions={todaySubstitutions}
    />
  )
}
