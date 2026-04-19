'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { upsertTemplate, deleteTemplate } from '../actions'
import type { EmailTemplate } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface State { error?: string; success?: string }

function SaveButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" size="sm" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</Button>
}

function TemplateCard({ template, keyLabel }: { template: EmailTemplate; keyLabel: string }) {
  const [editing, setEditing] = useState(false)

  const [state, action] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      formData.set('key', template.key)
      formData.set('channel', template.channel)
      const result = await upsertTemplate(formData)
      if (result && 'error' in result) return { error: result.error }
      setEditing(false)
      return { success: 'Template mis à jour.' }
    },
    {}
  )

  if (!editing) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{keyLabel}</span>
              <Badge variant="outline" className="text-xs capitalize">{template.channel}</Badge>
              <Badge variant={template.is_active ? 'default' : 'outline'} className="text-xs">
                {template.is_active ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
              <Button size="sm" variant="destructive" onClick={() => deleteTemplate(template.id)}>Supprimer</Button>
            </div>
          </div>
          <p className="text-sm font-medium">{template.name}</p>
        </CardHeader>
        <CardContent className="pt-0">
          {template.subject && <p className="text-xs text-muted-foreground mb-1">Sujet : {template.subject}</p>}
          <p className="text-xs text-muted-foreground line-clamp-2">{template.body}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-4">
        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nom du template</Label>
            <Input name="name" defaultValue={template.name} required />
          </div>
          {template.channel === 'email' && (
            <div className="space-y-1.5">
              <Label>Sujet</Label>
              <Input name="subject" defaultValue={template.subject ?? ''} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Corps du message</Label>
            <Textarea name="body" defaultValue={template.body} rows={5} required />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id={`active-${template.id}`} name="is_active" value="true" defaultChecked={template.is_active} className="h-4 w-4" />
            <Label htmlFor={`active-${template.id}`} className="font-normal cursor-pointer">Actif</Label>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex gap-2">
            <SaveButton />
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

interface Props {
  templates: EmailTemplate[]
  templateKeys: { key: string; label: string }[]
}

export function TemplateList({ templates, templateKeys }: Props) {
  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun template personnalisé. Ajoutez-en un ci-dessous pour remplacer les templates par défaut des scénarios.</p>
  }

  return (
    <div className="space-y-3">
      {templates.map((t) => {
        const keyLabel = templateKeys.find((k) => k.key === t.key)?.label ?? t.key
        return <TemplateCard key={t.id} template={t} keyLabel={keyLabel} />
      })}
    </div>
  )
}
