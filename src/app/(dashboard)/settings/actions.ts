'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateOrganization(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const name = formData.get('name') as string
  const billingEmail = formData.get('billing_email') as string

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Profil introuvable' }

  const { error } = await supabase
    .from('organizations')
    .update({ name, billing_email: billingEmail || null })
    .eq('id', profile.org_id)

  if (error) return { error: error.message }

  revalidatePath('/settings/organization')
  return { success: 'Organisation mise à jour.' }
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const fullName = formData.get('full_name') as string

  const { error } = await supabase
    .from('users')
    .update({ full_name: fullName })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/settings/organization')
  return { success: 'Profil mis à jour.' }
}

export async function updateMemberRole(memberId: string, role: 'admin' | 'member') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Only owners/admins can change roles — checked via RLS + this guard
  const { data: currentUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!currentUser || currentUser.role === 'member') {
    return { error: 'Permission insuffisante' }
  }

  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/settings/team')
  return { success: 'Rôle mis à jour.' }
}
