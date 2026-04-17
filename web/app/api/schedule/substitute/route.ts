import { backendJson, proxyBackend } from '@/lib/backend'
import { NextResponse } from 'next/server'

export async function GET() {
  const today = new Date().toISOString().split('T')[0]
  const data = await backendJson('/schedule/substitutions', { searchParams: { date_from: today } })
  return NextResponse.json({ substitutions: data.substitutions || [], schedules: [] })
}

export async function POST(request: Request) {
  return proxyBackend(request, '/schedule/substitute')
}
