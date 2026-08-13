import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NimantoStore } from "@nimanto/database";
import { canonicalHash } from "@nimanto/domain";
import { publishMatch } from "../src/match-publication.js";

const stores: NimantoStore[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

async function fixture(): Promise<{
  store: NimantoStore;
  tenantId: string;
  jobId: string;
  originalClaimId: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "nimanto-match-publication-"));
  const store = await NimantoStore.open(path.join(root, "database"));
  stores.push(store);
  const identity = await store.createLocalTenant("publisher@example.test", "Publisher");
  const claim = await store.createEvidence(identity.tenantId, {
    kind: "skill",
    value: "TypeScript",
    status: "confirmed",
    confidence: "high",
    sourceName: "Candidate resume",
    locator: "Skills",
  });
  await store.saveProfileVersion(identity.tenantId, "Candidate-approved wording");
  const job = await store.upsertJob(identity.tenantId, {
    source: "manual",
    sourceJobId: "publisher-job",
    title: "Platform Engineer",
    company: "Northwind",
    description: "Build TypeScript platforms",
    location: "Remote",
    workMode: "remote",
    url: "",
    requirements: ["TypeScript"],
    capability: "deep_link",
    sourceMeta: {},
    contentHash: canonicalHash({ version: 1 }),
  });
  return { store, tenantId: identity.tenantId, jobId: job.id, originalClaimId: claim.id };
}

describe("match publication", () => {
  it("uses only the exact profile-version claims and records complete provenance", async () => {
    const { store, tenantId, jobId, originalClaimId } = await fixture();
    await store.createEvidence(tenantId, {
      kind: "skill",
      value: "Rust",
      status: "confirmed",
      confidence: "high",
      sourceName: "New resume",
      locator: "Skills",
    });

    const published = await publishMatch(store, tenantId, jobId, "manual");
    expect(published.result.requirements[0]?.evidenceIds).toEqual([originalClaimId]);
    const receipt = (await store.listReceipts(tenantId)).at(-1);
    expect(receipt?.material).toMatchObject({
      jobId,
      profileVersionId: published.profileVersionId,
      evidenceIds: [originalClaimId],
    });
  });

  it("changes the input hash when mutable job content changes", async () => {
    const { store, tenantId, jobId } = await fixture();
    const first = await publishMatch(store, tenantId, jobId, "manual");
    const job = await store.getJob(tenantId, jobId);
    await store.upsertJob(tenantId, {
      ...job!,
      id: jobId,
      description: "Build Rust platforms",
      contentHash: canonicalHash({ version: 2 }),
    });
    const second = await publishMatch(store, tenantId, jobId, "scheduled_discovery");
    expect(second.inputHash).not.toBe(first.inputHash);
  });
});
