import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CodeQL init and analyze use the same immutable action revision", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/codeql.yml", import.meta.url),
    "utf8",
  );
  const actions = [...workflow.matchAll(/uses: github\/codeql-action\/(init|analyze)@([^\s]+)/g)];
  assert.deepEqual(actions.map((action) => action[1]).sort(), ["analyze", "init"]);
  assert.match(actions[0][2], /^[a-f0-9]{40}$/);
  assert.equal(actions[0][2], actions[1][2], "CodeQL steps cannot mix action versions");
});
