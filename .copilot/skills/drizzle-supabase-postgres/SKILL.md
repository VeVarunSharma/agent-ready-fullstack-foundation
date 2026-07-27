---
name: drizzle-supabase-postgres
description: "Change Drizzle schema and Supabase PostgreSQL migrations safely."
---

# Drizzle and Supabase PostgreSQL

## Use when

- A PRD declares persistence impact.
- Changing schema source, generated migrations, Supabase pools/roles, or database integration tests.

## Do not use when

- No approved persistence scope exists.
- Running ad hoc production repair, inventing seed/domain data, or adding a second PostgreSQL
  driver.

## Mandatory sources

- `CONSTITUTION.md`
- The relevant cataloged PRD and `ARCHITECTURE.md`
- `packages/db/package.json`, Drizzle config, schema sources, and existing migrations
- `docs/runbooks/database-bootstrap.md`
- `docs/security/DATA_CLASSIFICATION.md`, `docs/security/DATA_RESIDENCY.md`, and
  `docs/security/THREAT_MODEL.md` for stored data
- Local environment and Compose configuration when testing migrations

## Steps

1. Confirm data classification, compatibility window, rollout order, and recovery evidence.
2. Design an expand/migrate/contract sequence; separate destructive contraction from expansion.
3. Change Drizzle schema source, then generate the migration with repository commands.
4. Review generated SQL for locks, defaults, backfills, idempotency assumptions, and data movement.
5. Keep local password, Supabase transaction runtime, and Supabase session migration modes explicit.
   Preserve verified TLS, separate least-privilege roles, and the bounded pool.
6. Apply to a local disposable database and test both migrated behavior and compatibility.
7. Record the protected GitHub migration/required Vercel Deployment Check sequence; never attach
   migration execution to install, framework build, Vercel build, or application startup.

## Validation

```sh
pnpm db:generate
pnpm db:check
pnpm --filter @repo/db typecheck
pnpm test:unit
pnpm db:migrate:local
pnpm test:integration
```

The final two commands require the documented local PostgreSQL environment.

## Common failure modes

- Schema source without a generated migration, or manually authored drift from generated SQL.
- Destructive one-step changes, unsafe table rewrites, or no recovery plan.
- Default/admin/shared roles, a production `DATABASE_URL`, service-role key, unverified TLS, or
  broad grants.
- Migrations running during framework build, image build, or app startup.
