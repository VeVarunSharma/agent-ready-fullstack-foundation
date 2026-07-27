# ADR-0002: Vercel and Supabase foundation

- **Status:** Accepted for this template branch; not production approval
- **Date:** 2026-07-27
- **Decision owners:** Repository maintainers
- **Scope:** Product-neutral hosting, database, Auth, and delivery boundaries

## Context

The reusable foundation needs an alternative to the Azure Container Apps and Flexible Server
topology in ADR-0001. Changing only environment values would leave incorrect assumptions about
containers, managed identity, private networking, authentication headers, migration execution,
observability, and staged traffic. The alternative must run natively on Vercel, use Supabase
Postgres and Auth, and preserve the repository's specification, type, migration, security,
accessibility, and data-residency gates.

## Decision

### Vercel-native Next.js

Set the Vercel project Root Directory to `apps/web`. Use the checked-in filtered pnpm/Turborepo
install/build commands and standard Next.js output. Remove Docker, standalone-server preparation,
Container Apps, Application Gateway, ACR, and image-based migration assumptions.

Bootstrap exact Corepack `0.35.0` and pnpm `11.17.0` in the Vercel install command. Pin Node `24.x`
for Vercel because the platform rolls minor/patch releases; local and CI continue to use exact
`.node-version` `24.18.0`.

Vercel Git integration owns preview and staged production builds. Production-domain assignment must
wait for required Deployment Checks, including the protected Supabase migration job, or use manual
promotion with auto-assignment disabled.

### Supabase Auth with application-owned authorization

Use `@supabase/ssr` and `@supabase/supabase-js` with the project URL and modern publishable key
only. Refresh cookies through request-scoped Proxy clients and verify identity with `getClaims()`,
never the unverified user object from `getSession()`.

Provide an invite-only email/password surface with external public-signup denial, bounded
credentials, a validated relative return path, secure production cookies, fixed application errors,
and no identity/credential detail in logs. Production must verify that Supabase itself does not
distinguish unknown-user from wrong-password responses. Supabase Auth authenticates only; every
future product operation remains responsible for server-side authorization.

### Supabase PostgreSQL with separate connections and duties

Retain Drizzle's `node-postgres` adapter. Vercel runtime uses a dedicated least-privilege role
through Supabase transaction pooling on port `6543`, verified TLS, and a pool of at most five
connections per instance. It does not accept a full `DATABASE_URL`, administrator/default role, or
service-role key.

Production migration uses a distinct role and a direct/shared-session endpoint on port `5432`. One
`PoolClient` takes the nonblocking advisory lock and runs Drizzle on that same session. The
protected GitHub job—not Vercel build/startup—executes the bundle.

Supabase PostgreSQL does not support workload identity for native `pg` access. Constitution 2.0.0
therefore admits this narrow provider credential with encrypted provider custody, separate roles,
verified TLS, and rotation/revocation while continuing to prohibit committed/shared/admin/URL-shaped
credentials.

### External release gate

Use a stable GitHub check named **Supabase production migration** on every `main` push. A protected
`production` environment supplies migration-only settings after review. Vercel imports that job as a
Deployment Check and withholds custom-domain assignment until it succeeds. Schema changes remain
expand/migrate/contract compatible because code rollback does not reverse migration.

### Retained Azure boundary

Remove Azure resources coupled to the replaced workload. Keep only zero-resource Bicep admission
boundaries:

- Foundry stays false-only;
- Azure Monitor application export stays rejected;
- no Azure runtime consumer exists.

A future approved Azure consumer must use Vercel OIDC federation with exact team/project/environment
subject, audience `api://AzureADTokenExchange`, and narrow RBAC. No Azure client secret is
permitted.

## Consequences

### Positive

- The template maps directly to Vercel and Supabase rather than carrying false Azure controls.
- Auth, database runtime, and migration credentials have explicit separate boundaries.
- Database migration can gate traffic without entering a framework build or server startup.
- The neutral app remains product/domain independent and testable offline.
- Future Azure access can remain secretless through OIDC federation.

### Costs and constraints

- Vercel, Supabase, GitHub, email, DNS, support, logs, and backups add external processors/control
  planes whose locations and terms require review.
- Native PostgreSQL access requires protected rotating credentials because Supabase has no workload
  identity for `pg`.
- Transaction pooling excludes named prepared statements and session-state assumptions.
- Vercel and Supabase private-network equivalence to the prior Azure topology is not claimed.
- Deployment Checks, protected environments, roles, password/recovery/MFA policy, optional email,
  backups, and recovery are externally configured and cannot be proven by repository tests.
- Single-region/provider deployment has no declared failover.

## Alternatives considered

- **Support both Azure and Vercel in one runtime:** rejected because mixed modes multiply identity,
  networking, migration, and release assumptions and make the template harder to copy safely.
- **Keep Docker/standalone output on Vercel:** rejected because it bypasses the native Next.js
  deployment contract without an immediate consumer.
- **Use Supabase service-role/Data API for all server access:** rejected because a service-role key
  bypasses RLS and is broader than the dedicated PostgreSQL role required by this empty foundation.
- **Use the default `postgres` role:** rejected as overprivileged and shared across duties.
- **Run migration in Vercel build/startup:** rejected because builds/previews/retries can execute
  more than once and cannot safely own schema mutation.
- **Deploy retained Azure monitoring/Key Vault resources:** rejected because no Vercel runtime
  consumer or approved log-drain/private path exists.

## Validation

The decision is represented by strict environment tests, Supabase pool/migration tests, Auth
proxy/callback/form tests, Vercel/release contract tests, browser/axe checks, and zero-resource
Bicep validation. None of those proves a live provider configuration or production readiness.
