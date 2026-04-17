import { safeBackendJson } from '@/lib/backend'
import EmployeesClient from './EmployeesClient'

export const dynamic = 'force-dynamic'
export default async function EmployeesPage() {
  const employees = await safeBackendJson('/employees', { employees: [] })
  return <EmployeesClient employees={employees.employees || []} />
}
