import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.XERO_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Xero not configured' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.recouvrement-b2b.fr'
  const redirectUri = `${appUrl}/api/integrations/xero/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email accounting.transactions accounting.contacts',
    state: user.id,
  })

  return NextResponse.redirect(
    `https://login.xero.com/identity/connect/authorize?${params.toString()}`
  )
}
