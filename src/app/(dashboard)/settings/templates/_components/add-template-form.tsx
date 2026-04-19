'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { upsertTemplate } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

interface State { error?: string; success?: string }

function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" size="sm" disabled={pending}>{pending ? 'Enregistrement…' : 'Ajouter le template'}</Button>
}

export function AddTemplateForm({ templateKeys }: { templateKeys: { key: string; label: string }[] }) {
  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [key, setKey] = useState(templateKeys[0]?.key ?? 'reminder_1')

  const [state, action] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      formData.set('channel', channel)
      formData.set('key', key)
      const result = await upsertTemplate(formData)
      if (result && 'error' in result) return { error: result.error }
      return { success: result?.success }
    },
    {}
  )

  return (
    <Card>
      <CardContent className="pt-4">
        <form action={action} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type de relance</Label>
              <Select value={key} onValueChange={setKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templateKeys.map((k) => (
                    <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as 'email' | 'sms')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nom du template</Label>
            <Input name="name" placeholder="ex : Relance douce — Email" required />
          </div>

          {channel === 'email' && (
            <div className="space-y-1.5">
              <Label>Sujet</Label>
              <Input name="subject" placeholder="Rappel — Facture {{invoice_number}}" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Corps du message</Label>
            <Textarea
              name="body"
              placeholder={channel === 'email'
                ? 'Bonjour {{contact_name}},\n\nVotre facture {{invoice_number}}…'
                : 'Rappel {{org_name}}: Facture {{invoice_number}} {{amount}}…'
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
