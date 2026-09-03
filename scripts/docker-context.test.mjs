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

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(repository, relativePath), "utf8"));

test("the runtime image installs production dependencies only and can still run its CMD", async () => {
  const [dockerfile, ci] = await Promise.all([
    readFile(path.join(repository, "Dockerfile"), "utf8"),
    readFile(path.join(repository, ".github/workflows/ci.yml"), "utf8"),
  ]);
  const productionInstall = dockerfile.indexOf("pnpm install --prod --frozen-lockfile --offline");
  const runtimeCopy = dockerfile.indexOf("cp -a node_modules /runtime/node_modules");
  assert.notEqual(
    productionInstall,
    -1,
    "the Dockerfile must reshape node_modules with `pnpm install --prod --frozen-lockfile --offline`",
  );
  assert.doesNotMatch(
    dockerfile,
    /pnpm prune/u,
    "`pnpm prune --prod` is not lockfile-frozen; use `pnpm install --prod --frozen-lockfile --offline`",
  );
  assert.ok(
    productionInstall < runtimeCopy,
    "the production install must run before node_modules is copied into /runtime",
  );

  // Everything the container's CMD reaches must survive a production-only install.
  const cmd = /^CMD \[(?<arguments>[^\]]+)\]$/mu.exec(dockerfile)?.groups?.arguments;
  assert.ok(cmd, "the Dockerfile must declare a JSON-form CMD");
  const [runner, rootScript] = JSON.parse(`[${cmd}]`);
  assert.equal(runner, "pnpm");

  const root = await readJson("package.json");
  const rootCommand = root.scripts[rootScript];
  assert.ok(rootCommand, `root package.json must define the ${rootScript} script`);

  const requireProductionDependency = (manifest, name, binary) => {
    assert.ok(
      Object.hasOwn(manifest.dependencies ?? {}, binary),
      `${manifest.name}: \`${binary}\` runs in the container but is not a production dependency`,
    );
    assert.ok(
      !Object.hasOwn(manifest.devDependencies ?? {}, binary),
      `${manifest.name}: \`${binary}\` must not also be a devDependency`,
    );
    assert.ok(name);
  };

  requireProductionDependency(root, "root", rootCommand.trim().split(/\s+/u)[0]);

  // The static checks above cannot see inside the image; CI proves the claim at runtime.
  assert.match(
    ci,
    /test ! -d \/app\/node_modules\/vitest && test ! -d \/app\/node_modules\/@playwright/u,
  );
  assert.match(ci, /curl --fail --silent --show-error http:\/\/127\.0\.0\.1:4310\/health/u);

  const children = [
    ...rootCommand.matchAll(/--filter (?<workspace>@nimanto\/[a-z]+) (?<script>\w+)/gu),
  ];
  assert.equal(children.length, 3, "start:all must run the api, worker, and web start scripts");
  for (const child of children) {
    const { workspace, script } = child.groups;
    const directory = workspace.replace("@nimanto/", "apps/");
    const manifest = await readJson(path.join(directory, "package.json"));
    const command = manifest.scripts[script];
    assert.ok(command, `${workspace} must define the ${script} script`);
    const binary = command.trim().split(/\s+/u)[0];
    if (binary === "node") {
      continue;
    }
    requireProductionDependency(manifest, workspace, binary);
  }
});
