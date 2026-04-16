'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteDebtor } from '@/app/(dashboard)/debtors/actions'

interface DeleteDebtorButtonProps {
  id: string
  companyName: string
}

export function DeleteDebtorButton({ id, companyName }: DeleteDebtorButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, setIsPending] = useState(false)

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Confirmer ?</span>
        <button
          onClick={async () => {
            setIsPending(true)
            await deleteDebtor(id)
          }}
          disabled={isPending}
          className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
        >
          {isPending ? '…' : 'Oui'}
        </button>
        <span className="text-xs text-muted-foreground">/</span>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-medium hover:underline"
        >
          Non
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Supprimer ${companyName}`}
      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
