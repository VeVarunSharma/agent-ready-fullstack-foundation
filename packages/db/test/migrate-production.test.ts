import { describe, expect, it, vi } from "vitest";

import {
  ProductionMigrationConfigurationError,
  ProductionMigrationLockUnavailableError,
  loadProductionMigrationConfiguration,
  withProductionMigrationLock,
} from "../src/migrate-production";

const rootCertificate =
  "-----BEGIN CERTIFICATE-----\n" + "A".repeat(96) + "\n-----END CERTIFICATE-----";
const migrationEnvironment = {
  RUNTIME_MODE: "production",
  SUPABASE_MIGRATION_HOST: "aws-0-region.pooler.supabase.com",
  SUPABASE_MIGRATION_PORT: "5432",
  SUPABASE_MIGRATION_DATABASE: "postgres",
  SUPABASE_MIGRATION_USER: "migration.projectref",
  SUPABASE_MIGRATION_PASSWORD: "migration-password",
  SUPABASE_MIGRATION_ROOT_CERT: rootCertificate,
} as const;

describe("production migration configuration", () => {
  it("loads only the explicit production Supabase session contract", () => {
    expect(loadProductionMigrationConfiguration(migrationEnvironment)).toEqual({
      mode: "supabase-session",
      host: "aws-0-region.pooler.supabase.com",
      port: 5432,
      database: "postgres",
      user: "migration.projectref",
      password: "migration-password",
      rootCertificate,
    });
  });

  it.each([
    { RUNTIME_MODE: "local" },
    { SUPABASE_MIGRATION_PORT: "6543" },
    { SUPABASE_MIGRATION_USER: "postgres.projectref" },
    { SUPABASE_MIGRATION_ROOT_CERT: undefined },
  ])("rejects an unsafe migration override", (override) => {
    expect(() =>
      loadProductionMigrationConfiguration({
        ...migrationEnvironment,
        ...override,
      }),
    ).toThrow(ProductionMigrationConfigurationError);
  });

  it.each([
    { DATABASE_URL: "postgresql://migration:secret@database.invalid/postgres" },
    { SUPABASE_SERVICE_ROLE_KEY: "service-role-key-must-not-be-used" },
  ])("rejects unsupported migration credential %o", (override) => {
    expect(() =>
      loadProductionMigrationConfiguration({
        ...migrationEnvironment,
        ...override,
      }),
    ).toThrow(ProductionMigrationConfigurationError);
  });
});

describe("production migration advisory lock", () => {
  it("holds one dedicated PostgreSQL session lock for the full migration", async () => {
    const events: string[] = [];
    const query = vi.fn((sql: string, parameters: readonly number[]) => {
      expect(parameters).toHaveLength(2);
      if (sql.includes("pg_try_advisory_lock")) {
        events.push("lock");
        return Promise.resolve({ rows: [{ acquired: true }] });
      }

      events.push("unlock");
      return Promise.resolve({ rows: [] });
    });

    await withProductionMigrationLock({ query }, () => {
      events.push("migrate");
      return Promise.resolve();
    });

    expect(events).toEqual(["lock", "migrate", "unlock"]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[1]).toEqual(query.mock.calls[1]?.[1]);
  });

  it("fails closed without running migrations when another runner holds the lock", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ acquired: false }] });
    const migration = vi.fn(() => Promise.resolve());

    await expect(withProductionMigrationLock({ query }, migration)).rejects.toThrow(
      ProductionMigrationLockUnavailableError,
    );
    expect(migration).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("releases the lock when migration execution fails", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      withProductionMigrationLock({ query }, () => Promise.reject(new Error("migration failed"))),
    ).rejects.toThrow("migration failed");
    expect(query.mock.calls[1]?.[0]).toContain("pg_advisory_unlock");
  });
});
