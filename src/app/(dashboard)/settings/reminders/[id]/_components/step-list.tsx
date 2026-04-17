'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateStep, deleteStep } from '../../actions'
import type { ReminderScenarioStep } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface StepState { error?: string; success?: string }

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  )
}

function StepCard({ step, scenarioId }: { step: ReminderScenarioStep; scenarioId: string }) {
  const [editing, setEditing] = useState(false)
  const [channel, setChannel] = useState(step.channel)

  const updateWithIds = updateStep.bind(null, step.id, scenarioId)

  const [state, action] = useActionState(
    async (_prev: StepState, formData: FormData): Promise<StepState> => {
      formData.set('channel', channel)
      const result = await updateWithIds(formData)
      if (result && 'error' in result) return { error: result.error }
      setEditing(false)
      return { success: 'Étape mise à jour.' }
    },
    {}
  )

  async function handleDelete() {
    if (!confirm('Supprimer cette étape ?')) return
    await deleteStep(step.id, scenarioId)
  }

  const channelLabel = step.channel === 'email' ? 'Email' : 'SMS'

  if (!editing) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Étape {step.position + 1}
              </span>
              <Badge variant="outline">{channelLabel}</Badge>
              <span className="text-sm">J+{step.delay_days}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Modifier
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Supprimer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          {step.subject_template && (
            <p className="text-sm"><span className="text-muted-foreground">Sujet :</span> {step.subject_template}</p>
          )}
          <p className="text-sm text-muted-foreground line-clamp-2">{step.body_template}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-4">
        <form action={action} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`delay-${step.id}`}>Délai (jours)</Label>
              <Input
                id={`delay-${step.id}`}
                name="delay_days"
                type="number"
                min="0"
                defaultValue={step.delay_days}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as 'email' | 'sms')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {channel === 'email' && (
            <div className="space-y-1.5">
              <Label htmlFor={`subject-${step.id}`}>Sujet</Label>
              <Input
                id={`subject-${step.id}`}
                name="subject_template"
                defaultValue={step.subject_template ?? ''}
                placeholder="Relance facture {{invoice_number}}"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`body-${step.id}`}>Corps du message</Label>
            <Textarea
              id={`body-${step.id}`}
              name="body_template"
              defaultValue={step.body_template}
              rows={4}
              required
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            <SaveButton />
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

interface Props {
  steps: ReminderScenarioStep[]
  scenarioId: string
}

export function StepList({ steps, scenarioId }: Props) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune étape configurée. Ajoutez une première étape ci-dessous.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <StepCard key={step.id} step={step} scenarioId={scenarioId} />
      ))}
    </div>
  )
}
