import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import {
  canonicalHash,
  createReceipt,
  matchJob,
  normalizeRoleSnapshot,
  roleSnapshotHash,
  type CurrentRole,
} from "@nimanto/domain";
import { fetchProviderJobsResult, type JobProvider } from "../../providers/src/jobs.js";
import { NimantoStore } from "../src/store.js";

const stores: NimantoStore[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

const payloads = {
  greenhouse: {
    jobs: [
      {
        id: 17,
        title: "Engineer",
        content: "Build systems",
        location: { name: "Chicago" },
        absolute_url: "https://example.test/17",
      },
    ],
  },
  lever: [
    {
      id: "role17",
      text: "Engineer",
      descriptionPlain: "Build systems",
      workplaceType: "remote",
      categories: { location: "United States", country: "US" },
      hostedUrl: "https://example.test/17",
    },
  ],
  ashby: {
    jobs: [
      {
        id: "role17",
        title: "Engineer",
        descriptionPlain: "Build systems",
        isRemote: true,
        location: "United States",
        jobUrl: "https://example.test/17",
      },
    ],
  },
};

async function adapterRole(
  source: keyof typeof payloads,
  observedAt: string,
): Promise<CurrentRole> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(observedAt);
  try {
    const result = await fetchProviderJobsResult(
      { provider: source, board: "synthetic" },
      async () => Response.json(payloads[source]),
    );
    const job = result.jobs[0]!;
    return normalizeRoleSnapshot({ ...job, sourceRoleId: job.sourceJobId });
  } finally {
    vi.useRealTimers();
  }
}

async function publicationFixture(role: CurrentRole) {
  const store = await NimantoStore.open(`memory://${randomUUID()}`);
  stores.push(store);
  const { tenantId } = await store.createLocalTenant("rechecks@example.test", "Synthetic Rechecks");
  const evidence = await store.createEvidence(tenantId, {
    kind: "skill",
    value: "TypeScript",
    status: "confirmed",
    confidence: "high",
    sourceName: "Synthetic resume",
    locator: "line:1",
  });
  const profile = await store.saveProfileVersion(tenantId, "Synthetic authorization.");
  const job = await store.upsertJob(tenantId, role);
  const result = matchJob({ job: { ...job }, evidence: [evidence] });
  const match = await store.saveMatch(tenantId, job.id, profile.version.id, result);
  const application = await store.createApplication(tenantId, job.id, profile.version.id);
  const packet = await store.createPacket(tenantId, {
    applicationId: application.id,
    profileVersionId: profile.version.id,
    canonicalContent: {
      schemaVersion: "packet_v2",
      composition: {
        profileVersionId: profile.version.id,
        matchRunId: match.id,
        jobContentHash: job.contentHash,
        evidenceIds: [evidence.id],
      },
    },
    artifactManifest: {},
  });
  return { store, tenantId, job, match, packet };
}

it.each<Exclude<JobProvider, "smartrecruiters">>(["greenhouse", "lever", "ashby"])(
  "keeps the current Match and Packet after an identical %s adapter recheck",
  async (source) => {
    const first = await adapterRole(source, "2026-10-01T12:00:00.000Z");
    const { store, tenantId, job, match, packet } = await publicationFixture(first);
    const second = await adapterRole(source, "2026-10-02T12:00:00.000Z");
    expect(second.workplaceEvidence?.[0]?.observedAt).not.toBe(
      first.workplaceEvidence?.[0]?.observedAt,
    );
    expect(second.contentHash).toBe(first.contentHash);
    const rechecked = await store.upsertJob(tenantId, second);
    expect(rechecked.updatedAt).toBe(job.updatedAt);
    expect(rechecked.workplaceEvidence?.[0]?.observedAt).toBe("2026-10-02T12:00:00.000Z");
    expect((await store.listLatestMatches(tenantId)).map((current) => current.id)).toEqual([
      match.id,
    ]);
    expect(await store.isPacketCurrent(tenantId, packet.id)).toBe(true);
    const changed = {
      ...second,
      workplaceEvidence: (second.workplaceEvidence ?? []).map((evidence) => ({
        ...evidence,
        sourceText: "Changed substantive evidence",
      })),
    };
    await store.upsertJob(tenantId, { ...changed, contentHash: roleSnapshotHash(changed) });
    expect(await store.listLatestMatches(tenantId)).toEqual([]);
    expect(await store.isPacketCurrent(tenantId, packet.id)).toBe(false);
  },
);

it("preserves pre-fix hashes and immutable receipts until ordinary role refresh safely stales them", async () => {
  const current = await adapterRole("lever", "2026-10-01T12:00:00.000Z");
  const { contentHash: _contentHash, ...role } = current;
  const legacyHash = canonicalHash({
    schemaVersion: "role_snapshot_v1",
    source: role.source,
    title: role.title,
    company: role.company,
    description: role.description,
    location: role.location,
    workMode: role.workMode,
    roleFamily: role.roleFamily ?? null,
    workplaceEvidence: role.workplaceEvidence ?? [],
    url: role.url,
    requirements: role.requirements,
    sourcePostedAt: role.sourcePostedAt ?? null,
    sourceUpdatedAt: role.sourceUpdatedAt ?? null,
    validThrough: role.validThrough ?? null,
    capability: role.capability,
    sourceMeta: role.sourceMeta,
  });
  const { store, tenantId, job, match, packet } = await publicationFixture({
    ...role,
    contentHash: legacyHash,
  });
  const receipt = createReceipt({
    id: randomUUID(),
    type: "match.published",
    occurredAt: "2026-10-01T12:00:00.000Z",
    input: { matchRunId: match.id },
    artifact: { jobContentHash: legacyHash },
  });
  await store.saveReceipt(tenantId, receipt, { jobContentHash: legacyHash });
  const preservedReceipts = await store.listReceipts(tenantId);
  expect((await store.getJob(tenantId, job.id))?.contentHash).toBe(legacyHash);
  expect(await store.isPacketCurrent(tenantId, packet.id)).toBe(true);
  expect(current.contentHash).not.toBe(legacyHash);
  await store.upsertJob(tenantId, current);
  expect(await store.listLatestMatches(tenantId)).toEqual([]);
  expect(await store.isPacketCurrent(tenantId, packet.id)).toBe(false);
  expect((await store.listMatchRuns(tenantId)).items[0]).toMatchObject({
    id: match.id,
    jobContentHash: legacyHash,
  });
  expect(await store.getPacket(tenantId, packet.id)).toEqual(packet);
  expect(await store.listReceipts(tenantId)).toEqual(preservedReceipts);
});
