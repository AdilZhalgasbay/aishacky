import { safeBackendJson } from '@/lib/backend'
import RAGClient from './RAGClient'

export const dynamic = 'force-dynamic'
export default async function RAGPage() {
  const docs = await safeBackendJson('/rag/docs', { docs: [] })
  return <RAGClient docs={docs.docs || []} />
}
