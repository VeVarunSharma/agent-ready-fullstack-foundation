import "server-only";

import { createServerClient } from "@supabase/ssr";
import {
  EnvironmentConfigurationError,
  getAuthenticationConfiguration,
  loadServerEnvironment,
  type AuthenticationConfiguration,
  type SupabaseAuthenticationConfiguration,
} from "@repo/env/server";
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseCookieOptions } from "../../lib/supabase-cookie-options";

interface ClaimsResult {
  readonly data: { readonly claims?: unknown } | null;
  readonly error: unknown;
}

interface SupabaseClaimsClient {
  readonly auth: {
    getClaims(): Promise<ClaimsResult>;
  };
}

interface ProxySession {
  readonly client: SupabaseClaimsClient;
  readonly getResponse: () => NextResponse;
}

export interface SupabaseProxyDependencies {
  readonly loadAuthenticationConfiguration: () => AuthenticationConfiguration;
  readonly createSession: (
    request: NextRequest,
    configuration: SupabaseAuthenticationConfiguration,
  ) => ProxySession;
}

function loadAuthenticationConfiguration(): AuthenticationConfiguration {
  return getAuthenticationConfiguration(loadServerEnvironment());
}

function createSession(
  request: NextRequest,
  configuration: SupabaseAuthenticationConfiguration,
): ProxySession {
  let response = NextResponse.next({ request });
  const client = createServerClient(configuration.url, configuration.publishableKey, {
    cookieOptions: createSupabaseCookieOptions(
      new URL(configuration.applicationOrigin).protocol === "https:",
    ),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  return {
    client,
    getResponse: () => response,
  };
}

const defaultDependencies: SupabaseProxyDependencies = {
  loadAuthenticationConfiguration,
  createSession,
};

const publicExactPaths = new Set([
  "/api/v1/health",
  "/auth/login",
  "/health/live",
  "/health/ready",
]);
const sessionHeaderNames = ["cache-control", "expires", "pragma"] as const;

export function isPublicApplicationPath(pathname: string): boolean {
  return publicExactPaths.has(pathname);
}

function copySessionState(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  for (const headerName of sessionHeaderNames) {
    const value = source.headers.get(headerName);
    if (value !== null) {
      target.headers.set(headerName, value);
    }
  }
  return target;
}

function configurationUnavailableResponse(): NextResponse {
  return new NextResponse("Service unavailable.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function updateSupabaseSession(
  request: NextRequest,
  dependencies: SupabaseProxyDependencies = defaultDependencies,
): Promise<NextResponse> {
  let authentication: AuthenticationConfiguration;
  try {
    authentication = dependencies.loadAuthenticationConfiguration();
  } catch (error: unknown) {
    if (error instanceof EnvironmentConfigurationError) {
      return configurationUnavailableResponse();
    }
    throw error;
  }

  if (authentication.mode === "disabled" || isPublicApplicationPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const session = dependencies.createSession(request, authentication);
  const claims = await session.client.auth.getClaims();
  const response = session.getResponse();
  const authenticated = claims.error === null && claims.data?.claims !== undefined;

  if (authenticated) {
    return response;
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return copySessionState(
      response,
      new NextResponse(null, {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
          "WWW-Authenticate": "Bearer",
        },
      }),
    );
  }

  const loginUrl = new URL("/auth/login", authentication.applicationOrigin);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return copySessionState(response, NextResponse.redirect(loginUrl, 303));
}
