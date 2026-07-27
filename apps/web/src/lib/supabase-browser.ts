"use client";

import { createBrowserClient } from "@supabase/ssr";
import { loadClientEnvironment, requireSupabasePublicConfiguration } from "@repo/env/client";

import { createSupabaseCookieOptions } from "./supabase-cookie-options";

export function createSupabaseBrowserClient() {
  const environment = loadClientEnvironment();
  const configuration = requireSupabasePublicConfiguration(environment);
  return createBrowserClient(configuration.url, configuration.publishableKey, {
    cookieOptions: createSupabaseCookieOptions(
      environment.NEXT_PUBLIC_RUNTIME_MODE === "production",
    ),
  });
}
