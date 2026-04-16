import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TrendingUp, Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, invoiceStatusLabels, invoiceStatusVariant } from '@/lib/utils'
import type { InvoiceStatus } from '@/types/database'

interface KpiCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  colorClass?: string
}

function KpiCard({ title, value, sub, icon, colorClass = 'text-foreground' }: KpiCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`${colorClass} opacity-80`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load all invoices for KPI computation
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount_cents, currency, due_at, status, debtors(company_name)')
    .order('due_at', { ascending: true })

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  // KPI calculations
  const allInvoices = invoices ?? []

  const totalOutstanding = allInvoices
    .filter((i) => i.status === 'pending' || i.status === 'overdue')
    .reduce((acc, i) => acc + i.amount_cents, 0)

  const overdueInvoices = allInvoices.filter(
    (i) => i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_at) < today)
  )
  const totalOverdue = overdueInvoices.reduce((acc, i) => acc + i.amount_cents, 0)

  const paidThisMonth = allInvoices
    .filter(
      (i) =>
        i.status === 'paid' && new Date(i.due_at) >= startOfMonth
    )
    .reduce((acc, i) => acc + i.amount_cents, 0)

  const totalInvoices = allInvoices.length

  // Recent invoices (last 5)
  const recentInvoices = [...allInvoices]
    .sort((a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d&apos;ensemble de votre recouvrement</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Encours total"
          value={formatCurrency(totalOutstanding)}
          sub={`${allInvoices.filter((i) => i.status === 'pending' || i.status === 'overdue').length} facture(s) en attente`}
          icon={<TrendingUp className="h-5 w-5" />}
          colorClass="text-blue-600"
        />
        <KpiCard
          title="En retard"
          value={formatCurrency(totalOverdue)}
          sub={`${overdueInvoices.length} facture(s) dépassée(s)`}
          icon={<AlertTriangle className="h-5 w-5" />}
          colorClass={totalOverdue > 0 ? 'text-destructive' : 'text-foreground'}
        />
        <KpiCard
          title="Recouvré ce mois"
          value={formatCurrency(paidThisMonth)}
          sub="Factures marquées payées"
          icon={<CheckCircle className="h-5 w-5" />}
          colorClass="text-green-600"
        />
        <KpiCard
          title="Total factures"
          value={String(totalInvoices)}
          sub={`${allInvoices.filter((i) => i.status === 'paid').length} payée(s)`}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Recent invoices */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Factures récentes</h2>
          <Link
            href="/invoices"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aucune facture.{' '}
            <Link href="/invoices/new" className="font-medium underline-offset-4 hover:underline">
              Créer votre première facture
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {recentInvoices.map((invoice) => {
              const status = invoice.status as InvoiceStatus
              const debtor = invoice.debtors as { company_name: string } | null
              return (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{debtor?.company_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{invoice.invoice_number}</p>
                  </div>
                  <div className="flex items-center gap-4 ml-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(invoice.amount_cents, invoice.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Échéance {formatDate(invoice.due_at)}
                      </p>
                    </div>
                    <Badge variant={invoiceStatusVariant[status]}>
                      {invoiceStatusLabels[status]}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      {totalInvoices === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center space-y-3">
          <p className="font-medium">Commencez par ajouter vos débiteurs et factures</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/debtors/new"
              className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
            >
              Nouveau débiteur
            </Link>
            <Link
              href="/invoices/new"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Nouvelle facture
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
