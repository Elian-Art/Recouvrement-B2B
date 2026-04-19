'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'

interface Step {
  id: number
  title: string
  description: string
}

const STEPS: Step[] = [
  { id: 1, title: 'Votre organisation', description: 'Vérifiez vos informations d\'entreprise' },
  { id: 2, title: 'Premier débiteur', description: 'Ajoutez un client débiteur' },
  { id: 3, title: 'Première facture', description: 'Créez une facture impayée' },
  { id: 4, title: 'Scénario prêt', description: 'Votre scénario de relance par défaut est configuré' },
]

interface Props {
  orgName: string
  orgId: string
}

export function OnboardingWizard({ orgName, orgId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: org name (pre-filled)
  const [name, setName] = useState(orgName)

  // Step 2: debtor
  const [companyName, setCompanyName] = useState('')
  const [debtorId, setDebtorId] = useState<string | null>(null)

  // Step 3: invoice
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [dueAt, setDueAt] = useState('')

  async function handleStep1() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Erreur lors de la mise à jour')
      setStep(2)
    } catch {
      setError('Erreur lors de la mise à jour de l\'organisation.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2() {
    if (!companyName.trim()) { setError('Nom de l\'entreprise requis.'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/debtor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName }),
      })
      const data = await res.json() as { id?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      setDebtorId(data.id ?? null)
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création du débiteur.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStep3() {
    if (!invoiceNumber.trim() || !amount || !dueAt) { setError('Tous les champs sont requis.'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: invoiceNumber,
          amount: parseFloat(amount),
          due_at: dueAt,
          debtor_id: debtorId,
        }),
      })
      if (!res.ok) throw new Error('Erreur lors de la création')
      setStep(4)
    } catch {
      setError('Erreur lors de la création de la facture.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFinish() {
    setLoading(true)
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' })
      router.push('/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Bienvenue sur Recouvrement B2B</h1>
          <p className="text-sm text-muted-foreground">Configurez votre espace en quelques étapes</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                {step > s.id ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : step === s.id ? (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground font-bold">{s.id}</div>
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground hidden sm:block">{s.title}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`h-px w-8 sm:w-16 mx-1 ${step > s.id ? 'bg-green-500' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step - 1].title}</CardTitle>
            <CardDescription>{STEPS[step - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <Label>Nom de votre organisation</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme SAS" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button onClick={handleStep1} disabled={loading || !name.trim()} className="w-full">
                  {loading ? 'Enregistrement…' : 'Continuer'} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-1.5">
                  <Label>Nom de l&apos;entreprise débitrice</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Client SARL"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button onClick={handleStep2} disabled={loading} className="w-full">
                  {loading ? 'Création…' : 'Ajouter le débiteur'} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>N° Facture</Label>
                    <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="FAC-001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Montant (€)</Label>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1500.00" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Date d&apos;échéance</Label>
                  <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button onClick={handleStep3} disabled={loading} className="w-full">
                  {loading ? 'Création…' : 'Créer la facture'} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}

            {step === 4 && (
              <>
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 space-y-1">
                  <p className="font-medium">Votre espace est prêt !</p>
                  <p>Un scénario de relance par défaut (J+7, J+14, J+21) a été créé automatiquement.</p>
                  <p>Vous pouvez le personnaliser dans <strong>Relances → Scénarios</strong>.</p>
                </div>
                <Button onClick={handleFinish} disabled={loading} className="w-full">
                  {loading ? 'Chargement…' : 'Accéder au tableau de bord'} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
