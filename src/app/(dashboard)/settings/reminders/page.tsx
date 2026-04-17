import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function RemindersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/login')

  const { data: scenarios } = await supabase
    .from('reminder_scenarios')
    .select('*, reminder_scenario_steps(count)')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scénarios de relance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez les séquences de relance automatique pour vos factures impayées.
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/reminders/new">Nouveau scénario</Link>
        </Button>
      </div>

      {(!scenarios || scenarios.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun scénario configuré.</p>
            <Button asChild className="mt-4">
              <Link href="/settings/reminders/new">Créer un scénario</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {scenarios.map((scenario) => {
            const stepCount = (scenario.reminder_scenario_steps as unknown as { count: number }[])?.[0]?.count ?? 0
            return (
              <Card key={scenario.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{scenario.name}</CardTitle>
                      {scenario.is_default && (
                        <Badge variant="secondary">Par défaut</Badge>
                      )}
                      <Badge variant={scenario.is_active ? 'default' : 'outline'}>
                        {scenario.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/settings/reminders/${scenario.id}`}>Configurer</Link>
                    </Button>
                  </div>
                  <CardDescription>
                    {stepCount} étape{stepCount !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
