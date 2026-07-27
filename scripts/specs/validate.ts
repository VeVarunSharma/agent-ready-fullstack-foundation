import { pathToFileURL } from "node:url";

import { loadGitContext, validateRepository, type ValidationIssue } from "./model.js";

interface CliOptions {
  readonly base?: string;
}

function parseArguments(argumentsList: readonly string[]): CliOptions {
  let base: string | undefined;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--all") {
      continue;
    }
    if (argument === "--base") {
      const value = argumentsList[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--base requires a Git reference");
      }
      base = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument "${argument ?? ""}"`);
  }

  return base === undefined ? {} : { base };
}

function printIssues(issues: readonly ValidationIssue[]): void {
  for (const validationIssue of issues) {
    console.error(`- ${validationIssue.location}: ${validationIssue.message}`);
  }
}

interface BaseEnvironment {
  readonly GITHUB_BASE_REF?: string;
  readonly SPEC_BASE_REF?: string;
}

export function resolveEnvironmentBase(environment: BaseEnvironment): string | undefined {
  const explicitBase = environment.SPEC_BASE_REF?.trim();
  const githubBase = environment.GITHUB_BASE_REF?.trim();
  if (explicitBase !== undefined && explicitBase !== "") {
    return explicitBase;
  }
  return githubBase === undefined || githubBase === "" ? undefined : `origin/${githubBase}`;
}

function main(): void {
  try {
    const options = parseArguments(process.argv.slice(2));
    const environmentBase = resolveEnvironmentBase(process.env);
    const git = loadGitContext(process.cwd(), options.base ?? environmentBase);
    const issues = [...git.issues];

    if (git.issues.length === 0) {
      issues.push(...validateRepository(process.cwd(), git.context));
    }

    if (issues.length > 0) {
      console.error(`Specification validation failed with ${String(issues.length)} issue(s):`);
      printIssues(issues);
      process.exitCode = 1;
      return;
    }

    const gitSummary =
      git.context === null
        ? "Git immutability checks skipped because no baseline commit exists."
        : `Git policies checked against ${git.context.baselineRef}.`;
    console.log(`Specification catalog and documents are valid. ${gitSummary}`);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown validation error";
    console.error(`Specification validation failed: ${detail}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
