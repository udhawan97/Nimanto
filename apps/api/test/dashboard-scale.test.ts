import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { PGlite } from "@electric-sql/pglite";
import { NimantoStore, type SessionIdentity } from "@nimanto/database";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardRead } from "../src/dashboard-read.js";

const stores: NimantoStore[] = [];
const rawDatabases: PGlite[] = [];
const temporaryRoots: string[] = [];
const APPLICATION_COUNT = 1_000;
const ANSWER_BLOCK_COUNT = 1_000;
const REVISIONS_PER_ANSWER = 10;
const MAX_SERIALIZED_BYTES = 4 * 1024 * 1024;

const disabledRuntime = async () => ({
  operatorEnabled: false,
  tenantReady: false,
  externalActionsEnabled: false,
});

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(rawDatabases.splice(0).map((database) => database.close()));
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("DashboardRead large-tenant budget", () => {
  it("keeps 1,000 Applications and 10,000 answer revisions within bounded read and payload budgets", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-dashboard-scale-"));
    temporaryRoots.push(root);
    const dataDirectory = join(root, "data");
    const initial = await NimantoStore.open(dataDirectory);
    stores.push(initial);
    const identity = await initial.createLocalTenant(
      "scale-candidate@example.test",
      "Scale Candidate",
    );
    const session = await initial.createSession(identity.userId, identity.tenantId);
    const person: SessionIdentity = { ...identity, sessionId: session.id };
    await initial.close();
    stores.splice(stores.indexOf(initial), 1);

    const database = await PGlite.create(dataDirectory);
    rawDatabases.push(database);
    await database.query(
      `INSERT INTO jobs(
           id, tenant_id, source, source_job_id, title, company, description, location,
           work_mode, role_family, url, requirements, capability, source_meta, content_hash,
           created_at, updated_at
         )
         SELECT
           'scale-job-' || ordinal, $1, 'manual', 'scale-job-' || ordinal,
           'Synthetic role ' || ordinal, 'Example Corp',
           'Synthetic role retained only for the deterministic large-tenant budget.',
           'Remote', 'remote', 'software-engineering',
           'https://example.test/jobs/' || ordinal, '["TypeScript"]'::jsonb,
           'deep_link', '{"synthetic":true}'::jsonb, 'scale-hash-' || ordinal,
           '2026-01-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 second',
           '2026-01-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 second'
         FROM generate_series(1, $2::integer) AS ordinal`,
      [identity.tenantId, APPLICATION_COUNT],
    );
    await database.query(
      `INSERT INTO applications(
           id, tenant_id, job_id, status, created_at, updated_at
         )
         SELECT
           'scale-application-' || ordinal, $1, 'scale-job-' || ordinal, 'tracked',
           '2026-02-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 second',
           '2026-02-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 second'
         FROM generate_series(1, $2::integer) AS ordinal`,
      [identity.tenantId, APPLICATION_COUNT],
    );
    await database.query(
      `INSERT INTO application_status_events(
           id, tenant_id, application_id, from_status, to_status, source, occurred_at
         )
         SELECT
           'scale-status-' || ordinal, $1, 'scale-application-' || ordinal,
           NULL, 'tracked', 'candidate',
           '2026-02-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 second'
         FROM generate_series(1, $2::integer) AS ordinal`,
      [identity.tenantId, APPLICATION_COUNT],
    );
    await database.query(
      `INSERT INTO application_activities(
           id, tenant_id, application_id, kind, state, title, note, due_at,
           created_at, updated_at
         )
         SELECT
           'scale-activity-' || ordinal, $1, 'scale-application-' || ordinal,
           'follow_up', 'planned', 'Synthetic follow-up ' || ordinal, '',
           '2026-03-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 minute',
           '2026-02-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 second',
           '2026-02-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 second'
         FROM generate_series(1, $2::integer) AS ordinal`,
      [identity.tenantId, APPLICATION_COUNT],
    );
    await database.query(
      `INSERT INTO answer_blocks(
           id, tenant_id, topic, prompt, current_revision, created_at, updated_at
         )
         SELECT
           'scale-answer-' || ordinal, $1, 'leadership',
           'Synthetic prompt ' || ordinal, $2,
           '2026-04-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 second',
           '2026-04-01T00:00:00.000Z'::timestamptz + ordinal * interval '1 second'
         FROM generate_series(1, $3::integer) AS ordinal`,
      [identity.tenantId, REVISIONS_PER_ANSWER, ANSWER_BLOCK_COUNT],
    );
    await database.query(
      `INSERT INTO answer_revisions(
           id, tenant_id, answer_block_id, revision, topic, prompt, answer_text,
           evidence_ids, created_at
         )
         SELECT
           'scale-revision-' || answer_ordinal || '-' || revision_ordinal,
           $1, 'scale-answer-' || answer_ordinal, revision_ordinal, 'leadership',
           'Synthetic prompt ' || answer_ordinal,
           repeat('Synthetic answer evidence. ', 8) || revision_ordinal,
           '[]'::jsonb,
           '2026-04-01T00:00:00.000Z'::timestamptz
             + answer_ordinal * interval '1 second'
             + revision_ordinal * interval '1 millisecond'
         FROM generate_series(1, $2::integer) AS answer_ordinal
         CROSS JOIN generate_series(1, $3::integer) AS revision_ordinal`,
      [identity.tenantId, ANSWER_BLOCK_COUNT, REVISIONS_PER_ANSWER],
    );
    await database.close();
    rawDatabases.splice(rawDatabases.indexOf(database), 1);

    const store = await NimantoStore.open(dataDirectory);
    stores.push(store);
    const dashboardRead = new DashboardRead(store, disabledRuntime);

    const coldStartedAt = performance.now();
    const cold = await dashboardRead.read(person);
    const coldReadMs = performance.now() - coldStartedAt;
    const warmStartedAt = performance.now();
    const warm = await dashboardRead.read(person);
    const warmReadMs = performance.now() - warmStartedAt;
    const serializedBytes = Buffer.byteLength(JSON.stringify(warm));
    // Read timings are observations, not gates: they vary by an order of magnitude
    // across machines and CI runners. The payload budget below is the hard gate.
    console.info(
      JSON.stringify({
        applications: APPLICATION_COUNT,
        answerRevisions: ANSWER_BLOCK_COUNT * REVISIONS_PER_ANSWER,
        coldReadMs: Math.round(coldReadMs),
        warmReadMs: Math.round(warmReadMs),
        serializedBytes,
      }),
    );

    expect(cold.applications).toHaveLength(APPLICATION_COUNT);
    expect(cold.applications.every((application) => application.activities.length === 1)).toBe(
      true,
    );
    expect(cold.careerOperations.answerBlocks).toHaveLength(ANSWER_BLOCK_COUNT);
    expect(cold.careerOperations.answerBlocks.every((answer) => !answer.revisions)).toBe(true);
    const targetedHistory = await store.getAnswerBlock(identity.tenantId, "scale-answer-1", true);
    expect(targetedHistory).toMatchObject({
      currentRevision: REVISIONS_PER_ANSWER,
    });
    expect(targetedHistory?.revisions).toHaveLength(REVISIONS_PER_ANSWER);
    expect(serializedBytes).toBeLessThan(MAX_SERIALIZED_BYTES);
  }, 30_000);
});
