import type { NextConfig } from "next";
import { getSupabasePublicConfiguration, parseClientEnvironment } from "@repo/env/client";

const buildEnvironment = parseClientEnvironment({
  NEXT_PUBLIC_RUNTIME_MODE: process.env.NEXT_PUBLIC_RUNTIME_MODE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_SECRET_KEY: process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY,
  NEXT_PUBLIC_SUPABASE_SECRET_KEYS: process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEYS,
});
const supabaseConfiguration = getSupabasePublicConfiguration(buildEnvironment);
const connectSources = ["'self'", supabaseConfiguration?.url].filter(
  (source): source is string => source !== undefined,
);

/*
 * The initial CSP is report-only because Next's streamed App Router payloads
 * require per-request nonces before script-src can be enforced without
 * unsafe-inline. Production rollout is: collect violations safely, add a nonce
 * at the request boundary, remove unsafe-inline, then enforce this policy.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${connectSources.join(" ")}`,
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@repo/api-contracts", "@repo/db", "@repo/env", "@repo/ui"],
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicy,
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ]);
  },
};

export default nextConfig;
