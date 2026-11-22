import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { verifiedArtifactBytes } from "../src/packet-lifecycle.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("keeps artifact reads inside the exact tenant and packet directories", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nimanto-artifact-boundary-"));
  roots.push(root);
  const directory = path.join(root, "artifacts");
  const tenant = randomUUID();
  const packet = randomUUID();
  const bytes = Buffer.from("Disposable synthetic packet");
  const artifact = {
    filename: "packet.txt",
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  await mkdir(path.join(directory, tenant, packet), { recursive: true });
  await writeFile(path.join(directory, tenant, packet, artifact.filename), bytes);
  await mkdir(path.join(root, packet));
  await writeFile(path.join(root, packet, artifact.filename), bytes);
  await expect(verifiedArtifactBytes(directory, tenant, packet, artifact)).resolves.toEqual(bytes);
  await expect(verifiedArtifactBytes(directory, "..", packet, artifact)).rejects.toThrow(
    "ARTIFACT_INTEGRITY_FAILED",
  );
  await expect(
    verifiedArtifactBytes(directory, tenant, `../../${packet}`, artifact),
  ).rejects.toThrow("ARTIFACT_INTEGRITY_FAILED");
});
