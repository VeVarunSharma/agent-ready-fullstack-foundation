targetScope = 'subscription'

@description('This boundary is intentionally false-only until a governed Foundry consumer and complete data-plane design exist.')
@allowed([
  false
])
param enableFoundry bool = false

output posture string = enableFoundry
  ? 'Blocked: this false-only parameter prevents deployment.'
  : 'Nondeployable Foundry boundary: no account, project, model, agent, store, network, DNS, or RBAC resource is declared.'
