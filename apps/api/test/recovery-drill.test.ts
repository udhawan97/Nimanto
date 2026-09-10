// cspell:ignore unstub
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { recoveryTreeDigest, runRecoveryDrill } from "../src/recovery-drill.js";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("restores an isolated synthetic workspace with intact records and safe recovery state", async () => {
  const configured = await mkdtemp(join(tmpdir(), "nimanto-recovery-configured-"));
  roots.push(configured);
  await writeFile(join(configured, "sentinel"), "existing workspace stays intact");
  vi.stubEnv("NIMANTO_DATA_DIR", configured);
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("NETWORK_FORBIDDEN"));
  const report = await runRecoveryDrill();
  expect(report.status).toBe("passed");
  expect(report.checks).toEqual([
    "exclusive_database_ownership",
    "stopped_copy_byte_parity",
    "restored_export_parity",
    "restored_packet_integrity",
    "tenant_isolation",
    "runtime_approval_reset",
    "interrupted_action_quarantined",
    "pending_deletion_recovered",
    "completed_deletion_survives_restore",
  ]);
  expect(report.packetArtifacts).toBe(6);
  expect(report.limitations).toContain("pre_deletion_backup_suppression_not_implemented");
  expect(network).not.toHaveBeenCalled();
  expect(await readdir(configured)).toEqual(["sentinel"]);
  expect(await readFile(join(configured, "sentinel"), "utf8")).toBe(
    "existing workspace stays intact",
  );
}, 60_000);

it("detects changed, missing, extra files and empty directories in a stopped copy", async () => {
  const root = await mkdtemp(join(tmpdir(), "nimanto-recovery-digest-"));
  roots.push(root);
  const file = join(root, "packet.txt");
  await writeFile(file, "synthetic original");
  const original = await recoveryTreeDigest(root);
  await writeFile(file, "synthetic modified");
  expect(await recoveryTreeDigest(root)).not.toBe(original);
  await writeFile(file, "synthetic original");
  expect(await recoveryTreeDigest(root)).toBe(original);
  await mkdir(join(root, "empty"));
  expect(await recoveryTreeDigest(root)).not.toBe(original);
  await rm(join(root, "empty"), { recursive: true });
  await writeFile(join(root, "extra"), "synthetic extra");
  expect(await recoveryTreeDigest(root)).not.toBe(original);
  await rm(join(root, "extra"));
  await rm(file);
  expect(await recoveryTreeDigest(root)).not.toBe(original);
});

it("refuses links instead of including files outside the synthetic recovery tree", async () => {
  const root = await mkdtemp(join(tmpdir(), "nimanto-recovery-links-"));
  roots.push(root);
  await writeFile(join(root, "original"), "synthetic");
  await symlink(join(root, "original"), join(root, "linked"));
  await expect(recoveryTreeDigest(root)).rejects.toThrow("RECOVERY_TREE_UNSAFE");
});
