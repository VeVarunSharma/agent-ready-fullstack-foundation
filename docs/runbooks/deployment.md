# Deployment runbook

This runbook describes the Vercel/Supabase delivery contract and external gates. It is not
authorization to create or mutate a cloud environment.

> **Deployment is blocked.** No Vercel/Supabase project, production domain, GitHub protected
> environment, database role, Deployment Check, provider region approval, Auth password/recovery
> policy, backup/recovery evidence, or residency approval exists.

## Repository surfaces

- `apps/web/vercel.json` — Vercel project build/install configuration
- `packages/env` — strict browser/runtime/migration environment contracts
- `packages/db/dist/migrate-production.mjs` — protected migration entrypoint
- `.github/workflows/supabase-migrate.yml` — stable production migration check
- `.github/workflows/{ci,e2e,integration,infra-validate}.yml` — deterministic acceptance
- `infra/` / `azure.yaml` — zero-resource retained Azure admission boundary

## External duties

| Duty                                | Owner/boundary                                       |
| ----------------------------------- | ---------------------------------------------------- |
| Source/specification/review         | GitHub authors/reviewers and branch rules            |
| Vercel project/domain/environments  | Vercel project administrators                        |
| Supabase Auth/database/backup       | Supabase organization/project administrators         |
| Database runtime role               | Least-privilege application operator                 |
| Database migration role             | Protected migration operator; no application runtime |
| Migration approval                  | GitHub `production` environment reviewers            |
| Production traffic assignment       | Vercel Deployment Checks/promotion administrators    |
| Security/privacy/residency/recovery | Named approvers with evidence                        |
| Future Azure federation             | Entra/Azure owner after a consuming PRD              |

## 1. Configure Supabase projects

Create separate nonproduction and production projects. Record, without committing:

- organization/project reference and exact database/Auth region;
- shared/dedicated pooler endpoints and current root certificate;
- a dedicated runtime role and a distinct migration role;
- exact role grants, password rotation/revocation, pool limits, network restrictions, audit access;
- public-signup denial, asymmetric signing keys, password/breach/recovery/MFA policy, account
  provisioning, rates/lockouts, and optional notification email;
- backup/PITR/restore, retention/deletion, support access, RPO/RTO, incident owner.

The runtime role must not own schemas, create objects, read migration metadata, bypass RLS, or
assume the migration/admin role. The migration role owns only approved schema/migration metadata.
Neither role may be `postgres`, `supabase_admin`, `service_role`, `anon`, or `authenticated`.

Follow [database bootstrap](database-bootstrap.md) and [identity bootstrap](identity-bootstrap.md).

## 2. Configure the Vercel project

1. Import the GitHub repository and set **Root Directory** to `apps/web`.
2. Keep the checked-in install/build commands. Do not add a migration, Supabase CLI push, or
   arbitrary postbuild hook.
3. Set exact Preview and Production environment values. Production requires:
   - `RUNTIME_MODE=production`
   - `HOST_MODE=vercel`
   - `DATABASE_MODE=supabase-pooler`
   - `AUTH_MODE=supabase`
   - `LOGGING_MODE=json`
   - `TELEMETRY_MODE=disabled`
   - `NEXT_PUBLIC_RUNTIME_MODE=production`
   - exact application/Supabase Auth origins and publishable key
   - runtime database host `:6543`, database, dedicated user, password, root certificate, pool limit
4. Do not add `DATABASE_URL`, service-role key, migration variables, Azure connection string, or
   Azure client secret.
5. Configure custom domain/TLS, function region, preview isolation, fork protection, account RBAC,
   build/request/function log policy, support, retention, and Instant Rollback.
6. Require GitHub CI/browser/integration checks and **Supabase production migration** as Vercel
   Deployment Checks, or disable automatic production-domain assignment and use reviewed manual
   promotion.

Preview deployments use a separate nonproduction Supabase project. Production secrets are never
available to pull requests/forks.

## 3. Configure GitHub protection

Create a protected `production` environment with independent reviewers, default-branch restriction,
and only:

- `SUPABASE_MIGRATION_HOST`
- `SUPABASE_MIGRATION_DATABASE`
- `SUPABASE_MIGRATION_USER`
- `SUPABASE_MIGRATION_PASSWORD`
- `SUPABASE_MIGRATION_ROOT_CERT`

Port `5432` is fixed in the workflow. The host must be a Supabase direct endpoint or shared session
pooler reachable from the approved runner. Configure branch/ruleset protection for `main`, required
checks, action pin review, environment audit, secret rotation, and log retention.

## 4. Release sequence

1. PR checks run exact dependency, format, lint, type, unit, specification, build, local PostgreSQL,
   browser/axe, GitHub default CodeQL, and zero-resource IaC validation.
2. Vercel creates a preview from the reviewed branch. Test only against nonproduction Supabase.
3. Merge to `main`. Vercel creates a production build but required Deployment Checks hold domain
   assignment.
4. GitHub starts **Supabase production migration**. Protected reviewers verify commit, PRD,
   generated SQL, compatibility, grants, provider target, backup/recovery, and secrets/roles before
   release.
5. The job verifies source/toolchain, audits dependencies, typechecks/lints/tests the database
   package, builds the migration bundle, proves the checkout stayed unchanged, then runs it.
6. The entrypoint connects on port `5432`, takes the same-session advisory lock, applies outstanding
   Drizzle migrations, and emits only bounded success/failure.
7. Successful migration satisfies the Vercel check. Vercel assigns production domains automatically
   only if configured, or an authorized operator promotes the staged build.
8. Run post-release verification and retain only sanitized evidence.

No production schema change may depend on code becoming active before migration. Old and new code
must remain compatible throughout any staged/rolling release.

## 5. Post-release verification

Using synthetic/noncustomer requests:

1. Verify the deployed commit and Vercel environment/region/domain settings.
2. Confirm `/health/live` and `/health/ready` return only bounded status/correlation fields.
3. Confirm unauthenticated `/` redirects to the exact HTTPS `/auth/login`.
4. Verify an approved user can sign in; unknown-user and wrong-password responses are provider-level
   indistinguishable; unsafe return paths stay on the application origin.
5. Confirm public signup remains disabled and no privileged Supabase key or migration variable
   exists in Vercel.
6. Verify the runtime endpoint is `6543`, migration endpoint was `5432`, roles differ, TLS
   verification is active, and pool limits match approval without printing values.
7. Confirm the production-domain assignment occurred only after all Deployment Checks passed.
8. Inspect approved platform/application logs for only allowed metadata; callback
   token/email/cookies/ credentials/provider errors must be absent.
9. Record rollback target, schema compatibility, backup/PITR status, and incident contacts.

## Rollback and recovery

### Application

Vercel Instant Rollback may reassign domains to a previously served deployment. Verify its code is
compatible with every migration already applied. A rollback never runs down SQL.

### Database

Stop traffic promotion and repair forward. Do not drop newly used structures or run generated down
DDL as an emergency default. A Supabase restore/PITR operation requires separate approval, known
backup location/age, RPO/RTO, customer-write reconciliation, and post-restore verification. No
restore procedure is currently approved.

### Credentials/Auth

On suspected exposure, revoke/rotate the affected runtime or migration role independently, remove
sessions/invites as appropriate, inspect approved logs, and update protected settings. Do not copy a
credential between duties as a workaround.

## Failure stops

Stop without bypass when:

- source/check/deployment commit differs;
- migration review, environment approval, advisory lock, TLS, role, or provider target fails;
- a service-role/admin/shared credential, `DATABASE_URL`, unverified TLS, migration secret in
  Vercel, or production secret in preview appears;
- Vercel can assign production domains before required checks;
- generated SQL breaks expand/migrate/contract or lacks recovery/grant evidence;
- Auth project/signup/signing/password/recovery/MFA/rate/lockout policy is unresolved;
- region, logs, backups, retention/deletion, support, incident, RPO/RTO, or residency is unresolved;
- an Azure/Foundry resource or exporter appears without a separate admitting PRD.

Force-promoting or disabling a check requires an incident, named approver, exact scope, expiry, and
immediate reconciliation; it is not a normal release path.
