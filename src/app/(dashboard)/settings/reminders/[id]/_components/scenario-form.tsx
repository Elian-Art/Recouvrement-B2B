'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { updateScenario, deleteScenario } from '../../actions'
import type { ReminderScenario } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface State { error?: string; success?: string }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  )
}

interface Props { scenario: ReminderScenario }

export function ScenarioForm({ scenario }: Props) {
  const updateWithId = updateScenario.bind(null, scenario.id)

  const [state, action] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const result = await updateWithId(formData)
      if (result && 'error' in result) return { error: result.error }
      return { success: 'Scénario mis à jour.' }
    },
    {}
  )

  async function handleDelete() {
    if (!confirm('Supprimer ce scénario ? Cette action est irréversible.')) return
    await deleteScenario(scenario.id)
    window.location.href = '/settings/reminders'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Paramètres du scénario</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" defaultValue={scenario.name} required />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              name="is_default"
              value="true"
              defaultChecked={scenario.is_default}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="is_default" className="font-normal cursor-pointer">
              Scénario par défaut
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              value="true"
              defaultChecked={scenario.is_active}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="is_active" className="font-normal cursor-pointer">
              Actif
            </Label>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600">{state.success}</p>}

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <SubmitButton />
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/reminders">Retour</Link>
              </Button>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
            >
              Supprimer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
