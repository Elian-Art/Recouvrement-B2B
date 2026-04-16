import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { InvoiceForm } from '@/components/features/invoices/invoice-form'
import { createInvoice } from '../actions'

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: debtors } = await supabase
    .from('debtors')
    .select('id, company_name')
    .order('company_name', { ascending: true })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Factures
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Nouvelle facture</h1>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <InvoiceForm
          debtors={debtors ?? []}
          action={createInvoice}
          submitLabel="Créer la facture"
        />
      </div>
    </div>
  )
}
