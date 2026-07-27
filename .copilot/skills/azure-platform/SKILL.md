---
name: azure-platform
description:
  "Maintain the zero-resource Azure admission boundary and fail-closed provider preflight."
---

# Azure platform

## Use when

- Changing `azure.yaml`, false-only Bicep boundaries, future Vercel OIDC admission, or preflight.
- Reviewing whether infrastructure matches approved architecture and residency constraints.

## Do not use when

- Making portal-only changes, guessing production inputs, or performing a cloud operation without
  separate explicit authorization.
- Adding a resource with no immediate approved consumer.

## Mandatory sources

- `CONSTITUTION.md`
- The relevant cataloged PRD and `ARCHITECTURE.md`
- Relevant records under `docs/adr/`
- `docs/security/DATA_RESIDENCY.md` and `docs/security/THREAT_MODEL.md`
- `docs/runbooks/deployment.md`
- `azure.yaml`, affected `infra/` modules, parameters, fixtures, and preflight tests

## Steps

1. Confirm declared architecture/sensitive-data impacts and approved topology inputs.
2. Recheck current official schemas; use stable GA APIs and pinned modules only.
3. Keep the current template resource-free: Foundry, Azure Monitor export, and Azure runtime access
   remain false-only until a consuming PRD exists.
4. A future Vercel consumer must use exact-subject OIDC federation and least-privilege RBAC; do not
   add a client secret or speculative Azure resource.
5. Keep synthetic compile fixtures nondeployable and production provider records incomplete.
6. Update architecture, threat, residency, and runbook records to match actual IaC status.
7. Format, compile, lint, and exercise allow/deny preflight cases entirely offline.

## Validation

```sh
pnpm infra:validate
pnpm format:check
pnpm test:unit
```

Cloud preflight, what-if, and deployment are separate authorized operations, not validation steps.

## Common failure modes

- Preview or floating resources, hidden defaults, or copied samples with stale APIs.
- Any Azure resource without an immediate approved consumer, broad ownership, wildcard federation,
  static Azure credentials, or false claim of a private Vercel path.
- Compile fixtures that contain deployable production-shaped values.
- Treating compilation, a disabled module, or an unverified region as deployment readiness.
