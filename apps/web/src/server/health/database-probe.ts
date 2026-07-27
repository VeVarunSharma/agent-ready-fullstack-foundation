import "server-only";

import { createDatabasePool } from "@repo/db/pool";
import type { DatabaseConfiguration } from "@repo/env/server";

type EnabledDatabaseConfiguration = Exclude<DatabaseConfiguration, { readonly mode: "disabled" }>;

export async function probeDatabase(configuration: EnabledDatabaseConfiguration): Promise<boolean> {
  const pool = createDatabasePool(configuration);

  try {
    await pool.query("select 1");
  } catch {
    try {
      await pool.end();
    } catch {
      return false;
    }
    return false;
  }

  try {
    await pool.end();
  } catch {
    return false;
  }

  return true;
}
