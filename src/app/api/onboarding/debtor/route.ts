import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({ company_name: z.string().min(1) })

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

  const { data, error } = await supabase
    .from('debtors')
    .upsert({ org_id: profile.org_id, company_name: parsed.data.company_name }, { onConflict: 'org_id,company_name' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id })
}
