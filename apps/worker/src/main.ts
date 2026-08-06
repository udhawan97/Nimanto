import { readFileSync } from "node:fs";
import path from "node:path";
import { nextDelay, runCycle } from "./worker.js";

const apiOrigin = process.env.NIMANTO_API_ORIGIN ?? "http://127.0.0.1:4310";
let attempt = 0;

function bootstrapSecret(): string | undefined {
  if (process.env.NIMANTO_BOOTSTRAP_SECRET) return process.env.NIMANTO_BOOTSTRAP_SECRET;
  const root = path.resolve(
    process.env.NIMANTO_DATA_DIR ?? path.join(import.meta.dirname, "../../..", ".nimanto-data"),
  );
  try {
    return readFileSync(path.join(root, "launch-secret"), "utf8").trim();
  } catch {
    return undefined;
  }
}

const cycle = async () => {
  try {
    const secret = bootstrapSecret();
    const result = await runCycle({
      apiOrigin,
      ...(secret ? { bootstrapSecret: secret } : {}),
    });
    console.log(
      `Nimanto worker processed ${result.processed}; failed ${result.failed}; imported ${result.imported}; matched ${result.matched}.`,
    );
    attempt = 0;
  } catch (error) {
    attempt += 1;
    console.error(error instanceof Error ? error.message : "WORKER_ERROR");
  }
  setTimeout(cycle, nextDelay(attempt));
};

await cycle();
