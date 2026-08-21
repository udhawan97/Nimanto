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
