import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const entityLabels: Record<string, string> = {
  invoice: 'Facture',
  reminder: 'Relance',
  payment: 'Paiement',
  formal_notice: 'Mise en demeure',
  debtor: 'Débiteur',
}

const actionConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info' }> = {
  created:        { label: 'Créé', variant: 'secondary' },
  updated:        { label: 'Modifié', variant: 'outline' },
  sent:           { label: 'Envoyé', variant: 'default' },
  sent_email:     { label: 'Envoyé (email)', variant: 'default' },
  paid:           { label: 'Payé', variant: 'success' },
  generated:      { label: 'Généré', variant: 'info' },
  auto_escalated: { label: 'Escalade automatique', variant: 'destructive' },
  failed:         { label: 'Échoué', variant: 'destructive' },
}

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: logs } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Journal d&apos;activité</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Audit trail de toutes les actions effectuées sur votre compte.
        </p>
      </div>

      {(!logs || logs.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucune activité enregistrée.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          <ul className="space-y-3">
            {logs.map((log) => {
              const { label: actionLabel, variant } = actionConfig[log.action] ?? { label: log.action, variant: 'secondary' as const }
              const entityLabel = entityLabels[log.entity_type] ?? log.entity_type
              const details = log.details as Record<string, string> | null

              return (
                <li key={log.id} className="relative pl-12">
                  <div className="absolute left-0 top-2 h-8 w-8 rounded-full border-2 border-border bg-background flex items-center justify-center">
                    <span className="text-xs font-bold text-muted-foreground">
                      {entityLabel.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="bg-card border rounded-lg px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={variant} className="text-xs">{actionLabel}</Badge>
                      <span className="text-sm font-medium">{entityLabel}</span>
                      {details?.invoice_number && (
                        <span className="text-xs text-muted-foreground font-mono">
                          #{details.invoice_number}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    {log.actor_id === null && (
                      <p className="text-xs text-muted-foreground">Par le système (cron)</p>
                    )}
                    {details?.to && (
                      <p className="text-xs text-muted-foreground">Envoyé à : {details.to}</p>
                    )}
                    {details?.channel && (
                      <p className="text-xs text-muted-foreground capitalize">Canal : {details.channel}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
