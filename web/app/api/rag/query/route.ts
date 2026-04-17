import { proxyBackend } from '@/lib/backend'

export async function POST(request: Request) {
  return proxyBackend(request, '/rag/query')
}

export async function GET(request: Request) {
  return proxyBackend(request, '/rag/docs')
}
