import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { canonicalHash } from "@nimanto/domain";
import { buildServer } from "../src/server.js";

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const bootstrapSecret = "test-bootstrap-secret-with-at-least-32-characters";

async function setup(options?: {
  removePath?: (
    target: string,
    settings: { recursive?: boolean; force?: boolean },
  ) => Promise<void>;
  assuranceModel?: string;
  providerJobsFetcher?: (request: {
    provider: "greenhouse" | "lever" | "ashby";
    board: string;
  }) => Promise<
    Array<{
      source: "greenhouse" | "lever" | "ashby";
      sourceJobId: string;
      title: string;
      company: string;
      description: string;
      location: string;
      workMode: string;
      url: string;
      requirements: string[];
      contentHash: string;
      sourceMeta: Record<string, unknown>;
    }>
  >;
}): Promise<{
  app: FastifyInstance;
  cookie: string;
  root: string;
  tenantId: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "nimanto-api-"));
  const app = await buildServer({
    dataDirectory: path.join(root, "database"),
    artifactDirectory: path.join(root, "artifacts"),
    outboxDirectory: path.join(root, "outbox"),
    webOrigin: "http://127.0.0.1:4300",
    demoMode: true,
    bootstrapSecret,
    urlAllowlist: [],
    port: 4310,
    host: "127.0.0.1",
    ...(options?.removePath ? { removePath: options.removePath } : {}),
    ...(options?.assuranceModel ? { assuranceModel: options.assuranceModel } : {}),
    ...(options?.providerJobsFetcher ? { providerJobsFetcher: options.providerJobsFetcher } : {}),
  });
  apps.push(app);
  await app.ready();
  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/demo",
    headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
    payload: {},
  });
  expect(login.statusCode).toBe(200);
  const header = login.headers["set-cookie"];
  const cookie = (Array.isArray(header) ? header[0] : header)?.split(";")[0] ?? "";
  expect(cookie).toContain("nimanto_session=");
  return { app, cookie, root, tenantId: login.json().identity.tenantId as string };
}

describe("Nimanto beta API", () => {
  it("keeps profile-version responses additive and reports unchanged saves", async () => {
    const { app, cookie } = await setup();
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const unchanged = await app.inject({
      method: "POST",
      url: "/v1/profile/versions",
      headers: { cookie },
      payload: { authorizationWording: `  ${dashboard.profile.authorizationWording}  ` },
    });
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json()).toMatchObject({
      id: dashboard.profile.id,
      claimIds: dashboard.profile.claimIds,
      authorizationWording: dashboard.profile.authorizationWording,
      inputHash: dashboard.profile.inputHash,
      createdAt: dashboard.profile.createdAt,
      created: false,
    });

    const changed = await app.inject({
      method: "POST",
      url: "/v1/profile/versions",
      headers: { cookie },
      payload: { authorizationWording: "Candidate-approved changed wording." },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      authorizationWording: "Candidate-approved changed wording.",
      created: true,
    });
    expect(changed.json().id).not.toBe(dashboard.profile.id);
  });

  it("keeps the worker cycle healthy when a running schedule is cancelled", async () => {
    let markProviderStarted: (() => void) | undefined;
    let releaseProvider: (() => void) | undefined;
    const providerStarted = new Promise<void>((resolve) => {
      markProviderStarted = resolve;
    });
    const providerReleased = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const { app, cookie } = await setup({
      providerJobsFetcher: async ({ provider, board }) => {
        markProviderStarted?.();
        await providerReleased;
        return [
          {
            source: provider,
            sourceJobId: "cancelled-schedule-role",
            title: "Platform Engineer",
            company: board,
            description: "Build TypeScript services.",
            location: "Remote",
            workMode: "remote",
            url: "https://example.test/jobs/cancelled-schedule-role",
            requirements: ["TypeScript"],
            contentHash: "cancelled-schedule-content",
            sourceMeta: { fixture: true },
          },
        ];
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/v1/schedules",
      headers: { cookie },
      payload: { provider: "greenhouse", board: "northwind", cadenceMinutes: 60 },
    });

    const cycleRequest = app.inject({
      method: "POST",
      url: "/v1/worker/cycle",
      headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
    });
    await providerStarted;
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/v1/schedules/${created.json().id}`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(200);
    releaseProvider?.();

    const cycle = await cycleRequest;
    expect(cycle.statusCode).toBe(200);
    expect(cycle.json()).toEqual({ processed: 1, failed: 1, imported: 0, matched: 0 });
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(
      dashboard.jobs.some(
        (job: { sourceJobId: string }) => job.sourceJobId === "cancelled-schedule-role",
      ),
    ).toBe(false);
    expect(dashboard.matches).toEqual([]);
    expect(dashboard.receipts).toEqual([]);
  });

  it("runs tenant-owned durable discovery schedules through the private worker seam", async () => {
    const { app, cookie } = await setup({
      providerJobsFetcher: async ({ provider, board }) => [
        {
          source: provider,
          sourceJobId: "scheduled-role-1",
          title: "Senior Platform Engineer",
          company: board,
          description: "Build TypeScript and PostgreSQL services.",
          location: "Chicago",
          workMode: "hybrid",
          url: "https://example.test/jobs/scheduled-role-1",
          requirements: ["TypeScript", "PostgreSQL"],
          contentHash: "scheduled-role-content-1",
          sourceMeta: { fixture: true },
        },
      ],
    });

    const created = await app.inject({
      method: "POST",
      url: "/v1/schedules",
      headers: { cookie },
      payload: { provider: "greenhouse", board: "northwind", cadenceMinutes: 60 },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      provider: "greenhouse",
      board: "northwind",
      cadenceMinutes: 60,
      state: "queued",
    });

    expect((await app.inject({ method: "POST", url: "/v1/worker/cycle" })).statusCode).toBe(401);
    const cycle = await app.inject({
      method: "POST",
      url: "/v1/worker/cycle",
      headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
    });
    expect(cycle.statusCode).toBe(200);
    expect(cycle.json()).toEqual({ processed: 1, failed: 0, imported: 1, matched: 1 });

    const schedules = await app.inject({
      method: "GET",
      url: "/v1/schedules",
      headers: { cookie },
    });
    expect(schedules.json().schedules).toEqual([
      expect.objectContaining({
        id: created.json().id,
        state: "queued",
        attempts: 0,
        lastResult: { imported: 1, matched: 1 },
      }),
    ]);
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const scheduledJob = dashboard.jobs.find(
      (job: { sourceJobId: string }) => job.sourceJobId === "scheduled-role-1",
    );
    expect(scheduledJob).toBeDefined();
    expect(
      dashboard.matches.some((match: { jobId: string }) => match.jobId === scheduledJob.id),
    ).toBe(true);
    expect(
      dashboard.receipts.some(
        (receipt: { material?: { jobId?: string } }) => receipt.material?.jobId === scheduledJob.id,
      ),
    ).toBe(true);

    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/schedules/${created.json().id}/pause`,
          headers: { cookie },
        })
      ).json().state,
    ).toBe("paused");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/schedules/${created.json().id}/resume`,
          headers: { cookie },
        })
      ).json().state,
    ).toBe("queued");
  });

  it("rejects an invalid scheduled provider batch before writing any roles", async () => {
    const { app, cookie } = await setup({
      providerJobsFetcher: async ({ provider, board }) => [
        {
          source: provider,
          sourceJobId: "scheduled-atomic-valid",
          title: "Platform Engineer",
          company: board,
          description: "Build dependable services.",
          location: "Remote",
          workMode: "remote",
          url: "https://example.test/jobs/scheduled-atomic-valid",
          requirements: ["TypeScript"],
          contentHash: "scheduled-atomic-valid-content",
          sourceMeta: { fixture: true },
        },
        {
          source: provider,
          sourceJobId: "scheduled-atomic-invalid",
          title: " ",
          company: board,
          description: "This invalid row follows a valid one.",
          location: "Remote",
          workMode: "remote",
          url: "https://example.test/jobs/scheduled-atomic-invalid",
          requirements: [],
          contentHash: "scheduled-atomic-invalid-content",
          sourceMeta: { fixture: true },
        },
      ],
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/schedules",
          headers: { cookie },
          payload: { provider: "greenhouse", board: "atomic-board", cadenceMinutes: 60 },
        })
      ).statusCode,
    ).toBe(200);

    const cycle = await app.inject({
      method: "POST",
      url: "/v1/worker/cycle",
      headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
    });
    expect(cycle.statusCode).toBe(200);
    expect(cycle.json()).toEqual({ processed: 1, failed: 1, imported: 0, matched: 0 });

    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(
      dashboard.jobs.filter((job: { sourceJobId: string }) =>
        job.sourceJobId.startsWith("scheduled-atomic-"),
      ),
    ).toEqual([]);
  });

  it("imports a public-board role directly without publishing a match", async () => {
    const { app, cookie } = await setup({
      providerJobsFetcher: async ({ provider, board }) => [
        {
          source: provider,
          sourceJobId: " direct-role-1 ",
          title: " Direct Platform Engineer ",
          company: ` ${board} `,
          description: "Build direct-import systems.",
          location: " Remote ",
          workMode: "remote",
          url: "https://example.test/jobs/direct-role-1",
          requirements: [" TypeScript ", ""],
          contentHash: " direct-role-content-1 ",
          sourceMeta: { fixture: true },
        },
      ],
    });

    const imported = await app.inject({
      method: "POST",
      url: "/v1/jobs/import",
      headers: { cookie },
      payload: { provider: "greenhouse", board: "direct-board" },
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toMatchObject({
      imported: 1,
      jobs: [
        {
          sourceJobId: "direct-role-1",
          company: "direct-board",
          location: "Remote",
          requirements: ["TypeScript"],
          contentHash: "direct-role-content-1",
        },
      ],
    });
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const directJob = dashboard.jobs.find(
      (job: { sourceJobId: string }) => job.sourceJobId === "direct-role-1",
    );
    expect(directJob).toBeDefined();
    expect(dashboard.matches.some((match: { jobId: string }) => match.jobId === directJob.id)).toBe(
      false,
    );
  });

  it("rejects an invalid direct provider batch before writing any roles", async () => {
    const { app, cookie } = await setup({
      providerJobsFetcher: async ({ provider, board }) => [
        {
          source: provider,
          sourceJobId: "direct-atomic-valid",
          title: "Platform Engineer",
          company: board,
          description: "Build dependable services.",
          location: "Remote",
          workMode: "remote",
          url: "https://example.test/jobs/direct-atomic-valid",
          requirements: ["TypeScript"],
          contentHash: "direct-atomic-valid-content",
          sourceMeta: { fixture: true },
        },
        {
          source: provider,
          sourceJobId: "direct-atomic-invalid",
          title: " ",
          company: board,
          description: "This invalid row follows a valid one.",
          location: "Remote",
          workMode: "remote",
          url: "https://example.test/jobs/direct-atomic-invalid",
          requirements: [],
          contentHash: "direct-atomic-invalid-content",
          sourceMeta: { fixture: true },
        },
      ],
    });

    const imported = await app.inject({
      method: "POST",
      url: "/v1/jobs/import",
      headers: { cookie },
      payload: { provider: "greenhouse", board: "atomic-board" },
    });
    expect(imported.statusCode).toBe(400);
    expect(imported.json()).toMatchObject({ error: { code: "ROLE_TITLE_REQUIRED" } });

    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(
      dashboard.jobs.filter((job: { sourceJobId: string }) =>
        job.sourceJobId.startsWith("direct-atomic-"),
      ),
    ).toEqual([]);
  });

  it("uses the same current-role normalization for manual intake", async () => {
    const { app, cookie } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/v1/jobs",
      headers: { cookie },
      payload: {
        title: " Staff Engineer ",
        company: " Northwind ",
        description: " Build trustworthy systems. ",
        location: " Chicago ",
        workMode: " hybrid ",
        requirements: [" TypeScript ", "", " Evidence design "],
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      title: "Staff Engineer",
      company: "Northwind",
      description: "Build trustworthy systems.",
      location: "Chicago",
      workMode: "hybrid",
      requirements: ["TypeScript", "Evidence design"],
    });
  });

  it("runs evidence through match, packet assurance, approval, and the test outbox", async () => {
    const { app, cookie } = await setup();
    const dashboard = await app.inject({
      method: "GET",
      url: "/v1/dashboard",
      headers: { cookie },
    });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.headers["cache-control"]).toBe("no-store");
    const initial = dashboard.json();
    expect(initial.evidence).toHaveLength(4);
    expect(initial.jobs).toHaveLength(2);

    const governmentRows = [
      {
        company: "Northwind Systems, Inc.",
        label: "recent_positive_history",
        sourcePeriod: "FY2026 Q2",
        observedAt: "2026-07-15T00:00:00.000Z",
      },
    ];
    const untrustedEvaluation = await app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fixture-fy2026q2",
        checksum: canonicalHash(governmentRows),
        rows: governmentRows,
        resolutionEvaluation: Array.from({ length: 100 }, () => ({
          sourceName: "Northwind Systems, Inc.",
          expectedId: "Northwind Systems",
        })),
      },
    });
    expect(untrustedEvaluation.statusCode).toBe(400);
    expect(untrustedEvaluation.json().error.code).toBe("UNTRUSTED_RESOLUTION_EVALUATION");

    const governmentImport = await app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fixture-fy2026q2",
        checksum: canonicalHash(governmentRows),
        rows: governmentRows,
      },
    });
    expect(governmentImport.statusCode).toBe(200);
    expect(governmentImport.json()).toMatchObject({
      imported: 1,
      created: true,
      transformationVersion: "government_ingest_v1",
      resolutionEvaluation: { enabled: false, precision: 0, sampleSize: 0 },
      resolutionEvaluationProvenance: null,
      signals: [{ label: "possible", confidence: "low" }],
    });
    const idempotentImport = await app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fixture-fy2026q2",
        checksum: canonicalHash(governmentRows),
        rows: governmentRows,
      },
    });
    expect(idempotentImport.statusCode).toBe(200);
    expect(idempotentImport.json()).toMatchObject({ imported: 1, created: false });
    const transformationConflict = await app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fixture-fy2026q2",
        checksum: canonicalHash(governmentRows),
        transformationVersion: "government_ingest_v2",
        rows: governmentRows,
      },
    });
    expect(transformationConflict.statusCode).toBe(409);
    expect(transformationConflict.json().error.code).toBe("DATASET_EDITION_CONFLICT");
    const conflictingRows = [{ ...governmentRows[0], sourcePeriod: "FY2026 Q3" }];
    const conflictingImport = await app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fixture-fy2026q2",
        checksum: canonicalHash(conflictingRows),
        rows: conflictingRows,
      },
    });
    expect(conflictingImport.statusCode).toBe(409);
    expect(conflictingImport.json().error.code).toBe("DATASET_EDITION_CONFLICT");

    const evidencePayload = {
      filename: "resume.txt",
      mimeType: "text/plain",
      contentBase64: Buffer.from("Certification: AWS Solutions Architect", "utf8").toString(
        "base64",
      ),
    };
    const preview = await app.inject({
      method: "POST",
      url: "/v1/evidence/preview",
      headers: { cookie },
      payload: evidencePayload,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ claimCount: 1, preview: null });

    const imported = await app.inject({
      method: "POST",
      url: "/v1/evidence/import",
      headers: { cookie },
      payload: { ...evidencePayload, confirmedPreviewHash: preview.json().previewHash },
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json().claims[0].status).toBe("pending");

    const jobId = initial.jobs[0].id as string;
    const match = await app.inject({
      method: "POST",
      url: `/v1/jobs/${jobId}/match`,
      headers: { cookie },
    });
    expect(match.statusCode).toBe(200);
    expect(match.json().result.ruleVersion).toBe("scoring_rules_v1");

    const tracked = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId },
    });
    expect(tracked.statusCode).toBe(200);
    const applicationId = tracked.json().id as string;

    const createdPacket = await app.inject({
      method: "POST",
      url: "/v1/packets",
      headers: { cookie },
      payload: { applicationId, contactEmail: "jobs@example.test" },
    });
    expect(createdPacket.statusCode).toBe(200);
    const packetId = createdPacket.json().id as string;

    const assurance = await app.inject({
      method: "POST",
      url: `/v1/packets/${packetId}/assure`,
      headers: { cookie },
    });
    expect(assurance.json()).toMatchObject({ status: "passed", findings: [] });
    const approval = await app.inject({
      method: "POST",
      url: `/v1/packets/${packetId}/approve`,
      headers: { cookie },
    });
    expect(approval.json().status).toBe("approved");

    const reviewedDashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(reviewedDashboard.packets).toEqual([
      expect.objectContaining({
        id: packetId,
        artifactHash: expect.any(String),
        canonicalContent: expect.objectContaining({ schemaVersion: "packet_v1" }),
        artifactManifest: expect.objectContaining({
          documentInspection: expect.objectContaining({ status: "passed" }),
        }),
        latestAssurance: expect.objectContaining({
          status: "passed",
          ruleVersion: expect.stringContaining("application_assurance_v1"),
          findings: [],
        }),
      }),
    ]);

    const profileHistory = await app.inject({
      method: "GET",
      url: "/v1/history/profile-versions?limit=1",
      headers: { cookie },
    });
    expect(profileHistory.statusCode).toBe(200);
    expect(profileHistory.json()).toMatchObject({
      items: [expect.objectContaining({ id: expect.any(String), claimIds: expect.any(Array) })],
      nextCursor: null,
    });
    const matchHistory = await app.inject({
      method: "GET",
      url: `/v1/history/match-runs?jobId=${jobId}&limit=1`,
      headers: { cookie },
    });
    expect(matchHistory.statusCode).toBe(200);
    expect(matchHistory.json().items[0]).toMatchObject({
      jobId,
      currentJob: { id: jobId, title: expect.any(String) },
    });
    const packetHistory = await app.inject({
      method: "GET",
      url: `/v1/applications/${applicationId}/packets?limit=1`,
      headers: { cookie },
    });
    expect(packetHistory.statusCode).toBe(200);
    expect(packetHistory.json().items[0]).toMatchObject({ id: packetId });
    const assuranceHistory = await app.inject({
      method: "GET",
      url: `/v1/packets/${packetId}/assurance-runs?limit=1`,
      headers: { cookie },
    });
    expect(assuranceHistory.statusCode).toBe(200);
    expect(assuranceHistory.json().items[0]).toMatchObject({
      packetId,
      packetOrdinal: 1,
      status: "passed",
    });
    expect(assuranceHistory.body).not.toContain("runSequence");

    const action = await app.inject({
      method: "POST",
      url: "/v1/actions",
      headers: { cookie },
      payload: {
        packetId,
        provider: "test_outbox",
        to: "jobs@example.test",
        subject: "Application",
        body: "Please find my reviewed packet attached separately.",
      },
    });
    expect(action.json().state).toBe("pending_approval");
    const actionId = action.json().id as string;

    const newerDraftPacket = await app.inject({
      method: "POST",
      url: "/v1/packets",
      headers: { cookie },
      payload: { applicationId, contactEmail: "newer@example.test" },
    });
    expect(newerDraftPacket.statusCode).toBe(200);
    const dashboardWithActionHistory = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(dashboardWithActionHistory.packets.map((packet: { id: string }) => packet.id)).toEqual([
      newerDraftPacket.json().id,
    ]);
    expect(
      dashboardWithActionHistory.actionPackets.find(
        (packet: { id: string }) => packet.id === packetId,
      ),
    ).toMatchObject({ status: "approved" });

    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/actions/${actionId}/approve`,
          headers: { cookie },
        })
      ).json().state,
    ).toBe("approved");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/actions/${actionId}/execute`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(409);

    await app.inject({
      method: "PUT",
      url: "/v1/actions/runtime",
      headers: { cookie },
      payload: { enabled: true },
    });
    const executed = await app.inject({
      method: "POST",
      url: `/v1/actions/${actionId}/execute`,
      headers: { cookie },
    });
    expect(executed.statusCode).toBe(200);
    expect(executed.json().state).toBe("succeeded");
    const reference = executed.json().result.providerReference as string;
    expect(JSON.parse(await readFile(reference, "utf8"))).toMatchObject({
      provider: "test_outbox",
      to: "jobs@example.test",
      subject: "Application",
      body: "Please find my reviewed packet attached separately.",
    });

    const exported = await app.inject({
      method: "GET",
      url: "/v1/export",
      headers: { cookie },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.json()).toMatchObject({
      exportVersion: "nimanto-local-beta-v2",
      identity: { displayName: "Priya Shah", email: "priya@example.test" },
      workspace: {
        schemaVersion: "nimanto_export_v2",
        profileVersions: expect.any(Array),
        matchRuns: expect.any(Array),
        assuranceRuns: expect.any(Array),
      },
    });
    expect(exported.json().artifactNote).toContain("individually downloadable");

    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/data",
      headers: { cookie },
      payload: { confirmation: "DELETE MY NIMANTO DATA" },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({ message: expect.stringContaining("was deleted") });
    expect(typeof deleted.json().token).toBe("string");
    expect(
      (await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })).statusCode,
    ).toBe(401);
    await expect(readFile(reference, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  }, 20_000);

  /* The rate limiter is a guard, not a fault. Reporting its rejection as a
   * server error is what put "Connect the local service" on the workbench while
   * the service was healthy — sending the candidate to restart a backend that
   * was already running, when the only remedy was to wait. */
  it("reports throttling as throttling rather than as a broken local service", async () => {
    const { app } = await setup();
    /* Bounded above the configured ceiling rather than equal to it, so raising
     * the ceiling does not quietly turn this into a test of nothing. */
    let last = await app.inject({ method: "GET", url: "/health" });
    for (let attempt = 0; attempt < 1_500 && last.statusCode === 200; attempt += 1) {
      last = await app.inject({ method: "GET", url: "/health" });
    }
    expect(last.statusCode).toBe(429);
    expect(last.json().error.code).toBe("RATE_LIMITED");
    expect(last.json().error.message).toMatch(/wait/i);
    expect(last.headers["retry-after"]).toBeDefined();
  });

  it("enforces session and tenant boundaries", async () => {
    const { app, cookie } = await setup();
    expect((await app.inject({ method: "GET", url: "/v1/dashboard" })).statusCode).toBe(401);
    const first = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const otherLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/local",
      headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
      payload: { email: "other@example.test", displayName: "Other" },
    });
    const header = otherLogin.headers["set-cookie"];
    const otherCookie = (Array.isArray(header) ? header[0] : header)?.split(";")[0] ?? "";
    const foreign = await app.inject({
      method: "POST",
      url: `/v1/jobs/${first.jobs[0].id}/match`,
      headers: { cookie: otherCookie },
    });
    expect(foreign.statusCode).toBe(404);
    const foreignProfileCursor = await app.inject({
      method: "GET",
      url: `/v1/history/profile-versions?cursor=${first.profile.id}`,
      headers: { cookie: otherCookie },
    });
    expect(foreignProfileCursor.statusCode).toBe(400);
    expect(foreignProfileCursor.json().error.code).toBe("INVALID_CURSOR");
    const foreignMatchHistory = await app.inject({
      method: "GET",
      url: `/v1/history/match-runs?jobId=${first.jobs[0].id}`,
      headers: { cookie: otherCookie },
    });
    expect(foreignMatchHistory.statusCode).toBe(404);
  });

  it("does not let a second client resume a workspace without the private launch key", async () => {
    const { app } = await setup();
    const attempted = await app.inject({ method: "POST", url: "/v1/auth/demo", payload: {} });
    expect(attempted.statusCode).toBe(401);
    expect(attempted.json().error.code).toBe("INVALID_BOOTSTRAP_SECRET");
  });

  it("issues, accepts, and consumes a private invitation without public signup", async () => {
    const { app } = await setup();
    const denied = await app.inject({
      method: "POST",
      url: "/v1/auth/invitations",
      payload: { email: "invitee@example.test" },
    });
    expect(denied.statusCode).toBe(401);

    const issued = await app.inject({
      method: "POST",
      url: "/v1/auth/invitations",
      headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
      payload: { email: "invitee@example.test" },
    });
    expect(issued.statusCode).toBe(200);
    const accepted = await app.inject({
      method: "POST",
      url: "/v1/auth/invitations/accept",
      payload: {
        token: issued.json().token,
        email: "invitee@example.test",
        displayName: "Invitee",
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().identity).toMatchObject({ email: "invitee@example.test" });
    expect(accepted.headers["set-cookie"]).toBeDefined();

    const reused = await app.inject({
      method: "POST",
      url: "/v1/auth/invitations/accept",
      payload: {
        token: issued.json().token,
        email: "invitee@example.test",
        displayName: "Invitee",
      },
    });
    expect(reused.statusCode).toBe(409);
  });

  it("fails packet approval and download closed after artifact tampering", async () => {
    const { app, cookie, root, tenantId } = await setup();
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const tracked = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId: dashboard.jobs[0].id },
    });
    const packetResponse = await app.inject({
      method: "POST",
      url: "/v1/packets",
      headers: { cookie },
      payload: { applicationId: tracked.json().id },
    });
    const packet = packetResponse.json();
    await app.inject({
      method: "POST",
      url: `/v1/packets/${packet.id}/assure`,
      headers: { cookie },
    });
    const artifact = packet.artifactManifest.artifacts[0];
    await writeFile(
      path.join(root, "artifacts", tenantId, packet.id, artifact.filename),
      "changed",
    );

    const approval = await app.inject({
      method: "POST",
      url: `/v1/packets/${packet.id}/approve`,
      headers: { cookie },
    });
    expect(approval.statusCode).toBe(409);
    expect(approval.json().error.code).toBe("ARTIFACT_INTEGRITY_FAILED");
    const download = await app.inject({
      method: "GET",
      url: `/v1/packets/${packet.id}/artifacts/${artifact.format}`,
      headers: { cookie },
    });
    expect(download.statusCode).toBe(409);
  });

  it("blocks assurance when a configured exact local reviewer is unavailable", async () => {
    const { app, cookie } = await setup({ assuranceModel: "gemma4:12b" });
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const tracked = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId: dashboard.jobs[0].id },
    });
    const packet = await app.inject({
      method: "POST",
      url: "/v1/packets",
      headers: { cookie },
      payload: { applicationId: tracked.json().id },
    });
    const assurance = await app.inject({
      method: "POST",
      url: `/v1/packets/${packet.json().id}/assure`,
      headers: { cookie },
    });
    expect(assurance.statusCode).toBe(200);
    expect(assurance.json()).toMatchObject({
      status: "blocked",
      findings: [
        expect.objectContaining({ code: "MODEL_REVIEW_BLOCKED_UNAVAILABLE", severity: "required" }),
      ],
    });
  });

  it("keeps deletion resumable when filesystem cleanup fails", async () => {
    let attempts = 0;
    const { app, cookie } = await setup({
      removePath: async (target, settings) => {
        attempts += 1;
        if (attempts === 1) throw new Error("synthetic cleanup fault");
        await rm(target, settings);
      },
    });
    const first = await app.inject({
      method: "DELETE",
      url: "/v1/data",
      headers: { cookie },
      payload: { confirmation: "DELETE MY NIMANTO DATA" },
    });
    expect(first.statusCode).toBe(202);
    expect(first.json()).toMatchObject({ state: "cleanup_pending" });
    expect(first.json().message).not.toContain("All workspace data was deleted");
    const token = first.json().token as string;
    const pending = await app.inject({ method: "GET", url: `/v1/deletion/status?token=${token}` });
    expect(pending.json().state).toBe("cleanup_pending");

    const resumed = await app.inject({
      method: "POST",
      url: "/v1/deletion/resume",
      payload: { token },
    });
    expect(resumed.statusCode).toBe(200);
    expect(resumed.json().state).toBe("completed");
  });
  it("names the required order when a transition skips a stage", async () => {
    // The generic 400 ("The request needs attention...") is the right default
    // for validation, but it left the candidate with no way to know an
    // application has to pass through Prepared. The specific code has to be
    // tested before the INVALID_ catch-all or it can never fire.
    const { app, cookie } = await setup();
    const dashboard = await app.inject({
      method: "GET",
      url: "/v1/dashboard",
      headers: { cookie },
    });
    const jobId = dashboard.json().jobs[0].id as string;
    const tracked = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId },
    });
    expect(tracked.statusCode).toBe(200);

    const skipped = await app.inject({
      method: "PUT",
      url: `/v1/applications/${tracked.json().id}/status`,
      headers: { cookie },
      payload: { status: "submitted_externally" },
    });
    expect(skipped.statusCode).toBe(409);
    expect(skipped.json().error.code).toBe("INVALID_APPLICATION_TRANSITION");
    expect(skipped.json().error.message).toContain("Prepared");
  });

  it("requires an explicit API confirmation for a consequential candidate move", async () => {
    const { app, cookie } = await setup();
    const dashboard = await app.inject({
      method: "GET",
      url: "/v1/dashboard",
      headers: { cookie },
    });
    const tracked = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId: dashboard.json().jobs[0].id },
    });

    const unconfirmed = await app.inject({
      method: "PUT",
      url: `/v1/applications/${tracked.json().id}/status`,
      headers: { cookie },
      payload: { status: "withdrawn" },
    });
    expect(unconfirmed.statusCode).toBe(409);
    expect(unconfirmed.json().error.code).toBe("APPLICATION_TRANSITION_CONFIRMATION_REQUIRED");

    const confirmed = await app.inject({
      method: "PUT",
      url: `/v1/applications/${tracked.json().id}/status`,
      headers: { cookie },
      payload: { status: "withdrawn", confirmed: true },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().status).toBe("withdrawn");
  });

  it("previews the claims an import would create, not just how many", async () => {
    // The contract promises a preview of every accepted field before ingestion.
    const { app, cookie } = await setup();
    const preview = await app.inject({
      method: "POST",
      url: "/v1/evidence/preview",
      headers: { cookie },
      payload: {
        filename: "career-notes.txt",
        mimeType: "text/plain",
        contentBase64: Buffer.from(
          "Skill: TypeScript and API design\nProject: Shipped a versioned public API\n",
        ).toString("base64"),
      },
    });
    expect(preview.statusCode).toBe(200);
    const body = preview.json();
    expect(body.claimCount).toBeGreaterThan(0);
    // The count describes the list, not the parse: preview and import slice the
    // same bounded array, so a count above the list length would promise claims
    // the import then drops.
    expect(body.claims).toHaveLength(body.claimCount);
    expect(body.claimCount).toBeLessThanOrEqual(body.parsedCount);
    expect(body.claims.map((claim: { value: string }) => claim.value).join(" ")).toContain(
      "TypeScript",
    );
    for (const claim of body.claims) {
      expect(Object.keys(claim).sort()).toEqual(["kind", "locator", "sourceName", "value"]);
    }

    // Preview stores nothing.
    const after = await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } });
    expect(
      after.json().evidence.some((claim: { value: string }) => claim.value.includes("versioned")),
    ).toBe(false);
  });
});
