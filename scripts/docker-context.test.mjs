import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Docker uses an allowlisted context and a source-free runtime stage", async () => {
  const [dockerignore, dockerfile] = await Promise.all([
    readFile(path.join(repository, ".dockerignore"), "utf8"),
    readFile(path.join(repository, "Dockerfile"), "utf8"),
  ]);
  assert.match(dockerignore, /^\*\*$/mu);
  assert.match(dockerignore, /^\.env\.\*$/mu);
  assert.doesNotMatch(dockerfile, /COPY\s+\.\s+\./u);
  assert.match(dockerfile, /COPY --from=build --chown=node:node \/runtime \/app/u);
  assert.match(dockerfile, /NIMANTO_EXTERNAL_ACTIONS_ENABLED=off/u);
});
