'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  invoiceId: string
  disabled?: boolean
}

export function GenerateNoticeButton({ invoiceId, disabled }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function generate(sendEmail: boolean) {
    if (!confirm(`Générer une mise en demeure${sendEmail ? ' et l\'envoyer par email' : ''}?`)) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/formal-notices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, sendEmail }),
      })
      const data = await res.json() as { error?: string; noticeId?: string; pdfUrl?: string }
      if (!res.ok) {
        setError(data.error ?? 'Erreur inconnue')
      } else {
        router.refresh()
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  if (disabled) return null

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => generate(false)}
          disabled={loading}
        >
          {loading ? 'Génération…' : 'Mise en demeure (PDF)'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generate(true)}
          disabled={loading}
        >
          + Envoyer par email
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
