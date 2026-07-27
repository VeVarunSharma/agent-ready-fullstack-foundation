import type { DatabaseConfiguration } from "@repo/env/server";
import type { SupabaseMigrationDatabaseConfiguration } from "@repo/env/tooling";
import { Pool, type PoolConfig } from "pg";

type EnabledDatabaseConfiguration = Exclude<DatabaseConfiguration, { readonly mode: "disabled" }>;

export class DatabaseDisabledError extends Error {
  constructor() {
    super("The database is explicitly disabled.");
    this.name = "DatabaseDisabledError";
  }
}

function commonPoolConfiguration(configuration: EnabledDatabaseConfiguration): PoolConfig {
  return {
    host: configuration.host,
    port: configuration.port,
    database: configuration.database,
    user: configuration.user,
    max: configuration.poolMax,
    connectionTimeoutMillis: configuration.probeTimeoutMs,
    query_timeout: configuration.probeTimeoutMs,
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    allowExitOnIdle: true,
    application_name: "vercel-application-runtime",
  };
}

export function createPgPoolConfiguration(configuration: DatabaseConfiguration): PoolConfig {
  switch (configuration.mode) {
    case "disabled":
      throw new DatabaseDisabledError();
    case "local-password":
      return {
        ...commonPoolConfiguration(configuration),
        password: configuration.password,
        statement_timeout: configuration.probeTimeoutMs,
        ssl: false,
      };
    case "supabase-pooler":
      return {
        ...commonPoolConfiguration(configuration),
        password: configuration.password,
        ssl: {
          ca: configuration.rootCertificate,
          rejectUnauthorized: true,
        },
      };
  }
}

export function createSupabaseMigrationPoolConfiguration(
  configuration: SupabaseMigrationDatabaseConfiguration,
): PoolConfig {
  return {
    host: configuration.host,
    port: configuration.port,
    database: configuration.database,
    user: configuration.user,
    password: configuration.password,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    allowExitOnIdle: true,
    application_name: "supabase-schema-migration",
    ssl: {
      ca: configuration.rootCertificate,
      rejectUnauthorized: true,
    },
  };
}

export function createDatabasePoolFactory<TPool>(
  poolFactory: (configuration: PoolConfig) => TPool,
) {
  return (configuration: DatabaseConfiguration): TPool =>
    poolFactory(createPgPoolConfiguration(configuration));
}

export function createMigrationPoolFactory<TPool>(
  poolFactory: (configuration: PoolConfig) => TPool,
) {
  return (configuration: SupabaseMigrationDatabaseConfiguration): TPool =>
    poolFactory(createSupabaseMigrationPoolConfiguration(configuration));
}

export const createDatabasePool = createDatabasePoolFactory(
  (configuration) => new Pool(configuration),
);

export const createSupabaseMigrationPool = createMigrationPoolFactory(
  (configuration) => new Pool(configuration),
);
