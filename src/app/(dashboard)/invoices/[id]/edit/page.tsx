import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { InvoiceForm } from '@/components/features/invoices/invoice-form'
import { updateInvoice } from '../../actions'

interface EditInvoicePageProps {
  params: Promise<{ id: string }>
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: invoice }, { data: debtors }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', id).single(),
    supabase.from('debtors').select('id, company_name').order('company_name', { ascending: true }),
  ])

  if (!invoice) notFound()

  const updateWithId = updateInvoice.bind(null, id)

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
        <h1 className="mt-2 text-2xl font-bold">Modifier {invoice.invoice_number}</h1>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <InvoiceForm
          invoice={invoice}
          debtors={debtors ?? []}
          action={updateWithId}
          submitLabel="Enregistrer les modifications"
        />
      </div>
    </div>
  )
}
