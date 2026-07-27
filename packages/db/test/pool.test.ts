import { describe, expect, it, vi } from "vitest";
import type { PoolConfig } from "pg";

import {
  DatabaseDisabledError,
  createDatabasePoolFactory,
  createMigrationPoolFactory,
  createPgPoolConfiguration,
  createSupabaseMigrationPoolConfiguration,
} from "../src/internal/pool";

const rootCertificate =
  "-----BEGIN CERTIFICATE-----\n" + "A".repeat(96) + "\n-----END CERTIFICATE-----";

describe("PostgreSQL pool configuration", () => {
  it("uses a static password only for explicit local mode without TLS", () => {
    const configuration = createPgPoolConfiguration({
      mode: "local-password",
      host: "127.0.0.1",
      port: 5432,
      database: "app",
      user: "local",
      password: "local-only-password",
      poolMax: 4,
      probeTimeoutMs: 1_000,
    });

    expect(configuration).toMatchObject({
      password: "local-only-password",
      ssl: false,
      max: 4,
    });
  });

  it("uses verified TLS and a bounded pool for Supabase transaction mode", () => {
    const configuration = createPgPoolConfiguration({
      mode: "supabase-pooler",
      host: "aws-0-region.pooler.supabase.com",
      port: 6543,
      database: "postgres",
      user: "application.projectref",
      password: "runtime-password",
      rootCertificate,
      poolMax: 2,
      probeTimeoutMs: 2_000,
    });

    expect(configuration).toMatchObject({
      port: 6543,
      max: 2,
      password: "runtime-password",
      application_name: "vercel-application-runtime",
      ssl: {
        ca: rootCertificate,
        rejectUnauthorized: true,
      },
    });
    expect(configuration).not.toHaveProperty("statement_timeout");
  });

  it("creates a single verified session for production migrations", () => {
    const configuration = createSupabaseMigrationPoolConfiguration({
      mode: "supabase-session",
      host: "aws-0-region.pooler.supabase.com",
      port: 5432,
      database: "postgres",
      user: "migration.projectref",
      password: "migration-password",
      rootCertificate,
    });

    expect(configuration).toMatchObject({
      port: 5432,
      max: 1,
      application_name: "supabase-schema-migration",
      ssl: {
        ca: rootCertificate,
        rejectUnauthorized: true,
      },
    });
    expect(configuration).not.toHaveProperty("statement_timeout");
  });

  it("rejects pool creation when database use is disabled", () => {
    expect(() => createPgPoolConfiguration({ mode: "disabled" })).toThrow(DatabaseDisabledError);
  });

  it("allows runtime and migration pool constructors to be injected", () => {
    const poolFactory = vi.fn((configuration: PoolConfig) => ({ configuration }));
    const createPool = createDatabasePoolFactory(poolFactory);
    const createMigrationPool = createMigrationPoolFactory(poolFactory);

    createPool({
      mode: "local-password",
      host: "127.0.0.1",
      port: 5432,
      database: "app",
      user: "local",
      password: "local-only-password",
      poolMax: 2,
      probeTimeoutMs: 1_000,
    });
    createMigrationPool({
      mode: "supabase-session",
      host: "aws-0-region.pooler.supabase.com",
      port: 5432,
      database: "postgres",
      user: "migration.projectref",
      password: "migration-password",
      rootCertificate,
    });

    expect(poolFactory).toHaveBeenCalledTimes(2);
  });
});
