'use server'

import { redirect } from 'next/navigation'
import { stripe } from '@/lib/stripe/client'

interface CheckoutParams {
  invoiceId: string
  paymentToken: string
  amount: number
  currency: string
  invoiceNumber: string
  orgName: string
}

export async function createCheckoutSession(params: CheckoutParams) {
  const { invoiceId, paymentToken, amount, currency, invoiceNumber, orgName } = params

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.recouvrement-b2b.fr'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Facture ${invoiceNumber}`,
              description: `${orgName}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        payment_token: paymentToken,
        invoice_id: invoiceId,
      },
      success_url: `${appUrl}/pay/${paymentToken}/success`,
      cancel_url: `${appUrl}/pay/${paymentToken}`,
    })

    if (!session.url) {
      return { error: 'Impossible de créer la session de paiement.' }
    }

    redirect(session.url)
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return { error: message }
  }
}
