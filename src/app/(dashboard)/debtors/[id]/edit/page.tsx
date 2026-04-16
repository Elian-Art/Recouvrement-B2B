import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DebtorForm } from '@/components/features/debtors/debtor-form'
import { updateDebtor } from '../../actions'

interface EditDebtorPageProps {
  params: Promise<{ id: string }>
}

export default async function EditDebtorPage({ params }: EditDebtorPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: debtor } = await supabase.from('debtors').select('*').eq('id', id).single()
  if (!debtor) notFound()

  const updateWithId = updateDebtor.bind(null, id)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/debtors"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Débiteurs
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Modifier {debtor.company_name}</h1>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <DebtorForm debtor={debtor} action={updateWithId} submitLabel="Enregistrer les modifications" />
      </div>
    </div>
  )
}
