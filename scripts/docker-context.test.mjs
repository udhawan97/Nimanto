// cspell:words mktemp
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Docker uses an allowlisted context and a source-free runtime stage", async () => {
  const [dockerignore, dockerfile, ci] = await Promise.all([
    readFile(path.join(repository, ".dockerignore"), "utf8"),
    readFile(path.join(repository, "Dockerfile"), "utf8"),
    readFile(path.join(repository, ".github/workflows/ci.yml"), "utf8"),
  ]);
  assert.match(dockerignore, /^\*\*$/mu);
  assert.match(dockerignore, /^!tokens\.css$/mu);
  assert.match(dockerignore, /^\.env\.\*$/mu);
  assert.doesNotMatch(dockerfile, /COPY\s+\.\s+\./u);
  assert.match(dockerfile, /^COPY tokens\.css tokens\.css$/mu);
  assert.match(dockerfile, /COPY --from=build --chown=node:node \/runtime \/app/u);
  assert.match(dockerfile, /NIMANTO_EXTERNAL_ACTIONS_ENABLED=off/u);
  assert.match(ci, /mktemp -d/u);
  assert.match(ci, /trap cleanup EXIT/u);
  assert.match(ci, /docker export --output "\$canary_dir\/final-filesystem\.tar"/u);
  assert.match(ci, /grep -a -q -F "\$canary_value" "\$canary_dir\/final-filesystem\.tar"/u);
  assert.match(ci, /docker save --output "\$canary_dir\/saved-image\.tar"/u);
  assert.match(ci, /grep -a -q -F "\$canary_value" "\$canary_dir\/saved-image\.tar"/u);
  assert.match(ci, /grep -R -a -q -F "\$canary_value" "\$canary_dir\/saved-image"/u);
  assert.match(
    ci,
    /tar -xOf "\$archive_member" > "\$canary_dir\/saved-layers\/\$layer_index\.contents"/u,
  );
  assert.match(ci, /test "\$layer_index" -gt 0/u);
  assert.match(ci, /grep -R -a -q -F "\$canary_value" "\$canary_dir\/saved-layers"/u);
  assert.match(ci, /docker history --no-trunc[^\n]+\| grep -F "\$canary_value"/u);
});
