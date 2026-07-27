import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { resolveEnvironmentBase } from "./validate.js";

describe("specification CI baseline resolution", () => {
  it("ignores the empty GitHub base ref supplied on push events", () => {
    expect(resolveEnvironmentBase({ GITHUB_BASE_REF: "" })).toBeUndefined();
    expect(resolveEnvironmentBase({ GITHUB_BASE_REF: "   " })).toBeUndefined();
  });

  it("uses the pull-request base branch when present", () => {
    expect(resolveEnvironmentBase({ GITHUB_BASE_REF: "main" })).toBe("origin/main");
  });

  it("prefers an explicit nonempty specification base", () => {
    expect(
      resolveEnvironmentBase({
        GITHUB_BASE_REF: "main",
        SPEC_BASE_REF: " refs/heads/release ",
      }),
    ).toBe("refs/heads/release");
  });

  it("compares feature-branch pushes against the repository default branch", () => {
    const workflow = readFileSync(
      new URL("../../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toContain("github.ref_name != github.event.repository.default_branch");
    expect(workflow).toContain("format('origin/{0}', github.event.repository.default_branch)");
  });
});
