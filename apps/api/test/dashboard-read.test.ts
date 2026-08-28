import { canonicalHash } from "@nimanto/domain";
import { NimantoStore, type SessionIdentity } from "@nimanto/database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardRead } from "../src/dashboard-read.js";

const stores: NimantoStore[] = [];

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

    const dashboard = await new DashboardRead(store, () => false).read(person);
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

    const dashboardPromise = new DashboardRead(store, () => false).read(person);
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
});
