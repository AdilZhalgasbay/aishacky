import { proxyBackend } from '@/lib/backend'

export async function GET(request: Request) {
  return proxyBackend(request, '/attendance')
}

export async function POST(request: Request) {
  return proxyBackend(request, '/attendance')
}

export async function PATCH(request: Request) {
  return proxyBackend(request, '/attendance')
}
