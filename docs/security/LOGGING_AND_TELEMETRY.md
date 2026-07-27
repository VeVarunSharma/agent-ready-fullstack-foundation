# Logging and telemetry

This is the canonical observability data boundary. The
[repository constitution](../../CONSTITUTION.md) is binding.

> The PII-safe application logger is implemented. No Vercel project/log policy, Supabase log policy,
> Log Drain, collector, Azure Monitor destination, Application Insights connection, or application
> trace exporter is configured or approved.

## Objective

Collect the minimum structured evidence required for health and reliability without making logs an
alternate identity, database, support, or customer-content store.

## Application contract

[`apps/web/src/server/observability/logger.ts`](../../apps/web/src/server/observability/logger.ts)
accepts only:

- `api.request.completed`
- `api.request.failed`
- `database.probe.completed`
- `runtime.configuration.invalid`
- `telemetry.initialized`

Allowed properties:

| Property          | Constraint                                | Purpose                           |
| ----------------- | ----------------------------------------- | --------------------------------- |
| `correlationId`   | UUID                                      | One HTTP exchange; never identity |
| `traceId`         | 32 lowercase hex                          | Correlation only                  |
| `spanId`          | 16 lowercase hex                          | Correlation only                  |
| `durationMs`      | `0..300000`                               | Bounded operation duration        |
| `statusCode`      | HTTP `100..599`                           | Outcome class                     |
| `outcome`         | `success`, `failure`, `skipped`           | Low-cardinality result            |
| `component`       | `api`, `database`, `runtime`, `telemetry` | Low-cardinality owner             |
| `databaseEnabled` | Boolean                                   | Configuration state               |
| `telemetryMode`   | `disabled`, `azure-monitor`               | Export configuration state        |

Unknown fields are stripped. Pino redaction protects prohibited field names as defense in depth;
call sites must still construct only approved records. The API does not log path, URL, headers,
body, error object, principal, or provider response.

## Prohibited everywhere

Never emit, attach, sample, or capture:

- request/response/form/oRPC bodies or validation values;
- email, name, address, IP, user agent, Supabase user ID, JWT subject, tenant/customer identifier,
  or any other personal identifier;
- access/refresh/database/OIDC tokens, token hashes, cookies, authorization headers, API keys,
  passwords, root certificates, private keys, or connection strings;
- full URLs, query strings, fragments, referrers, callback links, or magic links;
- Supabase Auth errors/user records, database rows, SQL text/parameters, schema samples, pooler
  credentials, or provider configuration dumps;
- uploads, documents, extracted text, prompts, completions, tool arguments/results, model traces,
  evaluations, or safety content;
- exception messages/stacks from external libraries or unrestricted free text;
- complete Vercel/Supabase/GitHub/Azure identifiers or raw provider/API responses.

This applies to application logs, Vercel request/function/build logs, Supabase Auth/Postgres logs,
GitHub Actions, browser artifacts, CSP reports, crash dumps, support bundles, and future Foundry
observability.

## Supabase Auth

The sign-in form sends email/password directly from the browser to Supabase and records no
application event. It displays only fixed credential-rejection or availability text; raw provider
status/body/message, user records, and credentials never reach application logs. If an operational
Auth event is later required, its PRD must define a nonidentifying fixed event and prove that
provider/user detail cannot enter it.

Vercel and Supabase browser/network/platform logs still require review for request metadata, Auth
error detail, access, and retention. Password/recovery/invitation links remain prohibited from logs
if future flows are added.

## Database and migration

Readiness emits only bounded success/failure metadata. It never logs host, database, role, password,
certificate, SQL, pool errors, or rows.

The production migration bundle prints exactly one generic success or failure line. GitHub Actions
must not enable shell tracing or print environment variables. Migration credentials remain masked
protected secrets and no provider error is uploaded as an artifact.

## Vercel platform logging

Vercel may create edge/request/function/build/deployment logs independently of the application
logger. Before production, approve and verify:

- exact request/function/build fields, especially callback URL/query handling;
- region, retention, deletion, access roles, support access, exports, and incident use;
- preview versus production separation and fork protection;
- sampling/cardinality/cost limits;
- log drains, if any, with an independent allowlist and fail-closed destination.

No Log Drain exists in this foundation. Raw platform logs must not be copied into Azure Monitor or a
third party by default.

## Application trace export

Production requires `TELEMETRY_MODE=disabled`. `azure-monitor` is reserved and always rejected
because there is no approved Vercel Log Drain/collector, schema, region, identity, retention, or
loader path. There is no Application Insights connection string, OTLP endpoint, exporter package,
DCE, DCR, or collector.

A future exporter must use a stable dependency, initialize outside framework build/import side
effects, independently allowlist every field, and document network, region, access, retention,
deletion, support, cost, and failure behavior. Export failure must not reveal data or silently
switch destinations.

## CSP reports

CSP remains report-only with no collector. Before collection:

- accept a bounded schema and content type;
- rate-limit abuse and authenticate administrative access;
- discard full document/blocked URL, referrer, query, fragment, source sample, and script sample;
- keep only approved low-cardinality directive/disposition/origin-category fields;
- define regional destination, access, retention, deletion, and support.

Raw browser reports must never be forwarded directly to logs or a third party.

## Retention and access

No production default is claimed. The production owner must record each
application/platform/provider log source, field schema, classification, region, retention/deletion,
reader role, support path, export, cost limit, and incident exception. Access is audited and
reviewed. Ad hoc downloads and unrestricted exports are prohibited.

## CI and local behavior

- Local logs contain synthetic metadata only.
- Tests assert prohibited properties are stripped and provider detail is not surfaced.
- CI must not print environments, cookies, tokens, database credentials/certificates, callback URLs,
  production configuration, or raw Vercel/Supabase responses.
- Browser traces/screenshots are retained only on synthetic failure under the configured policy.
- Foundry tests remain deterministic and make no external model call.
