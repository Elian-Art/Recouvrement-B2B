# Architecture — Recouvrement-B2B

> Document de référence pour Claude Code et l'équipe.
> Toute décision d'implémentation doit être cohérente avec ce document.

---

## 1. Vision produit

Plateforme SaaS multi-tenant permettant aux entreprises (B2B) de :
- Importer et suivre leurs factures impayées
- Automatiser les relances par email et SMS selon des scénarios configurables
- Proposer au débiteur un lien de paiement en ligne (Stripe)
- Escalader automatiquement vers une mise en demeure PDF après échec des relances
- Visualiser un tableau de bord analytique du recouvrement

Cible : international, bilingue FR/EN.

---

## 2. Multi-tenancy

Modèle : **une base unique, isolation par `org_id`**.

Chaque ligne métier porte un `org_id`. Supabase RLS appliqué sur TOUTES les tables métier. Aucune requête côté client ne doit contourner le RLS.

Un utilisateur appartient à une seule organisation. Les rôles par org : `owner`, `admin`, `member`.

---

## 3. Schéma de base de données

> Tous les montants en **centimes** (integer). Toutes les dates en **timestamptz**. Soft delete via `archived_at` (jamais de DELETE physique sur les données métier).

### 3.1 — Tables Auth & Tenant

```sql
-- Organisations (tenants)
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,           -- sous-domaine ou identifiant URL
  email         text not null,                  -- email principal de l'org
  phone         text,
  address       jsonb,                          -- {street, city, zip, country, vat_number}
  logo_url      text,
  locale        text not null default 'fr',     -- 'fr' | 'en'
  timezone      text not null default 'Europe/Paris',
  plan          text not null default 'free',   -- 'free' | 'starter' | 'pro' | 'enterprise'
  stripe_customer_id    text,                   -- pour la facturation du SaaS
  stripe_subscription_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Membres d'une organisation
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  full_name     text not null,
  role          text not null default 'member' check (role in ('owner','admin','member')),
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_users_org on public.users(org_id);
```

### 3.2 — Tables Métier

```sql
-- Débiteurs (entreprises clientes qui doivent de l'argent)
create table public.debtors (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id),
  company_name  text not null,
  contact_name  text,
  email         text not null,
  phone         text,
  address       jsonb,
  siren         text,                           -- numéro SIREN/SIRET (France)
  vat_number    text,
  notes         text,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_debtors_org on public.debtors(org_id);

-- Factures impayées
create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id),
  debtor_id       uuid not null references public.debtors(id),
  invoice_number  text not null,                -- numéro de facture (affiché)
  amount_cents    integer not null check (amount_cents > 0),
  currency        text not null default 'EUR',  -- 'EUR' | 'USD' | 'GBP' …
  issued_at       date not null,                -- date d'émission
  due_at          date not null,                -- date d'échéance
  status          text not null default 'pending'
                  check (status in ('pending','overdue','in_recovery','partially_paid','paid','formal_notice','written_off')),
  paid_amount_cents integer not null default 0,
  remaining_cents   integer generated always as (amount_cents - paid_amount_cents) stored,
  source          text not null default 'manual' check (source in ('manual','csv_import','quickbooks','xero')),
  external_id     text,                         -- id dans le système source (QB, Xero…)
  file_url        text,                         -- PDF de la facture originale (Supabase Storage)
  notes           text,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(org_id, invoice_number)
);
create index idx_invoices_org on public.invoices(org_id);
create index idx_invoices_debtor on public.invoices(debtor_id);
create index idx_invoices_status on public.invoices(status);
create index idx_invoices_due on public.invoices(due_at);

-- Scénarios de relance (templates configurables par org)
create table public.reminder_scenarios (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id),
  name          text not null,                  -- ex: "Scénario standard", "Grands comptes"
  is_default    boolean not null default false,
  steps         jsonb not null,
  -- steps = [
  --   { "delay_days": 3,  "channel": "email", "template_key": "reminder_soft" },
  --   { "delay_days": 10, "channel": "email", "template_key": "reminder_firm" },
  --   { "delay_days": 20, "channel": "sms",   "template_key": "reminder_sms" },
  --   { "delay_days": 30, "channel": "email", "template_key": "reminder_final" },
  --   { "delay_days": 40, "action": "formal_notice" }
  -- ]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_scenarios_org on public.reminder_scenarios(org_id);

-- Relances envoyées
create table public.reminders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id),
  invoice_id    uuid not null references public.invoices(id),
  scenario_id   uuid references public.reminder_scenarios(id),
  step_index    integer not null,               -- index dans le tableau steps du scénario
  channel       text not null check (channel in ('email','sms')),
  status        text not null default 'scheduled'
                check (status in ('scheduled','sent','delivered','opened','clicked','failed','cancelled')),
  scheduled_at  timestamptz not null,
  sent_at       timestamptz,
  error_message text,
  metadata      jsonb,                          -- message_id email/SMS, tracking
  created_at    timestamptz not null default now()
);
create index idx_reminders_org on public.reminders(org_id);
create index idx_reminders_invoice on public.reminders(invoice_id);
create index idx_reminders_scheduled on public.reminders(scheduled_at) where status = 'scheduled';

-- Paiements reçus
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id),
  invoice_id          uuid not null references public.invoices(id),
  amount_cents        integer not null check (amount_cents > 0),
  currency            text not null default 'EUR',
  method              text not null default 'stripe'
                      check (method in ('stripe','bank_transfer','manual','other')),
  stripe_payment_id   text,                     -- Stripe Payment Intent ID
  stripe_checkout_id  text,                     -- Stripe Checkout Session ID
  paid_at             timestamptz not null default now(),
  notes               text,
  created_at          timestamptz not null default now()
);
create index idx_payments_org on public.payments(org_id);
create index idx_payments_invoice on public.payments(invoice_id);

-- Mises en demeure
create table public.formal_notices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id),
  invoice_id    uuid not null references public.invoices(id),
  debtor_id     uuid not null references public.debtors(id),
  pdf_url       text not null,                  -- Supabase Storage
  status        text not null default 'generated'
                check (status in ('generated','sent_email','sent_postal','acknowledged')),
  sent_at       timestamptz,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index idx_notices_org on public.formal_notices(org_id);
create index idx_notices_invoice on public.formal_notices(invoice_id);

-- Journal d'activité (audit trail)
create table public.activity_logs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id),
  actor_id      uuid references public.users(id),  -- null si action système (cron)
  entity_type   text not null,                  -- 'invoice' | 'reminder' | 'payment' | 'formal_notice' | 'debtor'
  entity_id     uuid not null,
  action        text not null,                  -- 'created' | 'updated' | 'sent' | 'paid' | 'escalated' …
  details       jsonb,
  created_at    timestamptz not null default now()
);
create index idx_logs_org on public.activity_logs(org_id);
create index idx_logs_entity on public.activity_logs(entity_type, entity_id);
```

### 3.3 — Tables Intégrations

```sql
-- Connexions aux services externes (QuickBooks, Xero…)
create table public.integrations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id),
  provider        text not null check (provider in ('quickbooks','xero')),
  access_token    text not null,                -- chiffré en base
  refresh_token   text,
  token_expires_at timestamptz,
  external_org_id text,                         -- Company ID chez le provider
  config          jsonb,                        -- options spécifiques provider
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(org_id, provider)
);
```

### 3.4 — Supabase Storage Buckets

| Bucket | Accès | Contenu |
|--------|-------|---------|
| `invoice-files` | Privé (RLS) | PDFs des factures originales uploadées |
| `formal-notices` | Privé (RLS) | PDFs des mises en demeure générées |
| `org-logos` | Public | Logos des organisations |

---

## 4. Routes de l'application (App Router)

### 4.1 — Pages publiques

```
/                           → Landing page (marketing)
/pricing                    → Page tarifs
/login                      → Connexion (Supabase Auth)
/signup                     → Inscription (crée user + org)
/forgot-password            → Réinitialisation mot de passe
/pay/[token]                → Page de paiement débiteur (publique, token signé)
```

### 4.2 — Dashboard (authentifié — layout partagé)

```
/dashboard                  → Vue d'ensemble (KPIs, graphiques)
/dashboard/invoices         → Liste des factures + filtres + recherche
/dashboard/invoices/new     → Créer une facture manuellement
/dashboard/invoices/import  → Import CSV/Excel ou sync QuickBooks/Xero
/dashboard/invoices/[id]    → Détail facture (timeline relances, paiements, statut)
/dashboard/debtors          → Liste des débiteurs
/dashboard/debtors/[id]     → Fiche débiteur (factures associées, historique)
/dashboard/reminders        → Vue calendrier/liste des relances planifiées
/dashboard/scenarios        → Gestion des scénarios de relance
/dashboard/scenarios/[id]   → Éditeur de scénario (drag & drop des étapes)
/dashboard/payments         → Historique des paiements reçus
/dashboard/formal-notices   → Liste des mises en demeure générées
/dashboard/analytics        → Tableaux de bord détaillés
/dashboard/settings         → Paramètres org (profil, logo, timezone, locale)
/dashboard/settings/team    → Gestion des membres / rôles
/dashboard/settings/billing → Abonnement SaaS (Stripe Customer Portal)
/dashboard/settings/integrations → Connexion QuickBooks, Xero
/dashboard/settings/templates    → Personnalisation des templates email/SMS
```

### 4.3 — API Routes (Route Handlers)

```
/api/auth/callback          → Callback OAuth Supabase
/api/webhooks/stripe        → Webhook Stripe (paiements débiteurs + abonnement SaaS)
/api/webhooks/resend        → Webhook email (delivery, open, click tracking)
/api/cron/process-reminders → Cron : envoyer les relances scheduled (Vercel Cron)
/api/cron/check-overdue     → Cron : passer les factures en overdue si due_at dépassé
/api/cron/sync-integrations → Cron : sync QuickBooks/Xero
/api/integrations/quickbooks/connect    → OAuth flow QuickBooks
/api/integrations/quickbooks/callback   → OAuth callback
/api/integrations/xero/connect          → OAuth flow Xero
/api/integrations/xero/callback         → OAuth callback
/api/invoices/import        → Upload + parsing CSV/Excel
/api/payments/create-session → Crée une Stripe Checkout Session pour le débiteur
/api/formal-notices/generate → Génère le PDF de mise en demeure
```

---

## 5. Workflows métier détaillés

### 5.1 — Cycle de vie d'une facture

```
                ┌──────────┐
                │  PENDING  │  (importée, pas encore en retard)
                └────┬─────┘
                     │ due_at dépassé (cron check-overdue)
                     ▼
                ┌──────────┐
                │ OVERDUE   │  (en retard, relances pas encore démarrées)
                └────┬─────┘
                     │ première relance envoyée
                     ▼
              ┌──────────────┐
              │ IN_RECOVERY  │  (relances en cours)
              └──┬───┬───┬──┘
                 │   │   │
    paiement     │   │   │  toutes relances échouées
    partiel      │   │   │
        ▼        │   │   ▼
┌──────────────┐ │   │ ┌───────────────┐
│PARTIALLY_PAID│ │   │ │FORMAL_NOTICE  │ (mise en demeure envoyée)
└──────┬───────┘ │   │ └───────┬───────┘
       │         │   │         │
       └────┬────┘   │    paiement total
            │        │         │
            ▼        │         ▼
       ┌─────────┐   │    ┌─────────┐
       │  PAID   │◄──┘    │  PAID   │
       └─────────┘         └─────────┘

       (à tout moment, possibilité de → WRITTEN_OFF si abandon)
```

### 5.2 — Moteur de relance (cron `process-reminders`)

```
Toutes les heures (Vercel Cron) :
1. SELECT reminders WHERE status = 'scheduled' AND scheduled_at <= now()
2. Pour chaque reminder :
   a. Charger l'invoice + debtor + org
   b. Vérifier que l'invoice n'est pas déjà payée → sinon annuler
   c. Si channel = 'email' :
      - Construire le contenu depuis le template (avec variables : nom, montant, lien paiement)
      - Envoyer via Resend
      - Mettre à jour status → 'sent'
   d. Si channel = 'sms' :
      - Envoyer via Twilio
      - Mettre à jour status → 'sent'
   e. Logger dans activity_logs
3. Si le step courant est le dernier ET action = 'formal_notice' :
   a. Générer le PDF de mise en demeure
   b. Créer l'entrée formal_notices
   c. Envoyer par email
   d. Mettre à jour invoice.status → 'formal_notice'
```

### 5.3 — Paiement en ligne (débiteur)

```
1. Relance contient un lien : /pay/[token]
   - token = JWT signé contenant { invoice_id, org_id, amount_cents, exp }
2. Page /pay/[token] (publique, pas d'auth requise) :
   - Vérifie le token
   - Affiche : montant dû, détails facture, bouton "Payer"
   - Appelle /api/payments/create-session → Stripe Checkout Session
   - Redirect vers Stripe Checkout
3. Webhook Stripe (checkout.session.completed) :
   - Vérifie la signature
   - Crée un payment dans la table payments
   - Met à jour invoice.paid_amount_cents
   - Si remaining_cents = 0 → invoice.status = 'paid'
   - Sinon → invoice.status = 'partially_paid'
   - Annule les reminders scheduled restants
   - Logger dans activity_logs
   - Envoyer email de confirmation au débiteur + notification à l'org
```

### 5.4 — Import de factures

```
Import CSV/Excel :
1. User uploade un fichier sur /dashboard/invoices/import
2. Front parse le fichier (Papaparse ou SheetJS) côté client
3. Affiche un écran de mapping des colonnes :
   - invoice_number ← quelle colonne ?
   - amount ← quelle colonne ?
   - due_at ← quelle colonne ?
   - debtor_email ← quelle colonne ?
   - debtor_company_name ← quelle colonne ?
4. Validation Zod sur chaque ligne
5. Affiche preview avec erreurs éventuelles
6. User confirme → POST /api/invoices/import
7. Serveur : upsert debtors + insert invoices en batch
8. Logger dans activity_logs

Sync QuickBooks / Xero :
1. OAuth connect → stocke tokens dans integrations
2. Cron sync-integrations (quotidien) :
   - Fetch factures impayées depuis l'API provider
   - Upsert dans invoices (match par external_id)
   - Crée les debtors manquants
```

---

## 6. Composants clés

### 6.1 — Layouts

| Composant | Rôle |
|-----------|------|
| `RootLayout` | HTML, fonts, ThemeProvider, i18n provider |
| `AuthLayout` | Layout login/signup (centré, minimal) |
| `DashboardLayout` | Sidebar + topbar + main content area |
| `PublicLayout` | Landing, pricing (header marketing + footer) |
| `PayLayout` | Page paiement débiteur (branding org, minimal) |

### 6.2 — Composants features (métier)

| Composant | Page | Description |
|-----------|------|-------------|
| `InvoiceTable` | invoices | Table paginée, filtrable (status, debtor, date range), bulk actions |
| `InvoiceDetail` | invoices/[id] | Infos facture + timeline relances/paiements |
| `InvoiceImportWizard` | invoices/import | Stepper : upload → mapping → preview → confirm |
| `DebtorCard` | debtors/[id] | Fiche débiteur avec agrégats (total dû, nb factures) |
| `ReminderTimeline` | invoices/[id] | Visualisation chronologique des relances (sent, scheduled, failed) |
| `ScenarioEditor` | scenarios/[id] | Éditeur visuel des étapes de relance (drag & drop) |
| `PaymentPage` | /pay/[token] | Page publique : détails + bouton Stripe |
| `DashboardKPIs` | dashboard | Cards : total dû, recouvré ce mois, taux de recouvrement, relances envoyées |
| `AnalyticsCharts` | analytics | Graphiques Recharts : évolution recouvrements, aging report, performance par scénario |
| `FormalNoticePreview` | formal-notices | Visualisation du PDF avant envoi |
| `SettingsBilling` | settings/billing | Gestion abonnement via Stripe Customer Portal |
| `IntegrationConnect` | settings/integrations | Cards QuickBooks/Xero avec bouton connect/disconnect |
| `TeamManager` | settings/team | Invite, rôles, suppression membres |

### 6.3 — Composants UI réutilisables (shadcn/ui + custom)

```
DataTable          — Table générique avec tri, pagination, filtres
StatusBadge        — Badge coloré selon le statut (paid, overdue, sent…)
AmountDisplay      — Affiche un montant en centimes formaté selon la locale + devise
DateDisplay        — Date formatée selon la locale de l'org
EmptyState         — Illustration + CTA quand une liste est vide
ConfirmDialog      — Modal de confirmation pour actions destructives
FileUploadZone     — Drag & drop pour upload (factures, CSV)
SearchInput        — Input de recherche avec debounce
LocaleSwitcher     — Toggle FR/EN
```

---

## 7. Authentification & Autorisation

```
1. Auth : Supabase Auth (email/password + magic link)
   - Signup → crée auth.user + organization + public.user (owner)
   - Login → JWT stocké en cookie httpOnly (middleware Next.js)

2. Middleware Next.js (/src/middleware.ts) :
   - Routes /dashboard/* → vérifier JWT valide, sinon redirect /login
   - Routes /api/* (sauf webhooks, cron) → vérifier JWT
   - Routes /pay/* → pas d'auth (accès public via token signé)
   - Routes /api/cron/* → vérifier header secret (CRON_SECRET)

3. Autorisation (dans chaque Server Component / API route) :
   - Extraire org_id du user connecté
   - RLS fait le filtrage en DB
   - Vérifier le rôle pour les actions admin (invite, delete, settings)
```

---

## 8. Internationalisation (i18n)

- Lib : `next-intl`
- Locales supportées : `fr`, `en`
- Fichiers : `/src/messages/fr.json`, `/src/messages/en.json`
- Détection : préférence org (`organizations.locale`) > header Accept-Language > défaut `fr`
- Les templates email/SMS utilisent la locale de l'org
- Les montants et dates se formatent selon la locale (`Intl.NumberFormat`, `Intl.DateTimeFormat`)

---

## 9. Jobs planifiés (Crons)

| Job | Fréquence | Route | Description |
|-----|-----------|-------|-------------|
| `check-overdue` | Toutes les heures | `/api/cron/check-overdue` | Passe les factures pending → overdue si `due_at < now()`. Crée les reminders selon le scénario assigné. |
| `process-reminders` | Toutes les heures | `/api/cron/process-reminders` | Envoie les relances dont `scheduled_at <= now()`. |
| `sync-integrations` | Toutes les 6h | `/api/cron/sync-integrations` | Sync QuickBooks/Xero pour les orgs connectées. |

Implémentation : Vercel Cron Jobs (`vercel.json`) appelant les route handlers avec un `CRON_SECRET` en header.

---

## 10. Sécurité — checklist

- [ ] RLS activé sur toutes les tables métier — policy filtre par `org_id`
- [ ] Webhook Stripe : vérifier signature avec `stripe.webhooks.constructEvent`
- [ ] Tokens de paiement (`/pay/[token]`) : JWT signé avec expiration courte (72h)
- [ ] Tokens d'intégration (QB, Xero) : chiffrés en base (`pgcrypto`)
- [ ] Rate limiting sur `/api/payments/create-session` (éviter abus)
- [ ] Validation Zod sur TOUTES les entrées (body, params, query)
- [ ] Montants toujours en centimes (integer) — jamais de float
- [ ] CRON_SECRET vérifié sur toutes les routes cron
- [ ] CSP headers configurés dans `next.config.js`
- [ ] `.env` et `.env.local` dans `.gitignore`

---

## 11. Variables d'environnement requises

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Email (Resend)
RESEND_API_KEY=

# SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Intégrations
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=

# Sécurité
CRON_SECRET=
JWT_SIGNING_SECRET=              # pour les tokens de paiement débiteur

# App
NEXT_PUBLIC_APP_URL=
```

---

## 12. Ordre d'implémentation (phases)

### Phase 1 — Fondations (MVP core)
1. Setup projet Next.js + Supabase + Tailwind + shadcn/ui
2. Auth (signup, login, middleware)
3. Modèle DB (migrations) + RLS policies
4. CRUD organisations + users
5. CRUD débiteurs
6. CRUD factures (création manuelle)
7. Dashboard KPIs basiques

### Phase 2 — Recouvrement
8. Scénarios de relance (CRUD + éditeur)
9. Moteur de relance (cron + envoi email via Resend)
10. Envoi SMS (Twilio)
11. Timeline relances sur la fiche facture
12. Page de paiement débiteur (`/pay/[token]` + Stripe Checkout)
13. Webhooks Stripe (paiement reçu)

### Phase 3 — Escalade & Analytics
14. Génération PDF mise en demeure
15. Escalade automatique (dernier step du scénario)
16. Tableau de bord analytics (Recharts)
17. Activity logs / audit trail

### Phase 4 — Intégrations & Polish
18. Import CSV/Excel
19. Intégration QuickBooks (OAuth + sync)
20. Intégration Xero (OAuth + sync)
21. Personnalisation templates email/SMS
22. Billing SaaS (plans + Stripe Customer Portal)
23. i18n complet (EN)
24. Onboarding wizard pour nouveaux users
