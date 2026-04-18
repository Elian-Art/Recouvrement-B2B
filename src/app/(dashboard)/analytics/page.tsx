import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MonthlyCollectionsChart, AgingReportChart, RecoveryRateChart } from './_components/charts'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()

  // ---- Monthly collections: last 12 months -------------------
  const twelveMonthsAgo = new Date(now)
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
  twelveMonthsAgo.setDate(1)

  const { data: invoicesAll } = await supabase
    .from('invoices')
    .select('amount_cents, status, issued_at, paid_at')
    .gte('issued_at', twelveMonthsAgo.toISOString().split('T')[0])

  // Build month buckets
  const monthKeys: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthlyMap: Record<string, { invoiced: number; collected: number }> = {}
  for (const k of monthKeys) monthlyMap[k] = { invoiced: 0, collected: 0 }

  for (const inv of invoicesAll ?? []) {
    const issuedKey = inv.issued_at.slice(0, 7)
    if (monthlyMap[issuedKey]) monthlyMap[issuedKey].invoiced += inv.amount_cents
    if (inv.status === 'paid' && inv.paid_at) {
      const paidKey = inv.paid_at.slice(0, 7)
      if (monthlyMap[paidKey]) monthlyMap[paidKey].collected += inv.amount_cents
    }
  }

  const monthlyData = monthKeys.map((k) => {
    const [, month] = k.split('-')
    const label = new Date(k + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    return { month: label, ...monthlyMap[k] }
  })

  // ---- Aging report (overdue invoices) -----------------------
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('amount_cents, due_at')
    .in('status', ['overdue', 'in_recovery', 'formal_notice'])

  const aging = { '0-30j': 0, '31-60j': 0, '61-90j': 0, '90j+': 0 }
  const agingCount = { '0-30j': 0, '31-60j': 0, '61-90j': 0, '90j+': 0 }

  for (const inv of overdueInvoices ?? []) {
    const days = Math.floor((now.getTime() - new Date(inv.due_at).getTime()) / (1000 * 60 * 60 * 24))
    const bucket = days <= 30 ? '0-30j' : days <= 60 ? '31-60j' : days <= 90 ? '61-90j' : '90j+'
    aging[bucket] += inv.amount_cents
    agingCount[bucket]++
  }

  const agingData = Object.entries(aging).map(([bucket, amount]) => ({
    bucket,
    amount,
    count: agingCount[bucket as keyof typeof agingCount],
  }))

  // ---- Recovery rate per month --------------------------------
  const recoveryData = monthKeys.map((k) => {
    const { invoiced, collected } = monthlyMap[k]
    const label = new Date(k + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    return {
      month: label,
      rate: invoiced > 0 ? Math.round((collected / invoiced) * 100 * 10) / 10 : 0,
    }
  })

  // ---- KPI totals ---------------------------------------------
  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('amount_cents, status')

  const totalOutstanding = (allInvoices ?? [])
    .filter((i) => ['overdue', 'in_recovery', 'formal_notice'].includes(i.status))
    .reduce((s, i) => s + i.amount_cents, 0)

  const totalPaid = (allInvoices ?? [])
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amount_cents, 0)

  const totalInvoiced = (allInvoices ?? []).reduce((s, i) => s + i.amount_cents, 0)
  const overallRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0

  const { data: noticeCount } = await supabase
    .from('formal_notices')
    .select('id', { count: 'exact', head: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Performances de recouvrement et état du portefeuille.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Encours total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalOutstanding, 'EUR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total recouvré</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid, 'EUR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de recouvrement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overallRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mises en demeure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{noticeCount?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facturé vs Recouvré (12 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyCollectionsChart data={monthlyData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Taux de recouvrement mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            <RecoveryRateChart data={recoveryData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analyse de l&apos;ancienneté des créances (Aging Report)</CardTitle>
        </CardHeader>
        <CardContent>
          <AgingReportChart data={agingData} />
          <div className="grid grid-cols-4 gap-4 mt-4">
            {agingData.map((b) => (
              <div key={b.bucket} className="text-center text-sm">
                <p className="font-medium">{b.bucket}</p>
                <p className="text-muted-foreground">{b.count} facture{b.count !== 1 ? 's' : ''}</p>
                <p className="font-semibold text-orange-600">{formatCurrency(b.amount, 'EUR')}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
