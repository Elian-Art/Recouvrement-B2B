'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { createScenario } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface State { error?: string }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Création…' : 'Créer le scénario'}
    </Button>
  )
}

export default function NewScenarioPage() {
  const [state, action] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const result = await createScenario(formData)
      if (result && 'error' in result) return { error: result.error }
      return {}
    },
    {}
  )

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nouveau scénario</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Créez un scénario de relance automatique.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations du scénario</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom du scénario</Label>
              <Input
                id="name"
                name="name"
                placeholder="ex : Relance standard 30 jours"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                name="is_default"
                value="true"
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_default" className="font-normal cursor-pointer">
                Définir comme scénario par défaut
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                value="true"
                defaultChecked
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="font-normal cursor-pointer">
                Activer ce scénario
              </Label>
            </div>

            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <SubmitButton />
              <Button variant="outline" asChild>
                <Link href="/settings/reminders">Annuler</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
