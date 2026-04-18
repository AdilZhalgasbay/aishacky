import { safeBackendJson } from '@/lib/backend'
import EmployeesClient from './EmployeesClient'
import DashboardWrapper from '@/components/layout/DashboardWrapper'

export const dynamic = 'force-dynamic'
export default async function EmployeesPage() {
  const employees = await safeBackendJson('/employees', { employees: [] })
  return (
    <DashboardWrapper>
      <EmployeesClient employees={employees.employees || []} />
    </DashboardWrapper>
  )
}
