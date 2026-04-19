'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

async function getOrgId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, orgId: null as null }
  const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
  return { supabase, orgId: data?.org_id ?? null }
}

const templateSchema = z.object({
  key: z.string().min(1),
  channel: z.enum(['email', 'sms']),
  name: z.string().min(1, 'Le nom est requis'),
  subject: z.string().optional().nullable(),
  body: z.string().min(1, 'Le corps est requis'),
  is_active: z.coerce.boolean().optional(),
})

export async function upsertTemplate(formData: FormData) {
  const { supabase, orgId } = await getOrgId()
  if (!orgId) return { error: 'Non authentifié' }

  const parsed = templateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('email_templates')
    .upsert(
      { org_id: orgId, ...parsed.data, subject: parsed.data.subject || null },
      { onConflict: 'org_id,key,channel' }
    )

  if (error) return { error: error.message }

  revalidatePath('/settings/templates')
  return { success: 'Template enregistré.' }
}

export async function deleteTemplate(id: string) {
  const { supabase, orgId } = await getOrgId()
  if (!orgId) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/settings/templates')
  return { success: true }
}
