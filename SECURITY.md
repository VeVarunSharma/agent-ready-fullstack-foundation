# Security

> **Not production configured.** No Vercel, Supabase, GitHub protected environment, Azure resource,
> identity audience, production data, recovery plan, or residency approval is evidenced.

The [repository constitution](CONSTITUTION.md) is binding.

## Report a vulnerability

Do not disclose a suspected vulnerability in a public issue, pull request, log, deployment preview,
Supabase table, or test artifact. Use the repository host's private vulnerability-reporting feature
when configured, otherwise an approved private organizational channel. Include affected
version/path, minimal synthetic reproduction, expected/observed behavior, likely impact, and a
secure contact.

Do not test a Vercel, Supabase, or Azure environment without explicit authorization.

## Implemented safeguards

- Strict environment schemas reject incomplete production modes, local credentials in production,
  database URLs, administrator/default database roles, unverified TLS, service-role keys, migration
  secrets in Vercel, HTTP callback origins, and disabled production authentication.
- Supabase Auth clients use only the project URL and publishable key. Proxy validates `getClaims()`,
  propagates refreshed cookies/cache headers, and never trusts `getSession()` as identity.
- Invite-only email/password login sends credentials directly from the browser to Supabase, returns
  one fixed credential rejection, validates relative return paths, and never sends credentials to
  application code/logs.
- Production Supabase cookies are `Secure`, `SameSite=Lax`, and path `/`; Proxy verifies claims and
  preserves refresh cookie/cache headers.
- Runtime PostgreSQL uses a dedicated role, transaction endpoint `6543`, bounded pool, and verified
  root certificate. Migration uses a distinct role and port `5432` session.
- Drizzle production migration holds a nonblocking advisory lock on the same `PoolClient`, unlocks
  in `finally`, and never runs during install/build/startup.
- oRPC/Zod contracts, safe envelopes, opaque correlation IDs, no-store responses, and strict
  TypeScript protect the JSON boundary.
- Pino accepts fixed events and allowlisted fields only; credentials, cookies, email, bodies, URLs,
  SQL, prompts, provider errors, and unrestricted text are prohibited.
- Semantic tokens, visible focus, labels/status text, reduced motion, and Playwright/axe checks
  cover the neutral UI and Auth form.
- Exact stable dependencies, lockfile policy, SHA-pinned workflow actions, CodeQL, and deterministic
  checks protect the source path.
- Provider-boundary Bicep compiles to zero resources and tests that Foundry, Azure Monitor export,
  and Azure runtime access remain disabled.

## Scaffolded-disabled or external

- Vercel project/root setting, custom domains, regions, production-domain assignment, Deployment
  Checks, protection, log settings, and rollback controls.
- Supabase project/region, public-signup denial, password/recovery/MFA policy, optional notification
  email, asymmetric signing keys, provisioning, rate/lockout/CAPTCHA, session lifetime, database
  roles, network restrictions, backups, PITR, and restore.
- GitHub `production` environment, reviewers, branch rules, migration secrets, and selection of the
  stable migration job as a Vercel Deployment Check.
- Azure Monitor export, Vercel Log Drain, collector, Application Insights, and all Azure resources.
- Vercel-to-Azure OIDC federated credentials and RBAC; no Azure consumer currently exists.
- Foundry account/project/model/agent/data plane; the boundary is false-only.

External configuration is not an active control until separately evidenced.

## Not defined

There is no self-service signup, social identity provider, user profile, product role, permission,
authorization policy, product table, RLS policy, customer data, Supabase Storage/Realtime/Edge
Function, on-call/SLA, disaster recovery objective, multi-region failover, or Foundry behavior.

## Canonical records

- [Data classification](docs/security/DATA_CLASSIFICATION.md)
- [Data residency](docs/security/DATA_RESIDENCY.md)
- [Threat model](docs/security/THREAT_MODEL.md)
- [Logging and telemetry](docs/security/LOGGING_AND_TELEMETRY.md)
- [Identity bootstrap](docs/runbooks/identity-bootstrap.md)
- [Database bootstrap](docs/runbooks/database-bootstrap.md)
- [Deployment](docs/runbooks/deployment.md)
- [Foundry readiness](docs/architecture/FOUNDRY_READINESS.md)

Unknown customer data is Restricted. Unknown region, replication, backup, retention, deletion,
support, identity, or recovery behavior blocks production use.

## Secrets and credentials

- Never commit or print a token, password, private key, certificate, cookie, connection string, real
  project/tenant identifier, or secret-shaped placeholder.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the only Supabase key allowed in browser code. A legacy
  anon key may be migrated externally, but this template requires the modern publishable-key format.
- Supabase legacy service-role and modern `sb_secret_` keys are prohibited from application and
  migration configuration, including public-prefixed environment names.
- Vercel receives only its dedicated runtime database role password and root certificate through
  encrypted environment settings.
- GitHub receives only its distinct migration role password and root certificate through the
  protected `production` environment.
- `DATABASE_URL` is prohibited. Separate fields prevent accidental URL logging and force explicit
  pool/TLS behavior.
- Runtime and migration roles must not be `postgres`, `supabase_admin`, `service_role`, `anon`, or
  `authenticated`; they must not share a credential.
- Rotate/revoke provider credentials on a named schedule and immediately after suspected exposure.
- Future Vercel-to-Azure access uses OIDC federation, not an Azure client secret.

Supabase PostgreSQL's password requirement is the narrow provider exception recorded in Constitution
2.0.0. It does not authorize committed, shared, administrator, URL-shaped, or cloud-management
credentials.

## Change requirements

Every functional change needs an active/current cataloged PRD. The same change must classify data,
validate trust-boundary inputs, separate authentication from authorization, record every processor
and location, use least privilege, keep secrets server-only, update selected architecture/security
records, and add deterministic evidence.

The first product persistence change must add schema and generated migration together, define
runtime/migration grants, decide how Supabase RLS complements application authorization, and
preserve expand/migrate/contract compatibility. The first new Auth field/provider must update
enumeration, CSRF, redirect, session, recovery, telemetry, and data-residency analysis.
