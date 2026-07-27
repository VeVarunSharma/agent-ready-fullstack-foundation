import type {
  AzureManagedIdentityDatabaseConfiguration,
  DatabaseConfiguration,
  LocalAzureCredentialDatabaseConfiguration,
} from "@repo/env/server";
import { Pool, type PoolConfig } from "pg";

import {
  createAzureTokenProvider,
  type AzureDatabaseConfiguration,
  type DatabasePasswordProvider,
} from "./token-provider";

type EnabledDatabaseConfiguration = Exclude<DatabaseConfiguration, { readonly mode: "disabled" }>;

export type TokenProviderFactory = (
  configuration:
    AzureManagedIdentityDatabaseConfiguration | LocalAzureCredentialDatabaseConfiguration,
) => DatabasePasswordProvider;

export interface PoolConfigurationDependencies {
  readonly tokenProviderFactory?: TokenProviderFactory;
}

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
    statement_timeout: configuration.probeTimeoutMs,
    keepAlive: true,
    allowExitOnIdle: true,
    application_name: "application-runtime",
  };
}

function azurePoolConfiguration(
  configuration: AzureDatabaseConfiguration,
  dependencies: PoolConfigurationDependencies,
): PoolConfig {
  const tokenProvider =
    dependencies.tokenProviderFactory?.(configuration) ?? createAzureTokenProvider(configuration);

  return {
    ...commonPoolConfiguration(configuration),
    password: () => tokenProvider.getPassword(),
    ssl: {
      rejectUnauthorized: true,
    },
  };
}

export function createPgPoolConfiguration(
  configuration: DatabaseConfiguration,
  dependencies: PoolConfigurationDependencies = {},
): PoolConfig {
  switch (configuration.mode) {
    case "disabled":
      throw new DatabaseDisabledError();
    case "local-password":
      return {
        ...commonPoolConfiguration(configuration),
        password: configuration.password,
        ssl: false,
      };
    case "azure-managed-identity":
    case "local-azure-credential":
      return azurePoolConfiguration(configuration, dependencies);
  }
}

export function createDatabasePoolFactory<TPool>(
  poolFactory: (configuration: PoolConfig) => TPool,
  dependencies: PoolConfigurationDependencies = {},
) {
  return (configuration: DatabaseConfiguration): TPool =>
    poolFactory(createPgPoolConfiguration(configuration, dependencies));
}

export const createDatabasePool = createDatabasePoolFactory(
  (configuration) => new Pool(configuration),
);
