import { z } from "zod";

const blankToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalNonemptyString = z.preprocess(
  blankToUndefined,
  z.string().trim().min(1).max(2_048).optional(),
);
const optionalSecret = z.preprocess(
  blankToUndefined,
  z.string().trim().min(16).max(4_096).optional(),
);
const optionalHost = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .min(1)
    .max(253)
    .refine(
      (value) =>
        !value.includes("://") &&
        !value.includes("/") &&
        !value.includes("@") &&
        !value.includes("?") &&
        !value.includes("#") &&
        !/\s/u.test(value),
      "Database hosts must be bare host names or IP addresses.",
    )
    .optional(),
);
const optionalUrl = z.preprocess(
  blankToUndefined,
  z
    .url()
    .max(2_048)
    .refine((value) => {
      const url = new URL(value);
      return url.username === "" && url.password === "" && url.hash === "";
    }, "URLs must not contain credentials or fragments.")
    .optional(),
);
const optionalRootCertificate = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .min(64)
    .max(32_768)
    .refine(
      (value) =>
        value.startsWith("-----BEGIN CERTIFICATE-----") &&
        value.endsWith("-----END CERTIFICATE-----"),
      "The Supabase database root certificate must be PEM encoded.",
    )
    .optional(),
);
const optionalPublishableKey = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .min(32)
    .max(512)
    .regex(/^sb_publishable_[\w-]+$/u, "A Supabase publishable key is required.")
    .optional(),
);
const databasePort = z
  .preprocess(blankToUndefined, z.coerce.number().int().min(1).max(65_535).optional())
  .transform((value) => value ?? 5432);
const migrationDatabasePort = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().min(1).max(65_535),
);
const poolSize = z
  .preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).optional())
  .transform((value) => value ?? 4);
const timeoutMilliseconds = z
  .preprocess(blankToUndefined, z.coerce.number().int().min(100).max(30_000).optional())
  .transform((value) => value ?? 2_000);

export const runtimeModeSchema = z.enum(["local", "test", "production"]);
export const hostModeSchema = z.enum(["local", "vercel"]);
export const databaseModeSchema = z.enum(["disabled", "local-password", "supabase-pooler"]);
export const authenticationModeSchema = z.enum(["disabled", "supabase"]);
export const loggingModeSchema = z.enum(["json", "silent"]);
export const telemetryModeSchema = z.enum(["disabled", "azure-monitor"]);
export const vercelEnvironmentSchema = z.enum(["development", "preview", "production"]);

export const AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON =
  "Azure Monitor export is unavailable: no approved Vercel Log Drain, collector, application exporter, data schema, or regional delivery path exists.";

const databaseFieldNames = ["DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER"] as const;
const runtimeMigrationFieldNames = [
  "SUPABASE_MIGRATION_HOST",
  "SUPABASE_MIGRATION_PORT",
  "SUPABASE_MIGRATION_DATABASE",
  "SUPABASE_MIGRATION_USER",
  "SUPABASE_MIGRATION_PASSWORD",
  "SUPABASE_MIGRATION_ROOT_CERT",
] as const;
const unsupportedRuntimeFieldNames = [
  "DATABASE_URL",
  "DATABASE_SSL_MODE",
  "AUTH_ALLOWED_IDENTITIES_JSON",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SECRET_KEYS",
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_SECRET_KEYS",
] as const;
const supabasePoolerHostPattern =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+pooler\.supabase\.com$/u;
const supabaseDirectHostPattern = /^db\.[a-z0-9]{20}\.supabase\.co$/u;
const prohibitedDatabaseRoles = new Set([
  "anon",
  "authenticated",
  "postgres",
  "service_role",
  "supabase_admin",
]);

function addRequiredIssue(
  context: z.RefinementCtx,
  environment: Readonly<Record<string, unknown>>,
  fieldName: string,
): void {
  if (environment[fieldName] === undefined) {
    context.addIssue({
      code: "custom",
      message: `${fieldName} is required for the selected mode.`,
      path: [fieldName],
    });
  }
}

function isSupabaseHost(host: string | undefined): boolean {
  return (
    host !== undefined &&
    (supabasePoolerHostPattern.test(host) || supabaseDirectHostPattern.test(host))
  );
}

function isDedicatedDatabaseRole(user: string | undefined): boolean {
  const role = user?.split(".", 1)[0]?.toLowerCase();
  return role !== undefined && !prohibitedDatabaseRoles.has(role);
}

function isOrigin(value: string | undefined, allowLocalHttp: boolean): boolean {
  if (value === undefined) {
    return false;
  }

  const url = new URL(value);
  const localHttp =
    allowLocalHttp &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  return (
    (url.protocol === "https:" || localHttp) &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === ""
  );
}

export const serverEnvironmentSchema = z
  .object({
    RUNTIME_MODE: runtimeModeSchema,
    HOST_MODE: hostModeSchema,
    DATABASE_MODE: databaseModeSchema,
    AUTH_MODE: authenticationModeSchema,
    LOGGING_MODE: loggingModeSchema,
    TELEMETRY_MODE: telemetryModeSchema,
    APPLICATION_ORIGIN: optionalUrl,
    VERCEL_ENV: z.preprocess(blankToUndefined, vercelEnvironmentSchema.optional()),
    NEXT_PUBLIC_RUNTIME_MODE: z.preprocess(blankToUndefined, runtimeModeSchema.optional()),
    NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalPublishableKey,
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    NEXT_PUBLIC_SUPABASE_SECRET_KEY: optionalSecret,
    NEXT_PUBLIC_SUPABASE_SECRET_KEYS: optionalSecret,
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    SUPABASE_SECRET_KEY: optionalSecret,
    SUPABASE_SECRET_KEYS: optionalSecret,
    DATABASE_HOST: optionalHost,
    DATABASE_PORT: databasePort,
    DATABASE_NAME: optionalNonemptyString,
    DATABASE_USER: optionalNonemptyString,
    DATABASE_PASSWORD: optionalSecret,
    SUPABASE_DATABASE_PASSWORD: optionalSecret,
    SUPABASE_DATABASE_ROOT_CERT: optionalRootCertificate,
    DATABASE_URL: optionalSecret,
    DATABASE_SSL_MODE: optionalNonemptyString,
    DATABASE_POOL_MAX: poolSize,
    DATABASE_PROBE_TIMEOUT_MS: timeoutMilliseconds,
    AUTH_ALLOWED_IDENTITIES_JSON: optionalNonemptyString,
    APPLICATIONINSIGHTS_CONNECTION_STRING: optionalNonemptyString,
    SUPABASE_MIGRATION_HOST: optionalHost,
    SUPABASE_MIGRATION_PORT: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().min(1).max(65_535).optional(),
    ),
    SUPABASE_MIGRATION_DATABASE: optionalNonemptyString,
    SUPABASE_MIGRATION_USER: optionalNonemptyString,
    SUPABASE_MIGRATION_PASSWORD: optionalSecret,
    SUPABASE_MIGRATION_ROOT_CERT: optionalRootCertificate,
  })
  .superRefine((environment, context) => {
    for (const fieldName of unsupportedRuntimeFieldNames) {
      if (environment[fieldName] !== undefined) {
        context.addIssue({
          code: "custom",
          message: `${fieldName} is prohibited from the application runtime contract.`,
          path: [fieldName],
        });
      }
    }

    for (const fieldName of runtimeMigrationFieldNames) {
      if (environment[fieldName] !== undefined) {
        context.addIssue({
          code: "custom",
          message: `${fieldName} is restricted to the protected migration job.`,
          path: [fieldName],
        });
      }
    }

    if (environment.DATABASE_MODE === "disabled") {
      for (const fieldName of [
        ...databaseFieldNames,
        "DATABASE_PASSWORD",
        "SUPABASE_DATABASE_PASSWORD",
        "SUPABASE_DATABASE_ROOT_CERT",
      ] as const) {
        if (environment[fieldName] !== undefined) {
          context.addIssue({
            code: "custom",
            message: `${fieldName} must be absent when the database is disabled.`,
            path: [fieldName],
          });
        }
      }
    } else {
      for (const fieldName of databaseFieldNames) {
        addRequiredIssue(context, environment, fieldName);
      }
    }

    if (environment.DATABASE_MODE === "local-password") {
      addRequiredIssue(context, environment, "DATABASE_PASSWORD");
      if (environment.SUPABASE_DATABASE_PASSWORD !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Supabase credentials are prohibited in local password mode.",
          path: ["SUPABASE_DATABASE_PASSWORD"],
        });
      }
      if (environment.SUPABASE_DATABASE_ROOT_CERT !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Supabase TLS configuration is prohibited in local password mode.",
          path: ["SUPABASE_DATABASE_ROOT_CERT"],
        });
      }
    } else if (environment.DATABASE_PASSWORD !== undefined) {
      context.addIssue({
        code: "custom",
        message: "DATABASE_PASSWORD is restricted to explicit local password mode.",
        path: ["DATABASE_PASSWORD"],
      });
    }

    if (environment.DATABASE_MODE === "supabase-pooler") {
      addRequiredIssue(context, environment, "SUPABASE_DATABASE_PASSWORD");
      addRequiredIssue(context, environment, "SUPABASE_DATABASE_ROOT_CERT");
      if (environment.DATABASE_PORT !== 6543) {
        context.addIssue({
          code: "custom",
          message: "Supabase serverless runtime traffic must use transaction-pool port 6543.",
          path: ["DATABASE_PORT"],
        });
      }
      if (environment.DATABASE_POOL_MAX > 5) {
        context.addIssue({
          code: "custom",
          message: "Supabase serverless pools are limited to five client connections per instance.",
          path: ["DATABASE_POOL_MAX"],
        });
      }
      if (!isSupabaseHost(environment.DATABASE_HOST)) {
        context.addIssue({
          code: "custom",
          message: "DATABASE_HOST must be a Supabase pooler or dedicated database host.",
          path: ["DATABASE_HOST"],
        });
      }
      if (!isDedicatedDatabaseRole(environment.DATABASE_USER)) {
        context.addIssue({
          code: "custom",
          message: "Supabase runtime access requires a dedicated least-privilege database role.",
          path: ["DATABASE_USER"],
        });
      }
    } else {
      for (const fieldName of [
        "SUPABASE_DATABASE_PASSWORD",
        "SUPABASE_DATABASE_ROOT_CERT",
      ] as const) {
        if (environment[fieldName] !== undefined) {
          context.addIssue({
            code: "custom",
            message: `${fieldName} is restricted to Supabase pooler mode.`,
            path: [fieldName],
          });
        }
      }
    }

    if (
      environment.DATABASE_MODE === "local-password" &&
      environment.RUNTIME_MODE === "production"
    ) {
      context.addIssue({
        code: "custom",
        message: "Local password database mode is not permitted in production.",
        path: ["DATABASE_MODE"],
      });
    }

    if (environment.HOST_MODE === "vercel") {
      if (environment.RUNTIME_MODE !== "production") {
        context.addIssue({
          code: "custom",
          message: "Vercel hosting requires the production runtime contract.",
          path: ["RUNTIME_MODE"],
        });
      }
      addRequiredIssue(context, environment, "VERCEL_ENV");
    } else if (environment.VERCEL_ENV !== undefined) {
      context.addIssue({
        code: "custom",
        message: "VERCEL_ENV is prohibited outside Vercel host mode.",
        path: ["VERCEL_ENV"],
      });
    }

    if (environment.AUTH_MODE === "supabase") {
      for (const fieldName of [
        "APPLICATION_ORIGIN",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ] as const) {
        addRequiredIssue(context, environment, fieldName);
      }
      if (!isOrigin(environment.NEXT_PUBLIC_SUPABASE_URL, environment.RUNTIME_MODE === "local")) {
        context.addIssue({
          code: "custom",
          message: "The Supabase project URL must be an HTTPS origin.",
          path: ["NEXT_PUBLIC_SUPABASE_URL"],
        });
      }
      if (!isOrigin(environment.APPLICATION_ORIGIN, environment.RUNTIME_MODE === "local")) {
        context.addIssue({
          code: "custom",
          message: "APPLICATION_ORIGIN must be an approved origin without a path or query.",
          path: ["APPLICATION_ORIGIN"],
        });
      }
    } else {
      for (const fieldName of [
        "APPLICATION_ORIGIN",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ] as const) {
        if (environment[fieldName] !== undefined) {
          context.addIssue({
            code: "custom",
            message: `${fieldName} must be absent when Supabase authentication is disabled.`,
            path: [fieldName],
          });
        }
      }
    }

    if (environment.RUNTIME_MODE === "production") {
      addRequiredIssue(context, environment, "NEXT_PUBLIC_RUNTIME_MODE");
      const productionModes = [
        ["HOST_MODE", environment.HOST_MODE, "vercel"],
        ["DATABASE_MODE", environment.DATABASE_MODE, "supabase-pooler"],
        ["AUTH_MODE", environment.AUTH_MODE, "supabase"],
        ["LOGGING_MODE", environment.LOGGING_MODE, "json"],
        ["TELEMETRY_MODE", environment.TELEMETRY_MODE, "disabled"],
      ] as const;
      for (const [fieldName, actual, expected] of productionModes) {
        if (actual !== expected) {
          context.addIssue({
            code: "custom",
            message: `${fieldName} must be ${expected} in production.`,
            path: [fieldName],
          });
        }
      }
    }
    if (
      environment.NEXT_PUBLIC_RUNTIME_MODE !== undefined &&
      environment.NEXT_PUBLIC_RUNTIME_MODE !== environment.RUNTIME_MODE
    ) {
      context.addIssue({
        code: "custom",
        message: "NEXT_PUBLIC_RUNTIME_MODE must match RUNTIME_MODE.",
        path: ["NEXT_PUBLIC_RUNTIME_MODE"],
      });
    }

    if (environment.TELEMETRY_MODE === "azure-monitor") {
      if (environment.APPLICATIONINSIGHTS_CONNECTION_STRING === undefined) {
        context.addIssue({
          code: "custom",
          message:
            "An Application Insights connection string is required for Azure Monitor export.",
          path: ["APPLICATIONINSIGHTS_CONNECTION_STRING"],
        });
      }
      context.addIssue({
        code: "custom",
        message: AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
        path: ["TELEMETRY_MODE"],
      });
    }

    if (
      environment.TELEMETRY_MODE === "disabled" &&
      environment.APPLICATIONINSIGHTS_CONNECTION_STRING !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Azure Monitor configuration is prohibited when telemetry export is disabled.",
        path: ["APPLICATIONINSIGHTS_CONNECTION_STRING"],
      });
    }
  });

export const clientEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_RUNTIME_MODE: runtimeModeSchema,
    NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalPublishableKey,
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    NEXT_PUBLIC_SUPABASE_SECRET_KEY: optionalSecret,
    NEXT_PUBLIC_SUPABASE_SECRET_KEYS: optionalSecret,
  })
  .strict()
  .superRefine((environment, context) => {
    const hasUrl = environment.NEXT_PUBLIC_SUPABASE_URL !== undefined;
    const hasKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined;
    if (hasUrl !== hasKey) {
      context.addIssue({
        code: "custom",
        message:
          "Supabase browser configuration requires both the project URL and publishable key.",
        path: [hasUrl ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : "NEXT_PUBLIC_SUPABASE_URL"],
      });
    }
    if (
      hasUrl &&
      !isOrigin(
        environment.NEXT_PUBLIC_SUPABASE_URL,
        environment.NEXT_PUBLIC_RUNTIME_MODE === "local",
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "The browser Supabase project URL must be one approved origin.",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
      });
    }

    for (const fieldName of [
      "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
      "NEXT_PUBLIC_SUPABASE_SECRET_KEYS",
    ] as const) {
      if (environment[fieldName] !== undefined) {
        context.addIssue({
          code: "custom",
          message: "A Supabase privileged key must never cross the browser boundary.",
          path: [fieldName],
        });
      }
    }

    if (environment.NEXT_PUBLIC_RUNTIME_MODE === "production" && (!hasUrl || !hasKey)) {
      context.addIssue({
        code: "custom",
        message: "Production browser builds require Supabase Auth configuration.",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
      });
    }
  });

export const migrationEnvironmentSchema = z
  .object({
    RUNTIME_MODE: z.literal("production"),
    SUPABASE_MIGRATION_HOST: optionalHost,
    SUPABASE_MIGRATION_PORT: migrationDatabasePort,
    SUPABASE_MIGRATION_DATABASE: optionalNonemptyString,
    SUPABASE_MIGRATION_USER: optionalNonemptyString,
    SUPABASE_MIGRATION_PASSWORD: optionalSecret,
    SUPABASE_MIGRATION_ROOT_CERT: optionalRootCertificate,
    DATABASE_URL: optionalSecret,
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    SUPABASE_SECRET_KEY: optionalSecret,
    SUPABASE_SECRET_KEYS: optionalSecret,
  })
  .superRefine((environment, context) => {
    for (const fieldName of runtimeMigrationFieldNames) {
      addRequiredIssue(context, environment, fieldName);
    }
    if (environment.SUPABASE_MIGRATION_PORT !== 5432) {
      context.addIssue({
        code: "custom",
        message: "Supabase migrations require a direct or session-pool connection on port 5432.",
        path: ["SUPABASE_MIGRATION_PORT"],
      });
    }
    if (!isSupabaseHost(environment.SUPABASE_MIGRATION_HOST)) {
      context.addIssue({
        code: "custom",
        message: "SUPABASE_MIGRATION_HOST must be a Supabase direct or session-pool host.",
        path: ["SUPABASE_MIGRATION_HOST"],
      });
    }
    if (!isDedicatedDatabaseRole(environment.SUPABASE_MIGRATION_USER)) {
      context.addIssue({
        code: "custom",
        message: "Supabase migrations require a dedicated migration database role.",
        path: ["SUPABASE_MIGRATION_USER"],
      });
    }
    for (const fieldName of [
      "DATABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_SECRET_KEYS",
    ] as const) {
      if (environment[fieldName] !== undefined) {
        context.addIssue({
          code: "custom",
          message: `${fieldName} is not part of the migration contract.`,
          path: [fieldName],
        });
      }
    }
  });

export type AuthenticationMode = z.infer<typeof authenticationModeSchema>;
export type ClientEnvironment = z.infer<typeof clientEnvironmentSchema>;
export type DatabaseMode = z.infer<typeof databaseModeSchema>;
export type HostMode = z.infer<typeof hostModeSchema>;
export type LoggingMode = z.infer<typeof loggingModeSchema>;
export type MigrationEnvironment = z.infer<typeof migrationEnvironmentSchema>;
export type RuntimeMode = z.infer<typeof runtimeModeSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type TelemetryMode = z.infer<typeof telemetryModeSchema>;
export type VercelEnvironment = z.infer<typeof vercelEnvironmentSchema>;
