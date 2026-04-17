import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScenarioForm } from './_components/scenario-form'
import { StepList } from './_components/step-list'
import { AddStepForm } from './_components/add-step-form'
import { Separator } from '@/components/ui/separator'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ScenarioDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scenario } = await supabase
    .from('reminder_scenarios')
    .select('*')
    .eq('id', id)
    .single()

  if (!scenario) notFound()

  const { data: steps } = await supabase
    .from('reminder_scenario_steps')
    .select('*')
    .eq('scenario_id', id)
    .order('position', { ascending: true })

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{scenario.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez le scénario et ses étapes de relance.
        </p>
      </div>

      <ScenarioForm scenario={scenario} />

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Étapes de relance</h2>
        <p className="text-sm text-muted-foreground">
          Variables disponibles : <code className="text-xs bg-muted px-1 rounded">{'{{contact_name}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{invoice_number}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{amount}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{due_date}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{payment_link}}'}</code>{' '}
          <code className="text-xs bg-muted px-1 rounded">{'{{org_name}}'}</code>
        </p>
        <StepList steps={steps ?? []} scenarioId={id} />
      </div>

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Ajouter une étape</h2>
        <AddStepForm scenarioId={id} />
      </div>
    </div>
  )
}
