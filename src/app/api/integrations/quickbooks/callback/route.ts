import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')

  if (!code) {
    return NextResponse.redirect(new URL('/settings/integrations?error=no_code', req.url))
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings/integrations?error=not_configured', req.url))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.recouvrement-b2b.fr'
  const redirectUri = `${appUrl}/api/integrations/quickbooks/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/settings/integrations?error=token_exchange', req.url))
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.redirect(new URL('/settings/integrations?error=org_not_found', req.url))
  }

  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await admin.from('integrations').upsert({
    org_id: profile.org_id,
    provider: 'quickbooks',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
    external_org_id: realmId ?? null,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'org_id,provider' })

  return NextResponse.redirect(new URL('/settings/integrations?success=quickbooks', req.url))
}
