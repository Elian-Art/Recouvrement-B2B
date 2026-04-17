import { formatCurrency, formatDate } from '@/lib/utils'
import type { Debtor, Invoice, Organization } from '@/types/database'

export interface TemplateVars {
  contact_name: string
  invoice_number: string
  amount: string
  due_date: string
  payment_link: string
  org_name: string
}

export function buildTemplateVars(
  invoice: Invoice,
  debtor: Debtor,
  org: Organization
): TemplateVars {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.recouvrement-b2b.fr'
  return {
    contact_name: debtor.contact_name ?? debtor.company_name,
    invoice_number: invoice.invoice_number,
    amount: formatCurrency(invoice.amount_cents, invoice.currency),
    due_date: formatDate(invoice.due_at),
    payment_link: `${appUrl}/pay/${invoice.payment_token}`,
    org_name: org.name,
  }
}

export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return (vars as unknown as Record<string, string>)[key] ?? `{{${key}}}`
  })
}
