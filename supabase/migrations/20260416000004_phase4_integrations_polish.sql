-- ============================================================
-- Phase 4 — Intégrations & Polish
-- ============================================================

-- ---- 1. Extend organizations --------------------------------

alter table organizations
  add column if not exists locale                  text not null default 'fr',
  add column if not exists stripe_subscription_id  text,
  add column if not exists onboarding_completed    boolean not null default false;

-- ---- 2. Email/SMS templates (custom per org) ----------------

create table if not exists email_templates (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references organizations(id) on delete cascade,
  key          text not null,          -- 'reminder_1' | 'reminder_2' | 'reminder_final' | 'formal_notice'
  channel      text not null check (channel in ('email', 'sms')),
  name         text not null,          -- user-facing label
  subject      text,                   -- email only
  body         text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, key, channel)
);

create index if not exists idx_email_templates_org_id on email_templates(org_id);

create trigger set_updated_at
  before update on email_templates
  for each row execute procedure handle_updated_at();

alter table email_templates enable row level security;

create policy "email_templates_all" on email_templates
  for all
  using  (org_id = get_user_org_id())
  with check (org_id = get_user_org_id());

-- ---- 3. Integrations (QuickBooks, Xero) ----------------------

create table if not exists integrations (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid not null references organizations(id) on delete cascade,
  provider          text not null check (provider in ('quickbooks', 'xero')),
  access_token      text not null,
  refresh_token     text,
  token_expires_at  timestamptz,
  external_org_id   text,           -- Company ID chez le provider
  config            jsonb,
  last_synced_at    timestamptz,
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, provider)
);

create index if not exists idx_integrations_org_id on integrations(org_id);

create trigger set_updated_at
  before update on integrations
  for each row execute procedure handle_updated_at();

alter table integrations enable row level security;

create policy "integrations_all" on integrations
  for all
  using  (org_id = get_user_org_id())
  with check (org_id = get_user_org_id());
