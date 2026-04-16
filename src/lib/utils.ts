import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { InvoiceStatus } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  pending: 'En attente',
  overdue: 'En retard',
  paid: 'Payée',
  cancelled: 'Annulée',
  in_dispute: 'En litige',
}

export const invoiceStatusVariant: Record<
  InvoiceStatus,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
> = {
  pending: 'secondary',
  overdue: 'destructive',
  paid: 'success',
  cancelled: 'outline',
  in_dispute: 'warning',
}
