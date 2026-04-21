export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/features/dashboard/sidebar'
import { Header } from '@/components/features/dashboard/header'
import { I18nProvider } from '@/lib/i18n/provider'
import fr from '@/messages/fr.json'
import en from '@/messages/en.json'

const messages = { fr, en } as Record<string, Record<string, unknown>>

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // Profile missing for authenticated user — sign out to break any redirect loop
    await supabase.auth.signOut()
    redirect('/login')
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, locale, onboarding_completed')
    .eq('id', profile.org_id)
    .single()

  const orgName = org?.name ?? ''
  const locale = (org?.locale ?? 'fr') as 'fr' | 'en'

  return (
    <I18nProvider locale={locale} messages={messages[locale] ?? fr}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header user={profile} orgName={orgName} />
          <main className="flex-1 overflow-y-auto bg-muted/20 p-6">{children}</main>
        </div>
      </div>
    </I18nProvider>
  )
}
