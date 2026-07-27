import "server-only";

export {
  AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
  EnvironmentConfigurationError,
  getAuthenticationConfiguration,
  getDatabaseConfiguration,
  getSupabasePublicConfiguration,
  getTelemetryConfiguration,
  loadServerEnvironment,
  parseServerEnvironment,
  readServerEnvironment,
  requireSupabasePublicConfiguration,
} from "./runtime";

export type {
  AuthenticationConfiguration,
  AuthenticationMode,
  AzureMonitorTelemetryConfiguration,
  DatabaseConfiguration,
  DatabaseMode,
  DisabledAuthenticationConfiguration,
  DisabledDatabaseConfiguration,
  DisabledTelemetryConfiguration,
  HostMode,
  LocalPasswordDatabaseConfiguration,
  LoggingMode,
  RuntimeMode,
  ServerEnvironment,
  SupabaseAuthenticationConfiguration,
  SupabasePoolerDatabaseConfiguration,
  SupabasePublicConfiguration,
  TelemetryConfiguration,
  TelemetryMode,
  VercelEnvironment,
} from "./runtime";
