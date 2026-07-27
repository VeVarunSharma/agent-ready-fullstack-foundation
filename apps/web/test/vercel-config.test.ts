import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface VercelConfiguration {
  readonly framework?: string;
  readonly installCommand?: string;
  readonly buildCommand?: string;
  readonly outputDirectory?: string;
  readonly env?: unknown;
}

interface WebManifest {
  readonly packageManager?: string;
  readonly engines?: { readonly node?: string };
}

describe("Vercel project configuration", () => {
  it("builds only the web workspace from the monorepo root", () => {
    const path = new URL("../vercel.json", import.meta.url);
    const configuration = JSON.parse(readFileSync(path, "utf8")) as VercelConfiguration;

    expect(configuration).toMatchObject({
      framework: "nextjs",
      installCommand:
        "npm install --global corepack@0.35.0 && corepack enable && corepack prepare pnpm@11.17.0 --activate && cd ../.. && pnpm install --filter @repo/web... --frozen-lockfile --strict-peer-dependencies",
    });
    expect(configuration.outputDirectory).toBeUndefined();
    expect(configuration.env).toBeUndefined();
    expect(configuration.buildCommand).toContain('test "$(pnpm --version)" = "11.17.0"');
    expect(configuration.buildCommand).toContain("--filter=@repo/web");
  });

  it("does not retain a standalone-container build entrypoint", () => {
    const manifest = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const parsedManifest = JSON.parse(manifest) as WebManifest;
    const configuration = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

    expect(manifest).not.toContain("prepare-standalone");
    expect(manifest).not.toContain(".next/standalone");
    expect(configuration).not.toContain('output: "standalone"');
    expect(configuration).not.toContain('NEXT_PUBLIC_RUNTIME_MODE ?? "test"');
    expect(parsedManifest).toMatchObject({
      packageManager: "pnpm@11.17.0",
      engines: { node: "24.x" },
    });
  });
});
