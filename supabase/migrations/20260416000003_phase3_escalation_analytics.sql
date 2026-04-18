-- ============================================================
-- Phase 3 — Escalade & Analytics
-- ============================================================

-- ---- 1. Extend invoices.status --------------------------------
-- Drop old constraint, add 'formal_notice' and 'in_recovery'

alter table invoices
  drop constraint if exists invoices_status_check;

alter table invoices
  add constraint invoices_status_check
    check (status in ('pending', 'overdue', 'in_recovery', 'paid', 'cancelled', 'in_dispute', 'formal_notice', 'written_off'));

-- ---- 2. Extend formal_notices ---------------------------------

alter table formal_notices
  add column if not exists debtor_id     uuid references debtors(id) on delete restrict,
  add column if not exists status        text not null default 'generated'
                                           check (status in ('generated', 'sent_email', 'sent_postal', 'acknowledged')),
  add column if not exists generated_at  timestamptz not null default now();

-- Backfill debtor_id from the related invoice
update formal_notices fn
set debtor_id = (
  select debtor_id from invoices i where i.id = fn.invoice_id
)
where fn.debtor_id is null;

create index if not exists idx_formal_notices_invoice_id on formal_notices(invoice_id);
create index if not exists idx_formal_notices_debtor_id  on formal_notices(debtor_id);

-- ---- 3. Activity logs -----------------------------------------

create table if not exists activity_logs (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references organizations(id) on delete cascade,
  actor_id     uuid references users(id) on delete set null,  -- null = system (cron)
  entity_type  text not null,   -- 'invoice' | 'reminder' | 'payment' | 'formal_notice' | 'debtor'
  entity_id    uuid not null,
  action       text not null,   -- 'created' | 'updated' | 'sent' | 'paid' | 'escalated' | 'generated' …
  details      jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_activity_logs_org_id   on activity_logs(org_id);
create index if not exists idx_activity_logs_entity   on activity_logs(entity_type, entity_id);
create index if not exists idx_activity_logs_created  on activity_logs(created_at desc);

alter table activity_logs enable row level security;

create policy "activity_logs_select" on activity_logs
  for select
  using (org_id = get_user_org_id());

-- System (cron/webhook via service role) inserts — bypasses RLS, no insert policy needed

-- ---- 4. Supabase Storage buckets (note) -----------------------
-- Run these once in the Supabase dashboard or via the management API:
-- supabase.storage.createBucket('formal-notices', { public: false })
-- supabase.storage.createBucket('invoice-files',  { public: false })
