import { afterEach, expect, it } from "vitest";
import { changedApplicationsForView } from "../../../apps/web/lib/career-ledger.js";
import { NimantoStore } from "../src/store.js";

const stores: NimantoStore[] = [];
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

async function fixture() {
  const store = await NimantoStore.open("memory://saved-review-observations");
  stores.push(store);
  const { tenantId } = await store.createLocalTenant("review@example.test", "Synthetic Review");
  async function application(sourceJobId: string) {
    const job = await store.upsertJob(tenantId, {
      source: "manual",
      sourceJobId,
      title: "Engineer",
      company: "Synthetic Works",
      description: "Synthetic role",
      location: "",
      workMode: "unknown",
      url: "",
      requirements: [],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: sourceJobId,
    });
    return store.createApplication(tenantId, job.id, null);
  }
  const first = await application("first");
  const second = await application("second");
  const view = await store.saveApplicationView(tenantId, { name: "Review", filters: {} });
  async function markReviewed() {
    const reviewed = await store.markApplicationViewReviewed(tenantId, view.id);
    // API timestamps have millisecond precision; put subsequent writes after
    // that boundary while retaining real database-generated observation times.
    await new Promise((resolve) => setTimeout(resolve, 5));
    return reviewed!.lastReviewedAt!;
  }
  async function changed(lastReviewedAt: string) {
    return store.readSnapshot(async (database) =>
      changedApplicationsForView({
        applications: await database.listApplications(tenantId),
        jobs: await database.listJobs(tenantId),
        careerOperations: await database.readCareerOperations(tenantId),
        filters: {},
        lastReviewedAt,
      }),
    );
  }
  return { store, tenantId, first, second, markReviewed, changed };
}

it("marks a newly recorded older outcome changed without rewriting its event or parent time", async () => {
  const { store, tenantId, first, second, markReviewed, changed } = await fixture();
  const watermark = await markReviewed();
  const occurredAt = "2026-01-01T12:00:00.000Z";
  await store.addOutcome(tenantId, first.id, { type: "reply", note: "Recorded later", occurredAt });

  expect(await changed(watermark)).toEqual([first.id]);
  const applications = await store.listApplications(tenantId);
  expect(applications.find((record) => record.id === first.id)).toMatchObject({
    updatedAt: first.updatedAt,
    outcomes: [expect.objectContaining({ occurredAt })],
  });
  expect(applications.find((record) => record.id === second.id)?.updatedAt).toBe(second.updatedAt);
  expect(await changed(await markReviewed())).toEqual([]);
});

it("scopes a new contact association to its Application and ignores an idempotent replay", async () => {
  const { store, tenantId, first, second, markReviewed, changed } = await fixture();
  const contact = await store.createContact(tenantId, {
    name: "Synthetic Contact",
    kind: "other",
    applicationId: first.id,
  });
  const watermark = await markReviewed();
  await store.linkContactToApplication(tenantId, contact.id, second.id, "other");

  expect(await changed(watermark)).toEqual([second.id]);
  expect((await store.listContacts(tenantId))[0]).toMatchObject({
    updatedAt: contact.updatedAt,
    createdAt: contact.createdAt,
  });
  const reviewedAgain = await markReviewed();
  await store.linkContactToApplication(tenantId, contact.id, second.id, "other");
  expect(await changed(reviewedAgain)).toEqual([]);
  const applications = await store.listApplications(tenantId);
  expect(applications.find((record) => record.id === first.id)?.updatedAt).toBe(first.updatedAt);
  expect(applications.find((record) => record.id === second.id)?.updatedAt).toBe(second.updatedAt);
});
