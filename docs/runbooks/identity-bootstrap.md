# Identity bootstrap

This runbook configures the external Supabase Auth boundary used by the Vercel application and
records the future Vercel-to-Azure OIDC rule. It does not authorize a live project.

> No Supabase project, user, password policy, recovery process, email provider, Vercel domain, or
> Azure federated identity is configured.

## Responsibility split

| Layer                | Responsibility                                                                       |
| -------------------- | ------------------------------------------------------------------------------------ |
| Vercel               | HTTPS/domain, request routing, environment isolation, deployment protection          |
| Supabase Auth        | User/password/session lifecycle, token issuance/signing/refresh/revoke, Auth logs    |
| Sign-in UI           | Direct credential submission to Supabase and fixed nonenumerating application errors |
| Next.js Proxy        | Request-scoped cookie refresh and verified `getClaims()` authentication              |
| Application handlers | Product authorization, record/tenant scope, deny-by-default decisions                |
| Future Entra/Azure   | Exchange Vercel OIDC assertion for an approved Azure resource token                  |

Authentication does not grant product permission. No product authorization exists.

## Supabase Auth prerequisites

- Separate nonproduction and production Supabase projects and approved regions
- Exact Vercel preview/production origins and custom-domain ownership
- Supabase organization access, MFA, administrator roles, audit/support policy
- Asymmetric JWT signing keys and rotation/revocation policy
- Public signup disabled and an approved account provisioning/deprovisioning process
- Password strength, breach protection, reset/recovery, lockout/rate limit, CAPTCHA, and MFA
  decisions
- Custom SMTP/notification path if invitations or recovery email are used
- Session lifetime, refresh reuse/revocation, cookie behavior, incident response
- Classification/residency/retention/deletion approval for email/user/session records

## Project URL and keys

Configure only:

- `NEXT_PUBLIC_SUPABASE_URL` — exact project HTTPS origin
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — modern `sb_publishable_...` key
- `APPLICATION_ORIGIN` — exact Vercel production HTTPS origin
- `NEXT_PUBLIC_RUNTIME_MODE=production`

The publishable key is browser-visible by design and relies on Auth controls plus future database
authorization/RLS. It is not a secret. Legacy service-role, modern `sb_secret_`, JWT-signing,
management, and database keys are prohibited from browser/application Auth configuration.

## Sign-in contract

`/auth/login` renders one email/password form:

1. The browser validates bounded input and calls `signInWithPassword` directly against the
   configured Supabase project.
2. The application displays one fixed rejection for every credential failure and a separate fixed
   availability message only for rate/provider/server failure.
3. Raw provider messages, user records, email, and password are never sent to the application server
   or logger.
4. On success, the browser returns to the server-validated relative `next` path and refreshes the
   application.

Production acceptance must prove Supabase itself uses indistinguishable HTTP status/body and
operationally acceptable timing for an unknown email and a known email with a wrong password. UI
masking alone is not sufficient. If the provider configuration cannot meet that condition, stop and
select a provider-level nonenumerating flow in a new PRD.

Public/self-service signup stays disabled. The repository has no signup, password reset, recovery,
email-change, MFA enrollment, or account-management route. Those flows must be admitted and tested
before a real audience depends on them; until then, provisioning/recovery is an external production
blocker.

## Runtime session contract

- `src/proxy.ts` excludes only Next.js framework assets/favicon; exact login/health paths return
  before creating a Supabase client.
- Protected requests create one server client per request and call `getClaims()`.
- `getSession()` may retrieve tokens when explicitly needed but is never identity/authorization
  proof.
- Supabase cookies use `SameSite=Lax`, path `/`, and `Secure` in production.
- Refreshed request/response cookies and cache-prevention headers remain synchronized.
- Missing/invalid claims redirect pages to `/auth/login`; protected APIs receive an empty `401`.
- `/auth/login`, `/health/*`, and `/api/v1/health` are the only current public protocol surfaces.
- A requested return path must start with one `/`, contain no backslash/control character, and never
  become another origin.
- Cookie/token/provider/password/email detail never enters application logs.

Review Supabase cookie names, HttpOnly exposure constraints, refresh-token reuse protection,
sign-out scope, session revocation, and Vercel caching in the configured environment.

## User lifecycle

Before production, define and test:

- who may create/invite, approve, suspend, delete, and recover an account;
- how initial passwords are delivered without support/operator disclosure;
- password strength/breach/rotation/reset policy and MFA requirement;
- duplicate/alias/domain and email-change policy;
- session revocation on removal/incident;
- Auth user/log/notification deletion and retention;
- support identity verification and anti-social-engineering controls;
- audit evidence without email/token/password disclosure.

No application `users` table or profile exists. A future product user model requires its own PRD,
classification, schema/migration, reconciliation key, authorization, deletion, and audit design.

## Verification

In an authorized nonproduction environment:

1. Confirm exact project URL, publishable key type, application origin, public-signup disabled, and
   asymmetric signing keys.
2. Prove an approved account can sign in and an unapproved account cannot be created.
3. Compare unknown-user and wrong-password provider status/body/timing for enumeration resistance.
4. Prove malformed input and unsafe return paths do not contact Supabase or leave the application
   origin.
5. Prove unauthenticated root redirects, protected API returns `401`, health remains independent,
   and a verified session reaches the neutral shell.
6. Inspect production cookies for Secure/SameSite/path and verify refresh/revoke/expiry/sign-out.
7. Exercise rate-limit/lockout/provider outage without raw provider detail or local bypass.
8. Inspect approved Vercel/Supabase logs for absence of password/cookie/token and application logs
   for absence of email.
9. Record booleans/timestamps/config references only; never copy credentials, JWTs, cookies, email,
   user records, keys, or raw provider responses.

## Future Vercel-to-Azure identity

No Azure consumer exists. A future PRD may use Vercel OIDC federation only:

1. Create a distinct user-assigned managed identity/app registration for each required environment
   or duty.
2. Trust Vercel issuer `https://oidc.vercel.com/<team>` (or explicitly approved global mode).
3. Match the exact subject
   `owner:<team>:project:<project>:environment:<preview|production|development>`.
4. Use audience `api://AzureADTokenExchange`.
5. Grant only the selected Azure service/data action at the narrowest scope.
6. Use `@vercel/oidc` plus Azure `ClientAssertionCredential` in server-only request code.
7. Verify wrong team/project/environment/audience/subject and preview-to-production access fail.

Azure client secrets, wildcard subjects, shared environment identities, broad Owner/Contributor, and
dormant credentials are prohibited. This future setup does not by itself authorize Foundry.
