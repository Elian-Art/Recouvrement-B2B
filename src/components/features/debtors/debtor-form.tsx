'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import type { Debtor } from '@/types/database'

interface DebtorFormProps {
  debtor?: Debtor
  action: (formData: FormData) => Promise<{ error: string } | void>
  submitLabel?: string
}

interface DebtorState { error?: string }

export function DebtorForm({ debtor, action, submitLabel = 'Enregistrer' }: DebtorFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: DebtorState, formData: FormData): Promise<DebtorState> => {
      const result = await action(formData)
      if (result && 'error' in result) return { error: result.error }
      return {}
    },
    {}
  )

  const inputClass =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50'

  return (
    <form action={formAction} className="space-y-5">
      {/* Company info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="company_name" className="text-sm font-medium">
            Nom de l&apos;entreprise <span className="text-destructive">*</span>
          </label>
          <input
            id="company_name"
            name="company_name"
            type="text"
            required
            defaultValue={debtor?.company_name}
            className={inputClass}
            placeholder="Acme SARL"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="siret" className="text-sm font-medium">
            SIRET
          </label>
          <input
            id="siret"
            name="siret"
            type="text"
            defaultValue={debtor?.siret ?? ''}
            className={inputClass}
            placeholder="12345678901234"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="country" className="text-sm font-medium">
            Pays
          </label>
          <input
            id="country"
            name="country"
            type="text"
            defaultValue={debtor?.country ?? 'FR'}
            className={inputClass}
          />
        </div>
      </div>

      {/* Contact */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium text-muted-foreground mb-3">Contact</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="contact_name" className="text-sm font-medium">
              Nom du contact
            </label>
            <input
              id="contact_name"
              name="contact_name"
              type="text"
              defaultValue={debtor?.contact_name ?? ''}
              className={inputClass}
              placeholder="Jean Dupont"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="contact_phone" className="text-sm font-medium">
              Téléphone
            </label>
            <input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              defaultValue={debtor?.contact_phone ?? ''}
              className={inputClass}
              placeholder="+33 6 00 00 00 00"
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="contact_email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={debtor?.contact_email ?? ''}
              className={inputClass}
              placeholder="contact@acme.fr"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium text-muted-foreground mb-3">Adresse</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="address" className="text-sm font-medium">
              Adresse
            </label>
            <input
              id="address"
              name="address"
              type="text"
              defaultValue={debtor?.address ?? ''}
              className={inputClass}
              placeholder="12 rue de la Paix"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="postal_code" className="text-sm font-medium">
              Code postal
            </label>
            <input
              id="postal_code"
              name="postal_code"
              type="text"
              defaultValue={debtor?.postal_code ?? ''}
              className={inputClass}
              placeholder="75001"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="city" className="text-sm font-medium">
              Ville
            </label>
            <input
              id="city"
              name="city"
              type="text"
              defaultValue={debtor?.city ?? ''}
              className={inputClass}
              placeholder="Paris"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="border-t pt-4 space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes internes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={debtor?.notes ?? ''}
          className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Informations supplémentaires…"
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
          disabled={isPending}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Enregistrement…' : submitLabel}
        </button>
        <Link
          href="/debtors"
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
        >
          Annuler
        </Link>
      </div>
    </form>
  )
}
