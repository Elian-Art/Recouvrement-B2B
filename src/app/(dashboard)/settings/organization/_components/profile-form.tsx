'use client'

import { useActionState } from 'react'
import { updateProfile } from '../../actions'
import type { UserProfile } from '@/types/database'

interface ProfileFormProps {
  profile: UserProfile
}

interface ProfileState { error?: string; success?: string }

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: ProfileState, formData: FormData): Promise<ProfileState> => {
      return (await updateProfile(formData)) ?? {}
    },
    {}
  )

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="full_name" className="text-sm font-medium">
          Nom complet
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          defaultValue={profile.full_name ?? ''}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Email</label>
        <input
          type="email"
          value={profile.email}
          disabled
          className="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">L&apos;email ne peut pas être modifié ici.</p>
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
