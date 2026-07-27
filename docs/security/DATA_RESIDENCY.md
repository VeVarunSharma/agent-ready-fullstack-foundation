# Data residency

This is the location and processor source of truth for the current foundation. Read it with
[data classification](DATA_CLASSIFICATION.md), the [threat model](THREAT_MODEL.md), and
[architecture](../../ARCHITECTURE.md).

> **No residency claim is complete.** No cloud environment is evidenced. Vercel, Supabase, GitHub,
> DNS, email, support, logs, backups, identity, and control planes require separate contractual and
> technical approval. Selecting nearby function/database regions is not an all-data residency proof.

Unclassified customer data is Restricted. Unknown processing, storage, replication, backup,
telemetry, support, or control-plane location blocks production use.

## Implemented repository and local surfaces

| Surface                    | Data and route                                               | Location/copies                                        | Required decision                                              |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| Browser                    | Neutral UI, optional Supabase Auth cookies, local `ui-theme` | User device; browser/profile sync may be multiregional | Device/sync policy; cookie/session classification and deletion |
| Developer workstation      | Source, dependencies, builds, synthetic env/test data        | Endpoint geography, caches, backups                    | Approved endpoint controls; no production data/credentials     |
| Local PostgreSQL           | Empty schema, Drizzle metadata, synthetic integration data   | Developer/CI host and named Docker volume              | Synthetic-only use and teardown                                |
| Next.js local/test process | Pages, probes, oRPC health, safe logs                        | Developer/CI process and logs                          | No customer data; bounded artifacts                            |
| Git/GitHub                 | Source, reviews, checks, security metadata                   | GitHub contracted/control-plane geography              | Terms, access, retention, support; no secrets/customer payload |
| npm/pnpm/OCI dependencies  | Package metadata and caches                                  | External registries/CDNs and local stores              | Integrity, mirrors, retention, support                         |

## Vercel surfaces

No Vercel project is currently configured.

| Surface                  | Intended data                                                                                          | Regionality/copies                                                                    | Required approval                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Edge/CDN/TLS             | Hosts, paths, headers, cookies, response content, network metadata                                     | Global/provider-managed edge; exact processing locations depend on plan/settings      | Edge geography, logs, DDoS/WAF/protection, TLS/DNS, support, retention                       |
| Next.js Functions        | Request metadata, Auth cookies/claims, ephemeral runtime, DB credential in memory, safe stdout         | Selected Vercel function region(s); scheduler/control/build/support planes may differ | Exact regions, failover, fluid compute, memory lifecycle, support, incident access           |
| Build/preview            | Source, public Supabase config, build logs/artifacts                                                   | Vercel build regions and caches; preview URLs/global edge                             | Environment isolation, secret scoping, fork protection, artifact/log retention               |
| Platform logs            | Request/function/build/deployment metadata; may include full callback URLs unless configured otherwise | Vercel log infrastructure and drains per plan                                         | Field schema/redaction, token-hash URL treatment, access, region, retention, deletion/export |
| Deployment control plane | Git metadata, project settings, domains, checks, rollbacks                                             | Provider-managed/nonregional                                                          | Account security, RBAC, history, support, retention, deletion                                |

Preview deployments must use a separate nonproduction Supabase project or stay
Auth/database-disabled. They must never receive production runtime or migration credentials.

## Supabase surfaces

No Supabase project is currently configured.

| Surface                                  | Intended data                                                                              | Regionality/copies                                                                   | Required approval                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Auth                                     | Email, password verifier, user record, JWTs, refresh/access tokens, cookies, provider logs | Selected project region plus Auth/control/recovery/support dependencies              | Region, public-signup denial, password/recovery/MFA, signing keys, session/log retention, deletion/export, support |
| Transaction pooler                       | Runtime SQL/TLS metadata, dedicated role credential                                        | Shared/dedicated pooler may be separate from database host; endpoint/provider region | Pooler location, encryption, logs, limits, support, failure behavior                                               |
| Postgres                                 | Future application rows, schema, migration metadata                                        | Selected project database region                                                     | Fields, grants/RLS, encryption, retention, deletion, maintenance, availability                                     |
| Direct/session endpoint                  | Migration SQL, schema metadata, dedicated role credential                                  | Database or shared pooler region; GitHub runner crosses public network               | Network/IP policy, TLS certificate, audit, runner origin, credential handling                                      |
| Backups/PITR                             | Database copies and WAL                                                                    | Provider-selected backup/replica locations according to plan/region                  | Exact copies/geography, retention, restore, deletion, legal hold, RPO/RTO                                          |
| Dashboard/control/support                | Project config, identities, logs, billing/support records                                  | Supabase control/support planes may be nonregional                                   | Organization access/MFA, support location/access, logs, retention, subprocessors                                   |
| Notification/recovery email — **future** | Invitation/recovery content and recipient address                                          | Selected SMTP/Supabase provider paths if admitted                                    | Provider, regions, content, bounce/log retention, support, abuse                                                   |

Supabase Storage, Realtime, Edge Functions, product Data API tables, and analytics exports are
absent. Adding one requires a new matrix row and PRD.

## GitHub migration surface

The workflow definition is implemented; its protected environment is external.

| Data                                     | Intended location/use                                     | Required approval                                               |
| ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| Source and migration bundle              | GitHub runner workspace; one run                          | Runner geography, cleanup, action trust, artifact policy        |
| Migration host/database/user identifiers | Protected secrets and process environment                 | Confidential identifier custody, access review, rotation        |
| Migration password/root certificate      | Protected secrets and process memory only                 | Restricted secret custody, reviewer policy, masking, revocation |
| Migration result                         | Bounded job status; bundle prints generic success/failure | Logs/retention/access; no SQL/provider error or row data        |

The job must be required as a Vercel Deployment Check. GitHub and Vercel control-plane metadata are
nonregional unless a contracted offering proves otherwise.

## Monitoring

The application emits PII-safe JSON stdout only. No application trace exporter, Azure Monitor
connection string, Vercel Log Drain, collector, CSP report endpoint, or external dashboard exists.
Vercel may still create platform/request/build logs; those are external and require field/region/
retention review before production.

`TELEMETRY_MODE=azure-monitor` is reserved and always rejected. Future export must record every
collector, transport, region, schema, identity, retention, support, and failure path.

## Azure and Foundry

The Bicep templates emit zero Azure resources. There is no Azure processing, storage, logging,
networking, DNS, RBAC, token exchange, model, or agent data flow.

Future Vercel-to-Azure access would cross Vercel and Entra nonregional control planes before
reaching the selected Azure data plane. OIDC federation removes a stored Azure client secret but
does not establish residency. A future PRD must add the selected service and all locations/copies.

## Production approval record

Before production, record owner, evidence, approval date, and review/expiry for:

1. permitted jurisdiction and exact Vercel function, Supabase project/database/pooler, GitHub
   runner, SMTP, DNS, log, backup, support, and control-plane locations;
2. every classified field, processor, store, cache, log, backup, export, derived value, and deletion
   path;
3. Vercel/Supabase/GitHub/email/DNS terms, subprocessors, support access, incident handling, and
   government/legal request policy;
4. primary/replica/backup/WAL/session/log/build/preview retention and verified deletion;
5. RPO/RTO, restore drill, regional outage/failover choice, and rollback/schema compatibility;
6. access reviews for Vercel, Supabase, GitHub, SMTP, DNS, and any future Azure tenant;
7. evidence that no production credential or customer payload enters source, preview, CI logs,
   browser-visible settings, or support artifacts.

No production use is admitted while any row remains unknown.
