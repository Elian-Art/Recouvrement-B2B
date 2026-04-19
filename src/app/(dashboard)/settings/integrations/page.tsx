import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.recouvrement-b2b.fr'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: integrations } = await supabase
    .from('integrations')
    .select('provider, connected_at, last_synced_at, external_org_id')

  const qb = integrations?.find((i) => i.provider === 'quickbooks')
  const xero = integrations?.find((i) => i.provider === 'xero')

  const providers = [
    {
      key: 'quickbooks',
      name: 'QuickBooks',
      description: 'Synchronisez vos factures impayées depuis QuickBooks Online.',
      logo: 'QB',
      color: 'bg-green-600',
      integration: qb,
      connectUrl: `/api/integrations/quickbooks/connect`,
      envRequired: !!process.env.QUICKBOOKS_CLIENT_ID,
    },
    {
      key: 'xero',
      name: 'Xero',
      description: 'Synchronisez vos factures impayées depuis Xero.',
      logo: 'X',
      color: 'bg-blue-600',
      integration: xero,
      connectUrl: `/api/integrations/xero/connect`,
      envRequired: !!process.env.XERO_CLIENT_ID,
    },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Intégrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connectez vos outils comptables pour synchroniser automatiquement vos factures impayées.
        </p>
      </div>

      <div className="space-y-4">
        {providers.map((p) => (
          <Card key={p.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${p.color} flex items-center justify-center text-white font-bold text-sm`}>
                    {p.logo}
                  </div>
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <CardDescription>{p.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={p.integration ? 'default' : 'secondary'}>
                  {p.integration ? 'Connecté' : 'Non connecté'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {p.integration && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Connecté le {formatDate(p.integration.connected_at)}</p>
                  {p.integration.last_synced_at && (
                    <p>Dernière sync : {formatDate(p.integration.last_synced_at)}</p>
                  )}
                  {p.integration.external_org_id && (
                    <p>ID organisation : {p.integration.external_org_id}</p>
                  )}
                </div>
              )}
              {!p.envRequired && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">
                  Variables d&apos;environnement {p.key === 'quickbooks' ? 'QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET' : 'XERO_CLIENT_ID / XERO_CLIENT_SECRET'} non configurées.
                </p>
              )}
              <div className="flex gap-2">
                {p.integration ? (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/api/integrations/${p.key}/sync`}>Synchroniser maintenant</Link>
                    </Button>
                    <Button variant="destructive" size="sm" asChild>
                      <Link href={`/api/integrations/${p.key}/disconnect`}>Déconnecter</Link>
                    </Button>
                  </>
                ) : (
                  <Button size="sm" disabled={!p.envRequired} asChild>
                    <a href={p.connectUrl}>Connecter {p.name}</a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
