-- ============================================================
-- Phase 1 — Initial schema
-- Recouvrement B2B — multi-tenant SaaS
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Organizations (tenants)
create table organizations (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text unique not null,
  billing_email   text,
  stripe_customer_id text,
  plan            text not null default 'free',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- User profiles — extends auth.users
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'member'
                check (role in ('owner', 'admin', 'member')),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Debtors (debtor companies)
create table debtors (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references organizations(id) on delete cascade,
  company_name   text not null,
  siret          text,
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  address        text,
  city           text,
  postal_code    text,
  country        text not null default 'FR',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Invoices
create table invoices (
  id                   uuid primary key default uuid_generate_v4(),
  org_id               uuid not null references organizations(id) on delete cascade,
  debtor_id            uuid not null references debtors(id) on delete restrict,
  invoice_number       text not null,
  amount_cents         integer not null check (amount_cents > 0),
  currency             text not null default 'EUR',
  issued_at            date not null,
  due_at               date not null,
  status               text not null default 'pending'
                         check (status in ('pending', 'overdue', 'paid', 'cancelled', 'in_dispute')),
  description          text,
  stripe_payment_link  text,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (org_id, invoice_number)
);

-- Reminders
create table reminders (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references organizations(id) on delete cascade,
  invoice_id   uuid not null references invoices(id) on delete cascade,
  channel      text not null check (channel in ('email', 'sms')),
  status       text not null default 'scheduled'
                 check (status in ('scheduled', 'sent', 'failed')),
  scheduled_at timestamptz not null,
  sent_at      timestamptz,
  subject      text,
  body         text,
  created_at   timestamptz not null default now()
);

-- Payments
create table payments (
  id                        uuid primary key default uuid_generate_v4(),
  org_id                    uuid not null references organizations(id) on delete cascade,
  invoice_id                uuid not null references invoices(id) on delete restrict,
  amount_cents              integer not null check (amount_cents > 0),
  currency                  text not null default 'EUR',
  stripe_payment_intent_id  text unique,
  stripe_charge_id          text,
  paid_at                   timestamptz not null default now(),
  created_at                timestamptz not null default now()
);

-- Formal notices (mises en demeure)
create table formal_notices (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  invoice_id  uuid not null references invoices(id) on delete restrict,
  pdf_url     text,
  sent_at     timestamptz,
  method      text check (method in ('email', 'mail', 'both')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_users_org_id          on users(org_id);
create index idx_debtors_org_id        on debtors(org_id);
create index idx_invoices_org_id       on invoices(org_id);
create index idx_invoices_debtor_id    on invoices(debtor_id);
create index idx_invoices_status       on invoices(status);
create index idx_invoices_due_at       on invoices(due_at);
create index idx_reminders_org_id      on reminders(org_id);
create index idx_reminders_invoice_id  on reminders(invoice_id);
create index idx_payments_org_id       on payments(org_id);
create index idx_payments_invoice_id   on payments(invoice_id);
create index idx_formal_notices_org_id on formal_notices(org_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on organizations
  for each row execute procedure handle_updated_at();

create trigger set_updated_at
  before update on users
  for each row execute procedure handle_updated_at();

create trigger set_updated_at
  before update on debtors
  for each row execute procedure handle_updated_at();

create trigger set_updated_at
  before update on invoices
  for each row execute procedure handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table organizations   enable row level security;
alter table users           enable row level security;
alter table debtors         enable row level security;
alter table invoices        enable row level security;
alter table reminders       enable row level security;
alter table payments        enable row level security;
alter table formal_notices  enable row level security;

-- Helper: returns the org_id of the currently authenticated user
create or replace function get_user_org_id()
returns uuid as $$
  select org_id from users where id = auth.uid()
$$ language sql security definer stable;

-- ---- organizations ----
create policy "org_select" on organizations
  for select using (id = get_user_org_id());

create policy "org_update" on organizations
  for update using (id = get_user_org_id())
  with check (id = get_user_org_id());

-- ---- users ----
create policy "users_select" on users
  for select using (org_id = get_user_org_id());

create policy "users_update_own" on users
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ---- debtors ----
create policy "debtors_select" on debtors
  for select using (org_id = get_user_org_id());

create policy "debtors_insert" on debtors
  for insert with check (org_id = get_user_org_id());

create policy "debtors_update" on debtors
  for update using (org_id = get_user_org_id())
  with check (org_id = get_user_org_id());

create policy "debtors_delete" on debtors
  for delete using (org_id = get_user_org_id());

-- ---- invoices ----
create policy "invoices_select" on invoices
  for select using (org_id = get_user_org_id());

create policy "invoices_insert" on invoices
  for insert with check (org_id = get_user_org_id());

create policy "invoices_update" on invoices
  for update using (org_id = get_user_org_id())
  with check (org_id = get_user_org_id());

create policy "invoices_delete" on invoices
  for delete using (org_id = get_user_org_id());

-- ---- reminders ----
create policy "reminders_all" on reminders
  for all using (org_id = get_user_org_id())
  with check (org_id = get_user_org_id());

-- ---- payments ----
create policy "payments_select" on payments
  for select using (org_id = get_user_org_id());

create policy "payments_insert" on payments
  for insert with check (org_id = get_user_org_id());

-- ---- formal_notices ----
create policy "formal_notices_all" on formal_notices
  for all using (org_id = get_user_org_id())
  with check (org_id = get_user_org_id());

-- ============================================================
-- TRIGGER: auto-create org + user profile on signup
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
declare
  v_org_id    uuid;
  v_org_name  text;
  v_slug      text;
  v_base_slug text;
  v_counter   int := 0;
begin
  v_org_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'organization_name'), ''),
    split_part(new.email, '@', 2)
  );

  -- Build a URL-safe slug
  v_base_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  v_slug := v_base_slug;

  -- Ensure uniqueness
  while exists (select 1 from organizations where slug = v_slug) loop
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  end loop;

  insert into organizations (name, slug, billing_email)
  values (v_org_name, v_slug, new.email)
  returning id into v_org_id;

  insert into users (id, org_id, email, full_name, role)
  values (
    new.id,
    v_org_id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    'owner'
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
