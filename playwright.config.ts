import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const bootstrapSecret = "playwright-bootstrap-secret-with-at-least-32-characters";
const webPort = Number(process.env.NIMANTO_PLAYWRIGHT_WEB_PORT ?? 4300);
const apiPort = Number(process.env.NIMANTO_PLAYWRIGHT_API_PORT ?? 4310);
const webOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
  },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
  webServer: {
    command: "pnpm start",
    // API startup owns the slower PGlite migration path. Waiting on the static
    // site alone lets isolated late-suite journeys render the retry screen
    // before the local service is ready.
    url: `${apiOrigin}/health`,
    // CI always owns a disposable server. Local debugging may opt into an
    // already-ready disposable server so a single late-suite journey does not
    // race PGlite startup without the public-site warm-up that precedes it in
    // the complete release run.
    reuseExistingServer: process.env.NIMANTO_REUSE_SERVER === "true",
    timeout: 60_000,
    env: {
      NIMANTO_BOOTSTRAP_SECRET: bootstrapSecret,
      NIMANTO_DATA_DIR: path.join(tmpdir(), `nimanto-playwright-${process.pid}`),
      NIMANTO_API_PORT: String(apiPort),
      // The suite still requires each tenant to opt in explicitly. This only
      // supplies the operator ceiling needed by the one executable-action journey.
      NIMANTO_EXTERNAL_ACTIONS_ENABLED: "on",
      NIMANTO_WEB_ORIGIN: webOrigin,
      NIMANTO_WEB_PORT: String(webPort),
      ...(process.env.NIMANTO_URL_ALLOWLIST
        ? { NIMANTO_URL_ALLOWLIST: process.env.NIMANTO_URL_ALLOWLIST }
        : {}),
      ...(process.env.NIMANTO_URL_TERMS_REVIEWED_AT
        ? { NIMANTO_URL_TERMS_REVIEWED_AT: process.env.NIMANTO_URL_TERMS_REVIEWED_AT }
        : {}),
    },
  },
});

export { bootstrapSecret };
