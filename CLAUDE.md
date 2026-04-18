# Recouvrement-B2B

SaaS multi-tenant de recouvrement de créances B2B. Permet aux entreprises de gérer leurs factures impayées, automatiser les relances (email/SMS), proposer le paiement en ligne au débiteur, et escalader automatiquement vers une mise en demeure PDF.

## Stack

- **Framework**: Next.js 15.5 (App Router, Turbopack) + TypeScript (strict mode) + React 19
- **Base de données / Auth / Storage**: Supabase (PostgreSQL + RLS + Edge Functions)
- **Styling**: Tailwind CSS v4 + shadcn/ui (oklch color system, CSS-based config)
- **Paiement**: Stripe (Checkout + webhooks)
- **Email**: Resend (transactionnel)
- **SMS**: Twilio
- **PDF**: @react-pdf/renderer (génération côté serveur des mises en demeure)
- **i18n**: next-intl (fr/en)
- **Validation**: Zod
- **Déploiement**: Vercel

## État d'avancement

### Phase 1 — Fondations (complétée ✅)
- [x] **Step 1** — Setup Next.js 15 + Tailwind v4 + shadcn/ui + structure de dossiers
- [x] **Step 2** — Auth (signup, login, forgot-password, middleware, callback)
- [x] **Step 3** — Migrations DB + RLS policies (toutes les tables + trigger new user)
- [x] **Step 4** — CRUD organisations + users (settings org + profil + team)
- [x] **Step 5** — CRUD débiteurs (liste, créer, modifier, supprimer)
- [x] **Step 6** — CRUD factures (liste, créer, modifier, supprimer + statuts)
- [x] **Step 7** — Dashboard KPIs basiques (encours, retard, recouvré, récents)

### Phase 2 — Recouvrement (complétée ✅)
- [x] **Step 1** — Migration DB : `payment_token` sur `invoices`, tables `reminder_scenarios` + `reminder_scenario_steps` + RLS
- [x] **Step 2** — Lib layer : `stripe/client.ts`, `email/resend.ts`, `sms/twilio.ts`, `supabase/admin.ts` (service-role)
- [x] **Step 3** — CRUD scénarios de relance : `/settings/reminders` (liste, créer, détail/étapes)
- [x] **Step 4** — Page détail facture `/invoices/[id]` + timeline des relances + bouton copie lien paiement
- [x] **Step 5** — Cron Vercel `/api/cron/reminders` : marque en retard, planifie, envoie via Resend/Twilio
- [x] **Step 6** — Webhook Stripe `/api/webhooks/stripe` : vérifie signature, marque facture payée, crée payment
- [x] **Step 7** — Page paiement public `/pay/[token]` + Stripe Checkout + page succès

### Phase 3 — Escalade & Analytics (complétée ✅)
- [x] **Step 1** — Migration DB : `activity_logs`, extension `formal_notices` (status + debtor_id + generated_at), nouveaux statuts `invoices`
- [x] **Step 2** — Lib : `pdf/formal-notice.tsx` (@react-pdf/renderer) + `activity.ts` (helper logActivity)
- [x] **Step 3** — API Route `/api/formal-notices/generate` : génère PDF + upload Storage + crée record + log
- [x] **Step 4** — Page `/formal-notices` : liste des mises en demeure + téléchargement PDF
- [x] **Step 5** — Bouton escalade sur `/invoices/[id]` : génère mise en demeure (avec ou sans envoi email)
- [x] **Step 6** — Cron mis à jour : log d'activité + escalade automatique après épuisement des étapes
- [x] **Step 7** — Page `/analytics` : Recharts (facturé vs recouvré, taux mensuel, aging report, KPIs)
- [x] **Step 8** — Page `/activity` : audit trail des 200 dernières actions

### Phase 4 — Intégrations & Polish (à venir)

## Notes techniques importantes

### Phase 3 — Escalade & Analytics (complétée)
- **Packages ajoutés** : `@react-pdf/renderer`, `recharts`
- **PDF generation** : `src/lib/pdf/formal-notice.tsx` — composant React PDF + `generateFormalNoticePDF()` qui retourne un `Buffer`. Utilisé uniquement dans des Route Handlers (jamais dans des Server/Client Components) pour éviter les conflits avec le renderer React.
- **Supabase Storage** : bucket `formal-notices` (privé, à créer dans le dashboard Supabase). Upload via `admin.storage.from('formal-notices').upload()` + signed URL 7 jours.
- **Activity logs** : `src/lib/activity.ts` — `logActivity()` helper. Écrit dans `activity_logs` via le client admin (bypass RLS). `actor_id = null` = action système (cron). RLS SELECT filtre par `org_id`.
- **Escalade automatique** : le cron détecte quand tous les steps d'un scénario ont été envoyés ET que la facture est toujours impayée → génère automatiquement la mise en demeure → met `invoices.status = 'formal_notice'`.
- **Nouveaux statuts facture** : `in_recovery` (relances en cours), `formal_notice` (mise en demeure envoyée), `written_off` (perdue).
- **Recharts** : composants client dans `_components/charts.tsx`, données calculées côté serveur dans `analytics/page.tsx`. 3 graphiques : BarChart (facturé vs recouvré 12 mois), LineChart (taux de recouvrement mensuel), BarChart horizontal (aging report).
- **Aging report** : répartition des créances en retard par ancienneté (0-30j, 31-60j, 61-90j, 90j+).

### Phase 2 — Recouvrement (complétée)
- **Packages ajoutés** : `stripe`, `resend`, `twilio`, `@types/twilio`
- **Admin client** : `src/lib/supabase/admin.ts` — `createAdminClient()` avec `service_role`, bypasse RLS, utilisé uniquement dans les route handlers serveur (cron, webhook)
- **Clients lazy** : `resend.ts`, `twilio.ts`, `stripe/client.ts` — les env vars sont vérifiées à l'exécution (pas au module load) pour éviter les erreurs build
- **Middleware** : `/pay/*` et `/api/*` exemptés de la redirection auth
- **Scénarios de relance** : `reminder_scenarios` + `reminder_scenario_steps` — trigger `ensure_single_default_scenario()` garantit un seul default par org. Seed : scénario par défaut + 3 étapes (email J+7, email J+14, SMS J+21)
- **Template interpolation** : `{{contact_name}}`, `{{invoice_number}}`, `{{amount}}`, `{{due_date}}`, `{{payment_link}}`, `{{org_name}}` — fonction `interpolate()` dans `src/lib/email/templates.ts`
- **Cron** : `/api/cron/reminders` (GET, `force-dynamic`) — sécurisé par `Authorization: Bearer CRON_SECRET`. Logique : marque `pending→overdue` si `due_at < today`, puis pour chaque facture overdue avec scénario, insère des reminders si absents, et envoie ceux dont `daysPastDue >= delay_days`
- **Webhook Stripe** : `/api/webhooks/stripe` (POST) — vérifie `stripe-signature` avec `STRIPE_WEBHOOK_SECRET`, gère `checkout.session.completed`, marque facture `paid`, crée `payment`
- **Stripe Checkout** : `src/app/pay/[token]/actions.ts` — `createCheckoutSession()` crée une session avec `payment_token` dans les métadonnées, redirige vers Stripe
- **Page paiement** : `/pay/[token]` — utilise l'admin client (pas d'auth user), affiche l'état de la facture
- **vercel.json** : cron `0 * * * *` → `/api/cron/reminders`
- **Stripe API version** : `2026-03-25.dahlia` (version actuelle du package installé)

### Auth + DB + CRUD (Steps 2-7 — complétés)
- **Packages ajoutés** : `@supabase/ssr`, `@supabase/supabase-js`, `@radix-ui/react-slot`, `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-separator`, `@radix-ui/react-avatar`
- **Supabase clients** : `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (RSC + Route Handlers), `src/lib/supabase/middleware.ts` (session refresh)
- **Middleware** : `src/middleware.ts` — redirige les non-authentifiés vers `/login`, les authentifiés hors des pages auth vers `/`
- **Auth Server Actions** : `src/lib/supabase/actions.ts` — `signUp`, `signIn`, `signOut`, `resetPassword`
- **Trigger Supabase** : à la création d'un utilisateur auth → crée automatiquement une `organization` + un profil `users` avec le rôle `owner`
- **Migration** : `supabase/migrations/20260416000001_initial_schema.sql` — toutes les tables + index + RLS + helper `get_user_org_id()` + trigger
- **Types DB** : `src/types/database.ts` — types manuels de toutes les tables + alias (Organization, Invoice, Debtor, etc.)
- **Montants** : toujours en centimes (integer) — le champ du formulaire est en euros, `invoiceSchema` convertit `× 100` via Zod
- **Server Actions pattern** : `useActionState` (React 19) + Server Action qui retourne `{ error }` ou `redirect()`
- **shadcn/ui components** créés manuellement dans `src/components/ui/` : button, input, label, card, badge, table, select, textarea, separator, dialog, dropdown-menu, avatar
- **`src/lib/utils.ts`** : ajout de `formatCurrency`, `formatDate`, `invoiceStatusLabels`, `invoiceStatusVariant`
- **Route groups** : `(auth)` — pages login/signup/forgot-password avec layout centré ; `(dashboard)` — layout avec sidebar + header
- **Sidebar** : `src/components/features/dashboard/sidebar.tsx` — navigation client avec `usePathname()`
- **Header** : `src/components/features/dashboard/header.tsx` — affiche org name + user menu avec logout

### Setup (Step 1 — complété)
- **Tailwind v4** : pas de `tailwind.config.ts` — configuration dans `src/app/globals.css` via `@theme inline`. Importer avec `@import "tailwindcss"`. Le système de couleurs utilise oklch (shadcn/ui default).
- **shadcn/ui** : CLI incompatible avec Node v24 — ajouter les composants manuellement via `npx shadcn@latest add <component>` ou copier depuis la doc. Config dans `components.json` (style: "new-york", baseColor: "zinc").
- **`cn()` utility** : `src/lib/utils.ts` (clsx + tailwind-merge). Toujours utiliser `cn()` pour combiner des classes Tailwind conditionnelles.
- **Path alias** : `@/` → `src/` configuré dans `tsconfig.json`. Toujours importer avec `@/` jamais avec des chemins relatifs `../../`.
- **Variables d'env** : modèle dans `.env.example` — copier vers `.env.local` (jamais committer).
- **Turbopack** : activé par défaut avec `next dev --turbopack`. Ne pas utiliser webpack si Turbopack est disponible.
- **React 19** : les hooks `use()`, `useOptimistic`, `useFormStatus` sont disponibles — préférer les Server Actions + ces hooks aux patterns Redux/useState complexes pour les formulaires.
- **Route groups** : `(auth)` et `(dashboard)` sont des groupes App Router — le dossier entre parenthèses n'apparaît pas dans l'URL. Les créer avec un `layout.tsx` dédié.
- **Composants shadcn/ui** : copiés dans `src/components/ui/` — ils sont modifiables directement (ce ne sont pas des packages npm).

## Commandes

- `npm run dev` : serveur de dev (port 3000)
- `npm run build` : build production
- `npm run lint` : ESLint
- `npm run test` : Vitest (unit tests)
- `npm run test:e2e` : Playwright (e2e)
- `npx supabase db push` : appliquer les migrations Supabase
- `npx supabase gen types typescript --local > src/lib/database.types.ts` : régénérer les types DB

## Architecture

```
/src
  /app              — Pages et layouts (App Router)
    /api            — Route handlers (webhooks Stripe, crons)
    /(auth)         — Pages login / signup / forgot-password        [à créer]
    /(dashboard)    — Espace connecté (factures, relances, analytics) [à créer]
  /components
    /ui             — Composants shadcn/ui réutilisables
    /features       — Composants métier (InvoiceTable, RelanceTimeline…)
  /lib
    /supabase       — Client Supabase, helpers, middleware auth
    /stripe         — Config Stripe, helpers paiement
    /email          — Templates email + helpers envoi
    /sms            — Helpers SMS
    /pdf            — Génération des mises en demeure PDF
    utils.ts        — Fonction cn() (clsx + tailwind-merge)
  /hooks            — Custom React hooks
  /types            — Types TypeScript globaux
  /messages         — Fichiers i18n (fr.json, en.json)              [à créer]
/supabase
  /migrations       — Migrations SQL
  seed.sql          — Données de test
```

## Conventions de code

- TypeScript strict, jamais `any` — utiliser `unknown` + type guards si nécessaire
- Named exports uniquement (pas de `export default` sauf pages Next.js)
- Composants en PascalCase, fichiers en kebab-case
- Server Components par défaut ; `"use client"` uniquement quand nécessaire
- Toute donnée Supabase passe par RLS — ne jamais utiliser `service_role` côté client
- Valider les inputs avec Zod (API routes + formulaires)
- Gérer les erreurs explicitement — pas de `catch` vide

## Base de données — modèle clé

Tables principales (Supabase/PostgreSQL) :
- `organizations` — tenants (multi-tenant par org)
- `users` — membres d'une org, liés via `org_id`
- `debtors` — entreprises débitrices
- `invoices` — factures impayées (montant, échéance, statut)
- `reminders` — relances planifiées/envoyées (type, canal, date, statut)
- `payments` — paiements reçus (lien Stripe)
- `formal_notices` — mises en demeure générées (PDF, date d'envoi)

RLS activé sur toutes les tables — chaque policy filtre par `org_id`.

## Workflows métier critiques

1. **Relance automatique** : cron (Supabase Edge Function ou Vercel Cron) → vérifie les factures en retard → envoie email/SMS selon le scénario de relance configuré par l'org
2. **Paiement en ligne** : débiteur reçoit un lien → page de paiement Stripe Checkout → webhook confirme le paiement → met à jour `invoices.status` + crée un `payment`
3. **Escalade mise en demeure** : après X relances sans réponse → génère un PDF de mise en demeure → enregistre dans `formal_notices` → envoie par email (+ option courrier)

## Sécurité — règles absolues

- JAMAIS committer `.env` ou `.env.local`
- Les webhooks Stripe DOIVENT vérifier la signature (`stripe.webhooks.constructEvent`)
- Toute route API authentifiée vérifie le JWT Supabase + l'appartenance à l'org
- Les montants financiers sont stockés en centimes (integer) — jamais en float
- Les PDFs de mise en demeure contiennent des données légales : toujours valider le contenu

## Git

- Branche principale : `main`
- Branches feature : `feat/nom-court`
- Branches fix : `fix/nom-court`
- Commits conventionnels : `feat:`, `fix:`, `chore:`, `docs:`
- Toujours tester avant de push

## Compaction

Quand le contexte est compacté, toujours préserver : la liste des fichiers modifiés, l'état des migrations DB, et les décisions d'architecture prises dans la session.
