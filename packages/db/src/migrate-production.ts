import { fileURLToPath, pathToFileURL } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PoolClient } from "pg";
import {
  getMigrationDatabaseConfiguration,
  parseMigrationEnvironment,
  type SupabaseMigrationDatabaseConfiguration,
} from "@repo/env/tooling";

import { createSupabaseMigrationPool } from "./internal/pool";

const PRODUCTION_MIGRATION_ADVISORY_LOCK = [0x4654434d, 0x4d494752] as const;

export class ProductionMigrationConfigurationError extends Error {
  constructor() {
    super("Production migrations require the protected Supabase session contract.");
    this.name = "ProductionMigrationConfigurationError";
  }
}

export class ProductionMigrationLockUnavailableError extends Error {
  constructor() {
    super("Another production migration holds the PostgreSQL advisory lock.");
    this.name = "ProductionMigrationLockUnavailableError";
  }
}

export interface ProductionMigrationLockClient {
  query(
    queryText: string,
    values: number[],
  ): Promise<{ readonly rows: readonly { readonly acquired?: boolean }[] }>;
}

export async function withProductionMigrationLock(
  client: ProductionMigrationLockClient,
  migration: () => Promise<void>,
): Promise<void> {
  const lock = await client.query(
    "SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired",
    [...PRODUCTION_MIGRATION_ADVISORY_LOCK],
  );

  if (lock.rows[0]?.acquired !== true) {
    throw new ProductionMigrationLockUnavailableError();
  }

  try {
    await migration();
  } finally {
    await client.query("SELECT pg_advisory_unlock($1::integer, $2::integer)", [
      ...PRODUCTION_MIGRATION_ADVISORY_LOCK,
    ]);
  }
}

export function loadProductionMigrationConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseMigrationDatabaseConfiguration {
  try {
    return getMigrationDatabaseConfiguration(parseMigrationEnvironment(environment));
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new ProductionMigrationConfigurationError();
    }
    throw error;
  }
}

export async function runProductionMigrations(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const pool = createSupabaseMigrationPool(loadProductionMigrationConfiguration(environment));
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    const database = drizzle({ client });
    const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
    await withProductionMigrationLock(client, () => migrate(database, { migrationsFolder }));
  } finally {
    try {
      client?.release();
    } finally {
      await pool.end();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runProductionMigrations();
    console.log("Production Supabase migrations are current.");
  } catch {
    console.error("Production Supabase migration failed.");
    process.exitCode = 1;
  }
}
