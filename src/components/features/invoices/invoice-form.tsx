'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import type { Debtor, Invoice } from '@/types/database'

interface InvoiceFormProps {
  invoice?: Invoice
  debtors: Pick<Debtor, 'id' | 'company_name'>[]
  action: (formData: FormData) => Promise<{ error: string } | void>
  submitLabel?: string
}

interface InvoiceState { error?: string }

const STATUS_OPTIONS = [
  { value: 'pending', label: 'En attente' },
  { value: 'overdue', label: 'En retard' },
  { value: 'paid', label: 'Payée' },
  { value: 'cancelled', label: 'Annulée' },
  { value: 'in_dispute', label: 'En litige' },
]

export function InvoiceForm({ invoice, debtors, action, submitLabel = 'Enregistrer' }: InvoiceFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: InvoiceState, formData: FormData): Promise<InvoiceState> => {
      const result = await action(formData)
      if (result && 'error' in result) return { error: result.error }
      return {}
    },
    {} as InvoiceState
  )

  const inputClass =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50'

  // Convert stored amount in cents back to euros for display
  const defaultAmount = invoice ? (invoice.amount_cents / 100).toFixed(2) : ''
  const defaultIssuedAt = invoice?.issued_at ?? new Date().toISOString().split('T')[0]
  const defaultDueAt = invoice?.due_at ?? ''

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Debtor */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="debtor_id" className="text-sm font-medium">
            Débiteur <span className="text-destructive">*</span>
          </label>
          <select
            id="debtor_id"
            name="debtor_id"
            required
            defaultValue={invoice?.debtor_id ?? ''}
            className={inputClass}
          >
            <option value="" disabled>
              Sélectionner un débiteur…
            </option>
            {debtors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.company_name}
              </option>
            ))}
          </select>
          {debtors.length === 0 && (
            <p className="text-xs text-muted-foreground">
              <Link href="/debtors/new" className="underline underline-offset-4">
                Créez d&apos;abord un débiteur
              </Link>
            </p>
          )}
        </div>

        {/* Invoice number */}
        <div className="space-y-1.5">
          <label htmlFor="invoice_number" className="text-sm font-medium">
            N° de facture <span className="text-destructive">*</span>
          </label>
          <input
            id="invoice_number"
            name="invoice_number"
            type="text"
            required
            defaultValue={invoice?.invoice_number ?? ''}
            className={inputClass}
            placeholder="FA-2026-001"
          />
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label htmlFor="amount_cents" className="text-sm font-medium">
            Montant (€) <span className="text-destructive">*</span>
          </label>
          <input
            id="amount_cents"
            name="amount_cents"
            type="number"
            required
            min="0.01"
            step="0.01"
            defaultValue={defaultAmount}
            className={inputClass}
            placeholder="1500.00"
          />
        </div>

        {/* Issued at */}
        <div className="space-y-1.5">
          <label htmlFor="issued_at" className="text-sm font-medium">
            Date d&apos;émission <span className="text-destructive">*</span>
          </label>
          <input
            id="issued_at"
            name="issued_at"
            type="date"
            required
            defaultValue={defaultIssuedAt}
            className={inputClass}
          />
        </div>

        {/* Due at */}
        <div className="space-y-1.5">
          <label htmlFor="due_at" className="text-sm font-medium">
            Date d&apos;échéance <span className="text-destructive">*</span>
          </label>
          <input
            id="due_at"
            name="due_at"
            type="date"
            required
            defaultValue={defaultDueAt}
            className={inputClass}
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Statut
          </label>
          <select
            id="status"
            name="status"
            defaultValue={invoice?.status ?? 'pending'}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={invoice?.description ?? ''}
          className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Détail des prestations…"
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || debtors.length === 0}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Enregistrement…' : submitLabel}
        </button>
        <Link
          href="/invoices"
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
        >
          Annuler
        </Link>
      </div>
    </form>
  )
}
