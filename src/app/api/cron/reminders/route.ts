import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminderEmail } from '@/lib/email/resend'
import { sendReminderSMS } from '@/lib/sms/twilio'
import { buildTemplateVars, interpolate } from '@/lib/email/templates'
import { generateFormalNoticePDF } from '@/lib/pdf/formal-notice'
import { logActivity } from '@/lib/activity'
import type { Invoice, Debtor, Organization } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // 1. Mark pending invoices as overdue
  await supabase
    .from('invoices')
    .update({ status: 'overdue', updated_at: now.toISOString() })
    .eq('status', 'pending')
    .lt('due_at', today)

  // 2. Fetch overdue + in_recovery invoices with a scenario
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('*, debtors(*), organizations(*)')
    .in('status', ['overdue', 'in_recovery'])
    .not('reminder_scenario_id', 'is', null)

  if (!overdueInvoices || overdueInvoices.length === 0) {
    return NextResponse.json({ scheduled: 0, sent: 0, escalated: 0 })
  }

  let scheduled = 0
  let sent = 0
  let errors = 0
  let escalated = 0

  for (const rawInvoice of overdueInvoices) {
    const invoice = rawInvoice as Invoice & {
      debtors: Debtor
      organizations: Organization
    }
    const debtor = invoice.debtors
    const org = invoice.organizations
    if (!debtor || !org) continue

    const dueDate = new Date(invoice.due_at)
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    // Fetch scenario steps
    const { data: steps } = await supabase
      .from('reminder_scenario_steps')
      .select('*')
      .eq('scenario_id', invoice.reminder_scenario_id!)
      .order('position', { ascending: true })

    if (!steps || steps.length === 0) continue

    const maxDelayDays = steps[steps.length - 1].delay_days

    // Check if all steps have been sent already
    const { data: sentReminders } = await supabase
      .from('reminders')
      .select('id')
      .eq('invoice_id', invoice.id)
      .eq('status', 'sent')

    const allStepsSent = sentReminders && sentReminders.length >= steps.length

    // Auto-escalate: all steps sent, invoice still not paid, no existing formal notice
    if (allStepsSent && daysPastDue > maxDelayDays) {
      const { data: existingNotice } = await supabase
        .from('formal_notices')
        .select('id')
        .eq('invoice_id', invoice.id)
        .maybeSingle()

      if (!existingNotice) {
        try {
          const generatedAt = now.toISOString()
          const pdfBuffer = await generateFormalNoticePDF({ invoice, debtor, org, generatedAt })

          const fileName = `${invoice.org_id}/${invoice.id}/${now.getTime()}-mise-en-demeure.pdf`
          await supabase.storage
            .from('formal-notices')
            .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })

          const { data: signedUrl } = await supabase.storage
            .from('formal-notices')
            .createSignedUrl(fileName, 60 * 60 * 24 * 7)

          const { data: notice } = await supabase
            .from('formal_notices')
            .insert({
              org_id: invoice.org_id,
              invoice_id: invoice.id,
              debtor_id: debtor.id,
              pdf_url: signedUrl?.signedUrl ?? null,
              status: 'generated',
              generated_at: generatedAt,
            })
            .select('id')
            .single()

          await supabase
            .from('invoices')
            .update({ status: 'formal_notice', updated_at: generatedAt })
            .eq('id', invoice.id)

          if (notice) {
            await logActivity({
              supabase,
              orgId: invoice.org_id,
              entityType: 'formal_notice',
              entityId: notice.id,
              action: 'auto_escalated',
              details: { invoice_id: invoice.id, invoice_number: invoice.invoice_number },
            })
          }
          escalated++
        } catch {
          errors++
        }
      }
      continue
    }

    // Process each step
    for (const step of steps) {
      const scheduledAt = new Date(dueDate.getTime() + step.delay_days * 24 * 60 * 60 * 1000)

      const { data: existing } = await supabase
        .from('reminders')
        .select('id, status')
        .eq('invoice_id', invoice.id)
        .eq('channel', step.channel)
        .gte('scheduled_at', new Date(scheduledAt.getTime() - 12 * 60 * 60 * 1000).toISOString())
        .lte('scheduled_at', new Date(scheduledAt.getTime() + 12 * 60 * 60 * 1000).toISOString())
        .maybeSingle()

      if (existing) continue

      const { data: reminder, error: insertError } = await supabase
        .from('reminders')
        .insert({
          org_id: invoice.org_id,
          invoice_id: invoice.id,
          channel: step.channel,
          status: 'scheduled',
          scheduled_at: scheduledAt.toISOString(),
          subject: step.subject_template,
          body: step.body_template,
        })
        .select('id')
        .single()

      if (insertError || !reminder) continue
      scheduled++

      // Mark invoice as in_recovery when first reminder is scheduled
      if (invoice.status === 'overdue') {
        await supabase
          .from('invoices')
          .update({ status: 'in_recovery', updated_at: now.toISOString() })
          .eq('id', invoice.id)
      }

      if (daysPastDue >= step.delay_days) {
        const vars = buildTemplateVars(invoice, debtor, org)
        const body = interpolate(step.body_template, vars)
        const subject = step.subject_template ? interpolate(step.subject_template, vars) : ''

        try {
          if (step.channel === 'email' && debtor.contact_email) {
            await sendReminderEmail({ to: debtor.contact_email, subject, body, fromName: org.name })
          } else if (step.channel === 'sms' && debtor.contact_phone) {
            await sendReminderSMS(debtor.contact_phone, body)
          } else {
            continue
          }

          await supabase
            .from('reminders')
            .update({ status: 'sent', sent_at: now.toISOString() })
            .eq('id', reminder.id)

          await logActivity({
            supabase,
            orgId: invoice.org_id,
            entityType: 'reminder',
            entityId: reminder.id,
            action: 'sent',
            details: {
              channel: step.channel,
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
            },
          })

          sent++
        } catch {
          await supabase
            .from('reminders')
            .update({ status: 'failed' })
            .eq('id', reminder.id)
          errors++
        }
      }
    }
  }

  return NextResponse.json({ scheduled, sent, escalated, errors })
}
