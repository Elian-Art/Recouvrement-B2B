import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BillingCard } from './_components/billing-card'

const PLANS = {
  free:       { name: 'Gratuit',    price: '0€/mois',   invoices: '20 factures',  features: ['Relances email', '1 scénario', 'Analytics basique'] },
  starter:    { name: 'Starter',    price: '29€/mois',  invoices: '200 factures', features: ['Relances email + SMS', 'Scénarios illimités', 'Mises en demeure PDF', 'Analytics complet'] },
  pro:        { name: 'Pro',        price: '79€/mois',  invoices: 'Illimité',     features: ['Tout Starter', 'Import CSV/Excel', 'Intégrations QB/Xero', 'Priorité support'] },
  enterprise: { name: 'Enterprise', price: 'Sur devis', invoices: 'Illimité',     features: ['Tout Pro', 'White-label', 'API accès', 'SLA dédié'] },
} as const

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  const { data: org } = await supabase
    .from('organizations')
    .select('plan, stripe_customer_id, stripe_subscription_id')
    .eq('id', profile?.org_id ?? '')
    .single()

  const currentPlan = (org?.plan ?? 'free') as keyof typeof PLANS
  const planInfo = PLANS[currentPlan] ?? PLANS.free

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Abonnement & Facturation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez votre abonnement et vos informations de facturation.
        </p>
      </div>

      <BillingCard
        currentPlan={currentPlan}
        planName={planInfo.name}
        planPrice={planInfo.price}
        invoiceLimit={planInfo.invoices}
        features={planInfo.features as unknown as string[]}
        hasStripeCustomer={!!org?.stripe_customer_id}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, plan]) => (
          <div
            key={key}
            className={`rounded-xl border p-5 space-y-3 ${key === currentPlan ? 'border-primary bg-primary/5' : ''}`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{plan.name}</h3>
              <span className="text-sm font-medium">{plan.price}</span>
            </div>
            <p className="text-sm text-muted-foreground">{plan.invoices}</p>
            <ul className="space-y-1">
              {(plan.features as unknown as string[]).map((f: string) => (
                <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {key === currentPlan && (
              <span className="inline-block text-xs font-medium text-primary">Plan actuel</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
