---
id: "VERCEL_SUPABASE_FOUNDATION"
version: "1"
path: "specs/PRDs/PRD_V1_VERCEL_SUPABASE_FOUNDATION.md"
title: "Vercel and Supabase application foundation"
summary: "Provide a reusable Vercel Next.js foundation with Supabase Postgres and Auth."
lifecycle: "current"
owners: ["@mortgatemate"]
created: "2026-07-27"
updated: "2026-07-27"
dataClassification: "Restricted"
supersededBy: null
architectureImpact: true
designSystemImpact: true
sensitiveDataImpact: true
persistenceImpact: false
---

# PRD V1: Vercel and Supabase application foundation

## Overview

Replace the Azure Container Apps and Azure Database for PostgreSQL hosting target with a reusable
Vercel and Supabase foundation. The Next.js App Router application remains product-neutral, but
gains a complete Supabase Auth session boundary, a Supabase-compatible PostgreSQL runtime and
migration boundary, Vercel monorepo configuration, and a release sequence that keeps database
migration outside framework builds and application startup.

The existing Azure workload topology is not carried forward under a misleading hybrid label.
Container Apps, Application Gateway, ACR, Key Vault, Flexible Server, and their private-network
delivery path are removed from this template. The disabled Foundry admission boundary and reserved
Azure Monitor application-export mode remain explicit, and future Vercel-to-Azure access is required
to use workload identity federation rather than a client secret.

## Motivation

The same governed application foundation must be reusable for projects whose application runtime is
Vercel and whose relational database and authentication provider are Supabase. Copying the Azure
workload topology and changing only environment values would leave invalid identity, networking,
authentication, migration, and release assumptions. A separate template must encode the provider
boundaries directly while preserving strict configuration, forward-only schema change, safe logging,
accessible neutral UI, and fail-closed production readiness.

## Scope

- Configure `apps/web` as the Vercel project root in the pnpm/Turborepo monorepo and remove the
  standalone-container build contract.
- Add strict Vercel/Supabase environment modes and reject incomplete provider combinations,
  service-role keys, unverified TLS, unsafe callback origins, and migration credentials in the web
  runtime.
- Use a bounded `pg` pool through Supabase transaction mode for Vercel runtime traffic and a
  distinct session-preserving Supabase connection for Drizzle migrations and advisory locking.
- Implement a Supabase browser credential client, request-scoped Proxy token refresh using verified
  claims, a neutral invite-only email/password form, validated relative return paths, secure
  production cookies, and sign-out without adding product roles or authorization.
- Add a protected GitHub migration check that runs before Vercel production-domain assignment and
  never during dependency installation, Next.js build, Vercel build, or application startup.
- Replace host-specific Azure IaC and delivery material with the retained false-only Foundry
  boundary, reserved Azure Monitor posture, and documented Vercel OIDC federation requirement for
  future Azure consumers.
- Align architecture, design, security, privacy, residency, operations, and template documentation
  with the implemented and still-unresolved provider boundaries.

## Out of Scope

- Provisioning or configuring a Vercel project, Supabase project, custom domain, email provider,
  Azure resource, GitHub environment, deployment check, or federated credential.
- Supabase Storage, Realtime, Edge Functions, Data API tables, self-service sign-up, social identity
  providers, organization membership, roles, permissions, or a product user profile.
- Product tables, seed data, row-level-security policy, data backfill, destructive migration, or
  production data transfer from Azure PostgreSQL.
- A Foundry account, model, deployment, agent, prompt, tool, dataset, or application call.
- Live Azure Monitor export, a Vercel Log Drain, a telemetry collector, or a production residency
  claim.
- Automatic production-domain promotion without the externally configured GitHub/Vercel checks and
  operator approvals defined by the deployment runbook.

## Feature Specifications

### FS-001: Vercel application runtime

The Vercel project root is `apps/web`. Vercel uses the repository lockfile, exact package manager,
workspace dependency graph, and Next.js framework output. No Dockerfile, standalone server rewrite,
Container Apps header, image migration bundle, or host-specific runtime assumption remains in the
application build.

### FS-002: Supabase PostgreSQL boundary

Production web traffic uses the shared or dedicated transaction pooler on port `6543`, TLS
certificate verification, a dedicated least-privilege runtime role, a small bounded client pool, and
no named prepared statement contract. Production migration uses a separate role and the direct or
shared session endpoint on port `5432`, preserving one PostgreSQL session for the advisory lock and
Drizzle migration. Credentials live only in Vercel or protected GitHub environment settings. A full
database URL remains prohibited from application configuration and logs.

The Drizzle schema stays empty. This PR changes connection and execution boundaries, not the product
data model, so `persistenceImpact` is false and no schema migration is invented.

### FS-003: Supabase Auth boundary

Supabase SSR clients use only the project URL and publishable key. Server clients are request
scoped, Proxy refresh calls `getClaims()` rather than trusting `getSession()`, refreshed
cookies/cache headers propagate intact, production cookies are Secure/SameSite, and malformed or
absent sessions do not become identities. Health and sign-in routes are public; the neutral
application shell requires authentication when the explicit production auth mode is enabled.

The sign-in form sends bounded email/password credentials directly from the browser to Supabase,
never to the application server/logger. Every credential error maps to one fixed application result,
and the post-login destination is a validated relative path. Production evidence must also prove
provider-level status/body/timing equivalence for unknown-user and wrong-password attempts; UI
masking alone is insufficient. Product authorization remains future and deny-by-default.

The rendered auth surface consumes existing `background`, `foreground`, `surface`,
`surface-foreground`, `muted-foreground`, `border`, `input`, `ring`, `primary`, and
`primary-foreground` tokens plus the shared `Button`. It adds no token or primitive. Native labels,
status text, keyboard focus, responsive reflow, light/dark/system themes, reduced motion, and
existing contrast requirements remain mandatory.

### FS-004: Release and retained Azure boundary

Vercel Git integration creates preview and staged production deployments. Vercel Deployment Checks
must hold custom-domain assignment until the stable GitHub migration check succeeds. The migration
job uses a protected production environment, exact reviewed source, an explicit confirmation for
manual dispatch, the session-preserving database endpoint, and the existing same-session advisory
lock. Schema changes remain expand/migrate/contract compatible with the previously served
application.

Azure workload resources coupled to the replaced host and database are removed. Foundry remains
false-only and emits no resources. Azure Monitor export remains reserved and rejected. A future
Vercel runtime that consumes an approved Azure service must use a Vercel OIDC token exchanged
through an exact Entra federated credential and narrow Azure RBAC; this PR creates neither.

## Affected Files

- `CONSTITUTION.md` — make provider credential rules explicit without permitting committed secrets.
- `apps/web/**` — add Vercel/Supabase runtime and Auth surfaces and remove container assumptions.
- `packages/env/**` — validate Vercel, Supabase runtime, Auth, and migration configuration.
- `packages/db/**` — implement transaction-pool runtime and session-preserving migration behavior.
- `package.json`, `pnpm-lock.yaml`, `turbo.json` — align scripts, dependencies, and environment
  inputs.
- `vercel.json`, `.env.example`, `apps/web/.env.example` — encode safe template configuration.
- `.github/workflows/**` — replace Azure delivery with protected Supabase migration and Vercel
  checks.
- `infra/**`, `azure.yaml` — remove replaced workload IaC and retain the false-only Azure boundary.
- `README.md`, `ARCHITECTURE.md`, `SECURITY.md` — describe the executable hybrid foundation.
- `docs/adr/**`, `docs/runbooks/**`, `docs/security/**` — record platform decisions and operations.
- `specs/design/DESIGN.md` — record the neutral authentication form as an existing-token consumer.

## Acceptance Criteria

- [x] **AC-001**: The monorepo builds the Next.js app through the Vercel project configuration
      without a standalone image, Docker delivery, or application-start migration.
- [x] **AC-002**: Environment parsing accepts only complete Vercel/Supabase production combinations
      and rejects missing TLS verification, unsafe origins, service-role keys, database URLs,
      runtime migration credentials, and production authentication bypass.
- [x] **AC-003**: Runtime PostgreSQL configuration enforces transaction-pool port `6543`, verified
      TLS, and bounded pooling, while production migration enforces a distinct port `5432` session
      and retains the same-session advisory lock.
- [x] **AC-004**: Supabase SSR Auth refreshes through request-scoped clients and verified claims,
      preserves response cookies/cache headers, protects the neutral shell, and permits only the
      documented public routes.
- [x] **AC-005**: Invite-only email/password sign-in validates inputs/return paths, uses fixed
      credential errors, requires provider-level enumeration verification before production, exposes
      no credential or identity value to application logs, and remains accessible in light, dark,
      keyboard, zoom/reflow, and reduced-motion use.
- [x] **AC-006**: The production migration workflow is separate from Vercel build/deploy, uses a
      protected GitHub environment and stable check name, and can gate Vercel production assignment
      before traffic.
- [x] **AC-007**: Azure host/database resources and delivery assumptions are absent; Foundry and
      Azure Monitor remain disabled, and future Azure access is documented as exact-subject Vercel
      OIDC federation with least privilege.
- [x] **AC-008**: Canonical architecture, design, threat, residency, telemetry, database, identity,
      and deployment records describe the same implemented, scaffolded-disabled, and future state.
- [x] **AC-009**: Deterministic repository, integration, browser/accessibility, build, and
      retained-IaC checks pass using the pinned toolchain without contacting Vercel, Supabase,
      Azure, or a model.

## Migration and Configuration

This branch is an alternative foundation template, not an in-place production migration. It carries
no Azure or Supabase data and defines no transfer. Existing Azure-hosted projects must plan any
application/data migration separately.

Template adopters create distinct Supabase development/staging/production projects, a Vercel project
rooted at `apps/web`, and a protected GitHub `production` environment. Vercel receives only runtime
and public Auth settings. GitHub receives only the dedicated migration settings. Supabase Auth
public-signup denial, password/breach/recovery/MFA policy, asymmetric signing keys, account
provisioning, and provider-level enumeration behavior are configured/verified externally. Vercel
must import the stable migration job as a required Deployment Check or disable automatic
production-domain assignment until migration evidence is approved.

The Supabase root certificate, database credentials, project URL, publishable key, project/tenant
identifiers, and Vercel/Azure OIDC identifiers are never committed. Credential rotation, backup,
restore, retention, region, support, password/recovery/MFA, abuse prevention, and account lifecycle
remain production blockers.

## Verification

| Criterion | Method    | Evidence                                                         |
| --------- | --------- | ---------------------------------------------------------------- |
| AC-001    | automated | `pnpm build` and `apps/web/test/vercel-config.test.ts`           |
| AC-002    | automated | `packages/env/test/environment.test.ts`                          |
| AC-003    | automated | `packages/db/test/pool.test.ts` and `migrate-production.test.ts` |
| AC-004    | automated | `apps/web/test/supabase-auth.test.ts` and `proxy.test.ts`        |
| AC-005    | automated | `apps/web/test/auth-flow.test.tsx` and `pnpm e2e`                |
| AC-006    | automated | `apps/web/test/release-contract.test.ts`                         |
| AC-007    | automated | `pnpm infra:validate` and repository search assertions           |
| AC-008    | CI        | `pnpm spec:validate:all` and architecture review                 |
| AC-009    | CI        | `pnpm check`, `pnpm test:integration`, `pnpm e2e`, `pnpm build`  |

## Status

Lifecycle: **current**

The alternative template is implemented and verified on `vercel-supabase-foundation`. No cloud
project or production data flow is configured or authorized by this record.
