import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (profile?.org_id) {
    const admin = createAdminClient()
    await admin.from('integrations')
      .delete()
      .eq('org_id', profile.org_id)
      .eq('provider', 'xero')
  }

  return NextResponse.redirect(new URL('/settings/integrations', req.url))
}
