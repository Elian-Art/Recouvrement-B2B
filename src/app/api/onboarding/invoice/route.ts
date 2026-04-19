import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  invoice_number: z.string().min(1),
  amount: z.number().positive(),
  due_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  debtor_id: z.string().uuid(),
})

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

  const { error } = await supabase.from('invoices').insert({
    org_id: profile.org_id,
    debtor_id: parsed.data.debtor_id,
    invoice_number: parsed.data.invoice_number,
    amount_cents: Math.round(parsed.data.amount * 100),
    issued_at: new Date().toISOString().split('T')[0],
    due_at: parsed.data.due_at,
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
