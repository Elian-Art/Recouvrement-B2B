'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type Step = 'upload' | 'mapping' | 'preview' | 'done'

interface RawRow {
  [key: string]: string
}

interface MappedInvoice {
  invoice_number: string
  amount: string
  due_date: string
  debtor_company: string
  debtor_email: string
  debtor_name?: string
  description?: string
  error?: string
}

const REQUIRED_FIELDS = ['invoice_number', 'amount', 'due_date', 'debtor_company', 'debtor_email'] as const
const FIELD_LABELS: Record<string, string> = {
  invoice_number: 'N° Facture *',
  amount: 'Montant (€) *',
  due_date: 'Échéance *',
  debtor_company: 'Société débitrice *',
  debtor_email: 'Email débiteur *',
  debtor_name: 'Nom contact',
  description: 'Description',
}

function parseFile(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  return new Promise((resolve, reject) => {
    if (file.name.endsWith('.csv')) {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const headers = result.meta.fields ?? []
          resolve({ headers, rows: result.data })
        },
        error: reject,
      })
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '' })
        const headers = data.length > 0 ? Object.keys(data[0]) : []
        resolve({ headers, rows: data })
      }
      reader.onerror = reject
      reader.readAsBinaryString(file)
    }
  })
}

function guessMapping(headers: string[]): Record<string, string> {
  const lower = headers.map((h) => h.toLowerCase())
  const guess: Record<string, string> = {}

  const patterns: Record<string, string[]> = {
    invoice_number: ['invoice', 'facture', 'number', 'num', 'ref', 'référence'],
    amount: ['amount', 'montant', 'total', 'prix'],
    due_date: ['due', 'echéance', 'echeance', 'date'],
    debtor_company: ['company', 'société', 'societe', 'entreprise', 'client'],
    debtor_email: ['email', 'mail', 'courriel'],
    debtor_name: ['contact', 'name', 'nom', 'prénom'],
    description: ['description', 'libellé', 'libelle', 'objet'],
  }

  for (const [field, keywords] of Object.entries(patterns)) {
    const idx = lower.findIndex((h) => keywords.some((k) => h.includes(k)))
    if (idx >= 0) guess[field] = headers[idx]
  }

  return guess
}

function validateRow(row: RawRow, mapping: Record<string, string>): MappedInvoice {
  const get = (field: string) => row[mapping[field] ?? '']?.trim() ?? ''
  const invoice_number = get('invoice_number')
  const amount = get('amount').replace(',', '.')
  const due_date = get('due_date')
  const debtor_company = get('debtor_company')
  const debtor_email = get('debtor_email')

  const errors: string[] = []
  if (!invoice_number) errors.push('N° facture manquant')
  if (!amount || isNaN(parseFloat(amount))) errors.push('Montant invalide')
  if (!due_date) errors.push('Échéance manquante')
  if (!debtor_company) errors.push('Société manquante')
  if (debtor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debtor_email)) errors.push('Email invalide')

  return {
    invoice_number,
    amount,
    due_date,
    debtor_company,
    debtor_email,
    debtor_name: get('debtor_name'),
    description: get('description'),
    error: errors.length > 0 ? errors.join(', ') : undefined,
  }
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<RawRow[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<MappedInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setLoading(true)
    try {
      const { headers: h, rows } = await parseFile(f)
      setHeaders(h)
      setRawRows(rows)
      setMapping(guessMapping(h))
      setStep('mapping')
    } catch {
      setImportError('Impossible de lire le fichier.')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function buildPreview() {
    const rows = rawRows.slice(0, 5).map((r) => validateRow(r, mapping))
    setPreview(rows)
    setStep('preview')
  }

  async function confirmImport() {
    setLoading(true)
    setImportError(null)
    try {
      const rows = rawRows.map((r) => validateRow(r, mapping))
      const res = await fetch('/api/invoices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json() as { imported?: number; errors?: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult({ imported: data.imported ?? 0, errors: data.errors ?? 0 })
      setStep('done')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'upload') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <svg className="h-10 w-10 text-muted-foreground mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="font-medium">Glissez votre fichier ici ou cliquez pour parcourir</p>
            <p className="text-sm text-muted-foreground mt-1">CSV, XLS, XLSX — max 5 MB</p>
          </div>
          <input
            id="file-input"
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {importError && <p className="text-sm text-destructive mt-3">{importError}</p>}
          {loading && <p className="text-sm text-muted-foreground mt-3">Lecture du fichier…</p>}

          <div className="mt-6 border-t pt-4">
            <p className="text-sm font-medium mb-2">Format attendu (colonnes CSV) :</p>
            <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded">
              invoice_number, amount, due_date, debtor_company, debtor_email, debtor_name, description
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'mapping') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapper les colonnes — {file?.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{rawRows.length} lignes détectées</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(FIELD_LABELS).map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label>{label}</Label>
                <Select
                  value={mapping[field] ?? '__none__'}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— ignorer —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— ignorer —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={buildPreview} disabled={REQUIRED_FIELDS.some((f) => !mapping[f])}>
              Prévisualiser
            </Button>
            <Button variant="outline" onClick={() => setStep('upload')}>Retour</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'preview') {
    const errorCount = preview.filter((r) => r.error).length
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aperçu (5 premières lignes)</CardTitle>
          <p className="text-sm text-muted-foreground">
            {rawRows.length} lignes au total — {errorCount > 0 ? `${errorCount} avec erreurs` : 'toutes valides'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">N° Facture</th>
                  <th className="text-left py-2 pr-4 font-medium">Montant</th>
                  <th className="text-left py-2 pr-4 font-medium">Échéance</th>
                  <th className="text-left py-2 pr-4 font-medium">Débiteur</th>
                  <th className="text-left py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono">{row.invoice_number || '—'}</td>
                    <td className="py-2 pr-4">{row.amount}€</td>
                    <td className="py-2 pr-4">{row.due_date}</td>
                    <td className="py-2 pr-4">{row.debtor_company}</td>
                    <td className="py-2">
                      {row.error
                        ? <Badge variant="destructive" className="text-xs">{row.error}</Badge>
                        : <Badge variant="secondary" className="text-xs">OK</Badge>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importError && <p className="text-sm text-destructive">{importError}</p>}

          <div className="flex gap-3">
            <Button onClick={confirmImport} disabled={loading}>
              {loading ? 'Import en cours…' : `Importer ${rawRows.length} factures`}
            </Button>
            <Button variant="outline" onClick={() => setStep('mapping')}>Retour</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // done
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Import terminé</h2>
        <p className="text-sm text-muted-foreground">
          {result?.imported} facture{result?.imported !== 1 ? 's' : ''} importée{result?.imported !== 1 ? 's' : ''}
          {(result?.errors ?? 0) > 0 ? `, ${result?.errors} ignorée${result?.errors !== 1 ? 's' : ''} (erreurs)` : ''}
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Button asChild>
            <Link href="/invoices">Voir les factures</Link>
          </Button>
          <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setResult(null) }}>
            Nouvel import
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
