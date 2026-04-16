'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const debtorSchema = z.object({
  company_name: z.string().min(1, 'Le nom est requis'),
  siret: z.string().optional().nullable(),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email('Email invalide').optional().or(z.literal('')).nullable(),
  contact_phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().default('FR'),
  notes: z.string().optional().nullable(),
})

async function getUserOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
  return data?.org_id ?? null
}

export async function createDebtor(formData: FormData) {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)
  if (!orgId) return { error: 'Non authentifié' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = debtorSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const data = parsed.data
  const { error } = await supabase.from('debtors').insert({
    org_id: orgId,
    company_name: data.company_name,
    siret: data.siret || null,
    contact_name: data.contact_name || null,
    contact_email: data.contact_email || null,
    contact_phone: data.contact_phone || null,
    address: data.address || null,
    city: data.city || null,
    postal_code: data.postal_code || null,
    country: data.country,
    notes: data.notes || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/debtors')
  redirect('/debtors')
}

export async function updateDebtor(id: string, formData: FormData) {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)
  if (!orgId) return { error: 'Non authentifié' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = debtorSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const data = parsed.data
  const { error } = await supabase
    .from('debtors')
    .update({
      company_name: data.company_name,
      siret: data.siret || null,
      contact_name: data.contact_name || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      address: data.address || null,
      city: data.city || null,
      postal_code: data.postal_code || null,
      country: data.country,
      notes: data.notes || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/debtors')
  revalidatePath(`/debtors/${id}/edit`)
  redirect('/debtors')
}

export async function deleteDebtor(id: string) {
  const supabase = await createClient()
  const orgId = await getUserOrgId(supabase)
  if (!orgId) return { error: 'Non authentifié' }

  const { error } = await supabase.from('debtors').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/debtors')
  return { success: true }
}
