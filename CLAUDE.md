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

### Phase 1 — Fondations (en cours)
- [x] **Step 1** — Setup Next.js 15 + Tailwind v4 + shadcn/ui + structure de dossiers
- [ ] Step 2 — Auth (signup, login, middleware)
- [ ] Step 3 — Migrations DB + RLS policies
- [ ] Step 4 — CRUD organisations + users
- [ ] Step 5 — CRUD débiteurs
- [ ] Step 6 — CRUD factures (création manuelle)
- [ ] Step 7 — Dashboard KPIs basiques

### Phase 2 — Recouvrement (à venir)
### Phase 3 — Escalade & Analytics (à venir)
### Phase 4 — Intégrations & Polish (à venir)

## Notes techniques importantes

- **Tailwind v4** : pas de `tailwind.config.ts` — configuration dans `src/app/globals.css` via `@theme inline`. Importer avec `@import "tailwindcss"`.
- **shadcn/ui** : CLI incompatible avec Node v24 — ajouter les composants manuellement via `npx shadcn@latest add <component>` ou copier depuis la doc. Config dans `components.json`.
- **`cn()` utility** : `src/lib/utils.ts` (clsx + tailwind-merge).
- **Variables d'env** : modèle dans `.env.example` — copier vers `.env.local` (jamais committer).

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
