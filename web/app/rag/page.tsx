import { safeBackendJson } from '@/lib/backend'
import RAGClient from './RAGClient'
import DashboardWrapper from '@/components/layout/DashboardWrapper'

export const dynamic = 'force-dynamic'
export default async function RAGPage() {
  const docs = await safeBackendJson('/rag/docs', { docs: [] })
  return (
    <DashboardWrapper>
      <RAGClient docs={docs.docs || []} />
    </DashboardWrapper>
  )
}
