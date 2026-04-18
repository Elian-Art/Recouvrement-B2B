import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type ActivityEntityType = Database['public']['Tables']['activity_logs']['Insert']['entity_type']

interface LogActivityParams {
  supabase: SupabaseClient<Database>
  orgId: string
  actorId?: string | null
  entityType: ActivityEntityType
  entityId: string
  action: string
  details?: Record<string, unknown>
}

export async function logActivity({
  supabase,
  orgId,
  actorId = null,
  entityType,
  entityId,
  action,
  details,
}: LogActivityParams): Promise<void> {
  await supabase.from('activity_logs').insert({
    org_id: orgId,
    actor_id: actorId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    details: details ?? null,
  })
}
