'use client'

import { useState } from 'react'
import { createCheckoutSession } from '../actions'

interface Props {
  invoiceId: string
  paymentToken: string
  amount: number
  currency: string
  invoiceNumber: string
  orgName: string
}

export function CheckoutButton({ invoiceId, paymentToken, amount, currency, invoiceNumber, orgName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const result = await createCheckoutSession({ invoiceId, paymentToken, amount, currency, invoiceNumber, orgName })
      if (result.error) {
        setError(result.error)
        setLoading(false)
      }
      // On success, the server action redirects to Stripe — no client code needed
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        {loading ? 'Redirection vers le paiement…' : 'Payer maintenant'}
      </button>
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
    </div>
  )
}
