import { proxyBackend } from '@/lib/backend'

export async function GET(request: Request) {
  return proxyBackend(request, '/incidents')
}

export async function POST(request: Request) {
  return proxyBackend(request, '/incidents')
}

export async function PATCH(request: Request) {
  return proxyBackend(request, '/incidents')
}
