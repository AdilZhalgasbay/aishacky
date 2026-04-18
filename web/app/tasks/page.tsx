import { safeBackendJson } from '@/lib/backend'
import IncidentsClient from '../incidents/IncidentsClient'
import DashboardWrapper from '@/components/layout/DashboardWrapper'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const [incidents, tasks, employees] = await Promise.all([
    safeBackendJson('/incidents', { incidents: [] }),
    safeBackendJson('/tasks', { tasks: [] }),
    safeBackendJson('/employees', { employees: [] }),
  ])

  return (
    <DashboardWrapper>
      <IncidentsClient
        incidents={incidents.incidents || []}
        tasks={tasks.tasks || []}
        employees={employees.employees || []}
        initialTab="tasks"
      />
    </DashboardWrapper>
  )
}
