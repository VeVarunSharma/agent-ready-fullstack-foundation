import { describe, expect, it } from "vitest";

import { createSupabaseCookieOptions } from "../src/lib/supabase-cookie-options";
import { parseRelativeApplicationPath } from "../src/lib/relative-application-path";

describe("Supabase Auth safety helpers", () => {
  it("marks production cookies secure while retaining local development support", () => {
    expect(createSupabaseCookieOptions(true)).toEqual({
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(createSupabaseCookieOptions(false).secure).toBe(false);
  });

  it("accepts only bounded same-application return paths", () => {
    expect(parseRelativeApplicationPath("/settings")).toBe("/settings");
    expect(parseRelativeApplicationPath("//attacker.test")).toBeUndefined();
    expect(parseRelativeApplicationPath("/\\attacker.test")).toBeUndefined();
    expect(parseRelativeApplicationPath("/\t/attacker.test")).toBeUndefined();
    expect(parseRelativeApplicationPath("https://attacker.test")).toBeUndefined();
  });
});
