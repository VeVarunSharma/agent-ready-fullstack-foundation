import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

const requiredApprovals = [
  "vercelProjectConfigured",
  "supabaseProjectConfigured",
  "supabaseAuthConfigured",
  "databaseRolesConfigured",
  "migrationEnvironmentProtected",
  "deploymentCheckRequired",
  "dataResidencyApproved",
  "recoveryApproved",
];
const prohibitedTopologyKeys = new Set([
  "applicationGateway",
  "containerApps",
  "containerRegistry",
  "dockerImage",
  "keyVault",
  "postgres",
  "virtualNetwork",
]);
const prohibitedCredentialKeyPattern =
  /(?:api.?key|connection.?string|password|private.?key|publishable.?key|root.?cert|secret|token)$/iu;
const placeholderPattern =
  /(?:^|[^a-z0-9])(?:change-?me|compile|dummy|example|placeholder|replace|sample|synthetic|tbd|test|todo|unresolved)(?:$|[^a-z0-9])/iu;

function issue(code, path, message) {
  return { code, path, message };
}

function get(value, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpsOrigin(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function containsPlaceholder(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }
  if (placeholderPattern.test(value)) {
    return true;
  }
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname.endsWith(".test") ||
      hostname.endsWith(".example") ||
      hostname.endsWith(".invalid")
    );
  } catch {
    return false;
  }
}

function inspectKeys(value, add, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectKeys(item, add, [...path, String(index)]));
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    if (prohibitedTopologyKeys.has(key)) {
      add(
        "REPLACED_AZURE_TOPOLOGY_PROHIBITED",
        childPath.join("."),
        `${key} belongs to the replaced Azure workload topology.`,
      );
    }
    if (prohibitedCredentialKeyPattern.test(key)) {
      add(
        "CREDENTIAL_CONFIGURATION_PROHIBITED",
        childPath.join("."),
        "Credentials and certificate material must remain in protected provider settings.",
      );
    }
    inspectKeys(child, add, childPath);
  }
}

function requireExactKeys(value, path, allowedKeys, add) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    add("CONFIGURATION_OBJECT_REQUIRED", path, `${path || "root"} must be an object.`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      add(
        "UNKNOWN_CONFIGURATION_FIELD",
        path ? `${path}.${key}` : key,
        "Provider-boundary configuration rejects unknown fields.",
      );
    }
  }
}

function validateBase(config) {
  const errors = [];
  const add = (code, path, message) => {
    errors.push(issue(code, path, message));
  };

  const exactObjects = [
    [
      "",
      config,
      new Set([
        "schemaVersion",
        "deploymentProfile",
        "nonProduction",
        "dataClassification",
        "application",
        "platform",
        "approvals",
        "azure",
      ]),
    ],
    ["application", config?.application, new Set(["host", "database", "authentication"])],
    [
      "platform",
      config?.platform,
      new Set([
        "applicationOrigin",
        "vercelProjectName",
        "vercelFunctionRegion",
        "supabaseProjectRef",
        "supabaseRegion",
      ]),
    ],
    ["approvals", config?.approvals, new Set(requiredApprovals)],
    ["azure", config?.azure, new Set(["foundry", "monitorExporter", "vercelOidc"])],
    ["azure.foundry", config?.azure?.foundry, new Set(["enabled"])],
    [
      "azure.monitorExporter",
      config?.azure?.monitorExporter,
      new Set(["enabled", "telemetryMode"]),
    ],
    ["azure.vercelOidc", config?.azure?.vercelOidc, new Set(["enabled", "audience"])],
  ];
  if (config?.nonProduction !== undefined) {
    exactObjects.push([
      "nonProduction",
      config.nonProduction,
      new Set(["compileOnly", "deploymentAllowed"]),
    ]);
  }
  for (const [path, value, allowedKeys] of exactObjects) {
    requireExactKeys(value, path, allowedKeys, add);
  }

  if (config?.schemaVersion !== 1) {
    add("SCHEMA_VERSION_REQUIRED", "schemaVersion", "schemaVersion must equal 1.");
  }
  const expectedProviders = {
    "application.host": "vercel",
    "application.database": "supabase",
    "application.authentication": "supabase",
    dataClassification: "Restricted",
  };
  for (const [path, expected] of Object.entries(expectedProviders)) {
    if (get(config, path) !== expected) {
      add("PROVIDER_CONTRACT_REQUIRED", path, `${path} must equal ${expected} for this template.`);
    }
  }

  if (get(config, "azure.foundry.enabled") !== false) {
    add("FOUNDRY_ENABLEMENT_PROHIBITED", "azure.foundry.enabled", "Foundry remains false-only.");
  }
  if (
    get(config, "azure.monitorExporter.enabled") !== false ||
    get(config, "azure.monitorExporter.telemetryMode") !== "disabled"
  ) {
    add(
      "AZURE_MONITOR_EXPORT_PROHIBITED",
      "azure.monitorExporter",
      "Azure Monitor application export remains disabled.",
    );
  }
  if (get(config, "azure.vercelOidc.enabled") !== false) {
    add(
      "AZURE_RUNTIME_ACCESS_PROHIBITED",
      "azure.vercelOidc.enabled",
      "No Azure runtime consumer is admitted by this foundation.",
    );
  }
  if (get(config, "azure.vercelOidc.audience") !== "api://AzureADTokenExchange") {
    add(
      "AZURE_OIDC_AUDIENCE_REQUIRED",
      "azure.vercelOidc.audience",
      "Future Azure federation must use the Azure token-exchange audience.",
    );
  }

  inspectKeys(config, add);
  return errors;
}

export function validateCompileOnlyConfig(config) {
  const errors = validateBase(config);
  if (config?.deploymentProfile !== "compile") {
    errors.push(
      issue(
        "COMPILE_ONLY_PROFILE_REQUIRED",
        "deploymentProfile",
        "Compile fixtures must use the compile deployment profile.",
      ),
    );
  }
  if (
    config?.nonProduction?.compileOnly !== true ||
    config?.nonProduction?.deploymentAllowed !== false
  ) {
    errors.push(
      issue(
        "COMPILE_ONLY_DENY_REQUIRED",
        "nonProduction",
        "Compile fixtures must explicitly deny deployment.",
      ),
    );
  }
  return errors.toSorted((left, right) => left.code.localeCompare(right.code));
}

export function validateProductionConfig(config) {
  const errors = validateBase(config);
  if (config?.deploymentProfile !== "production") {
    errors.push(
      issue(
        "PRODUCTION_PROFILE_REQUIRED",
        "deploymentProfile",
        "Production preflight requires the production profile.",
      ),
    );
  }

  const platformFields = [
    "applicationOrigin",
    "vercelProjectName",
    "vercelFunctionRegion",
    "supabaseProjectRef",
    "supabaseRegion",
  ];
  for (const field of platformFields) {
    const value = config?.platform?.[field];
    if (!isNonEmptyString(value)) {
      errors.push(
        issue(
          "PLATFORM_VALUE_REQUIRED",
          `platform.${field}`,
          `platform.${field} requires an approved value.`,
        ),
      );
    } else if (containsPlaceholder(value)) {
      errors.push(
        issue(
          "SYNTHETIC_VALUE_PROHIBITED",
          `platform.${field}`,
          "Production platform values must not contain synthetic markers.",
        ),
      );
    }
  }
  if (!isHttpsOrigin(config?.platform?.applicationOrigin)) {
    errors.push(
      issue(
        "APPLICATION_ORIGIN_INVALID",
        "platform.applicationOrigin",
        "The production application origin must be one exact HTTPS origin.",
      ),
    );
  }

  for (const approval of requiredApprovals) {
    if (config?.approvals?.[approval] !== true) {
      errors.push(
        issue(
          "PRODUCTION_APPROVAL_REQUIRED",
          `approvals.${approval}`,
          `${approval} must be explicitly approved before production use.`,
        ),
      );
    }
  }

  return errors.toSorted(
    (left, right) => left.code.localeCompare(right.code) || left.path.localeCompare(right.path),
  );
}

function parseArguments(argumentsList) {
  const options = {
    configPath: "",
    expectFailure: false,
    mode: "production",
    quiet: false,
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--config") {
      options.configPath = argumentsList[index + 1] ?? "";
      index += 1;
    } else if (argument === "--expect-failure") {
      options.expectFailure = true;
    } else if (argument === "--mode") {
      options.mode = argumentsList[index + 1] ?? "";
      index += 1;
    } else if (argument === "--quiet") {
      options.quiet = true;
    } else {
      throw new Error(`Unknown preflight argument: ${argument}`);
    }
  }
  if (!options.configPath) {
    throw new Error("--config is required.");
  }
  if (options.mode !== "production" && options.mode !== "compile-only") {
    throw new Error("--mode must be production or compile-only.");
  }
  return options;
}

export async function runCli(argumentsList = process.argv.slice(2)) {
  const options = parseArguments(argumentsList);
  let config;
  try {
    config = JSON.parse(await readFile(options.configPath, "utf8"));
  } catch (error) {
    if (!options.quiet) {
      console.error("Preflight could not read a valid JSON configuration.");
    }
    return 1;
  }

  const errors =
    options.mode === "compile-only"
      ? validateCompileOnlyConfig(config)
      : validateProductionConfig(config);
  const failedAsExpected = options.expectFailure && errors.length > 0;
  const succeeded = !options.expectFailure && errors.length === 0;
  if (!options.quiet) {
    if (succeeded) {
      console.log(`${options.mode} provider-boundary preflight passed.`);
    } else if (!failedAsExpected) {
      errors.forEach((error) => {
        console.error(`${error.code} ${error.path}: ${error.message}`);
      });
    }
  }
  return succeeded || failedAsExpected ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.exitCode = await runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Provider-boundary preflight failed.");
    process.exitCode = 1;
  }
}
