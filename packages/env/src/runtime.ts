import {
  clientEnvironmentSchema,
  migrationEnvironmentSchema,
  serverEnvironmentSchema,
  type ClientEnvironment,
  type MigrationEnvironment,
  type ServerEnvironment,
} from "./schemas";

export {
  AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
  authenticationModeSchema,
  clientEnvironmentSchema,
  databaseModeSchema,
  hostModeSchema,
  loggingModeSchema,
  migrationEnvironmentSchema,
  runtimeModeSchema,
  serverEnvironmentSchema,
  telemetryModeSchema,
  vercelEnvironmentSchema,
  type AuthenticationMode,
  type ClientEnvironment,
  type DatabaseMode,
  type HostMode,
  type LoggingMode,
  type MigrationEnvironment,
  type RuntimeMode,
  type ServerEnvironment,
  type TelemetryMode,
  type VercelEnvironment,
} from "./schemas";

interface CommonDatabaseConfiguration {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly poolMax: number;
  readonly probeTimeoutMs: number;
}

export interface DisabledDatabaseConfiguration {
  readonly mode: "disabled";
}

export interface LocalPasswordDatabaseConfiguration extends CommonDatabaseConfiguration {
  readonly mode: "local-password";
  readonly password: string;
}

export interface SupabasePoolerDatabaseConfiguration extends CommonDatabaseConfiguration {
  readonly mode: "supabase-pooler";
  readonly password: string;
  readonly rootCertificate: string;
}

export interface SupabaseMigrationDatabaseConfiguration {
  readonly mode: "supabase-session";
  readonly host: string;
  readonly port: 5432;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly rootCertificate: string;
}

export type DatabaseConfiguration =
  | DisabledDatabaseConfiguration
  | LocalPasswordDatabaseConfiguration
  | SupabasePoolerDatabaseConfiguration;

export interface DisabledAuthenticationConfiguration {
  readonly mode: "disabled";
}

export interface SupabaseAuthenticationConfiguration {
  readonly mode: "supabase";
  readonly applicationOrigin: string;
  readonly url: string;
  readonly publishableKey: string;
}

export type AuthenticationConfiguration =
  DisabledAuthenticationConfiguration | SupabaseAuthenticationConfiguration;

export interface SupabasePublicConfiguration {
  readonly url: string;
  readonly publishableKey: string;
}

export interface DisabledTelemetryConfiguration {
  readonly mode: "disabled";
}

export interface AzureMonitorTelemetryConfiguration {
  readonly mode: "azure-monitor";
  readonly connectionString: string;
}

export type TelemetryConfiguration =
  DisabledTelemetryConfiguration | AzureMonitorTelemetryConfiguration;

export class EnvironmentConfigurationError extends Error {
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super("Runtime configuration is invalid.");
    this.name = "EnvironmentConfigurationError";
    this.fields = fields;
  }
}

function requiredValue(value: string | undefined, fieldName: string): string {
  if (value === undefined) {
    throw new EnvironmentConfigurationError([fieldName]);
  }
  return value;
}

function databaseConnectionFields(environment: ServerEnvironment) {
  return {
    host: requiredValue(environment.DATABASE_HOST, "DATABASE_HOST"),
    port: environment.DATABASE_PORT,
    database: requiredValue(environment.DATABASE_NAME, "DATABASE_NAME"),
    user: requiredValue(environment.DATABASE_USER, "DATABASE_USER"),
    poolMax: environment.DATABASE_POOL_MAX,
    probeTimeoutMs: environment.DATABASE_PROBE_TIMEOUT_MS,
  };
}

export function getDatabaseConfiguration(environment: ServerEnvironment): DatabaseConfiguration {
  switch (environment.DATABASE_MODE) {
    case "disabled":
      return { mode: "disabled" };
    case "local-password":
      return {
        mode: "local-password",
        ...databaseConnectionFields(environment),
        password: requiredValue(environment.DATABASE_PASSWORD, "DATABASE_PASSWORD"),
      };
    case "supabase-pooler":
      return {
        mode: "supabase-pooler",
        ...databaseConnectionFields(environment),
        password: requiredValue(
          environment.SUPABASE_DATABASE_PASSWORD,
          "SUPABASE_DATABASE_PASSWORD",
        ),
        rootCertificate: requiredValue(
          environment.SUPABASE_DATABASE_ROOT_CERT,
          "SUPABASE_DATABASE_ROOT_CERT",
        ),
      };
  }
}

export function getAuthenticationConfiguration(
  environment: ServerEnvironment,
): AuthenticationConfiguration {
  switch (environment.AUTH_MODE) {
    case "disabled":
      return { mode: "disabled" };
    case "supabase":
      return {
        mode: "supabase",
        applicationOrigin: requiredValue(environment.APPLICATION_ORIGIN, "APPLICATION_ORIGIN"),
        url: requiredValue(environment.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
        publishableKey: requiredValue(
          environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        ),
      };
  }
}

export function getSupabasePublicConfiguration(
  environment: Pick<
    ClientEnvironment | ServerEnvironment,
    "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  >,
): SupabasePublicConfiguration | undefined {
  if (
    environment.NEXT_PUBLIC_SUPABASE_URL === undefined ||
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === undefined
  ) {
    return undefined;
  }

  return {
    url: environment.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function requireSupabasePublicConfiguration(
  environment: Pick<
    ClientEnvironment | ServerEnvironment,
    "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  >,
): SupabasePublicConfiguration {
  const configuration = getSupabasePublicConfiguration(environment);
  if (configuration === undefined) {
    throw new EnvironmentConfigurationError([
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
  }
  return configuration;
}

export function getMigrationDatabaseConfiguration(
  environment: MigrationEnvironment,
): SupabaseMigrationDatabaseConfiguration {
  return {
    mode: "supabase-session",
    host: requiredValue(environment.SUPABASE_MIGRATION_HOST, "SUPABASE_MIGRATION_HOST"),
    port: 5432,
    database: requiredValue(environment.SUPABASE_MIGRATION_DATABASE, "SUPABASE_MIGRATION_DATABASE"),
    user: requiredValue(environment.SUPABASE_MIGRATION_USER, "SUPABASE_MIGRATION_USER"),
    password: requiredValue(environment.SUPABASE_MIGRATION_PASSWORD, "SUPABASE_MIGRATION_PASSWORD"),
    rootCertificate: requiredValue(
      environment.SUPABASE_MIGRATION_ROOT_CERT,
      "SUPABASE_MIGRATION_ROOT_CERT",
    ),
  };
}

export function getTelemetryConfiguration(environment: ServerEnvironment): TelemetryConfiguration {
  switch (environment.TELEMETRY_MODE) {
    case "disabled":
      return { mode: "disabled" };
    case "azure-monitor":
      return {
        mode: "azure-monitor",
        connectionString: requiredValue(
          environment.APPLICATIONINSIGHTS_CONNECTION_STRING,
          "APPLICATIONINSIGHTS_CONNECTION_STRING",
        ),
      };
  }
}

function fieldsFromIssues(
  issues: readonly { readonly path: readonly PropertyKey[] }[],
): readonly string[] {
  return [
    ...new Set(
      issues.flatMap((issue) => {
        const field = issue.path[0];
        return typeof field === "string" ? [field] : [];
      }),
    ),
  ].sort();
}

export function parseServerEnvironment(input: unknown): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(input);
  if (!result.success) {
    throw new EnvironmentConfigurationError(fieldsFromIssues(result.error.issues));
  }
  return result.data;
}

export function parseMigrationEnvironment(input: unknown): MigrationEnvironment {
  const result = migrationEnvironmentSchema.safeParse(input);
  if (!result.success) {
    throw new EnvironmentConfigurationError(fieldsFromIssues(result.error.issues));
  }
  return result.data;
}

export function readServerEnvironment() {
  return serverEnvironmentSchema.safeParse(process.env);
}

export function loadServerEnvironment(): ServerEnvironment {
  return parseServerEnvironment(process.env);
}

export function loadMigrationEnvironment(): MigrationEnvironment {
  return parseMigrationEnvironment(process.env);
}

export function parseClientEnvironment(input: unknown): ClientEnvironment {
  return clientEnvironmentSchema.parse(input);
}

export function createLocalDatabaseUrl(configuration: LocalPasswordDatabaseConfiguration): string {
  const username = encodeURIComponent(configuration.user);
  const password = encodeURIComponent(configuration.password);
  const database = encodeURIComponent(configuration.database);
  return `postgresql://${username}:${password}@${configuration.host}:${String(configuration.port)}/${database}`;
}
