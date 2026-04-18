import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function PATCH(req: Request) {
  try {
    const { id, subject, is_available } = await req.json()
    if (!id) throw new Error("Укажите ID сотрудника")

    const updateData: any = {}
    if (subject !== undefined) updateData.subject = subject
    if (is_available !== undefined) updateData.is_available = is_available

    const { error } = await sb.from("employees").update(updateData).eq("id", id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
