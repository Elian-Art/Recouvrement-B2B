'use client'

import { useActionState } from 'react'
import { updateOrganization } from '../../actions'

interface OrgFormProps {
  org: { id: string; name: string; billing_email: string | null } | null
}

interface OrgState { error?: string; success?: string }

export function OrgForm({ org }: OrgFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: OrgState, formData: FormData): Promise<OrgState> => {
      return (await updateOrganization(formData)) ?? {}
    },
    {}
  )

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Nom de l&apos;entreprise
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={org?.name ?? ''}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="billing_email" className="text-sm font-medium">
          Email de facturation
        </label>
        <input
          id="billing_email"
          name="billing_email"
          type="email"
          defaultValue={org?.billing_email ?? ''}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}
