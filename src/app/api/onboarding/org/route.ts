import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({ name: z.string().min(1) })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { data: profile } = await supabase
    .from('users').select('org_id').eq('id', user.id).single()

  if (!profile?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 400 })

  await supabase
    .from('organizations')
    .update({ name: parsed.data.name })
    .eq('id', profile.org_id)

  return NextResponse.json({ ok: true })
}
