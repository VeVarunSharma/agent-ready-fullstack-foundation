import { defineConfig } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${String(port)}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL,
    browserName: "chromium",
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "pnpm start",
    env: {
      AUTH_MODE: "disabled",
      DATABASE_MODE: "disabled",
      DATABASE_HOST: "",
      DATABASE_NAME: "",
      DATABASE_PASSWORD: "",
      DATABASE_USER: "",
      HOST_MODE: "local",
      HOSTNAME: "127.0.0.1",
      LOGGING_MODE: "json",
      APPLICATION_ORIGIN: "",
      NEXT_PUBLIC_RUNTIME_MODE: "test",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(port),
      RUNTIME_MODE: "test",
      SUPABASE_DATABASE_PASSWORD: "",
      SUPABASE_DATABASE_ROOT_CERT: "",
      TELEMETRY_MODE: "disabled",
      VERCEL_ENV: "",
    },
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 5_000,
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: `${baseURL}/health/live`,
  },
});
