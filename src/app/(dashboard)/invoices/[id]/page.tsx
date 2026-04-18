import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, invoiceStatusLabels, invoiceStatusVariant } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ReminderTimeline } from './_components/reminder-timeline'
import { PaymentLinkButton } from './_components/payment-link-button'
import { GenerateNoticeButton } from './_components/generate-notice-button'

interface Props {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, debtors(*)')
    .eq('id', id)
    .single()

  if (!invoice) notFound()

  const debtor = invoice.debtors as unknown as {
    id: string
    company_name: string
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
  }

  const { data: reminders } = await supabase
    .from('reminders')
    .select('*')
    .eq('invoice_id', id)
    .order('scheduled_at', { ascending: true })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.recouvrement-b2b.fr'
  const paymentLink = `${appUrl}/pay/${invoice.payment_token}`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Facture {invoice.invoice_number}</h1>
            <Badge variant={invoiceStatusVariant[invoice.status]}>
              {invoiceStatusLabels[invoice.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {debtor.company_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/invoices/${id}/edit`}>Modifier</Link>
          </Button>
          <PaymentLinkButton paymentLink={paymentLink} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails de la facture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant</span>
              <span className="font-medium">{formatCurrency(invoice.amount_cents, invoice.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date d&apos;émission</span>
              <span>{formatDate(invoice.issued_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Échéance</span>
              <span>{formatDate(invoice.due_at)}</span>
            </div>
            {invoice.paid_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payée le</span>
                <span>{formatDate(invoice.paid_at)}</span>
              </div>
            )}
            {invoice.description && (
              <div className="pt-1">
                <span className="text-muted-foreground">Description</span>
                <p className="mt-1">{invoice.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Débiteur</CardTitle>
            <CardDescription>
              <Link href={`/debtors/${debtor.id}/edit`} className="text-primary hover:underline">
                Voir le profil
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium">{debtor.company_name}</div>
            {debtor.contact_name && (
              <div className="text-muted-foreground">{debtor.contact_name}</div>
            )}
            {debtor.contact_email && (
              <div className="text-muted-foreground">{debtor.contact_email}</div>
            )}
            {debtor.contact_phone && (
              <div className="text-muted-foreground">{debtor.contact_phone}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-medium mb-4">Historique des relances</h2>
        <ReminderTimeline reminders={reminders ?? []} />
      </div>

      {['overdue', 'in_recovery'].includes(invoice.status) && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Escalade</h2>
            <p className="text-sm text-muted-foreground">
              Générez une mise en demeure officielle pour cette facture impayée.
            </p>
            <GenerateNoticeButton invoiceId={id} />
          </div>
        </>
      )}
    </div>
  )
}
