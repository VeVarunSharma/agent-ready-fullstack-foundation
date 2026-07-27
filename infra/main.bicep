targetScope = 'subscription'

@description('Provider-boundary configuration. This template deliberately emits no Azure resources.')
param config object

@description('Foundry remains false-only until a governed consumer, data flow, region, and least-privilege design are approved.')
@allowed([
  false
])
param enableFoundry bool = false

output applicationHost string = config.application.host
output authenticationProvider string = config.application.authentication
output databaseProvider string = config.application.database
output foundryStatus string = enableFoundry
  ? 'Blocked: the false-only parameter prevents Foundry deployment.'
  : 'Foundry is not deployed; no account, project, model, agent, data plane, DNS, or RBAC is declared.'
output azureMonitorStatus string = 'Application export is disabled; no Azure Monitor resource, connection string, collector, or Vercel Log Drain is declared.'
output azureRuntimeAccessStatus string = 'No Azure runtime consumer is admitted; future Vercel access requires exact-subject OIDC federation and least-privilege RBAC.'
