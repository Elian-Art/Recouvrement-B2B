import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface XeroInvoice {
  InvoiceID: string
  InvoiceNumber: string
  DueDate: string
  AmountDue: number
  Contact: { Name: string }
}

interface XeroInvoicesResponse {
  Invoices?: XeroInvoice[]
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return NextResponse.redirect(new URL('/settings/integrations?error=org', req.url))

  const admin = createAdminClient()
  const { data: integration } = await admin
    .from('integrations')
    .select('access_token, external_org_id, refresh_token, token_expires_at')
    .eq('org_id', profile.org_id)
    .eq('provider', 'xero')
    .single()

  if (!integration) return NextResponse.redirect(new URL('/settings/integrations?error=not_connected', req.url))

  let accessToken = integration.access_token

  // Refresh token if expired
  if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
    const clientId = process.env.XERO_CLIENT_ID
    const clientSecret = process.env.XERO_CLIENT_SECRET
    if (clientId && clientSecret && integration.refresh_token) {
      const refreshRes = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
        }),
      })
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json() as { access_token: string; refresh_token: string; expires_in: number }
        accessToken = refreshed.access_token
        await admin.from('integrations').update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq('org_id', profile.org_id).eq('provider', 'xero')
      }
    }
  }

  const tenantId = integration.external_org_id
  const xeroRes = await fetch(
    'https://api.xero.com/api.xro/2.0/Invoices?where=AmountDue%3E0&Status=AUTHORISED',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'xero-tenant-id': tenantId ?? '',
        Accept: 'application/json',
      },
    }
  )

  if (!xeroRes.ok) return NextResponse.redirect(new URL('/settings/integrations?error=xero_api', req.url))

  const xeroData = await xeroRes.json() as XeroInvoicesResponse
  const xeroInvoices = xeroData.Invoices ?? []

  let imported = 0
  for (const inv of xeroInvoices) {
    const { data: debtor } = await admin
      .from('debtors')
      .upsert({ org_id: profile.org_id, company_name: inv.Contact.Name }, { onConflict: 'org_id,company_name' })
      .select('id')
      .single()

    if (!debtor) continue

    // Xero DueDate format: /Date(timestamp+offset)/
    const dueDateMatch = inv.DueDate.match(/\d+/)
    const dueAt = dueDateMatch
      ? new Date(parseInt(dueDateMatch[0])).toISOString().split('T')[0]
      : null

    await admin.from('invoices').upsert({
      org_id: profile.org_id,
      debtor_id: debtor.id,
      invoice_number: inv.InvoiceNumber,
      amount_cents: Math.round(inv.AmountDue * 100),
      issued_at: new Date().toISOString().split('T')[0],
      due_at: dueAt ?? new Date().toISOString().split('T')[0],
      status: 'pending',
    }, { onConflict: 'org_id,invoice_number', ignoreDuplicates: true })

    imported++
  }

  await admin.from('integrations').update({ last_synced_at: new Date().toISOString() })
    .eq('org_id', profile.org_id).eq('provider', 'xero')

  return NextResponse.redirect(new URL(`/settings/integrations?synced=${imported}`, req.url))
}
