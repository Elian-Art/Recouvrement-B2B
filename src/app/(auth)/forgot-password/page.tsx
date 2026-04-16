'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { resetPassword } from '@/lib/supabase/actions'

interface ForgotState {
  error?: string
  success?: string
}

const initialState: ForgotState = {}

export default function ForgotPasswordPage() {
  const [state, action, isPending] = useActionState(
    async (_prev: ForgotState, formData: FormData) => {
      formData.set('origin', window.location.origin)
      const result = await resetPassword(formData)
      return (result ?? {}) as ForgotState
    },
    initialState
  )

  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recevez un lien de réinitialisation par email
        </p>
      </div>

      {state.success ? (
        <div className="space-y-4">
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {state.success}
          </p>
          <Link
            href="/login"
            className="inline-flex h-9 w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
          >
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vous@entreprise.com"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  )
}
