import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../../.github/workflows/supabase-migrate.yml", import.meta.url),
  "utf8",
);
const rootManifest = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
) as { readonly scripts?: Readonly<Record<string, string>> };

describe("Supabase production release contract", () => {
  it("publishes one stable protected migration check for every main deployment", () => {
    expect(workflow).toContain("name: Supabase production migration");
    expect(workflow).toMatch(/push:\s+branches:\s+- main/u);
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("group: supabase-production-migration");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).not.toContain("pull_request:");
  });

  it("keeps migration credentials inside the protected job", () => {
    for (const secretName of [
      "SUPABASE_MIGRATION_HOST",
      "SUPABASE_MIGRATION_DATABASE",
      "SUPABASE_MIGRATION_USER",
      "SUPABASE_MIGRATION_PASSWORD",
      "SUPABASE_MIGRATION_ROOT_CERT",
    ]) {
      expect(workflow).toContain(`secrets.${secretName}`);
    }
    expect(workflow).toContain('SUPABASE_MIGRATION_PORT: "5432"');
    expect(workflow).toContain("run: pnpm db:migrate:production");
    expect(workflow).toContain("--fail-if-no-match");
    expect(rootManifest.scripts?.["db:migrate:production"]).toContain("--fail-if-no-match");
    expect(rootManifest.scripts?.["db:migrate:production"]).not.toContain("--if-present");
  });

  it("does not couple migrations to a Vercel or Next.js build", () => {
    expect(workflow).not.toMatch(/\bvercel (?:build|deploy|promote)\b/u);
    expect(workflow).not.toContain("next build");
    expect(workflow).not.toContain("pnpm build\n");
    expect(workflow).toContain("pnpm --filter @repo/db --fail-if-no-match build:migration");
  });

  it("requires exact confirmation for manual default-branch runs", () => {
    expect(workflow).toContain("RUN SUPABASE MIGRATIONS");
    expect(workflow).toContain('test "$SELECTED_REF" = "refs/heads/$DEFAULT_BRANCH"');
  });
});
