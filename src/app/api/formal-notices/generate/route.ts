import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateFormalNoticePDF } from '@/lib/pdf/formal-notice'
import { logActivity } from '@/lib/activity'
import { sendReminderEmail } from '@/lib/email/resend'
import { formatCurrency } from '@/lib/utils'
import type { Invoice, Debtor, Organization } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Auth: must be a logged-in user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { invoiceId, sendEmail = false } = await req.json() as {
    invoiceId: string
    sendEmail?: boolean
  }

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch invoice + debtor + org
  const { data: rawInvoice } = await admin
    .from('invoices')
    .select('*, debtors(*), organizations(*)')
    .eq('id', invoiceId)
    .single()

  if (!rawInvoice) {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  }

  const invoice = rawInvoice as Invoice & { debtors: Debtor; organizations: Organization }
  const debtor = invoice.debtors
  const org = invoice.organizations

  const now = new Date()
  const generatedAt = now.toISOString()

  // Generate PDF buffer
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generateFormalNoticePDF({ invoice, debtor, org, generatedAt })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'PDF generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Upload to Supabase Storage
  const fileName = `${invoice.org_id}/${invoiceId}/${now.getTime()}-mise-en-demeure.pdf`
  const { error: uploadError } = await admin.storage
    .from('formal-notices')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get signed URL (valid 7 days)
  const { data: signedUrl } = await admin.storage
    .from('formal-notices')
    .createSignedUrl(fileName, 60 * 60 * 24 * 7)

  const pdfUrl = signedUrl?.signedUrl ?? null

  // Create formal_notices record
  const { data: notice, error: noticeError } = await admin
    .from('formal_notices')
    .insert({
      org_id: invoice.org_id,
      invoice_id: invoiceId,
      debtor_id: debtor.id,
      pdf_url: pdfUrl,
      status: 'generated',
      generated_at: generatedAt,
    })
    .select('id')
    .single()

  if (noticeError || !notice) {
    return NextResponse.json({ error: noticeError?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Update invoice status to 'formal_notice'
  await admin
    .from('invoices')
    .update({ status: 'formal_notice', updated_at: generatedAt })
    .eq('id', invoiceId)

  // Log activity
  await logActivity({
    supabase: admin,
    orgId: invoice.org_id,
    actorId: user.id,
    entityType: 'formal_notice',
    entityId: notice.id,
    action: 'generated',
    details: { invoice_id: invoiceId, invoice_number: invoice.invoice_number },
  })

  // Optionally send by email
  if (sendEmail && debtor.contact_email) {
    try {
      await sendReminderEmail({
        to: debtor.contact_email,
        subject: `Mise en demeure — Facture ${invoice.invoice_number}`,
        body: `Bonjour ${debtor.contact_name ?? debtor.company_name},\n\nVeuillez trouver ci-joint notre mise en demeure concernant la facture ${invoice.invoice_number} d'un montant de ${formatCurrency(invoice.amount_cents, invoice.currency)}.\n\nVous disposez de 8 jours pour procéder au règlement.\n\nCordialement,\n${org.name}`,
        fromName: org.name,
      })

      await admin
        .from('formal_notices')
        .update({ status: 'sent_email', sent_at: new Date().toISOString() })
        .eq('id', notice.id)

      await logActivity({
        supabase: admin,
        orgId: invoice.org_id,
        actorId: user.id,
        entityType: 'formal_notice',
        entityId: notice.id,
        action: 'sent_email',
        details: { to: debtor.contact_email },
      })
    } catch {
      // Email failure is non-blocking — notice already created
    }
  }

  return NextResponse.json({ noticeId: notice.id, pdfUrl })
}
