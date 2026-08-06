import { readFileSync } from "node:fs";
import path from "node:path";
import { nextDelay, runCycle, type WorkerSource } from "./worker.js";

const apiOrigin = process.env.NIMANTO_API_ORIGIN ?? "http://127.0.0.1:4310";
const provider = process.env.NIMANTO_SOURCE_PROVIDER;
const board = process.env.NIMANTO_SOURCE_BOARD;
const source: WorkerSource | undefined =
  board && (provider === "greenhouse" || provider === "lever" || provider === "ashby")
    ? { provider, board }
    : undefined;
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
      ...(source ? { source, ...(secret ? { bootstrapSecret: secret } : {}) } : {}),
    });
    console.log(`Nimanto worker ${result.status}; imported ${result.imported}.`);
    attempt = 0;
  } catch (error) {
    attempt += 1;
    console.error(error instanceof Error ? error.message : "WORKER_ERROR");
  }
  setTimeout(cycle, nextDelay(attempt)).unref();
};

await cycle();
