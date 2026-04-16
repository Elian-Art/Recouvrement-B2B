'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { InvoiceStatus } from '@/types/database'

const invoiceSchema = z.object({
  debtor_id: z.string().uuid('Débiteur requis'),
  invoice_number: z.string().min(1, 'Le numéro de facture est requis'),
  amount_cents: z
    .string()
    .transform((v) => Math.round(parseFloat(v) * 100))
    .pipe(z.number().int().positive('Le montant doit être positif')),
  issued_at: z.string().min(1, 'La date d\'émission est requise'),
  due_at: z.string().min(1, 'La date d\'échéance est requise'),
  status: z.enum(['pending', 'overdue', 'paid', 'cancelled', 'in_dispute']).default('pending'),
  description: z.string().optional().nullable(),
})

async function getUserOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
  return data?.org_id ?? null
}

export async function createInvoice(formData: FormData) {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)
  if (!orgId) return { error: 'Non authentifié' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = invoiceSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const data = parsed.data
  const { error } = await supabase.from('invoices').insert({
    org_id: orgId,
    debtor_id: data.debtor_id,
    invoice_number: data.invoice_number,
    amount_cents: data.amount_cents,
    issued_at: data.issued_at,
    due_at: data.due_at,
    status: data.status,
    description: data.description || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/invoices')
  redirect('/invoices')
}

export async function updateInvoice(id: string, formData: FormData) {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)
  if (!orgId) return { error: 'Non authentifié' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = invoiceSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const data = parsed.data
  const { error } = await supabase
    .from('invoices')
    .update({
      debtor_id: data.debtor_id,
      invoice_number: data.invoice_number,
      amount_cents: data.amount_cents,
      issued_at: data.issued_at,
      due_at: data.due_at,
      status: data.status,
      description: data.description || null,
      paid_at: data.status === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}/edit`)
  redirect('/invoices')
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)
  if (!orgId) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('invoices')
    .update({
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/invoices')
  revalidatePath('/')
  return { success: true }
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)
  if (!orgId) return { error: 'Non authentifié' }

  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  revalidatePath('/')
  return { success: true }
}
