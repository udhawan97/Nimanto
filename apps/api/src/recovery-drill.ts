// cspell:ignore errcode
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { CURRENT_SCHEMA_VERSION, NimantoStore } from "@nimanto/database";
import { canonicalHash } from "@nimanto/domain";
import { DeletionCoordinator } from "./deletion-coordinator.js";
import { ExternalActionLifecycle } from "./external-action-lifecycle.js";
import { publishMatch } from "./match-publication.js";
import { PacketLifecycle, verifyPacketArtifacts } from "./packet-lifecycle.js";
import { NIMANTO_VERSION } from "./version.js";

/** Inventory only an owned, stopped synthetic tree. Never follows links. File
 * contents are streamed so copying a database does not require its size in RAM. */
export async function recoveryTreeDigest(root: string): Promise<string> {
  const entries: Array<{ name: string; kind: string; sha256?: string }> = [];
  async function visit(relative: string): Promise<void> {
    const absolute = path.join(root, relative);
    const info = await lstat(absolute);
    if (info.isDirectory()) {
      entries.push({ name: relative, kind: "directory" });
      for (const name of (await readdir(absolute)).sort()) {
        await visit(relative ? `${relative}/${name}` : name);
      }
    } else if (info.isFile() && info.nlink === 1) {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(absolute)) hash.update(chunk);
      entries.push({ name: relative, kind: "file", sha256: hash.digest("hex") });
    } else {
      throw new Error("RECOVERY_TREE_UNSAFE");
    }
  }
  await visit("");
  return canonicalHash(entries);
}

async function stableExport(store: NimantoStore, tenantId: string): Promise<unknown> {
  const { exportedAt: _exportedAt, ...records } = await store.exportTenant(tenantId);
  return records;
}

async function assertOwnership(database: string): Promise<void> {
  // A separate process is required: POSIX SQLite locks are process-owned.
  const probe = `
    import { DatabaseSync } from 'node:sqlite';
    const lock = new DatabaseSync(process.argv[1], { timeout: 250 });
    try { lock.exec('BEGIN EXCLUSIVE'); process.exitCode = 1; }
    catch (error) { if (![5, 6].includes(error.errcode)) process.exitCode = 2; }
    finally { lock.close(); }
  `;
  await promisify(execFile)(
    process.execPath,
    ["--input-type=module", "-e", probe, path.join(database, ".nimanto-lock.sqlite")],
    { timeout: 5_000, maxBuffer: 16_384 },
  );
}

/** A recovery rehearsal, not a backup/restore interface. No caller path, runtime
 * configuration, server listener, worker, or provider effect is accepted. All
 * writes and cleanup are confined to the fresh temporary root created here. */
export async function runRecoveryDrill() {
  const started = Date.now();
  const root = await mkdtemp(path.join(tmpdir(), "nimanto-recovery-drill-"));
  const live = path.join(root, "live");
  const backup = path.join(root, "backup");
  const restored = path.join(root, "restored");
  const finalRestore = path.join(root, "completed-restore");
  const stores = new Set<NimantoStore>();
  const checks: string[] = [];
  async function open(directory: string) {
    const store = await NimantoStore.open(path.join(directory, "database"));
    stores.add(store);
    return store;
  }
  async function close(store: NimantoStore) {
    await store.close();
    stores.delete(store);
  }
  const providerForbidden = async (): Promise<never> => {
    throw new Error("RECOVERY_PROVIDER_FORBIDDEN");
  };
  try {
    const source = await open(live);
    const owner = await source.createLocalTenant("recovery@example.test", "Synthetic Recovery");
    const foreign = await source.createLocalTenant("foreign@example.test", "Synthetic Other");
    const deleting = await source.createLocalTenant("erased@example.test", "Synthetic Erasure");
    const claim = await source.createEvidence(owner.tenantId, {
      kind: "skill",
      value: "TypeScript",
      status: "pending",
      confidence: "high",
      sourceName: "Synthetic recovery fixture",
      locator: "line:1",
    });
    await source.confirmEvidence(owner.tenantId, claim.id);
    const profile = await source.createProfileVersion(owner.tenantId, "Synthetic wording.");
    const job = await source.upsertJob(owner.tenantId, {
      source: "manual",
      sourceJobId: "synthetic-recovery-role",
      title: "Engineer",
      company: "Synthetic Works",
      description: "Build systems with TypeScript",
      location: "",
      workMode: "unknown",
      url: "",
      requirements: ["TypeScript"],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: canonicalHash({ fixture: "synthetic_recovery_v1" }),
    });
    const application = await source.createApplication(owner.tenantId, job.id, profile.id);
    await publishMatch(source, owner.tenantId, job.id, "manual");
    const packets = new PacketLifecycle(source, path.join(live, "artifacts"));
    const packet = await packets.create({
      tenantId: owner.tenantId,
      applicationId: application.id,
      candidateName: "Synthetic Recovery",
      evidenceIds: [claim.id],
    });
    const assurance = await packets.assure(owner.tenantId, packet.id);
    assert.equal(assurance.status, "passed");
    await packets.approve(owner.tenantId, packet.id, {
      reviewedAssuranceId: assurance.id,
      reviewedArtifactHash: packet.artifactHash,
      reviewedManifestHash: packet.manifestHash,
    });
    const actions = new ExternalActionLifecycle(
      source,
      path.join(live, "outbox"),
      providerForbidden,
      true,
    );
    const action = await actions.request({
      tenantId: owner.tenantId,
      packetId: packet.id,
      provider: "test_outbox",
      to: "jobs@example.test",
      subject: "Synthetic recovery",
      body: "Synthetic recovery fixture only",
    });
    await actions.approve(owner.tenantId, action.id);
    actions.setTenantOptIn(owner.tenantId, true);
    // Simulate the persisted boundary left by a crash, without executing anything.
    await source.transitionExternalAction(owner.tenantId, action.id, "approved", "executing");
    await source.createSourceSchedule(owner.tenantId, {
      provider: "greenhouse",
      board: "synthetic-recovery",
      cadenceMinutes: 60,
    });
    await source.createSourceSchedule(deleting.tenantId, {
      provider: "greenhouse",
      board: "synthetic-erasure",
      cadenceMinutes: 60,
    });
    const residue = path.join("artifacts", deleting.tenantId, "synthetic.txt");
    await mkdir(path.dirname(path.join(live, residue)), { recursive: true, mode: 0o700 });
    await writeFile(path.join(live, residue), "Synthetic pending cleanup", { mode: 0o600 });
    const deletion = await source.beginTenantDeletion(deleting.tenantId);
    // The backup intentionally contains an unfinished deletion and its residual file.
    await assertOwnership(path.join(live, "database"));
    checks.push("exclusive_database_ownership");
    const expected = await stableExport(source, owner.tenantId);
    await close(source);

    const digest = await recoveryTreeDigest(live);
    await cp(live, backup, { recursive: true, errorOnExist: true, force: false });
    assert.equal(await recoveryTreeDigest(backup), digest);
    await cp(backup, restored, { recursive: true, errorOnExist: true, force: false });
    assert.equal(await recoveryTreeDigest(restored), digest);
    checks.push("stopped_copy_byte_parity");

    const recovered = await open(restored);
    await assertOwnership(path.join(restored, "database"));
    assert.deepEqual(await stableExport(recovered, owner.tenantId), expected);
    checks.push("restored_export_parity");
    await verifyPacketArtifacts(
      path.join(restored, "artifacts"),
      owner.tenantId,
      packet.id,
      packet.artifactManifest,
    );
    checks.push("restored_packet_integrity");
    assert.equal(await recovered.getPacket(foreign.tenantId, packet.id), null);
    assert.deepEqual(await recovered.listEvidence(foreign.tenantId), []);
    await assert.rejects(recovered.exportTenant(deleting.tenantId), /TENANT_NOT_ACTIVE/u);
    checks.push("tenant_isolation");

    const restartedActions = new ExternalActionLifecycle(
      recovered,
      path.join(restored, "outbox"),
      providerForbidden,
      true,
    );
    assert.equal(restartedActions.capability(owner.tenantId).externalActionsEnabled, false);
    await assert.rejects(
      restartedActions.execute(owner.tenantId, action.id),
      /EXTERNAL_ACTIONS_DISABLED/u,
    );
    checks.push("runtime_approval_reset");
    assert.equal(await restartedActions.recoverInterrupted(), 1);
    assert.equal(
      (await recovered.getExternalAction(owner.tenantId, action.id))?.state,
      "ambiguous",
    );
    assert.equal(await restartedActions.recoverInterrupted(), 0);
    checks.push("interrupted_action_quarantined");
    const cleanup = new DeletionCoordinator(
      recovered,
      path.join(restored, "artifacts"),
      path.join(restored, "outbox"),
    );
    assert.deepEqual(await cleanup.recoverPending(), { recovered: 1, pending: 0 });
    await assert.rejects(lstat(path.join(restored, residue)), { code: "ENOENT" });
    assert.deepEqual(await recovered.listSourceSchedules(deleting.tenantId), []);
    assert.equal((await recovered.deletionStatus(deletion.token))?.state, "completed");
    checks.push("pending_deletion_recovered");
    const afterRecovery = await stableExport(recovered, owner.tenantId);
    await close(recovered);

    // A second stopped copy proves completion remains durable across restore.
    await cp(restored, finalRestore, { recursive: true, errorOnExist: true, force: false });
    assert.equal(await recoveryTreeDigest(finalRestore), await recoveryTreeDigest(restored));
    const final = await open(finalRestore);
    await assert.rejects(final.exportTenant(deleting.tenantId), /TENANT_NOT_ACTIVE/u);
    await assert.rejects(lstat(path.join(finalRestore, residue)), { code: "ENOENT" });
    assert.equal((await final.deletionStatus(deletion.token))?.state, "completed");
    assert.deepEqual(await final.recoverableDeletionRuns(), []);
    assert.deepEqual(await stableExport(final, owner.tenantId), afterRecovery);
    checks.push("completed_deletion_survives_restore");
    // Neither restoration may have changed the stopped source or backup.
    assert.equal(await recoveryTreeDigest(live), digest);
    assert.equal(await recoveryTreeDigest(backup), digest);
    return {
      schemaVersion: "nimanto_recovery_drill_v1",
      status: "passed" as const,
      version: NIMANTO_VERSION,
      databaseSchemaVersion: CURRENT_SCHEMA_VERSION,
      elapsedMs: Date.now() - started,
      packetArtifacts:
        packet.artifactManifest.artifacts instanceof Array
          ? packet.artifactManifest.artifacts.length
          : 0,
      checks,
      limitations: [
        "synthetic_stopped_local_copy_only",
        "pre_deletion_backup_suppression_not_implemented",
        "hosted_recovery_and_schema_downgrade_not_verified",
      ],
    };
  } finally {
    // A failed close must prevent directory removal under a possibly live owner.
    await Promise.all([...stores].map((store) => store.close()));
    await rm(root, { recursive: true, force: true });
  }
}
