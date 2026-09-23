import path from "node:path";
import { defineConfig } from "@playwright/test";

const baseURL = process.env.A11Y_BASE_URL ?? "http://localhost:3100";
const url = new URL(baseURL);
const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
const command = process.env.A11Y_DEV_CMD;

export default defineConfig({
  testDir: ".",
  testMatch: "a11y.spec.ts",
  workers: 1, // the dev server compiles routes on demand; parallel hits only slow it down
  retries: 0,
  reporter: [["list"]],
  // Keep Playwright's own output out of the action directory.
  outputDir: process.env.A11Y_OUT ? path.join(path.dirname(process.env.A11Y_OUT), "playwright") : undefined,
  use: {
    baseURL,
    storageState: process.env.A11Y_STORAGE_STATE || undefined,
    ...(process.env.A11Y_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.A11Y_CHROMIUM_PATH } } : {}),
  },
  // No command means the app is already running at target-url.
  webServer: command
    ? {
        command,
        cwd: process.env.A11Y_CWD,
        // Wait on the port, not a URL: an app without a "/" page answers 404 and a URL wait would hang.
        port,
        timeout: 240_000,
        reuseExistingServer: false,
        stdout: "pipe",
        env: { NEXT_TELEMETRY_DISABLED: "1", PORT: String(port) },
      }
    : undefined,
});
