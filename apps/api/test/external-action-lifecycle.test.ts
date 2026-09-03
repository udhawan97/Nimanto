import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { NimantoStore } from "@nimanto/database";
import { matchJob } from "@nimanto/domain";
import type { ActionResult } from "@nimanto/providers";
import { DeletionCoordinator } from "../src/deletion-coordinator.js";
import { ExternalActionLifecycle } from "../src/external-action-lifecycle.js";

const stores: NimantoStore[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
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
  const profile = await store.createProfileVersion(identity.tenantId, "");
  const match = await store.saveMatch(
    identity.tenantId,
    job.id,
    profile.id,
    matchJob({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      },
      evidence: [],
    }),
  );
  const application = await store.createApplication(identity.tenantId, job.id, profile.id);
  const packet = await store.createPacket(identity.tenantId, {
    applicationId: application.id,
    profileVersionId: profile.id,
    canonicalContent: {
      schemaVersion: "packet_v2",
      composition: {
        profileVersionId: profile.id,
        matchRunId: match.id,
        matchInputHash: match.inputHash,
        matchArtifactHash: match.artifactHash,
        jobContentHash: job.contentHash,
        evidenceIds: [],
      },
      claims: [],
    },
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
  it("keeps readiness tenant-scoped in memory and resets it for a new lifecycle", async () => {
    const { store, identity, action, artifactDirectory, outboxDirectory } =
      await approvedActionFixture("tenant-runtime");
    const other = await store.createLocalTenant("other-runtime@example.test", "Other Runtime");
    const lifecycle = new ExternalActionLifecycle(store, outboxDirectory, undefined, true);

    expect(lifecycle.capability(identity.tenantId)).toMatchObject({
      tenantReady: false,
      externalActionsEnabled: false,
    });
    lifecycle.setTenantOptIn(other.tenantId, true);
    expect(lifecycle.capability(other.tenantId).externalActionsEnabled).toBe(true);
    expect(lifecycle.capability(identity.tenantId).externalActionsEnabled).toBe(false);
    await expect(lifecycle.execute(other.tenantId, action.id)).rejects.toThrow("ACTION_NOT_FOUND");

    lifecycle.setTenantOptIn(identity.tenantId, true);
    const restarted = new ExternalActionLifecycle(store, outboxDirectory, undefined, true);
    expect(restarted.capability(identity.tenantId).externalActionsEnabled).toBe(false);
    expect(restarted.capability(other.tenantId).externalActionsEnabled).toBe(false);

    const coordinator = new DeletionCoordinator(
      store,
      artifactDirectory,
      outboxDirectory,
      undefined,
      (tenantId) => lifecycle.clearTenantReadiness(tenantId),
    );
    await expect(coordinator.start(identity.tenantId)).resolves.toMatchObject({ pending: false });
    expect(lifecycle.capability(identity.tenantId).externalActionsEnabled).toBe(false);
    expect(lifecycle.capability(other.tenantId).externalActionsEnabled).toBe(true);
  });

  it("recovers pending deletion cleanup through the internal operator path", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-deletion-recovery-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("cleanup@example.test", "Cleanup");
    let failOnce = true;
    const coordinator = new DeletionCoordinator(
      store,
      join(root, "artifacts"),
      join(root, "outbox"),
      async (target, options) => {
        if (failOnce) {
          failOnce = false;
          throw new Error("synthetic cleanup failure");
        }
        await rm(target, options);
      },
    );
    const started = await coordinator.start(identity.tenantId);
    expect(started.pending).toBe(true);

    await expect(coordinator.recoverPending()).resolves.toEqual({ recovered: 1, pending: 0 });
    await expect(store.deletionStatus(started.run.token)).resolves.toMatchObject({
      state: "completed",
    });
  });

  it("recovers a crash-left running deletion without a candidate bearer", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-running-deletion-recovery-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("running-cleanup@example.test", "Cleanup");
    const run = await store.beginTenantDeletion(identity.tenantId);
    expect(run.state).toBe("running");

    const coordinator = new DeletionCoordinator(
      store,
      join(root, "artifacts"),
      join(root, "outbox"),
    );
    await expect(coordinator.recoverPending()).resolves.toEqual({ recovered: 1, pending: 0 });
    await expect(store.deletionStatus(run.token)).resolves.toMatchObject({ state: "completed" });
  });

  it("recovers expired incomplete cleanup before pruning terminal tombstones", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-expired-deletion-reconciliation-"));
    const data = join(root, "data");
    const initial = await NimantoStore.open(data);
    const completedIdentity = await initial.createLocalTenant(
      "expired-completed@example.test",
      "Completed",
    );
    const completed = await initial.beginTenantDeletion(completedIdentity.tenantId);
    await initial.purgeTenantForDeletion(completed.id, completedIdentity.tenantId);
    await initial.completeDeletion(completed.id);
    const runningIdentity = await initial.createLocalTenant(
      "expired-running@example.test",
      "Running",
    );
    const running = await initial.beginTenantDeletion(runningIdentity.tenantId);
    await initial.close();

    const raw = await PGlite.create(data);
    await raw.query("UPDATE deletion_runs SET expires_at = now() - interval '1 day'");
    await raw.close();

    const reopened = await NimantoStore.open(data);
    stores.push(reopened);
    const coordinator = new DeletionCoordinator(
      reopened,
      join(root, "artifacts"),
      join(root, "outbox"),
    );
    await expect(coordinator.recoverPending()).resolves.toEqual({ recovered: 1, pending: 0 });
    await expect(reopened.recoverableDeletionRuns()).resolves.toEqual([]);
    await expect(reopened.pruneCompletedDeletionRuns()).resolves.toBe(0);
    await expect(reopened.databaseContains(completed.id)).resolves.toBe(false);
    await expect(reopened.databaseContains(running.id)).resolves.toBe(false);
  });

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
    ).rejects.toThrow("ACTION_APPROVAL_STALE");
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
    const lifecycle = new ExternalActionLifecycle(
      store,
      outboxDirectory,
      async () => {
        providerCalls += 1;
        throw new Error("PROVIDER_MUST_NOT_RUN");
      },
      true,
    );
    await lifecycle.setTenantOptIn(identity.tenantId, true);

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
    const lifecycle = new ExternalActionLifecycle(
      store,
      outboxDirectory,
      async () => {
        providerCalls += 1;
        throw new Error("PROVIDER_MUST_NOT_RUN");
      },
      true,
    );
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
    await lifecycle.setTenantOptIn(identity.tenantId, true);

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
    const lifecycle = new ExternalActionLifecycle(store, outboxDirectory, executor, true);
    await lifecycle.setTenantOptIn(identity.tenantId, true);
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

  it("warns with the action id alone when a delivered action cannot be recorded", async () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store, identity, action, outboxDirectory } =
      await approvedActionFixture("action-ambiguous");
    const delivered: ActionResult = {
      status: "sent",
      provider: "test_outbox",
      providerReference: "outbox:action-ambiguous",
    };
    // The provider succeeded; only the outcome write fails.
    const failingReceipts = new Proxy(store, {
      get(target, property) {
        if (property === "transaction") {
          return async <T>(work: (database: NimantoStore) => Promise<T>) =>
            store.transaction((database) =>
              work(
                new Proxy(database, {
                  get(inner, innerProperty) {
                    if (innerProperty === "saveReceipt") {
                      return async () => {
                        throw new Error("INJECTED_RECEIPT_FAILURE");
                      };
                    }
                    const value = Reflect.get(inner, innerProperty, inner) as unknown;
                    return typeof value === "function" ? value.bind(inner) : value;
                  },
                }) as NimantoStore,
              ),
            );
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as NimantoStore;
    const lifecycle = new ExternalActionLifecycle(
      failingReceipts,
      outboxDirectory,
      async () => delivered,
      true,
    );
    lifecycle.setTenantOptIn(identity.tenantId, true);

    await expect(lifecycle.execute(identity.tenantId, action.id)).rejects.toThrow(
      "ACTION_OUTCOME_AMBIGUOUS",
    );
    expect(warnings).toHaveBeenCalledTimes(1);
    const line = warnings.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toEqual({
      level: "warn",
      code: "ACTION_OUTCOME_AMBIGUOUS",
      actionId: action.id,
    });
    // Never the recipient, the subject, the body, or the tenant.
    expect(line).not.toContain("@");
    expect(line).not.toContain("Application");
    expect(line).not.toContain(identity.tenantId);
  });
});
