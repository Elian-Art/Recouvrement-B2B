'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props {
  currentPlan: string
  planName: string
  planPrice: string
  invoiceLimit: string
  features: string[]
  hasStripeCustomer: boolean
}

export function BillingCard({ currentPlan, planName, planPrice, invoiceLimit, hasStripeCustomer }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Erreur lors de l\'ouverture du portail.')
      }
    } catch {
      setError('Erreur réseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Plan actuel</CardTitle>
          <Badge>{planName}</Badge>
        </div>
        <CardDescription>{planPrice} · {invoiceLimit}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentPlan !== 'free' && (
          <Button onClick={openPortal} disabled={loading} variant="outline">
            {loading ? 'Chargement…' : 'Gérer l\'abonnement'}
          </Button>
        )}
        {currentPlan === 'free' && (
          <p className="text-sm text-muted-foreground">
            Passez à un plan payant pour accéder à toutes les fonctionnalités.
          </p>
        )}
        {!hasStripeCustomer && currentPlan !== 'free' && (
          <p className="text-xs text-muted-foreground">
            Premier clic sur &quot;Gérer l&apos;abonnement&quot; créera votre profil Stripe.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
