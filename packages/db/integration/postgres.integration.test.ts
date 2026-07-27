import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { loadLocalDatabaseConfiguration } from "../src/local-database";
import { createDatabasePoolFactory } from "../src/internal/pool";

const createInjectedPool = createDatabasePoolFactory((configuration) => new Pool(configuration));

describe("PostgreSQL connectivity", () => {
  it("connects through the injected pool and executes SELECT 1", async () => {
    const pool = createInjectedPool(loadLocalDatabaseConfiguration());

    try {
      const result = await pool.query<{ value: number }>("SELECT 1 AS value");

      expect(result.rows).toEqual([{ value: 1 }]);
    } finally {
      await pool.end();
    }
  });
});
