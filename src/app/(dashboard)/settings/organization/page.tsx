import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrgForm } from './_components/org-form'
import { ProfileForm } from './_components/profile-form'

export default async function OrganizationSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const org = profile.organizations as { id: string; name: string; billing_email: string | null } | null

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Gérez votre organisation et votre profil.</p>
      </div>

      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold">Organisation</h2>
        <OrgForm org={org} />
      </section>

      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold">Mon profil</h2>
        <ProfileForm profile={profile} />
      </section>
    </div>
  )
}
