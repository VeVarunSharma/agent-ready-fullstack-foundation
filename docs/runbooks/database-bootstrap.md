# Supabase database bootstrap

This runbook creates and verifies separate PostgreSQL roles for Vercel runtime and protected schema
migration. It does not create a Supabase project or authorize production access.

> No Supabase project, role, credential, root certificate, backup policy, or production schema is
> configured. Run only through an approved private operator process with a verified target and
> recovery evidence. Never paste production values into source, issues, PRs, terminal transcripts,
> or SQL shared through public channels.

## Identity model

| Identity                       | Purpose                                                       | Prohibited                                                 |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------- |
| Supabase project administrator | One-time role/grant/bootstrap and recovery                    | Application runtime                                        |
| Runtime database role          | Approved DML only through transaction pooler `6543`           | DDL, ownership, migration metadata, role/admin, bypass RLS |
| Migration database role        | Reviewed DDL/migration metadata through direct/session `5432` | Application runtime, superuser-like privileges             |
| GitHub migration job           | Uses migration role from protected environment                | Runtime role and Supabase management/service-role key      |
| Vercel runtime                 | Uses runtime role from encrypted Production settings          | Migration/admin role and migration secrets                 |

The two database roles require different credentials and rotation. Do not use `postgres`,
`supabase_admin`, `service_role`, `anon`, or `authenticated`.

## Prerequisites

- Production/nonproduction Supabase projects are separate and their exact regions are approved.
- Current Supabase connection/pooler documentation and custom-role behavior are rechecked.
- The direct/session endpoint on port `5432` and transaction endpoint on `6543` are known.
- The current Supabase root certificate is obtained from the project Connect settings and verified.
- Backup/PITR, restore, retention, support, incident, RPO/RTO, and credential rotation are approved.
- The GitHub protected environment and Vercel environment administrators are distinct where
  practical.
- The persistence PRD defines schema, grants, RLS/application authorization, rollout compatibility,
  and recovery. The current schema is empty.

## Create dedicated roles

Connect through an authorized administrator session using verified TLS. Supply generated passwords
through process environment or an approved secret mechanism, never command history. Use reviewed,
project-specific role names:

```sql
CREATE ROLE application_runtime
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

CREATE ROLE schema_migration
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;
```

Set each password through a parameterized/secret-fed administrator process. Do not embed a password
literal in a migration, SQL file, shell command, or provider screenshot.

If roles already exist, inspect their attributes, memberships, ownership, and active sessions before
changing anything. A matching name is not proof of safe state.

## Baseline grants for the empty schema

Replace identifiers through safe administrator parameters:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE postgres TO application_runtime;
GRANT CONNECT ON DATABASE postgres TO schema_migration;

GRANT USAGE ON SCHEMA public TO application_runtime;
GRANT USAGE, CREATE ON SCHEMA public TO schema_migration;

CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION schema_migration;
REVOKE ALL ON SCHEMA drizzle FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA drizzle TO schema_migration;
```

Before using `IF NOT EXISTS`, verify any existing `drizzle` schema owner; the statement does not fix
wrong ownership. The runtime role receives no migration-metadata access.

The first product schema should use a dedicated schema owned by the migration role. Its admitting
PRD must grant only required operations:

```sql
GRANT USAGE ON SCHEMA application TO application_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA application
  TO application_runtime;
GRANT USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA application
  TO application_runtime;

ALTER DEFAULT PRIVILEGES
  FOR ROLE schema_migration
  IN SCHEMA application
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO application_runtime;
ALTER DEFAULT PRIVILEGES
  FOR ROLE schema_migration
  IN SCHEMA application
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO application_runtime;
```

Do not run these template grants before a product schema/operation set is approved. `GRANT ALL`,
database ownership, role admin, replication, bypass-RLS, broad `PUBLIC`, or membership in Supabase
administrator roles is prohibited.

## Supabase Auth and RLS

The current server uses a dedicated PostgreSQL runtime role after Supabase Auth verifies the
request. No product query exists. The first table-bearing PRD must choose and test one explicit
model:

- application-owned authorization with every query constrained to the verified subject/tenant; or
- Supabase Data API/user JWT with RLS; or
- a reviewed combination in which RLS is defense in depth.

RLS never replaces server-side authorization. A direct database role must not silently bypass an RLS
policy intended for `authenticated` users. Record how verified Auth claims become safe query scope.

## Configure protected settings

### Vercel runtime

Use the transaction pooler values from Supabase Connect:

- `DATABASE_HOST` — shared/dedicated pooler host
- `DATABASE_PORT=6543`
- `DATABASE_NAME`
- `DATABASE_USER` — dedicated role using the exact pooler username form shown by Supabase
- `SUPABASE_DATABASE_PASSWORD`
- `SUPABASE_DATABASE_ROOT_CERT`
- `DATABASE_POOL_MAX` — `1..5`, selected against the project pool limit

Do not send `statement_timeout` as a transaction-pool startup parameter; Supabase's dedicated
PgBouncer endpoint may reject it. Configure reviewed role/database timeouts server-side and keep the
client-side query timeout bounded.

### GitHub migration

Use a direct or shared-session endpoint:

- `SUPABASE_MIGRATION_HOST`
- `SUPABASE_MIGRATION_PORT=5432` (fixed in workflow)
- `SUPABASE_MIGRATION_DATABASE`
- `SUPABASE_MIGRATION_USER` — distinct migration role and exact endpoint username form
- `SUPABASE_MIGRATION_PASSWORD`
- `SUPABASE_MIGRATION_ROOT_CERT`

Never copy migration values into Vercel, preview values into production, or runtime values into the
GitHub migration job.

## Verify positive and negative access

From the actual Vercel and protected-runner contexts, record booleans/role names only:

1. Both connections use TLS with certificate verification and the intended project/region.
2. Runtime reaches port `6543`; migration reaches port `5432`.
3. `SELECT current_user, current_database()` matches each dedicated role.
4. Runtime can execute only approved DML and cannot create/alter/drop objects, read `drizzle`,
   change roles, or assume migration/admin roles.
5. Migration can access migration metadata and approved schema DDL but cannot assume administrator
   or runtime duties.
6. Pool limits and transaction-mode query patterns work without named prepared/session state.
7. Credential rotation succeeds independently for each role and old credentials fail.

Do not print connection strings, passwords, certificate bodies, rows, full host/project identifiers,
or provider errors.

## Migration execution

The protected workflow builds `packages/db/dist/migrate-production.mjs` and executes it only after
environment approval. The entrypoint:

- accepts only the `SUPABASE_MIGRATION_*` production contract;
- fixes one pool connection and verified TLS;
- acquires `pg_try_advisory_lock` on one `PoolClient`;
- runs Drizzle on that same session;
- unlocks in `finally`, releases, and closes;
- emits one bounded success/failure line.

Never run it during pnpm install, Next.js/Vercel build, preview deployment, application startup, or
an unprotected local/CI task.

## Rotation and recovery

- Rotate runtime and migration credentials separately with an overlap procedure and negative test.
- On compromise, revoke the affected role credential/sessions, inspect approved logs, and update
  only that duty's protected setting.
- Migration failure stops promotion; repair forward.
- A database restore/PITR requires separate approval, known backup geography/age, write
  reconciliation, and compatibility verification. No restore procedure is currently approved.
