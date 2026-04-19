import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('org_id').eq('id', user.id).single()

  if (!profile?.org_id) return NextResponse.json({ error: 'Org not found' }, { status: 400 })

  await supabase
    .from('organizations')
    .update({ onboarding_completed: true })
    .eq('id', profile.org_id)

  return NextResponse.json({ ok: true })
}
