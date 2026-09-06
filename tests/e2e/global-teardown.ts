import { rm } from "node:fs/promises";
import { playwrightDataDir } from "../../playwright.config.js";

/** Remove the disposable service's data directory after the suite. It deletes
 * only the exact path the config computed for this run — never
 * process.env.NIMANTO_DATA_DIR, which a contributor may have pointed at a real
 * workspace. */
export default async function globalTeardown(): Promise<void> {
  await rm(playwrightDataDir, { recursive: true, force: true });
}
