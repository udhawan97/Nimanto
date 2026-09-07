import { fork, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile, stat, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { NimantoStore } from "../src/store.js";

const roots: string[] = [];
const stores: NimantoStore[] = [];
const children: ChildProcess[] = [];
afterEach(async () => {
  await Promise.all(
    children.splice(0).map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.kill("SIGKILL");
      await exited;
    }),
  );
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function directory() {
  const root = await mkdtemp(join(tmpdir(), "nimanto-process-lock-"));
  roots.push(root);
  const data = join(root, "data");
  await mkdir(data);
  return { root, data };
}
function message(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    const received = (value: unknown) => {
      cleanup();
      resolve(String(value));
    };
    const exited = (code: number | null) => {
      cleanup();
      reject(new Error(`Child exited: ${code}`));
    };
    const cleanup = () => {
      child.off("message", received);
      child.off("exit", exited);
    };
    child.once("message", received);
    child.once("exit", exited);
  });
}
async function contender(
  root: string,
  data: string,
  pause: "creation" | "recovery" | "none" = "none",
) {
  const script = join(root, "contender.mts");
  await writeFile(
    script,
    `
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    if (process.argv[3] === "creation") {
      const open = fs.openSync;
      fs.openSync = function(file, ...args) {
        const descriptor = open.call(this, file, ...args);
        if (String(file).endsWith(".nimanto-lock.sqlite")) {
          process.send("created");
          fs.readSync(0, Buffer.alloc(1), 0, 1, null);
        }
        return descriptor;
      };
      syncBuiltinESMExports();
    }
    if (process.argv[3] === "recovery") {
      const read = fs.readFileSync;
      fs.readFileSync = function(file, ...args) {
        const value = read.call(this, file, ...args);
        if (String(file).endsWith(".nimanto-lock")) {
          process.send("observed");
          fs.readSync(0, Buffer.alloc(1), 0, 1, null);
        }
        return value;
      };
      syncBuiltinESMExports();
    }
    import { NimantoStore } from ${JSON.stringify(new URL("../src/store.ts", import.meta.url).href)};
    process.once("message", async () => {
      try {
        const store = await NimantoStore.open(process.argv[2]);
        process.send("opened");
        process.on("message", async () => { await store.close(); process.send("closed"); });
      } catch (error) { process.send(String(error)); }
    });
    process.send("ready");
  `,
  );
  const workerRequire = createRequire(
    new URL("../../../apps/worker/package.json", import.meta.url),
  );
  const child = fork(script, [data, pause], {
    execArgv: ["--import", workerRequire.resolve("tsx"), "--conditions=development"],
    stdio: ["pipe", "ignore", "pipe", "ipc"],
  });
  children.push(child);
  expect(await message(child)).toBe("ready");
  return child;
}
async function openChild(child: ChildProcess) {
  const result = message(child);
  child.send("open");
  return result;
}

it("does not reclaim an incompletely published legacy lock", async () => {
  const { data } = await directory();
  await writeFile(join(data, ".nimanto-lock"), "");
  await expect(NimantoStore.open(data)).rejects.toThrow("DATA_DIRECTORY_IN_USE");
});

it("admits one owner when another process pauses after exclusive file creation", async () => {
  const { root, data } = await directory();
  const paused = await contender(root, data, "creation");
  expect(await openChild(paused)).toBe("created");
  const winner = await NimantoStore.open(data);
  stores.push(winner);
  const outcome = message(paused);
  paused.stdin!.write("x");
  expect(await outcome).toContain("DATA_DIRECTORY_IN_USE");
  expect((await stat(join(data, ".nimanto-lock.sqlite"))).mode & 0o777).toBe(0o600);
}, 20_000);

it("repeated close cannot release a successor's ownership", async () => {
  const { data } = await directory();
  const first = await NimantoStore.open(data);
  await Promise.all([first.close(), first.close()]);
  const successor = await NimantoStore.open(data);
  stores.push(successor);
  await first.close();
  await expect(NimantoStore.open(data)).rejects.toThrow("DATA_DIRECTORY_IN_USE");
});

it("serializes stale-marker observation before a successor can be claimed", async () => {
  const { root, data } = await directory();
  await writeFile(join(data, ".nimanto-lock"), JSON.stringify({ pid: 2 ** 31 - 1, bootEpoch: 1 }));
  const paused = await contender(root, data, "recovery");
  expect(await openChild(paused)).toBe("observed");
  expect(await openChild(await contender(root, data))).toContain("DATA_DIRECTORY_IN_USE");
  const outcome = message(paused);
  paused.stdin!.write("x");
  expect(await outcome).toBe("opened");
  await expect(NimantoStore.open(data)).rejects.toThrow("DATA_DIRECTORY_IN_USE");
}, 20_000);

it("admits one independent process during startup and concurrent crash recovery", async () => {
  const { root, data } = await directory();
  for (let round = 0; round < 2; round += 1) {
    const contenders = [await contender(root, data), await contender(root, data)];
    const outcomes = await Promise.all(contenders.map(openChild));
    expect(
      outcomes.filter((outcome) => outcome === "opened"),
      JSON.stringify(outcomes),
    ).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.includes("DATA_DIRECTORY_IN_USE"))).toHaveLength(1);
    const winner = contenders[outcomes.indexOf("opened")]!;
    const exited = new Promise<void>((resolve) => winner.once("exit", () => resolve()));
    winner.kill("SIGKILL");
    await exited;
  }
  const recovered = await NimantoStore.open(data);
  stores.push(recovered);
  expect(await recovered.createLocalTenant("recovered@example.test", "Recovered")).toBeTruthy();
}, 30_000);

it("same-process rejected contenders cannot unlock an owner for another process", async () => {
  const { root, data } = await directory();
  const owner = await NimantoStore.open(data);
  stores.push(owner);
  for (let index = 0; index < 3; index += 1) {
    await expect(NimantoStore.open(data)).rejects.toThrow("DATA_DIRECTORY_IN_USE");
  }
  expect(await openChild(await contender(root, data))).toContain("DATA_DIRECTORY_IN_USE");
}, 20_000);

it("refuses a symbolic-link lock sidecar", async () => {
  const { root, data } = await directory();
  const target = join(root, "unrelated");
  await writeFile(target, "");
  await symlink(target, join(data, ".nimanto-lock.sqlite"));
  await expect(NimantoStore.open(data)).rejects.toThrow("DATA_DIRECTORY_LOCK_UNSAFE");
});

it("retains a replacement marker when the original owner closes", async () => {
  const { data } = await directory();
  const owner = await NimantoStore.open(data);
  stores.push(owner);
  const replacement = JSON.stringify({ pid: process.pid, bootEpoch: 1, token: "replacement" });
  await writeFile(join(data, ".nimanto-lock"), replacement);
  await owner.close();
  expect(await readFile(join(data, ".nimanto-lock"), "utf8")).toBe(replacement);
  expect((await stat(join(data, ".nimanto-lock.sqlite"))).isFile()).toBe(true);
});
