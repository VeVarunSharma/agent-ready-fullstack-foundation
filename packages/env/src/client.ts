import { parseClientEnvironment as parseEnvironment } from "./runtime";
import type { ClientEnvironment } from "./schemas";

export {
  clientEnvironmentSchema,
  getSupabasePublicConfiguration,
  requireSupabasePublicConfiguration,
  type ClientEnvironment,
} from "./runtime";

export function parseClientEnvironment(input: unknown): ClientEnvironment {
  return parseEnvironment(input);
}

export function loadClientEnvironment(): ClientEnvironment {
  return parseClientEnvironment({
    NEXT_PUBLIC_RUNTIME_MODE: process.env.NEXT_PUBLIC_RUNTIME_MODE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_SECRET_KEY: process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY,
    NEXT_PUBLIC_SUPABASE_SECRET_KEYS: process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEYS,
  });
}
