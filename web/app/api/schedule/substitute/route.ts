import { backendJson, proxyBackend } from '@/lib/backend'
import { getDemoDate } from '@/lib/dateUtils'
import { NextResponse } from 'next/server'

export async function GET() {
  const today = getDemoDate()
  const data: any = await backendJson('/schedule/substitutions', { searchParams: { date_from: today } })
  return NextResponse.json({ substitutions: data?.substitutions || [], schedules: [] })
}

export async function POST(request: Request) {
  return proxyBackend(request, '/schedule/substitute')
}
