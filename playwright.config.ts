import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const bootstrapSecret = "playwright-bootstrap-secret-with-at-least-32-characters";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4300",
    trace: "retain-on-failure",
  },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:4300/workspace/",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NIMANTO_BOOTSTRAP_SECRET: bootstrapSecret,
      NIMANTO_DATA_DIR: path.join(tmpdir(), `nimanto-playwright-${process.pid}`),
    },
  },
});

export { bootstrapSecret };
