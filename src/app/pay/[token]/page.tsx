import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CheckoutButton } from './_components/checkout-button'

interface Props {
  params: Promise<{ token: string }>
}

export default async function PaymentPage({ params }: Props) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, debtors(*), organizations(*)')
    .eq('payment_token', token)
    .single()

  if (!invoice) notFound()

  if (invoice.status === 'paid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border max-w-md w-full p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Facture déjà réglée</h1>
          <p className="text-sm text-gray-500">Cette facture a été payée. Merci !</p>
        </div>
      </div>
    )
  }

  if (invoice.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border max-w-md w-full p-8 text-center space-y-3">
          <h1 className="text-xl font-semibold">Facture annulée</h1>
          <p className="text-sm text-gray-500">Cette facture a été annulée. Contactez l&apos;émetteur pour plus d&apos;informations.</p>
        </div>
      </div>
    )
  }

  const debtor = invoice.debtors as { company_name: string; contact_name: string | null }
  const org = invoice.organizations as { name: string }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border max-w-md w-full overflow-hidden">
        <div className="bg-gray-900 px-8 py-6 text-white">
          <p className="text-sm text-gray-400">{org.name}</p>
          <h1 className="text-2xl font-bold mt-1">
            {formatCurrency(invoice.amount_cents, invoice.currency)}
          </h1>
          <p className="text-sm text-gray-300 mt-1">Facture {invoice.invoice_number}</p>
        </div>

        <div className="px-8 py-6 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Destinataire</span>
              <span className="font-medium">{debtor.company_name}</span>
            </div>
            {debtor.contact_name && (
              <div className="flex justify-between">
                <span className="text-gray-500">Contact</span>
                <span>{debtor.contact_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Échéance</span>
              <span className={new Date(invoice.due_at) < new Date() ? 'text-red-600 font-medium' : ''}>
                {formatDate(invoice.due_at)}
              </span>
            </div>
            {invoice.description && (
              <div className="pt-1">
                <span className="text-gray-500">Description</span>
                <p className="mt-0.5 text-gray-700">{invoice.description}</p>
              </div>
            )}
          </div>

          <CheckoutButton
            invoiceId={invoice.id}
            paymentToken={token}
            amount={invoice.amount_cents}
            currency={invoice.currency}
            invoiceNumber={invoice.invoice_number}
            orgName={org.name}
          />

          <p className="text-xs text-center text-gray-400">
            Paiement sécurisé par Stripe. Vos données bancaires ne sont jamais stockées.
          </p>
        </div>
      </div>
    </div>
  )
}
