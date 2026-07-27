import { describe, expect, it, vi } from "vitest";
import type { PoolConfig } from "pg";

import {
  DatabaseDisabledError,
  createDatabasePoolFactory,
  createPgPoolConfiguration,
} from "../src/internal/pool";

describe("PostgreSQL pool configuration", () => {
  it("uses a static password only for explicit local mode", () => {
    const configuration = createPgPoolConfiguration({
      mode: "local-password",
      host: "127.0.0.1",
      port: 5432,
      database: "app",
      user: "local",
      password: "local-only",
      poolMax: 4,
      probeTimeoutMs: 1_000,
    });

    expect(configuration).toMatchObject({
      password: "local-only",
      ssl: false,
      max: 4,
    });
  });

  it("injects a refreshable async password callback for Azure", async () => {
    const getPassword = vi.fn(() => Promise.resolve("azure-token"));
    const configuration = createPgPoolConfiguration(
      {
        mode: "azure-managed-identity",
        host: "database.invalid",
        port: 5432,
        database: "app",
        user: "application",
        managedIdentityClientId: "7af253a4-147b-48cf-b158-a5d79810b2a7",
        poolMax: 10,
        probeTimeoutMs: 2_000,
      },
      {
        tokenProviderFactory: () => ({ getPassword }),
      },
    );

    expect(configuration.ssl).toEqual({ rejectUnauthorized: true });
    expect(configuration.password).toBeTypeOf("function");
    if (typeof configuration.password !== "function") {
      throw new Error("Expected an asynchronous pg password callback.");
    }
    await expect(configuration.password()).resolves.toBe("azure-token");
  });

  it("rejects pool creation when database use is disabled", () => {
    expect(() => createPgPoolConfiguration({ mode: "disabled" })).toThrow(DatabaseDisabledError);
  });

  it("allows the pool constructor to be injected", () => {
    const poolFactory = vi.fn((configuration: PoolConfig) => ({ configuration }));
    const createPool = createDatabasePoolFactory(poolFactory);
    const pool = createPool({
      mode: "local-password",
      host: "127.0.0.1",
      port: 5432,
      database: "app",
      user: "local",
      password: "local-only",
      poolMax: 2,
      probeTimeoutMs: 1_000,
    });

    expect(poolFactory).toHaveBeenCalledOnce();
    expect(pool.configuration).toMatchObject({ host: "127.0.0.1" });
  });
});
