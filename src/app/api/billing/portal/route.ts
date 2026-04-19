import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 400 })

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id, name, billing_email')
    .eq('id', profile.org_id)
    .single()

  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.recouvrement-b2b.fr'

  // Create Stripe customer if none exists
  let customerId = org.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      email: org.billing_email ?? undefined,
      metadata: { org_id: profile.org_id },
    })
    customerId = customer.id
    await supabase
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', profile.org_id)
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings/billing`,
  })

  return NextResponse.json({ url: session.url })
}
