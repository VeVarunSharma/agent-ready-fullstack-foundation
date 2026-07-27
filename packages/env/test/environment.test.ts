import { describe, expect, it } from "vitest";

import {
  loadClientEnvironment,
  parseClientEnvironment,
  requireSupabasePublicConfiguration,
} from "../src/client";
import { serverEnvironmentSchema } from "../src/schemas";
import {
  createLocalDatabaseUrl,
  getMigrationDatabaseConfiguration,
  parseMigrationEnvironment,
} from "../src/tooling";
import {
  AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
  EnvironmentConfigurationError,
  getAuthenticationConfiguration,
  getDatabaseConfiguration,
  getTelemetryConfiguration,
  parseServerEnvironment,
} from "../src/server";

const rootCertificate =
  "-----BEGIN CERTIFICATE-----\n" + "A".repeat(96) + "\n-----END CERTIFICATE-----";
const publishableKey = `sb_publishable_${"a".repeat(40)}`;
const disabledEnvironment = {
  RUNTIME_MODE: "test",
  HOST_MODE: "local",
  DATABASE_MODE: "disabled",
  AUTH_MODE: "disabled",
  LOGGING_MODE: "silent",
  TELEMETRY_MODE: "disabled",
  NEXT_PUBLIC_RUNTIME_MODE: "test",
} as const;
const productionEnvironment = {
  RUNTIME_MODE: "production",
  HOST_MODE: "vercel",
  VERCEL_ENV: "production",
  DATABASE_MODE: "supabase-pooler",
  AUTH_MODE: "supabase",
  LOGGING_MODE: "json",
  TELEMETRY_MODE: "disabled",
  NEXT_PUBLIC_RUNTIME_MODE: "production",
  APPLICATION_ORIGIN: "https://application.example.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  DATABASE_HOST: "aws-0-region.pooler.supabase.com",
  DATABASE_PORT: "6543",
  DATABASE_NAME: "postgres",
  DATABASE_USER: "application.projectref",
  SUPABASE_DATABASE_PASSWORD: "runtime-password-value",
  SUPABASE_DATABASE_ROOT_CERT: rootCertificate,
  DATABASE_POOL_MAX: "2",
  DATABASE_PROBE_TIMEOUT_MS: "2000",
} as const;
const migrationEnvironment = {
  RUNTIME_MODE: "production",
  SUPABASE_MIGRATION_HOST: "aws-0-region.pooler.supabase.com",
  SUPABASE_MIGRATION_PORT: "5432",
  SUPABASE_MIGRATION_DATABASE: "postgres",
  SUPABASE_MIGRATION_USER: "migration.projectref",
  SUPABASE_MIGRATION_PASSWORD: "migration-password-value",
  SUPABASE_MIGRATION_ROOT_CERT: rootCertificate,
} as const;

describe("server environment", () => {
  it("requires every runtime mode explicitly", () => {
    expect(() => parseServerEnvironment({})).toThrow(EnvironmentConfigurationError);
  });

  it("accepts the complete Vercel and Supabase production contract", () => {
    const environment = parseServerEnvironment(productionEnvironment);

    expect(getDatabaseConfiguration(environment)).toEqual({
      mode: "supabase-pooler",
      host: "aws-0-region.pooler.supabase.com",
      port: 6543,
      database: "postgres",
      user: "application.projectref",
      password: "runtime-password-value",
      rootCertificate,
      poolMax: 2,
      probeTimeoutMs: 2_000,
    });
    expect(getAuthenticationConfiguration(environment)).toEqual({
      mode: "supabase",
      applicationOrigin: "https://application.example.test",
      url: "https://project.supabase.co",
      publishableKey,
    });
    expect(getTelemetryConfiguration(environment)).toEqual({ mode: "disabled" });
  });

  it("accepts an explicitly database-disabled test runtime", () => {
    const environment = parseServerEnvironment(disabledEnvironment);

    expect(getDatabaseConfiguration(environment)).toEqual({ mode: "disabled" });
    expect(getAuthenticationConfiguration(environment)).toEqual({ mode: "disabled" });
  });

  it("builds a local-only password configuration", () => {
    const environment = parseServerEnvironment({
      ...disabledEnvironment,
      RUNTIME_MODE: "local",
      NEXT_PUBLIC_RUNTIME_MODE: "local",
      DATABASE_MODE: "local-password",
      LOGGING_MODE: "json",
      DATABASE_HOST: "127.0.0.1",
      DATABASE_PORT: "5432",
      DATABASE_NAME: "app",
      DATABASE_USER: "local user",
      DATABASE_PASSWORD: "local/password/value",
    });
    const configuration = getDatabaseConfiguration(environment);

    expect(configuration).toMatchObject({
      mode: "local-password",
      host: "127.0.0.1",
      port: 5432,
    });
    if (configuration.mode !== "local-password") {
      throw new Error("Expected local password mode.");
    }
    expect(createLocalDatabaseUrl(configuration)).toContain("@127.0.0.1:5432/app");
  });

  it.each([
    { DATABASE_PORT: "5432" },
    { DATABASE_POOL_MAX: "6" },
    { DATABASE_USER: "postgres.projectref" },
    { SUPABASE_DATABASE_ROOT_CERT: undefined },
    { SUPABASE_DATABASE_PASSWORD: undefined },
    { DATABASE_HOST: "database.example.test" },
    { DATABASE_HOST: "abcdefghijklmnopqrst.supabase.co" },
  ])("rejects unsafe Supabase runtime configuration %o", (override) => {
    expect(() =>
      parseServerEnvironment({
        ...productionEnvironment,
        ...override,
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it.each([
    ["DATABASE_URL", "postgresql://application:secret@database.invalid/postgres"],
    ["DATABASE_SSL_MODE", "require"],
    ["SUPABASE_SERVICE_ROLE_KEY", "service-role-key-must-not-be-used"],
    ["SUPABASE_SECRET_KEY", "sb_secret_key_must_not_be_used"],
    ["SUPABASE_SECRET_KEYS", "sb_secret_keys_must_not_be_used"],
    ["NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", "service-role-key-must-not-be-public"],
    ["NEXT_PUBLIC_SUPABASE_SECRET_KEY", "sb_secret_key_must_not_be_public"],
    ["NEXT_PUBLIC_SUPABASE_SECRET_KEYS", "sb_secret_keys_must_not_be_public"],
    ["AUTH_ALLOWED_IDENTITIES_JSON", "[]"],
    ["SUPABASE_MIGRATION_PASSWORD", "migration-password-must-not-be-runtime"],
  ] as const)("rejects prohibited runtime field %s", (fieldName, value) => {
    expect(() =>
      parseServerEnvironment({
        ...productionEnvironment,
        [fieldName]: value,
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it.each([
    { HOST_MODE: "local" },
    { DATABASE_MODE: "disabled" },
    { AUTH_MODE: "disabled" },
    { LOGGING_MODE: "silent" },
    { TELEMETRY_MODE: "azure-monitor" },
    { VERCEL_ENV: undefined },
    { APPLICATION_ORIGIN: "http://application.example.test" },
    { NEXT_PUBLIC_RUNTIME_MODE: "test" },
  ])("rejects a production bypass %o", (override) => {
    expect(() =>
      parseServerEnvironment({
        ...productionEnvironment,
        ...override,
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("allows local Supabase Auth only with a local HTTP origin", () => {
    const environment = parseServerEnvironment({
      ...disabledEnvironment,
      RUNTIME_MODE: "local",
      NEXT_PUBLIC_RUNTIME_MODE: "local",
      AUTH_MODE: "supabase",
      APPLICATION_ORIGIN: "http://127.0.0.1:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    });

    expect(getAuthenticationConfiguration(environment).mode).toBe("supabase");
  });

  it("rejects dormant Supabase Auth configuration when authentication is disabled", () => {
    expect(() =>
      parseServerEnvironment({
        ...disabledEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("fails Azure Monitor export closed with the current delivery limitation", () => {
    const result = serverEnvironmentSchema.safeParse({
      ...disabledEnvironment,
      TELEMETRY_MODE: "azure-monitor",
      APPLICATIONINSIGHTS_CONNECTION_STRING:
        "InstrumentationKey=00000000-0000-0000-0000-000000000000",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected Azure Monitor export configuration to be rejected.");
    }
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
        path: ["TELEMETRY_MODE"],
      }),
    );
  });

  it("rejects dormant Azure Monitor credentials while telemetry is disabled", () => {
    expect(() =>
      parseServerEnvironment({
        ...disabledEnvironment,
        APPLICATIONINSIGHTS_CONNECTION_STRING:
          "InstrumentationKey=00000000-0000-0000-0000-000000000000",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });
});

describe("migration environment", () => {
  it("parses a dedicated Supabase session connection", () => {
    expect(
      getMigrationDatabaseConfiguration(parseMigrationEnvironment(migrationEnvironment)),
    ).toEqual({
      mode: "supabase-session",
      host: "aws-0-region.pooler.supabase.com",
      port: 5432,
      database: "postgres",
      user: "migration.projectref",
      password: "migration-password-value",
      rootCertificate,
    });
  });

  it.each([
    { RUNTIME_MODE: "local" },
    { SUPABASE_MIGRATION_PORT: "6543" },
    { SUPABASE_MIGRATION_USER: "postgres.projectref" },
    { SUPABASE_MIGRATION_PASSWORD: undefined },
    { DATABASE_URL: "postgresql://migration:secret@database.invalid/postgres" },
    { SUPABASE_SERVICE_ROLE_KEY: "service-role-key-must-not-be-used" },
    { SUPABASE_SECRET_KEY: "sb_secret_key_must_not_be_used" },
    { SUPABASE_SECRET_KEYS: "sb_secret_keys_must_not_be_used" },
    { SUPABASE_MIGRATION_HOST: "abcdefghijklmnopqrst.supabase.co" },
  ])("rejects unsafe migration configuration %o", (override) => {
    expect(() =>
      parseMigrationEnvironment({
        ...migrationEnvironment,
        ...override,
      }),
    ).toThrow(EnvironmentConfigurationError);
  });
});

describe("client environment", () => {
  it("loads only browser-safe Supabase configuration", () => {
    const environment = parseClientEnvironment({
      NEXT_PUBLIC_RUNTIME_MODE: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    });

    expect(requireSupabasePublicConfiguration(environment)).toEqual({
      url: "https://project.supabase.co",
      publishableKey,
    });
  });

  it("permits an unconfigured test browser runtime", () => {
    expect(parseClientEnvironment({ NEXT_PUBLIC_RUNTIME_MODE: "test" })).toEqual({
      NEXT_PUBLIC_RUNTIME_MODE: "test",
    });
  });

  it.each([
    {
      NEXT_PUBLIC_RUNTIME_MODE: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    },
    {
      NEXT_PUBLIC_RUNTIME_MODE: "production",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    },
    {
      NEXT_PUBLIC_RUNTIME_MODE: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "service-role-key-must-not-be-public",
    },
    {
      NEXT_PUBLIC_RUNTIME_MODE: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_SUPABASE_SECRET_KEY: "sb_secret_key_must_not_be_public",
    },
    {
      NEXT_PUBLIC_RUNTIME_MODE: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_SUPABASE_SECRET_KEYS: "sb_secret_keys_must_not_be_public",
    },
  ])("rejects an incomplete or privileged browser configuration %o", (environment) => {
    expect(() => parseClientEnvironment(environment)).toThrow();
  });

  it("does not read server-only values from process.env", () => {
    const originalRuntimeMode = process.env.NEXT_PUBLIC_RUNTIME_MODE;
    const originalDatabasePassword = process.env.DATABASE_PASSWORD;
    process.env.NEXT_PUBLIC_RUNTIME_MODE = "test";
    process.env.DATABASE_PASSWORD = "must-not-cross-the-boundary";

    try {
      expect(loadClientEnvironment()).toEqual({ NEXT_PUBLIC_RUNTIME_MODE: "test" });
    } finally {
      if (originalRuntimeMode === undefined) {
        delete process.env.NEXT_PUBLIC_RUNTIME_MODE;
      } else {
        process.env.NEXT_PUBLIC_RUNTIME_MODE = originalRuntimeMode;
      }
      if (originalDatabasePassword === undefined) {
        delete process.env.DATABASE_PASSWORD;
      } else {
        process.env.DATABASE_PASSWORD = originalDatabasePassword;
      }
    }
  });
});
