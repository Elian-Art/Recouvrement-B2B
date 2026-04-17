'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { addStep } from '../../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

interface State { error?: string; success?: string }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Ajout…' : 'Ajouter l\'étape'}
    </Button>
  )
}

export function AddStepForm({ scenarioId }: { scenarioId: string }) {
  const [channel, setChannel] = useState<'email' | 'sms'>('email')

  const addWithId = addStep.bind(null, scenarioId)

  const [state, action] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      formData.set('channel', channel)
      const result = await addWithId(formData)
      if (result && 'error' in result) return { error: result.error }
      setChannel('email')
      return { success: 'Étape ajoutée.' }
    },
    {}
  )

  return (
    <Card>
      <CardContent className="pt-4">
        <form action={action} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="delay_days">Délai après échéance (jours)</Label>
              <Input
                id="delay_days"
                name="delay_days"
                type="number"
                min="0"
                placeholder="7"
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
              <Label htmlFor="subject_template">Sujet</Label>
              <Input
                id="subject_template"
                name="subject_template"
                placeholder="Relance — Facture {{invoice_number}}"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="body_template">Corps du message</Label>
            <Textarea
              id="body_template"
              name="body_template"
              placeholder={channel === 'email'
                ? 'Bonjour {{contact_name}},\n\nNous vous rappelons que la facture {{invoice_number}} d\'un montant de {{amount}} est arrivée à échéance le {{due_date}}.\n\nPour régler en ligne : {{payment_link}}\n\nCordialement,\n{{org_name}}'
                : 'Rappel {{org_name}} : facture {{invoice_number}} de {{amount}} échue le {{due_date}}. Paiement : {{payment_link}}'
              }
              rows={5}
              required
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600">{state.success}</p>}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  )
}
