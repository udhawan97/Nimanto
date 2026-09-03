import { canonicalHash } from "@nimanto/domain";
import { NimantoStore, type SessionIdentity } from "@nimanto/database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardRead } from "../src/dashboard-read.js";

const stores: NimantoStore[] = [];
const disabledRuntime = async () => ({
  operatorEnabled: false,
  tenantReady: false,
  externalActionsEnabled: false,
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

describe("DashboardRead", () => {
  it("annotates recognized ATS links without mutating the retained role", async () => {
    const store = await NimantoStore.open("memory://dashboard-ats-routing");
    stores.push(store);
    const local = await store.createLocalTenant("route@example.test", "Route Candidate");
    const session = await store.createSession(local.userId, local.tenantId);
    const person: SessionIdentity = { ...local, sessionId: session.id };
    const saved = await store.upsertJob(local.tenantId, {
      source: "manual",
      sourceJobId: "candidate-copy",
      title: "Platform role",
      company: "Northwind",
      description: "Build candidate-controlled systems.",
      location: "Remote",
      workMode: "remote",
      url: "https://job-boards.greenhouse.io/northwind/jobs/17001?utm_source=test#apply",
      requirements: ["TypeScript"],
      capability: "deep_link",
      sourceMeta: { candidateEntered: true },
      contentHash: canonicalHash({ role: "route" }),
    });

    const dashboard = await new DashboardRead(store, disabledRuntime).read(person);
    expect(dashboard.jobs[0]?.atsRoute).toMatchObject({
      state: "ready",
      provider: "greenhouse",
      boardId: "northwind",
      sourceJobId: "17001",
      targetUrl: "https://job-boards.greenhouse.io/northwind/jobs/17001",
      ruleVersion: "ats_routing_v1",
    });
    expect((await store.getJob(local.tenantId, saved.id))?.url).toBe(
      "https://job-boards.greenhouse.io/northwind/jobs/17001?utm_source=test#apply",
    );
  });

  it("projects exact role provenance without exposing normalized or provider bodies", async () => {
    const store = await NimantoStore.open("memory://dashboard-role-provenance");
    stores.push(store);
    const local = await store.createLocalTenant("provenance@example.test", "Provenance Candidate");
    const session = await store.createSession(local.userId, local.tenantId);
    const person: SessionIdentity = { ...local, sessionId: session.id };
    const recorded = await store.recordSourceObservation(
      local.tenantId,
      {
        source: "greenhouse",
        boardId: "northwind",
        startedAt: "2026-08-28T09:00:00.000Z",
        completedAt: "2026-08-28T09:01:00.000Z",
        complete: true,
        pagesRead: 1,
        sourceItemCount: 1,
        responseFingerprint: "board-fingerprint",
        retryAfterObserved: false,
        sourcePolicyVersion: "source_registry_v1",
      },
      [
        {
          source: "greenhouse",
          sourceJobId: "17001",
          title: "Platform Engineer",
          company: "Northwind",
          description: "Build candidate-controlled systems.",
          location: "Chicago",
          workMode: "hybrid",
          url: "https://job-boards.greenhouse.io/northwind/jobs/17001",
          requirements: ["TypeScript"],
          capability: "deep_link",
          sourceMeta: { board: "northwind" },
          contentHash: canonicalHash({ role: "provenance" }),
          observedAt: "2026-08-28T09:00:30.000Z",
          sourcePostedAt: "2026-08-27T12:00:00.000Z",
          sourceUpdatedAt: "2026-08-28T08:00:00.000Z",
          rawPayload: { id: "17001", confidentialProviderField: "discarded" },
        },
      ],
    );
    await store.recordRoleVerification(local.tenantId, recorded.jobs[0]!.id, {
      attemptedAt: "2026-08-28T10:00:00.000Z",
      method: "detail_get",
      result: "present",
      evidence: {
        responseFingerprint: "detail-fingerprint",
        verificationPolicyVersion: "ats_verification_v1",
        internalProviderNote: "not projected",
      },
    });

    const dashboard = await new DashboardRead(store, disabledRuntime).read(person);
    expect(dashboard.jobs[0]?.provenance).toMatchObject({
      observation: {
        sourceRunId: recorded.sourceRun.id,
        observedAt: "2026-08-28T09:00:30.000Z",
        normalizerVersion: "role_normalizer_v2",
      },
      verificationAttempt: {
        sourceRunId: null,
        attemptedAt: "2026-08-28T10:00:00.000Z",
        authority: "employer_ats",
        method: "detail_get",
        result: "present",
        responseFingerprint: "detail-fingerprint",
        policyVersion: "ats_verification_v1",
      },
      sourceRun: {
        id: recorded.sourceRun.id,
        complete: true,
        responseFingerprint: "board-fingerprint",
      },
      verificationSourceRun: null,
    });
    expect(JSON.stringify(dashboard.jobs[0]?.provenance)).not.toContain(
      "confidentialProviderField",
    );
    expect(JSON.stringify(dashboard.jobs[0]?.provenance)).not.toContain("internalProviderNote");
  });

  it("holds one coherent read transaction against a concurrent Application write", async () => {
    const store = await NimantoStore.open("memory://dashboard-coherence");
    stores.push(store);
    const local = await store.createLocalTenant("candidate@example.test", "Candidate");
    const session = await store.createSession(local.userId, local.tenantId);
    const person: SessionIdentity = { ...local, sessionId: session.id };
    const firstJob = await store.upsertJob(local.tenantId, {
      source: "manual",
      sourceJobId: "first-role",
      title: "First role",
      company: "Example",
      description: "First role description",
      location: "Remote",
      workMode: "remote",
      url: "https://example.test/jobs/first",
      requirements: ["TypeScript"],
      capability: "deep_link",
      sourceMeta: { synthetic: true },
      contentHash: canonicalHash({ role: "first" }),
    });
    const secondJob = await store.upsertJob(local.tenantId, {
      source: "manual",
      sourceJobId: "second-role",
      title: "Second role",
      company: "Example",
      description: "Second role description",
      location: "Remote",
      workMode: "remote",
      url: "https://example.test/jobs/second",
      requirements: ["PostgreSQL"],
      capability: "deep_link",
      sourceMeta: { synthetic: true },
      contentHash: canonicalHash({ role: "second" }),
    });
    await store.createApplication(local.tenantId, firstJob.id, null);

    let releasePacketRead!: () => void;
    const packetReadPaused = new Promise<void>((resolve) => {
      releasePacketRead = resolve;
    });
    let packetReadReached!: () => void;
    const reachedPacketRead = new Promise<void>((resolve) => {
      packetReadReached = resolve;
    });
    const listLatestPackets = NimantoStore.prototype.listLatestPackets;
    vi.spyOn(NimantoStore.prototype, "listLatestPackets").mockImplementation(async function (
      this: NimantoStore,
      tenantId,
    ) {
      const packets = await listLatestPackets.call(this, tenantId);
      packetReadReached();
      await packetReadPaused;
      return packets;
    });

    const dashboardPromise = new DashboardRead(store, disabledRuntime).read(person);
    await reachedPacketRead;

    let writeSettled = false;
    const concurrentWrite = store
      .createApplication(local.tenantId, secondJob.id, null)
      .finally(() => {
        writeSettled = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writeSettled).toBe(false);

    releasePacketRead();
    const [dashboard] = await Promise.all([dashboardPromise, concurrentWrite]);
    expect(dashboard.applications).toHaveLength(1);
    expect(dashboard.personalFunnel.sampleSize).toBe(1);
    expect(await store.listApplications(local.tenantId)).toHaveLength(2);
  });

  it("assembles the Dashboard from a read-only snapshot", async () => {
    const store = await NimantoStore.open("memory://dashboard-read-only");
    stores.push(store);
    const local = await store.createLocalTenant("snapshot@example.test", "Snapshot Candidate");
    const session = await store.createSession(local.userId, local.tenantId);
    const person: SessionIdentity = { ...local, sessionId: session.id };

    /* A write attempted from inside the Dashboard's own database view must be
     * refused by the transaction itself, not merely by convention. */
    const writeDuringRead = (open: "transaction" | "readSnapshot") =>
      new Proxy(store, {
        get(target, property) {
          if (property === open) {
            return async <T>(work: (database: NimantoStore) => Promise<T>) =>
              (target[open] as NimantoStore["transaction"])((database) =>
                work(
                  new Proxy(database, {
                    get(inner, innerProperty) {
                      if (innerProperty === "listReceipts") {
                        return async (tenantId: string) => {
                          await database.createEvidence(tenantId, {
                            kind: "skill",
                            value: "Written from inside a Dashboard read",
                            status: "pending",
                            confidence: "high",
                            sourceName: "Synthetic",
                            locator: "line:1",
                          });
                          return [];
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

    await expect(
      new DashboardRead(writeDuringRead("readSnapshot"), disabledRuntime).read(person),
    ).rejects.toThrow(/read-only/i);
    expect(await store.listEvidence(local.tenantId)).toEqual([]);
    await expect(new DashboardRead(store, disabledRuntime).read(person)).resolves.toMatchObject({
      identity: person,
    });
  });
});
