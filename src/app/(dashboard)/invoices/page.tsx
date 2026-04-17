import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Pencil, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeleteInvoiceButton } from '@/components/features/invoices/delete-invoice-button'
import { formatCurrency, formatDate, invoiceStatusLabels, invoiceStatusVariant } from '@/lib/utils'
import type { InvoiceStatus } from '@/types/database'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount_cents, currency, due_at, status, debtors(company_name)')
    .order('due_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Factures</h1>
          <p className="text-sm text-muted-foreground">
            {invoices?.length ?? 0} facture{(invoices?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nouvelle facture
        </Link>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Facture</TableHead>
              <TableHead>Débiteur</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices?.map((invoice) => {
              const status = invoice.status as InvoiceStatus
              const debtor = invoice.debtors as { company_name: string } | null

              return (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                  <TableCell>{debtor?.company_name ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(invoice.amount_cents, invoice.currency)}
                  </TableCell>
                  <TableCell>{formatDate(invoice.due_at)}</TableCell>
                  <TableCell>
                    <Badge variant={invoiceStatusVariant[status]}>
                      {invoiceStatusLabels[status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Voir le détail"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/invoices/${invoice.id}/edit`}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <DeleteInvoiceButton
                        id={invoice.id}
                        invoiceNumber={invoice.invoice_number}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {(!invoices || invoices.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Aucune facture.{' '}
                  <Link
                    href="/invoices/new"
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    Créer une facture
                  </Link>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
