import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const paymentToken = session.metadata?.payment_token
    if (!paymentToken) {
      return NextResponse.json({ error: 'Missing payment_token metadata' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Fetch the invoice by payment token
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, org_id, amount_cents, currency')
      .eq('payment_token', paymentToken)
      .single()

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Mark invoice as paid
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: now, updated_at: now })
      .eq('id', invoice.id)

    // Create payment record
    await supabase.from('payments').insert({
      org_id: invoice.org_id,
      invoice_id: invoice.id,
      amount_cents: session.amount_total ?? invoice.amount_cents,
      currency: session.currency?.toUpperCase() ?? invoice.currency,
      stripe_payment_intent_id: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
      paid_at: now,
    })
  }

  return NextResponse.json({ received: true })
}
