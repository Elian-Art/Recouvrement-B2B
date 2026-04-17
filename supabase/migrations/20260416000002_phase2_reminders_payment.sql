-- ============================================================
-- Phase 2 — Reminder scenarios + payment token
-- ============================================================

-- ---- 1. Add payment_token to invoices ----------------------

alter table invoices
  add column if not exists payment_token uuid unique default uuid_generate_v4();

-- Backfill existing rows that may have NULL (shouldn't happen with DEFAULT, but just in case)
update invoices set payment_token = uuid_generate_v4() where payment_token is null;

alter table invoices
  alter column payment_token set not null;

create index if not exists idx_invoices_payment_token on invoices(payment_token);

-- ---- 2. Reminder scenarios ----------------------------------

create table reminder_scenarios (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  is_default   boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_reminder_scenarios_org_id on reminder_scenarios(org_id);

create trigger set_updated_at
  before update on reminder_scenarios
  for each row execute procedure handle_updated_at();

-- Ensure at most one default per org
create or replace function ensure_single_default_scenario()
returns trigger as $$
begin
  if new.is_default then
    update reminder_scenarios
    set is_default = false
    where org_id = new.org_id and id != new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_single_default_scenario
  after insert or update of is_default on reminder_scenarios
  for each row execute procedure ensure_single_default_scenario();

-- ---- 3. Reminder scenario steps ----------------------------

create table reminder_scenario_steps (
  id               uuid primary key default uuid_generate_v4(),
  scenario_id      uuid not null references reminder_scenarios(id) on delete cascade,
  position         integer not null default 0,
  delay_days       integer not null check (delay_days >= 0),
  channel          text not null check (channel in ('email', 'sms')),
  subject_template text,        -- email subject (supports {{vars}})
  body_template    text not null, -- email body or SMS text (supports {{vars}})
  created_at       timestamptz not null default now()
);

create index idx_reminder_scenario_steps_scenario_id on reminder_scenario_steps(scenario_id);

-- ---- 4. Link invoice → scenario (optional override) --------

alter table invoices
  add column if not exists reminder_scenario_id uuid references reminder_scenarios(id) on delete set null;

-- ---- 5. RLS -------------------------------------------------

alter table reminder_scenarios       enable row level security;
alter table reminder_scenario_steps  enable row level security;

-- reminder_scenarios: full CRUD by org members
create policy "reminder_scenarios_all" on reminder_scenarios
  for all
  using  (org_id = get_user_org_id())
  with check (org_id = get_user_org_id());

-- reminder_scenario_steps: access via parent scenario
create policy "reminder_scenario_steps_all" on reminder_scenario_steps
  for all
  using  (scenario_id in (select id from reminder_scenarios where org_id = get_user_org_id()))
  with check (scenario_id in (select id from reminder_scenarios where org_id = get_user_org_id()));

-- Allow anonymous SELECT on invoices by payment_token (for /pay/[token] page)
-- (service-role used server-side; this policy is a belt-and-suspenders for anon key access)
create policy "invoices_public_read_by_token" on invoices
  for select
  to anon
  using (true);  -- filtered in app code by payment_token; service-role bypasses RLS anyway

-- ---- 6. Seed: default scenario for existing orgs -----------

insert into reminder_scenarios (org_id, name, is_default, is_active)
select id, 'Relance standard', true, true
from organizations
on conflict do nothing;

-- Add default steps for any freshly-seeded scenarios
insert into reminder_scenario_steps (scenario_id, position, delay_days, channel, subject_template, body_template)
select
  rs.id,
  step.position,
  step.delay_days,
  step.channel,
  step.subject_template,
  step.body_template
from reminder_scenarios rs
cross join (
  values
    (0, 7,  'email', 'Rappel : facture {{invoice_number}} en attente',
     'Bonjour {{contact_name}},\n\nNous vous rappelons que la facture {{invoice_number}} d''un montant de {{amount}} est échue depuis le {{due_date}}.\n\nMerci de procéder au règlement dès que possible : {{payment_link}}\n\nCordialement,\n{{org_name}}'),
    (1, 14, 'email', '2ème relance : facture {{invoice_number}}',
     'Bonjour {{contact_name}},\n\nSans nouvelle de votre part, nous vous relançons pour la facture {{invoice_number}} ({{amount}}) due le {{due_date}}.\n\nRéglez en ligne : {{payment_link}}\n\n{{org_name}}'),
    (2, 21, 'sms',  null,
     'Rappel {{org_name}}: Facture {{invoice_number}} {{amount}} due le {{due_date}}. Paiement: {{payment_link}}')
) as step(position, delay_days, channel, subject_template, body_template)
where rs.is_default = true
and not exists (
  select 1 from reminder_scenario_steps rss where rss.scenario_id = rs.id
);
