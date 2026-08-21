import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NimantoStore } from "@nimanto/database";
import type { ActionResult } from "@nimanto/providers";
import { DeletionCoordinator } from "../src/deletion-coordinator.js";
import { ExternalActionLifecycle } from "../src/external-action-lifecycle.js";

const stores: NimantoStore[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

async function approvedActionFixture(label: string) {
  const root = await mkdtemp(join(tmpdir(), `nimanto-action-${label}-`));
  const dataDirectory = join(root, "data");
  const artifactDirectory = join(root, "artifacts");
  const outboxDirectory = join(root, "outbox");
  const store = await NimantoStore.open(dataDirectory);
  stores.push(store);
  const identity = await store.createLocalTenant(`${label}@example.test`, label);
  const job = await store.upsertJob(identity.tenantId, {
    source: "manual",
    sourceJobId: `${label}-job`,
    title: "Engineer",
    company: "Synthetic Works",
    description: "Build systems",
    location: "",
    workMode: "unspecified",
    url: "",
    requirements: [],
    capability: "deep_link",
    sourceMeta: {},
    contentHash: `${label}-job-content`,
  });
  const application = await store.createApplication(identity.tenantId, job.id, null);
  const packet = await store.createPacket(identity.tenantId, {
    applicationId: application.id,
    profileVersionId: null,
    canonicalContent: { claims: [] },
    artifactManifest: {},
  });
  const assurance = await store.saveAssurance(identity.tenantId, packet.id, {
    status: "passed",
    ruleVersion: "application_assurance_v1",
    findings: [],
  });
  await store.approvePacketExact(
    identity.tenantId,
    packet.id,
    assurance.id,
    packet.artifactHash,
    packet.manifestHash,
  );
  const action = await store.createExternalAction(identity.tenantId, {
    packetId: packet.id,
    provider: "test_outbox",
    target: { to: "jobs@example.test" },
    payload: { subject: "Application", body: "Reviewed packet" },
    idempotencyKey: `${label}-action`,
  });
  await store.approveExternalActionExact(identity.tenantId, action.id);
  return { store, identity, application, packet, action, artifactDirectory, outboxDirectory };
}

describe("external action lifecycle", () => {
  it("rejects an approved packet after a newer packet replaces it", async () => {
    const { store, identity, application, packet, outboxDirectory } =
      await approvedActionFixture("retired-packet");
    await store.createPacket(identity.tenantId, {
      applicationId: application.id,
      profileVersionId: null,
      canonicalContent: { claims: ["newer"] },
      artifactManifest: {},
    });
    const lifecycle = new ExternalActionLifecycle(store, outboxDirectory);
    await expect(
      lifecycle.request({
        tenantId: identity.tenantId,
        packetId: packet.id,
        provider: "test_outbox",
        to: "jobs@example.test",
        subject: "Stale packet",
        body: "Must not be accepted.",
      }),
    ).rejects.toThrow("LATEST_APPROVED_PACKET_REQUIRED");
  });

  it("uses generation order when packet timestamps tie", async () => {
    const { store, identity, application, outboxDirectory } =
      await approvedActionFixture("tied-packets");
    const { older, newer } = await store.transaction(async (database) => {
      const older = await database.createPacket(identity.tenantId, {
        id: "zzzz-tied-older",
        applicationId: application.id,
        profileVersionId: null,
        canonicalContent: { claims: ["older"] },
        artifactManifest: {},
      });
      const assurance = await database.saveAssurance(identity.tenantId, older.id, {
        status: "passed",
        ruleVersion: "application_assurance_v1",
        findings: [],
      });
      await database.approvePacketExact(
        identity.tenantId,
        older.id,
        assurance.id,
        older.artifactHash,
        older.manifestHash,
      );
      const newer = await database.createPacket(identity.tenantId, {
        id: "aaaa-tied-newer",
        applicationId: application.id,
        profileVersionId: null,
        canonicalContent: { claims: ["newer"] },
        artifactManifest: {},
      });
      return { older, newer };
    });
    expect(older.createdAt).toBe(newer.createdAt);
    await expect(
      store.getLatestPacketForApplication(identity.tenantId, application.id),
    ).resolves.toMatchObject({ id: newer.id });

    const lifecycle = new ExternalActionLifecycle(store, outboxDirectory);
    await expect(
      lifecycle.request({
        tenantId: identity.tenantId,
        packetId: older.id,
        provider: "test_outbox",
        to: "jobs@example.test",
        subject: "Tied timestamp",
        body: "The older packet must stay historical.",
      }),
    ).rejects.toThrow("LATEST_APPROVED_PACKET_REQUIRED");
  });

  it("rejects approval when a newer packet replaces the action packet", async () => {
    const { store, identity, application, packet, outboxDirectory } =
      await approvedActionFixture("retired-before-approval");
    const pending = await store.createExternalAction(identity.tenantId, {
      packetId: packet.id,
      provider: "test_outbox",
      target: { to: "pending@example.test" },
      payload: { subject: "Pending action", body: "Must remain pending." },
      idempotencyKey: "retired-before-approval-pending",
    });
    await store.createPacket(identity.tenantId, {
      applicationId: application.id,
      profileVersionId: null,
      canonicalContent: { claims: ["newer"] },
      artifactManifest: {},
    });

    const lifecycle = new ExternalActionLifecycle(store, outboxDirectory);
    await expect(lifecycle.approve(identity.tenantId, pending.id)).rejects.toThrow(
      "LATEST_APPROVED_PACKET_REQUIRED",
    );
    await expect(store.getExternalAction(identity.tenantId, pending.id)).resolves.toMatchObject({
      state: "pending_approval",
      approvedAt: null,
    });
  });

  it("rejects execution without an outbox effect when a newer packet appears", async () => {
    const { store, identity, application, action, outboxDirectory } = await approvedActionFixture(
      "retired-before-execution",
    );
    await store.createPacket(identity.tenantId, {
      applicationId: application.id,
      profileVersionId: null,
      canonicalContent: { claims: ["newer"] },
      artifactManifest: {},
    });
    let providerCalls = 0;
    const lifecycle = new ExternalActionLifecycle(store, outboxDirectory, async () => {
      providerCalls += 1;
      throw new Error("PROVIDER_MUST_NOT_RUN");
    });
    lifecycle.setRuntime(true);

    await expect(lifecycle.execute(identity.tenantId, action.id)).rejects.toThrow(
      "ACTION_APPROVAL_STALE",
    );
    expect(providerCalls).toBe(0);
    await expect(store.getExternalAction(identity.tenantId, action.id)).resolves.toMatchObject({
      state: "approved",
    });
    await expect(access(join(outboxDirectory, `${action.id}.json`))).rejects.toThrow();
  });

  it("persists a stale failure when a newer packet appears before the provider lock", async () => {
    const { store, identity, application, action, outboxDirectory } = await approvedActionFixture(
      "packet-execution-interleave",
    );
    let providerCalls = 0;
    const lifecycle = new ExternalActionLifecycle(store, outboxDirectory, async () => {
      providerCalls += 1;
      throw new Error("PROVIDER_MUST_NOT_RUN");
    });
    const originalTransaction = store.transaction.bind(store);
    let lifecycleTransactions = 0;
    store.transaction = async <T>(work: (database: NimantoStore) => Promise<T>): Promise<T> => {
      const result = await originalTransaction(work);
      lifecycleTransactions += 1;
      if (lifecycleTransactions === 1) {
        await originalTransaction(async (database) => {
          await database.createPacket(identity.tenantId, {
            applicationId: application.id,
            profileVersionId: null,
            canonicalContent: { claims: ["interleaved newer packet"] },
            artifactManifest: {},
          });
        });
      }
      return result;
    };
    lifecycle.setRuntime(true);

    await expect(lifecycle.execute(identity.tenantId, action.id)).rejects.toThrow(
      "ACTION_APPROVAL_STALE",
    );
    expect(providerCalls).toBe(0);
    await expect(store.getExternalAction(identity.tenantId, action.id)).resolves.toMatchObject({
      state: "failed",
      result: { errorCode: "ACTION_APPROVAL_STALE" },
    });
    await expect(access(join(outboxDirectory, `${action.id}.json`))).rejects.toThrow();
  });

  it("holds deletion behind the provider effect and leaves no post-cleanup outbox file", async () => {
    const { store, identity, action, artifactDirectory, outboxDirectory } =
      await approvedActionFixture("action-race");

    let releaseEffect!: () => void;
    let reportEffectStarted!: () => void;
    const effectMayFinish = new Promise<void>((resolve) => {
      releaseEffect = resolve;
    });
    const effectStarted = new Promise<void>((resolve) => {
      reportEffectStarted = resolve;
    });
    const executor = async (): Promise<ActionResult> => {
      reportEffectStarted();
      await effectMayFinish;
      const providerReference = join(outboxDirectory, `${action.id}.json`);
      await mkdir(outboxDirectory, { recursive: true });
      await writeFile(providerReference, "synthetic outbox effect", { flag: "wx" });
      return { provider: "test_outbox", status: "sent", providerReference };
    };
    const lifecycle = new ExternalActionLifecycle(store, outboxDirectory, executor);
    lifecycle.setRuntime(true);
    const executionPromise = lifecycle.execute(identity.tenantId, action.id);
    await effectStarted;

    let deletionSettled = false;
    const deletionPromise = new DeletionCoordinator(store, artifactDirectory, outboxDirectory)
      .start(identity.tenantId)
      .then((result) => {
        deletionSettled = true;
        return result;
      });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(deletionSettled).toBe(false);

    releaseEffect();
    await expect(executionPromise).resolves.toMatchObject({ state: "succeeded" });
    await expect(deletionPromise).resolves.toMatchObject({ pending: false });
    await expect(access(join(outboxDirectory, `${action.id}.json`))).rejects.toThrow();
  });

  it("recovers an interrupted executing action as ambiguous without retrying it", async () => {
    const { store, identity, action, outboxDirectory } =
      await approvedActionFixture("action-restart");
    await expect(
      store.transitionExternalAction(identity.tenantId, action.id, "approved", "executing"),
    ).resolves.toMatchObject({ state: "executing" });
    const lifecycle = new ExternalActionLifecycle(store, outboxDirectory);
    await expect(lifecycle.recoverInterrupted()).resolves.toBe(1);
    await expect(store.getExternalAction(identity.tenantId, action.id)).resolves.toMatchObject({
      state: "ambiguous",
      result: { errorCode: "EXECUTION_INTERRUPTED" },
    });
    await expect(access(join(outboxDirectory, `${action.id}.json`))).rejects.toThrow();
  });
});
