import { describe, expect, it, vi } from "vitest";
import { EnvironmentConfigurationError } from "@repo/env/server";
import { NextRequest, NextResponse } from "next/server";

import {
  isPublicApplicationPath,
  updateSupabaseSession,
  type SupabaseProxyDependencies,
} from "../src/server/auth/supabase-proxy";
import { config as proxyConfig } from "../src/proxy";

const authentication = {
  mode: "supabase",
  applicationOrigin: "https://application.example.test",
  url: "https://project.supabase.co",
  publishableKey: `sb_publishable_${"a".repeat(40)}`,
} as const;

function dependencies(result: {
  readonly data: { readonly claims?: unknown } | null;
  readonly error: unknown;
}): SupabaseProxyDependencies {
  return {
    loadAuthenticationConfiguration: () => authentication,
    createSession: (request) => ({
      client: {
        auth: {
          getClaims: vi.fn(() => Promise.resolve(result)),
        },
      },
      getResponse: () => NextResponse.next({ request }),
    }),
  };
}

describe("Supabase authentication proxy", () => {
  it("recognizes only the documented public application paths", () => {
    expect(proxyConfig.matcher).toEqual(["/((?!_next/static|_next/image|favicon.ico).*)"]);
    expect(isPublicApplicationPath("/auth/login")).toBe(true);
    expect(isPublicApplicationPath("/health/ready")).toBe(true);
    expect(isPublicApplicationPath("/api/v1/health")).toBe(true);
    expect(isPublicApplicationPath("/")).toBe(false);
    expect(isPublicApplicationPath("/api/v1/accounts")).toBe(false);
    expect(isPublicApplicationPath("/api/v1/health/private")).toBe(false);
    expect(isPublicApplicationPath("/auth/private")).toBe(false);
    expect(isPublicApplicationPath("/api/v1/private.png")).toBe(false);
  });

  it("does not call Supabase when authentication is explicitly disabled", async () => {
    const createSession = vi.fn();
    const response = await updateSupabaseSession(new NextRequest("https://local.test/"), {
      loadAuthenticationConfiguration: () => ({ mode: "disabled" }),
      createSession,
    });

    expect(response.status).toBe(200);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("allows authenticated requests to protected routes", async () => {
    const response = await updateSupabaseSession(
      new NextRequest("https://application.example.test/"),
      dependencies({ data: { claims: { sub: "opaque-subject" } }, error: null }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps sign-in and health routes public without trusting an absent session", async () => {
    const createSession = vi.fn();
    const response = await updateSupabaseSession(
      new NextRequest("https://application.example.test/auth/login"),
      {
        loadAuthenticationConfiguration: () => authentication,
        createSession,
      },
    );

    expect(response.status).toBe(200);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated page without retaining its query string", async () => {
    const response = await updateSupabaseSession(
      new NextRequest("https://application.example.test/private?email=person@example.test"),
      dependencies({ data: null, error: new Error("invalid session") }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://application.example.test/auth/login?next=%2Fprivate",
    );
    expect(response.headers.get("location")).not.toContain("person");
  });

  it("returns a body-free unauthorized response for protected APIs", async () => {
    const response = await updateSupabaseSession(
      new NextRequest("https://application.example.test/api/v1/accounts"),
      dependencies({ data: null, error: null }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("fails closed with a generic response when runtime configuration is invalid", async () => {
    const response = await updateSupabaseSession(
      new NextRequest("https://application.example.test/"),
      {
        loadAuthenticationConfiguration: () => {
          throw new EnvironmentConfigurationError(["AUTH_MODE"]);
        },
        createSession: vi.fn(),
      },
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Service unavailable.");
  });
});
