import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  runCli,
  validateCompileOnlyConfig,
  validateProductionConfig,
} from "../scripts/preflight.mjs";

const compileFixtureUrl = new URL("../environments/compile.config.json", import.meta.url);
const productionFixtureUrl = new URL("../environments/production.config.json", import.meta.url);
const foundryTemplateUrl = new URL("../modules/foundry.bicep", import.meta.url);
const mainTemplateUrl = new URL("../main.bicep", import.meta.url);
const bicepCliUrl = new URL("../.tools/bicep", import.meta.url);
const vercelConfigUrl = new URL("../../apps/web/vercel.json", import.meta.url);
const migrationWorkflowUrl = new URL(
  "../../.github/workflows/supabase-migrate.yml",
  import.meta.url,
);

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

function compileBicep(templateUrl) {
  return JSON.parse(
    execFileSync(
      fileURLToPath(bicepCliUrl),
      ["build", fileURLToPath(templateUrl), "--stdout", "--no-restore"],
      { encoding: "utf8" },
    ),
  );
}

async function validProductionConfig() {
  const config = await readJson(productionFixtureUrl);
  config.platform = {
    applicationOrigin: "https://approved.application.company",
    vercelProjectName: "approved-application",
    vercelFunctionRegion: "iad1",
    supabaseProjectRef: "abcdefghijklmnopqrst",
    supabaseRegion: "us-east-1",
  };
  config.approvals = Object.fromEntries(
    Object.keys(config.approvals).map((approval) => [approval, true]),
  );
  return config;
}

function hasCode(errors, code) {
  return errors.some((error) => error.code === code);
}

test("compile fixtures are synthetic and explicitly nondeployable", async () => {
  const config = await readJson(compileFixtureUrl);
  assert.deepEqual(validateCompileOnlyConfig(config), []);
  assert.ok(hasCode(validateProductionConfig(config), "PRODUCTION_PROFILE_REQUIRED"));
  assert.ok(hasCode(validateProductionConfig(config), "SYNTHETIC_VALUE_PROHIBITED"));
  assert.equal(
    await runCli([
      "--config",
      fileURLToPath(compileFixtureUrl),
      "--mode",
      "compile-only",
      "--quiet",
    ]),
    0,
  );
});

test("a complete provider-boundary production record passes", async () => {
  assert.deepEqual(validateProductionConfig(await validProductionConfig()), []);
});

test("checked-in production input fails every unresolved external approval", async () => {
  const errors = validateProductionConfig(await readJson(productionFixtureUrl));
  assert.ok(hasCode(errors, "PLATFORM_VALUE_REQUIRED"));
  assert.ok(hasCode(errors, "PRODUCTION_APPROVAL_REQUIRED"));
  assert.equal(
    await runCli(["--config", fileURLToPath(productionFixtureUrl), "--expect-failure", "--quiet"]),
    0,
  );
});

test("replaced Azure resources and credential material are rejected", async () => {
  const config = await validProductionConfig();
  config.containerApps = { enabled: true };
  config.databasePassword = "must-not-be-in-config";
  config.azure.foundry.apiKey = "must-not-be-in-config";
  const errors = validateProductionConfig(config);
  assert.ok(hasCode(errors, "REPLACED_AZURE_TOPOLOGY_PROHIBITED"));
  assert.ok(hasCode(errors, "CREDENTIAL_CONFIGURATION_PROHIBITED"));
  assert.ok(hasCode(errors, "UNKNOWN_CONFIGURATION_FIELD"));
});

test("Foundry, Azure Monitor export, and Azure runtime access remain false-only", async () => {
  for (const mutation of [
    (config) => {
      config.azure.foundry.enabled = true;
    },
    (config) => {
      config.azure.monitorExporter.enabled = true;
    },
    (config) => {
      config.azure.vercelOidc.enabled = true;
    },
  ]) {
    const config = await validProductionConfig();
    mutation(config);
    assert.notDeepEqual(validateProductionConfig(config), []);
  }
});

test("Bicep emits no Azure resources", () => {
  const main = compileBicep(mainTemplateUrl);
  const foundry = compileBicep(foundryTemplateUrl);

  assert.deepEqual(main.resources, []);
  assert.deepEqual(foundry.resources, []);
  assert.deepEqual(main.parameters.enableFoundry.allowedValues, [false]);
  assert.deepEqual(foundry.parameters.enableFoundry.allowedValues, [false]);
  assert.match(main.outputs.azureRuntimeAccessStatus.value, /OIDC federation/iu);
});

test("repository delivery surfaces match the Vercel and Supabase boundary", async () => {
  const vercel = await readJson(vercelConfigUrl);
  assert.equal(vercel.framework, "nextjs");
  assert.match(vercel.buildCommand, /--filter=@repo\/web/u);

  const workflow = await readFile(migrationWorkflowUrl, "utf8");
  assert.match(workflow, /name: Supabase production migration/u);
  assert.match(workflow, /environment: production/u);
  assert.match(workflow, /SUPABASE_MIGRATION_PORT: "5432"/u);
  assert.match(workflow, /pnpm db:migrate:production/u);
  assert.doesNotMatch(workflow, /az login|az deployment|docker build/iu);
});
