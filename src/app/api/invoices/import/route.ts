import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const rowSchema = z.object({
  invoice_number: z.string().min(1),
  amount: z.string().transform((v) => Math.round(parseFloat(v.replace(',', '.')) * 100)),
  due_date: z.string().min(1),
  debtor_company: z.string().min(1),
  debtor_email: z.string().email().optional().or(z.literal('')),
  debtor_name: z.string().optional(),
  description: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 400 })

  const { rows } = await req.json() as { rows: unknown[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  let imported = 0
  let errors = 0
  const today = new Date().toISOString().split('T')[0]

  for (const rawRow of rows) {
    const parsed = rowSchema.safeParse(rawRow)
    if (!parsed.success) { errors++; continue }

    const { invoice_number, amount, due_date, debtor_company, debtor_email, debtor_name, description } = parsed.data

    // Upsert debtor by company_name + org_id
    const { data: debtor } = await admin
      .from('debtors')
      .upsert(
        {
          org_id: profile.org_id,
          company_name: debtor_company,
          contact_name: debtor_name || null,
          contact_email: debtor_email || null,
        },
        { onConflict: 'org_id,company_name', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (!debtor) { errors++; continue }

    // Parse date — try ISO, then DD/MM/YYYY, then MM/DD/YYYY
    let parsedDate: string | null = null
    if (/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      parsedDate = due_date
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(due_date)) {
      const [d, m, y] = due_date.split('/')
      parsedDate = `${y}-${m}-${d}`
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(due_date)) {
      const [m, d, y] = due_date.split('/')
      parsedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    if (!parsedDate) { errors++; continue }

    // Insert invoice (skip on conflict = same invoice_number + org)
    const { error: invoiceError } = await admin
      .from('invoices')
      .upsert(
        {
          org_id: profile.org_id,
          debtor_id: debtor.id,
          invoice_number,
          amount_cents: amount,
          currency: 'EUR',
          issued_at: today,
          due_at: parsedDate,
          description: description || null,
        },
        { onConflict: 'org_id,invoice_number', ignoreDuplicates: true }
      )

    if (invoiceError) { errors++; continue }

    await logActivity({
      supabase: admin,
      orgId: profile.org_id,
      actorId: user.id,
      entityType: 'invoice',
      entityId: debtor.id,
      action: 'created',
      details: { source: 'csv_import', invoice_number },
    })

    imported++
  }

  return NextResponse.json({ imported, errors })
}
