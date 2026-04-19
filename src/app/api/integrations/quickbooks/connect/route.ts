import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'QuickBooks not configured' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.recouvrement-b2b.fr'
  const redirectUri = `${appUrl}/api/integrations/quickbooks/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state: user.id,
  })

  return NextResponse.redirect(
    `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`
  )
}
