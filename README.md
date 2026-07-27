# Vercel and Supabase application foundation

> **NOT PRODUCTION CONFIGURED.** This repository contains a tested local application and
> production-shaped provider contracts. It does not create a Vercel project, Supabase project,
> custom domain, SMTP provider, protected GitHub environment, database roles, backup policy,
> residency approval, or Azure resource.

This is a reusable, product-neutral foundation for a Next.js application hosted on Vercel with
Supabase Postgres and Supabase Auth. It includes strict TypeScript, pnpm/Turborepo workspaces, oRPC
v1 contracts, accessible semantic UI tokens, an empty Drizzle schema, local PostgreSQL integration,
Supabase-safe runtime and migration connections, deterministic CI, and a protected migration check
that can gate Vercel production promotion.

It defines no domain behavior, product table, self-service sign-up, role, permission, user profile,
Supabase Storage/Realtime function, or Foundry agent.

## Prerequisites

- Node.js `24.18.0`
- Corepack `0.35.0`
- pnpm `11.17.0`
- Git
- Docker with Compose v2 for local PostgreSQL/integration tests
- Vercel, Supabase, and GitHub accounts only when configuring cloud environments

## Local quickstart

```sh
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install --frozen-lockfile

cat > apps/web/.env.local <<'EOF'
RUNTIME_MODE=local
HOST_MODE=local
DATABASE_MODE=local-password
AUTH_MODE=disabled
LOGGING_MODE=json
TELEMETRY_MODE=disabled
NEXT_PUBLIC_RUNTIME_MODE=local
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=foundation_local
DATABASE_USER=foundation_local
DATABASE_PASSWORD=local-only-do-not-use-in-production
DATABASE_POOL_MAX=4
DATABASE_PROBE_TIMEOUT_MS=2000
EOF

docker compose up -d --wait
pnpm db:migrate:local
pnpm dev
```

Open <http://localhost:3000>. Authentication is disabled only in the explicit local contract. The
Compose credential is intentionally obvious, loopback-bound, synthetic, and prohibited elsewhere.

Available protocol surfaces:

- `GET /health/live` — process liveness only
- `GET /health/ready` — configuration and database readiness
- `GET /api/v1/health` — typed oRPC v1 health pipeline
- `GET /auth/login` — neutral invite-only Supabase credential surface

Stop and clean local resources:

```sh
docker compose down
rm -f apps/web/.env.local
```

Use `docker compose down --volumes` when the disposable local database should also be removed.

## Vercel and Supabase shape

The Vercel project uses **Root Directory** `apps/web`. `apps/web/vercel.json` bootstraps exact
Corepack `0.35.0`/pnpm `11.17.0`, installs the filtered workspace, verifies Vercel selected Node
`24.x`, and builds only `@repo/web` plus its dependencies. Local/CI use `.node-version` `24.18.0`;
Vercel rolls minor/patch updates within Node 24. Vercel Git integration supplies preview and staged
production deployments; no Vercel access token is stored in this repository.

The production runtime contract is exact:

| Boundary  | Required value                                                                      |
| --------- | ----------------------------------------------------------------------------------- |
| Runtime   | `RUNTIME_MODE=production`                                                           |
| Host      | `HOST_MODE=vercel` and Vercel-provided `VERCEL_ENV`                                 |
| Database  | `DATABASE_MODE=supabase-pooler`, transaction port `6543`, verified root certificate |
| Auth      | `AUTH_MODE=supabase`, exact HTTPS application/project origins, publishable key only |
| Logging   | `LOGGING_MODE=json`                                                                 |
| Telemetry | `TELEMETRY_MODE=disabled`                                                           |

Runtime PostgreSQL uses a dedicated least-privilege role through Supabase transaction pooling with a
maximum of five application-side connections per Vercel instance. Production migrations use a
different role and a direct or shared-session endpoint on port `5432`; the same PostgreSQL session
holds the advisory lock and runs Drizzle. Neither migration credentials nor a service-role key enter
the Vercel environment.

Supabase Auth uses request-scoped SSR clients, cookie refresh in Next.js `proxy.ts`, and
`getClaims()` verification. The browser sends credentials directly to Supabase and the repository
has no signup route. Configure approved users, public-signup denial, password/recovery/MFA policy,
asymmetric signing keys, rate limits, and any invitation/recovery email provider outside the
repository. See the [identity runbook](docs/runbooks/identity-bootstrap.md).

## Production migration gate

`.github/workflows/supabase-migrate.yml` runs for every push to `main` and as an explicitly
confirmed manual dispatch. Its stable check name is **Supabase production migration**. Configure it
as a Vercel Deployment Check so the production build cannot receive custom-domain traffic before the
protected GitHub `production` environment approves and completes migration.

The job receives only:

- `SUPABASE_MIGRATION_HOST`
- `SUPABASE_MIGRATION_DATABASE`
- `SUPABASE_MIGRATION_USER`
- `SUPABASE_MIGRATION_PASSWORD`
- `SUPABASE_MIGRATION_ROOT_CERT`

Never run `pnpm db:migrate:production` from a developer shell, Vercel build, application startup, or
unprotected job. Follow the [deployment runbook](docs/runbooks/deployment.md).

## Validation

Fast deterministic pull-request checks:

```sh
pnpm check
```

Environment-dependent checks:

```sh
docker compose up -d --wait
pnpm db:migrate:local
pnpm test:integration

pnpm --filter @repo/web exec playwright install chromium
pnpm build
pnpm e2e
```

| Command                   | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `pnpm dev`                | Run persistent workspace development tasks            |
| `pnpm build`              | Build packages and the Vercel-targeted Next.js app    |
| `pnpm lint`               | Run shared ESLint and hardcoded-color policy          |
| `pnpm deps:audit`         | Reject dependency ranges, lock drift, and prereleases |
| `pnpm typecheck`          | Run strict TypeScript checks                          |
| `pnpm test:unit`          | Run deterministic unit/component tests                |
| `pnpm format:check`       | Check Prettier formatting                             |
| `pnpm spec:new -- <args>` | Scaffold and catalog a governed PRD                   |
| `pnpm spec:validate:all`  | Validate the full specification catalog               |
| `pnpm db:generate`        | Generate Drizzle migrations from schema source        |
| `pnpm db:migrate:local`   | Apply migrations to disposable local PostgreSQL       |
| `pnpm db:check`           | Check Drizzle migration consistency                   |
| `pnpm infra:validate`     | Prove retained Azure boundaries emit no resources     |

## Repository map

| Path                     | Responsibility                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `apps/web`               | Next.js routes, Supabase Auth, oRPC, probes, Vercel configuration                     |
| `packages/api-contracts` | Versioned oRPC v1/Zod contracts and safe envelopes                                    |
| `packages/db`            | Empty Drizzle schema, local migration, pooled runtime, protected migration entrypoint |
| `packages/env`           | Only runtime/browser/migration environment parser                                     |
| `packages/ui`            | Accessible primitives and executable semantic tokens                                  |
| `infra`                  | Zero-resource Azure/Foundry/Monitor/OIDC admission boundary                           |
| `.github/workflows`      | CI, integration, browser checks, IaC validation, protected migration                  |
| `specs`                  | Governed PRD catalog and design contract                                              |
| `docs`                   | ADR, architecture, security, residency, and operator runbooks                         |

## Retained Azure boundary

The application currently calls no Azure service. Foundry remains false-only and emits no resource.
Azure Monitor application export remains rejected. If a future PRD adds an Azure consumer, Vercel
must exchange an OIDC token with audience `api://AzureADTokenExchange` through an exact Entra
federated credential and narrowly scoped RBAC; an Azure client secret is prohibited.

## Before product work

Every functional change after this foundation requires a cataloged PRD in the same pull request.
Persistence changes must include reviewed schema and generated forward-only migrations. New user or
customer data remains Restricted until explicitly classified, and unknown provider regions,
replication, backups, retention, deletion, support access, identity policy, or recovery objectives
block production use.
