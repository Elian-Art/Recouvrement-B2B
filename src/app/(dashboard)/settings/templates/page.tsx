import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateList } from './_components/template-list'
import { AddTemplateForm } from './_components/add-template-form'
import { Separator } from '@/components/ui/separator'

const TEMPLATE_KEYS = [
  { key: 'reminder_1',    label: '1ère relance' },
  { key: 'reminder_2',    label: '2ème relance' },
  { key: 'reminder_final', label: 'Relance finale' },
  { key: 'formal_notice', label: 'Mise en demeure' },
]

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('key', { ascending: true })

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Templates email & SMS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personnalisez les messages envoyés à vos débiteurs. Variables disponibles :{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{contact_name}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{invoice_number}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{amount}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{due_date}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{payment_link}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{org_name}}'}</code>
        </p>
      </div>

      <TemplateList templates={templates ?? []} templateKeys={TEMPLATE_KEYS} />

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Ajouter un template</h2>
        <AddTemplateForm templateKeys={TEMPLATE_KEYS} />
      </div>
    </div>
  )
}
