import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminderEmail } from '@/lib/email/resend'
import { sendReminderSMS } from '@/lib/sms/twilio'
import { buildTemplateVars, interpolate } from '@/lib/email/templates'
import type { Invoice, Debtor, Organization } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // 1. Mark pending invoices as overdue (due_at < today)
  await supabase
    .from('invoices')
    .update({ status: 'overdue', updated_at: now.toISOString() })
    .eq('status', 'pending')
    .lt('due_at', today)

  // 2. Fetch all overdue invoices that have a reminder scenario
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('*, debtors(*), organizations(*)')
    .eq('status', 'overdue')
    .not('reminder_scenario_id', 'is', null)

  if (!overdueInvoices || overdueInvoices.length === 0) {
    return NextResponse.json({ scheduled: 0, sent: 0 })
  }

  let scheduled = 0
  let sent = 0
  let errors = 0

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

    // Fetch the scenario steps
    const { data: steps } = await supabase
      .from('reminder_scenario_steps')
      .select('*')
      .eq('scenario_id', invoice.reminder_scenario_id!)
      .order('position', { ascending: true })

    if (!steps) continue

    for (const step of steps) {
      // Check if a reminder for this step already exists
      const { data: existing } = await supabase
        .from('reminders')
        .select('id')
        .eq('invoice_id', invoice.id)
        .eq('scheduled_at', new Date(dueDate.getTime() + step.delay_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .eq('channel', step.channel)
        .maybeSingle()

      if (existing) continue

      const scheduledAt = new Date(dueDate.getTime() + step.delay_days * 24 * 60 * 60 * 1000)

      // Schedule the reminder
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

      // If the step is due today or overdue (daysPastDue >= delay_days), send it now
      if (daysPastDue >= step.delay_days) {
        const vars = buildTemplateVars(invoice, debtor, org)
        const body = interpolate(step.body_template, vars)
        const subject = step.subject_template ? interpolate(step.subject_template, vars) : ''

        try {
          if (step.channel === 'email' && debtor.contact_email) {
            await sendReminderEmail({
              to: debtor.contact_email,
              subject,
              body,
              fromName: org.name,
            })
          } else if (step.channel === 'sms' && debtor.contact_phone) {
            await sendReminderSMS(debtor.contact_phone, body)
          } else {
            continue
          }

          await supabase
            .from('reminders')
            .update({ status: 'sent', sent_at: now.toISOString() })
            .eq('id', reminder.id)

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

  return NextResponse.json({ scheduled, sent, errors })
}
