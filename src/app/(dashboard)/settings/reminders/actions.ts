'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ---- helpers ------------------------------------------------

async function getOrgId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, orgId: null as null }
  const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
  return { supabase, orgId: data?.org_id ?? null }
}

// ---- scenarios CRUD -----------------------------------------

const scenarioSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  is_default: z.coerce.boolean().optional(),
  is_active: z.coerce.boolean().optional(),
})

export async function createScenario(formData: FormData) {
  const { supabase, orgId } = await getOrgId()
  if (!orgId) return { error: 'Non authentifié' }

  const parsed = scenarioSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data, error } = await supabase
    .from('reminder_scenarios')
    .insert({ org_id: orgId, ...parsed.data })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/settings/reminders')
  redirect(`/settings/reminders/${data.id}`)
}

export async function updateScenario(id: string, formData: FormData) {
  const { supabase, orgId } = await getOrgId()
  if (!orgId) return { error: 'Non authentifié' }

  const parsed = scenarioSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('reminder_scenarios')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/settings/reminders')
  revalidatePath(`/settings/reminders/${id}`)
  return { success: 'Scénario mis à jour.' }
}

export async function deleteScenario(id: string) {
  const { supabase, orgId } = await getOrgId()
  if (!orgId) return { error: 'Non authentifié' }

  const { error } = await supabase.from('reminder_scenarios').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/settings/reminders')
  return { success: true }
}

// ---- steps CRUD ---------------------------------------------

const stepSchema = z.object({
  delay_days: z.coerce.number().int().min(0, 'Délai ≥ 0'),
  channel: z.enum(['email', 'sms']),
  subject_template: z.string().optional().nullable(),
  body_template: z.string().min(1, 'Le corps est requis'),
  position: z.coerce.number().int().min(0).optional(),
})

export async function addStep(scenarioId: string, formData: FormData) {
  const { supabase, orgId } = await getOrgId()
  if (!orgId) return { error: 'Non authentifié' }

  // Verify scenario belongs to this org
  const { data: scenario } = await supabase
    .from('reminder_scenarios')
    .select('id')
    .eq('id', scenarioId)
    .single()
  if (!scenario) return { error: 'Scénario introuvable' }

  const raw = Object.fromEntries(formData)
  const parsed = stepSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Auto-set position to max+1
  const { data: existing } = await supabase
    .from('reminder_scenario_steps')
    .select('position')
    .eq('scenario_id', scenarioId)
    .order('position', { ascending: false })
    .limit(1)
  const nextPos = (existing?.[0]?.position ?? -1) + 1

  const { error } = await supabase.from('reminder_scenario_steps').insert({
    scenario_id: scenarioId,
    position: nextPos,
    delay_days: parsed.data.delay_days,
    channel: parsed.data.channel,
    subject_template: parsed.data.subject_template || null,
    body_template: parsed.data.body_template,
  })

  if (error) return { error: error.message }

  revalidatePath(`/settings/reminders/${scenarioId}`)
  return { success: true }
}

export async function updateStep(stepId: string, scenarioId: string, formData: FormData) {
  const { supabase, orgId } = await getOrgId()
  if (!orgId) return { error: 'Non authentifié' }

  const parsed = stepSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('reminder_scenario_steps')
    .update({
      delay_days: parsed.data.delay_days,
      channel: parsed.data.channel,
      subject_template: parsed.data.subject_template || null,
      body_template: parsed.data.body_template,
    })
    .eq('id', stepId)

  if (error) return { error: error.message }

  revalidatePath(`/settings/reminders/${scenarioId}`)
  return { success: true }
}

export async function deleteStep(stepId: string, scenarioId: string) {
  const { supabase } = await getOrgId()

  const { error } = await supabase.from('reminder_scenario_steps').delete().eq('id', stepId)
  if (error) return { error: error.message }

  revalidatePath(`/settings/reminders/${scenarioId}`)
  return { success: true }
}
