import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const statusConfig = {
  generated:    { label: 'Générée',        variant: 'secondary' as const },
  sent_email:   { label: 'Envoyée (email)', variant: 'default' as const },
  sent_postal:  { label: 'Envoyée (courrier)', variant: 'default' as const },
  acknowledged: { label: 'Accusée de réception', variant: 'success' as const },
}

export default async function FormalNoticesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notices } = await supabase
    .from('formal_notices')
    .select(`
      *,
      invoices (invoice_number, amount_cents, currency),
      debtors (company_name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mises en demeure</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique des mises en demeure générées pour vos factures impayées.
        </p>
      </div>

      {(!notices || notices.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucune mise en demeure générée.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les mises en demeure se génèrent depuis le{' '}
              <Link href="/invoices" className="underline">détail d&apos;une facture</Link>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facture</TableHead>
                <TableHead>Débiteur</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Générée le</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.map((notice) => {
                const inv = notice.invoices as unknown as { invoice_number: string; amount_cents: number; currency: string } | null
                const deb = notice.debtors as unknown as { company_name: string } | null
                const { label, variant } = statusConfig[notice.status] ?? statusConfig.generated

                return (
                  <TableRow key={notice.id}>
                    <TableCell className="font-mono text-sm">
                      {inv?.invoice_number ?? '—'}
                    </TableCell>
                    <TableCell>{deb?.company_name ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {inv ? formatCurrency(inv.amount_cents, inv.currency) : '—'}
                    </TableCell>
                    <TableCell>{formatDate(notice.generated_at)}</TableCell>
                    <TableCell>
                      <Badge variant={variant}>{label}</Badge>
                    </TableCell>
                    <TableCell>
                      {notice.pdf_url ? (
                        <a
                          href={notice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline-offset-4 hover:underline"
                        >
                          Télécharger
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Indisponible</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
