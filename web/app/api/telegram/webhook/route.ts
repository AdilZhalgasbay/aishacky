import { proxyBackend } from '@/lib/backend'

export async function POST(request: Request) {
  return proxyBackend(request, '/telegram/simulate')
}

export async function GET(request: Request) {
  return proxyBackend(request, '/telegram/messages')
}
