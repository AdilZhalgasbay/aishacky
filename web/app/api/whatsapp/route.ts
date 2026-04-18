import { NextResponse } from 'next/server'

const WA_BOT_URL = 'http://127.0.0.1:3001'

export async function GET() {
  try {
    const res = await fetch(`${WA_BOT_URL}/status`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ isReady: false, qr: null, error: 'wa-bot unreachable' }, { status: 503 })
  }
}
