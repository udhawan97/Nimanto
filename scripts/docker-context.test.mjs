// cspell:words mktemp
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

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

test("Docker production reshaping succeeds without a terminal or inherited CI", async () => {
  const dockerfile = await readFile(path.join(repository, "Dockerfile"), "utf8");
  const command = /^RUN (.*pnpm install --prod --frozen-lockfile --offline)$/mu.exec(
    dockerfile,
  )?.[1];
  assert.ok(command, "the Dockerfile must declare its production dependency install");
  const scratch = await mkdtemp(path.join(tmpdir(), "nimanto-docker-install-"));
  // Explicit false also neutralizes GitHub Actions' other CI detection flags.
  const environment = { ...process.env, CI: "false" };
  const run = promisify(execFile);
  try {
    await writeFile(
      path.join(scratch, "package.json"),
      JSON.stringify({
        name: "synthetic-container",
        private: true,
        dependencies: { "runtime-tool": "file:fixtures/runtime-tool" },
        devDependencies: { "build-tool": "file:fixtures/build-tool" },
      }),
    );
    await writeFile(path.join(scratch, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    for (const name of ["runtime-tool", "build-tool"]) {
      const directory = path.join(scratch, "fixtures", name);
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({ name, version: "1.0.0" }),
      );
    }
    await mkdir(path.join(scratch, "packages", "app"), { recursive: true });
    await writeFile(
      path.join(scratch, "packages", "app", "package.json"),
      JSON.stringify({
        name: "synthetic-app",
        private: true,
        dependencies: { "runtime-tool": "file:../../fixtures/runtime-tool" },
        devDependencies: { "build-tool": "file:../../fixtures/build-tool" },
      }),
    );
    const settings = { cwd: scratch, env: environment, timeout: 30_000 };
    await run("pnpm", ["install", "--offline", "--ignore-scripts"], settings);
    await run("sh", ["-c", command], settings);
    const installed = await readFile(
      path.join(scratch, "node_modules", "runtime-tool", "package.json"),
      "utf8",
    );
    assert.equal(JSON.parse(installed).name, "runtime-tool");
    await assert.rejects(
      readFile(path.join(scratch, "node_modules", "build-tool", "package.json")),
      { code: "ENOENT" },
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

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
  const [runner, supervisor, ...commands] = JSON.parse(`[${cmd}]`);
  assert.equal(runner, "node");
  assert.equal(supervisor, "node_modules/concurrently/dist/bin/index.js");
  const root = await readJson("package.json");

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

  requireProductionDependency(root, "root", "concurrently");
  requireProductionDependency(await readJson("apps/web/package.json"), "web", "serve");
  assert.ok(commands.includes("--kill-others"));
  assert.ok(commands.includes("node apps/api/dist/main.js"));
  assert.ok(commands.includes("node apps/worker/dist/main.js"));
  assert.ok(
    commands.includes(
      "node apps/web/node_modules/serve/build/main.js apps/web/out -l ${NIMANTO_WEB_PORT:-4300} --no-clipboard",
    ),
  );
  assert.match(dockerfile, /^ENV NO_UPDATE_CHECK=1$/mu);

  // The static checks above cannot see inside the image; CI proves the claim at runtime.
  assert.match(
    ci,
    /test ! -d \/app\/node_modules\/vitest && test ! -d \/app\/node_modules\/@playwright/u,
  );
  assert.match(ci, /curl --fail --silent --show-error http:\/\/127\.0\.0\.1:4310\/health/u);
});

test("the runtime CMD starts without a package manager and stops peers when a service fails", async () => {
  const dockerfile = await readFile(path.join(repository, "Dockerfile"), "utf8");
  const command = JSON.parse(/^CMD (\[.*\])$/mu.exec(dockerfile)[1]);
  const scratch = await mkdtemp(path.join(tmpdir(), "nimanto-runtime-start-"));
  try {
    await mkdir(path.join(scratch, "node_modules"));
    await symlink(
      path.join(repository, "node_modules/concurrently"),
      path.join(scratch, "node_modules/concurrently"),
      "dir",
    );
    const bin = path.join(scratch, "bin");
    await mkdir(bin);
    for (const name of ["pnpm", "corepack"]) {
      await writeFile(
        path.join(bin, name),
        '#!/bin/sh\necho "unexpected-package-manager" >&2\nexit 99\n',
        { mode: 0o755 },
      );
    }
    for (const [name, file] of [
      ["api", "apps/api/dist/main.js"],
      ["worker", "apps/worker/dist/main.js"],
      ["web", "apps/web/node_modules/serve/build/main.js"],
    ]) {
      await mkdir(path.dirname(path.join(scratch, file)), { recursive: true });
      await writeFile(
        path.join(scratch, file),
        `console.log('${name}-started');\nprocess.on('SIGTERM',()=>{console.log('${name}-stopped');process.exit(0)});\n${name === "api" ? "setTimeout(()=>process.exit(1),1000);" : "setInterval(()=>{},1000);"}\n`,
      );
    }
    await chmod(scratch, 0o555);
    const result = await promisify(execFile)(command[0], command.slice(1), {
      cwd: scratch,
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        pnpm_config_verify_deps_before_run: "install",
      },
      timeout: 10000,
    }).then(
      (value) => ({ ...value, code: 0 }),
      (error) => error,
    );
    assert.equal(result.code, 1, result.stderr || result.stdout);
    for (const name of ["api", "worker", "web"])
      assert.match(result.stdout, new RegExp(`${name}-started`, "u"));
    for (const name of ["worker", "web"])
      assert.match(result.stdout, new RegExp(`${name}-stopped`, "u"));
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /unexpected-package-manager/u);
  } finally {
    await chmod(scratch, 0o755);
    await rm(scratch, { recursive: true, force: true });
  }
});
