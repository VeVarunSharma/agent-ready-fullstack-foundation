import type { CookieOptions } from "@supabase/ssr";

export function createSupabaseCookieOptions(secure: boolean): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    secure,
  };
}
