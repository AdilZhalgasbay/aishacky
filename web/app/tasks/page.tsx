import { safeBackendJson } from '@/lib/backend'
import IncidentsClient from '../incidents/IncidentsClient'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const [incidents, tasks, employees] = await Promise.all([
    safeBackendJson('/incidents', { incidents: [] }),
    safeBackendJson('/tasks', { tasks: [] }),
    safeBackendJson('/employees', { employees: [] }),
  ])

  return (
    <IncidentsClient
      incidents={incidents.incidents || []}
      tasks={tasks.tasks || []}
      employees={employees.employees || []}
      initialTab="tasks"
    />
  )
}
