import { proxyBackend } from '@/lib/backend'

export async function POST(request: Request) {
  return proxyBackend(request, '/agent/message-audio')
}
