import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface QBInvoice {
  Id: string
  DocNumber: string
  DueDate: string
  TotalAmt: number
  Balance: number
  CustomerRef: { name: string; value: string }
}

interface QBQueryResponse {
  QueryResponse?: { Invoice?: QBInvoice[] }
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
    .eq('provider', 'quickbooks')
    .single()

  if (!integration) return NextResponse.redirect(new URL('/settings/integrations?error=not_connected', req.url))

  // Refresh token if expired
  let accessToken = integration.access_token
  if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
    if (clientId && clientSecret && integration.refresh_token) {
      const refreshRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
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
        }).eq('org_id', profile.org_id).eq('provider', 'quickbooks')
      }
    }
  }

  const realmId = integration.external_org_id
  const qbRes = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Invoice WHERE Balance > '0.00'&minorversion=65`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
  )

  if (!qbRes.ok) return NextResponse.redirect(new URL('/settings/integrations?error=qb_api', req.url))

  const qbData = await qbRes.json() as QBQueryResponse
  const qbInvoices = qbData.QueryResponse?.Invoice ?? []

  let imported = 0
  for (const inv of qbInvoices) {
    // Upsert debtor
    const { data: debtor } = await admin
      .from('debtors')
      .upsert({ org_id: profile.org_id, company_name: inv.CustomerRef.name }, { onConflict: 'org_id,company_name' })
      .select('id')
      .single()

    if (!debtor) continue

    await admin.from('invoices').upsert({
      org_id: profile.org_id,
      debtor_id: debtor.id,
      invoice_number: inv.DocNumber,
      amount_cents: Math.round(inv.Balance * 100),
      issued_at: new Date().toISOString().split('T')[0],
      due_at: inv.DueDate,
      status: 'pending',
    }, { onConflict: 'org_id,invoice_number', ignoreDuplicates: true })

    imported++
  }

  await admin.from('integrations').update({ last_synced_at: new Date().toISOString() })
    .eq('org_id', profile.org_id).eq('provider', 'quickbooks')

  return NextResponse.redirect(new URL(`/settings/integrations?synced=${imported}`, req.url))
}
