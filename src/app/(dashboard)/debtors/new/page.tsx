import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DebtorForm } from '@/components/features/debtors/debtor-form'
import { createDebtor } from '../actions'

export default function NewDebtorPage() {
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
        <h1 className="mt-2 text-2xl font-bold">Nouveau débiteur</h1>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <DebtorForm action={createDebtor} submitLabel="Créer le débiteur" />
      </div>
    </div>
  )
}
