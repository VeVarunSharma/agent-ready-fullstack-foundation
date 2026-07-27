import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Object.assign(process.env, {
  RUNTIME_MODE: "test",
  HOST_MODE: "local",
  DATABASE_MODE: "disabled",
  AUTH_MODE: "disabled",
  LOGGING_MODE: "silent",
  TELEMETRY_MODE: "disabled",
  NEXT_PUBLIC_RUNTIME_MODE: "test",
});

afterEach(() => {
  cleanup();
});
