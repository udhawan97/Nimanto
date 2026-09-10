import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

test("the recovery command rejects a supplied workspace path before starting a drill", async () => {
  await assert.rejects(
    promisify(execFile)(process.execPath, [
      fileURLToPath(new URL("./recovery-drill.mjs", import.meta.url)),
      "/not-a-recovery-destination",
    ]),
    (error) => {
      assert.equal(error.code, 2);
      assert.equal(error.stdout, "");
      assert.match(error.stderr, /no arguments; synthetic data only/u);
      return true;
    },
  );
});
