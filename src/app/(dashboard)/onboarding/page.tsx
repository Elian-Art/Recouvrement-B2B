import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './_components/onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('name, onboarding_completed')
    .eq('id', profile.org_id)
    .single()

  if (org?.onboarding_completed) redirect('/')

  return <OnboardingWizard orgName={org?.name ?? ''} orgId={profile.org_id} />
}
