'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function PaymentLinkButton({ paymentLink }: { paymentLink: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(paymentLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? 'Copié !' : 'Copier le lien de paiement'}
    </Button>
  )
}
