import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { NimantoStore } from "@nimanto/database";
import {
  canonicalHash,
  governmentEvidenceLanguageContractChecksum,
  governmentEvidenceLanguageReviewChecksum,
  governmentDatasetProvenanceChecksum,
  roleSnapshotHash,
  type GovernmentDatasetProvenance,
  type GovernmentEvidenceLanguageReview,
} from "@nimanto/domain";
import type { ProviderJobVerificationResult } from "@nimanto/providers";
import type { GovernmentDatasetTrust } from "../src/config.js";
import { buildServer, messageForError } from "../src/server.js";
import { NIMANTO_VERSION } from "../src/version.js";

const apps: FastifyInstance[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const bootstrapSecret = "test-bootstrap-secret-with-at-least-32-characters";

async function setup(options?: {
  removePath?: (
    target: string,
    settings: { recursive?: boolean; force?: boolean },
  ) => Promise<void>;
  assuranceModel?: string;
  externalActionsEnabled?: boolean;
  urlAllowlist?: string[];
  urlTermsReviewedAt?: string;
  governmentDatasetTrust?: GovernmentDatasetTrust;
  allowlistedJobPageFetcher?: (input: {
    url: string;
    allowedHosts: string[];
  }) => Promise<{ canonicalUrl: string; text: string; observedAt: string }>;
  localModel?: {
    status: () => Promise<{ available: boolean; models: string[] }>;
    draftSummary: (input: {
      model: string;
      role: string;
      company: string;
      evidence: string[];
    }) => Promise<{ text: string; model: string; label: "unverified_local_draft" }>;
  };
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
  providerJobVerifier?: (request: {
    provider: "greenhouse" | "lever" | "ashby";
    board: string;
    sourceJobId: string;
  }) => Promise<ProviderJobVerificationResult>;
}): Promise<{
  app: FastifyInstance;
  cookie: string;
  root: string;
  tenantId: string;
  sessionId: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "nimanto-api-"));
  const app = await buildServer({
    dataDirectory: path.join(root, "database"),
    artifactDirectory: path.join(root, "artifacts"),
    outboxDirectory: path.join(root, "outbox"),
    webOrigin: "http://127.0.0.1:4300",
    demoMode: true,
    externalActionsEnabled: options?.externalActionsEnabled ?? true,
    bootstrapSecret,
    urlAllowlist: options?.urlAllowlist ?? [],
    port: 4310,
    host: "127.0.0.1",
    ...(options?.removePath ? { removePath: options.removePath } : {}),
    ...(options?.assuranceModel ? { assuranceModel: options.assuranceModel } : {}),
    ...(options?.urlTermsReviewedAt ? { urlTermsReviewedAt: options.urlTermsReviewedAt } : {}),
    ...(options?.governmentDatasetTrust
      ? {
          governmentDatasetTrust: options.governmentDatasetTrust,
        }
      : {}),
    ...(options?.allowlistedJobPageFetcher
      ? { allowlistedJobPageFetcher: options.allowlistedJobPageFetcher }
      : {}),
    ...(options?.localModel ? { localModel: options.localModel } : {}),
    ...(options?.providerJobsFetcher ? { providerJobsFetcher: options.providerJobsFetcher } : {}),
    ...(options?.providerJobVerifier ? { providerJobVerifier: options.providerJobVerifier } : {}),
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
  return {
    app,
    cookie,
    root,
    tenantId: login.json().identity.tenantId as string,
    sessionId: login.json().identity.sessionId as string,
  };
}

describe("Nimanto beta API", () => {
  it("rejects a browser write when a sibling tab replaced the rendered session", async () => {
    const { app, sessionId } = await setup();
    const replacement = await app.inject({
      method: "POST",
      url: "/v1/auth/local",
      headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
      payload: { displayName: "Replacement", email: "replacement-fence@example.test" },
    });
    const header = replacement.headers["set-cookie"];
    const replacementCookie = (Array.isArray(header) ? header[0] : header)?.split(";")[0] ?? "";
    const replacementSessionId = replacement.json().identity.sessionId as string;

    const stale = await app.inject({
      method: "POST",
      url: "/v1/evidence",
      headers: {
        cookie: replacementCookie,
        origin: "http://127.0.0.1:4300",
        "x-nimanto-expected-session-id": sessionId,
      },
      payload: { kind: "skill", value: "Must not cross sessions" },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe("IDENTITY_CHANGED");

    const unfenced = await app.inject({
      method: "POST",
      url: "/v1/evidence",
      headers: { cookie: replacementCookie, origin: "http://127.0.0.1:4300" },
      payload: { kind: "skill", value: "Missing session fence" },
    });
    expect(unfenced.statusCode).toBe(409);
    expect(unfenced.json().error.code).toBe("IDENTITY_CHANGED");

    const current = await app.inject({
      method: "POST",
      url: "/v1/evidence",
      headers: {
        cookie: replacementCookie,
        origin: "http://127.0.0.1:4300",
        "x-nimanto-expected-session-id": replacementSessionId,
      },
      payload: { kind: "skill", value: "Current session evidence" },
    });
    expect(current.statusCode).toBe(200);
  });

  it("reports one release version through health, metadata, and OpenAPI", async () => {
    const { app, cookie } = await setup();
    expect((await app.inject({ method: "GET", url: "/health" })).json().version).toBe(
      NIMANTO_VERSION,
    );
    expect((await app.inject({ method: "GET", url: "/v1/meta" })).json().version).toBe(
      NIMANTO_VERSION,
    );
    expect((await app.inject({ method: "GET", url: "/docs/json" })).json().info.version).toBe(
      NIMANTO_VERSION,
    );
    expect((await app.inject({ method: "GET", url: "/v1/meta" })).json().providers).toMatchObject({
      reviewedUrlIntake: false,
      reviewedUrlTermsAt: null,
      reviewedUrlHosts: [],
    });
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    for (const job of dashboard.jobs) {
      expect(job.contentHash).toBe(roleSnapshotHash(job));
    }
  });

  it("keeps tenant external-action consent below the operator ceiling", async () => {
    const { app, cookie } = await setup({ externalActionsEnabled: false });
    const optedIn = await app.inject({
      method: "PUT",
      url: "/v1/actions/runtime",
      headers: { cookie },
      payload: { enabled: true },
    });
    expect(optedIn.statusCode).toBe(200);
    expect(optedIn.json()).toEqual({
      operatorEnabled: false,
      tenantReady: true,
      externalActionsEnabled: false,
    });
    const dashboard = await app.inject({
      method: "GET",
      url: "/v1/dashboard",
      headers: { cookie },
    });
    expect(dashboard.json().runtime).toEqual({
      operatorEnabled: false,
      tenantReady: true,
      externalActionsEnabled: false,
    });
    const optedOut = await app.inject({
      method: "PUT",
      url: "/v1/actions/runtime",
      headers: { cookie },
      payload: { enabled: false },
    });
    expect(optedOut.json()).toEqual({
      operatorEnabled: false,
      tenantReady: false,
      externalActionsEnabled: false,
    });
    expect(
      (await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })).json()
        .runtime,
    ).toEqual({
      operatorEnabled: false,
      tenantReady: false,
      externalActionsEnabled: false,
    });
  });

  it("projects readiness only after the tenant enables it for this server process", async () => {
    const { app, cookie } = await setup({ externalActionsEnabled: true });
    const before = await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } });
    expect(before.json().runtime).toEqual({
      operatorEnabled: true,
      tenantReady: false,
      externalActionsEnabled: false,
    });
    await app.inject({
      method: "PUT",
      url: "/v1/actions/runtime",
      headers: { cookie },
      payload: { enabled: true },
    });
    const after = await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } });
    expect(after.json().runtime).toEqual({
      operatorEnabled: true,
      tenantReady: true,
      externalActionsEnabled: true,
    });
  });

  it("reports and completes reviewed URL intake only through the configured capability", async () => {
    let fetched: { url: string; allowedHosts: string[] } | null = null;
    const { app, cookie } = await setup({
      urlAllowlist: ["jobs.example.test"],
      urlTermsReviewedAt: "2026-08-25",
      allowlistedJobPageFetcher: async (input) => {
        fetched = input;
        if (!input.allowedHosts.includes(new URL(input.url).hostname)) {
          throw new Error("SOURCE_URL_NOT_ALLOWED");
        }
        return {
          canonicalUrl: "https://jobs.example.test/openings/platform",
          text: "Build accessible TypeScript services from a reviewed public role posting.",
          observedAt: "2026-08-25T12:00:00.000Z",
        };
      },
    });
    expect((await app.inject({ method: "GET", url: "/v1/meta" })).json().providers).toMatchObject({
      reviewedUrlIntake: true,
      reviewedUrlTermsAt: "2026-08-25",
      reviewedUrlHosts: ["jobs.example.test"],
    });

    const imported = await app.inject({
      method: "POST",
      url: "/v1/jobs/url-import",
      headers: { cookie },
      payload: {
        url: "https://jobs.example.test/openings/platform",
        title: "Platform Engineer",
        company: "Example Labs",
        location: "Remote",
        workMode: "remote",
        requirements: ["TypeScript", "Accessible interfaces"],
      },
    });
    expect(imported.statusCode).toBe(200);
    expect(fetched).toEqual({
      url: "https://jobs.example.test/openings/platform",
      allowedHosts: ["jobs.example.test"],
    });
    expect(imported.json()).toMatchObject({
      source: "allowlisted_url",
      title: "Platform Engineer",
      company: "Example Labs",
      description: "Build accessible TypeScript services from a reviewed public role posting.",
      url: "https://jobs.example.test/openings/platform",
      sourceMeta: {
        observedAt: "2026-08-25T12:00:00.000Z",
        termsReviewedAt: "2026-08-25",
        transientBodyDeleted: true,
      },
    });
    const published = await app.inject({
      method: "POST",
      url: `/v1/jobs/${imported.json().id}/match`,
      headers: { cookie },
    });
    expect(published.statusCode).toBe(200);
    const unchanged = await app.inject({
      method: "POST",
      url: "/v1/jobs/url-import",
      headers: { cookie },
      payload: {
        url: "https://jobs.example.test/openings/platform",
        title: " Platform Engineer ",
        company: " Example Labs ",
        location: " Remote ",
        workMode: "remote",
        requirements: [" TypeScript ", "Accessible interfaces"],
      },
    });
    expect(unchanged.json().contentHash).toBe(imported.json().contentHash);
    expect(
      (await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } }))
        .json()
        .matches.some((match: { jobId: string }) => match.jobId === imported.json().id),
    ).toBe(true);
    const materiallyChanged = await app.inject({
      method: "POST",
      url: "/v1/jobs/url-import",
      headers: { cookie },
      payload: {
        url: "https://jobs.example.test/openings/platform",
        title: "Platform Engineer",
        company: "Example Labs",
        location: "Chicago",
        workMode: "hybrid",
        requirements: ["TypeScript", "Accessible interfaces"],
      },
    });
    expect(materiallyChanged.json().contentHash).not.toBe(imported.json().contentHash);
    expect(
      (await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } }))
        .json()
        .matches.some((match: { jobId: string }) => match.jobId === imported.json().id),
    ).toBe(false);

    const refused = await app.inject({
      method: "POST",
      url: "/v1/jobs/url-import",
      headers: { cookie },
      payload: {
        url: "https://other.example.test/opening",
        title: "Refused role",
        company: "Other",
        requirements: [],
      },
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().error).toMatchObject({
      code: "SOURCE_URL_NOT_ALLOWED",
      message: expect.stringContaining("allowlisted HTTPS"),
    });
  });

  it("archives and restores a role without changing its source record", async () => {
    const { app, cookie } = await setup();
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const job = dashboard.jobs[0];
    const archived = await app.inject({
      method: "PUT",
      url: `/v1/jobs/${job.id}/disposition`,
      headers: { cookie },
      payload: { archived: true },
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json()).toMatchObject({
      id: job.id,
      source: job.source,
      title: job.title,
      candidateDisposition: { state: "archived", archivedAt: expect.any(String) },
    });
    const restored = await app.inject({
      method: "PUT",
      url: `/v1/jobs/${job.id}/disposition`,
      headers: { cookie },
      payload: { archived: false },
    });
    expect(restored.json()).toMatchObject({
      id: job.id,
      candidateDisposition: { state: "active", archivedAt: null },
    });
  });

  it("records candidate review of only the latest exact role-wording quote", async () => {
    const { app, cookie } = await setup();
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const job = dashboard.jobs.find((candidate: { title: string }) =>
      candidate.title.includes("Product Engineer"),
    );
    const published = await app.inject({
      method: "POST",
      url: `/v1/jobs/${job.id}/match`,
      headers: { cookie },
    });
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({
      jobContentHash: job.contentHash,
      result: {
        blockers: [
          expect.objectContaining({
            code: "no_sponsorship_of_any_kind",
            consequence: "visible_warning",
            candidateConfirmed: false,
          }),
        ],
      },
    });

    const reviewed = await app.inject({
      method: "PUT",
      url: `/v1/jobs/${job.id}/role-wording-review`,
      headers: { cookie },
      payload: {
        matchRunId: published.json().id,
        blockerCode: "no_sponsorship_of_any_kind",
        reviewed: true,
      },
    });
    expect(reviewed.statusCode).toBe(200);
    expect(reviewed.json()).toMatchObject({
      jobId: job.id,
      matchRunId: published.json().id,
      blockerCode: "no_sponsorship_of_any_kind",
      reviewedAt: expect.any(String),
    });
    const refreshedDashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(refreshedDashboard.roleWordingReviews).toEqual([reviewed.json()]);

    const refused = await app.inject({
      method: "PUT",
      url: `/v1/jobs/${job.id}/role-wording-review`,
      headers: { cookie },
      payload: {
        matchRunId: published.json().id,
        blockerCode: "location_conflict",
        reviewed: true,
      },
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.json()).toMatchObject({ error: { code: "ROLE_WORDING_NOT_REVIEWABLE" } });

    const cleared = await app.inject({
      method: "PUT",
      url: `/v1/jobs/${job.id}/role-wording-review`,
      headers: { cookie },
      payload: {
        matchRunId: published.json().id,
        blockerCode: "no_sponsorship_of_any_kind",
        reviewed: false,
      },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toBeNull();
  });

  it("adds a private application note without changing funnel outcomes", async () => {
    const { app, cookie } = await setup();
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const application = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId: dashboard.jobs[0].id },
    });
    const note = await app.inject({
      method: "POST",
      url: `/v1/applications/${application.json().id}/notes`,
      headers: { cookie },
      payload: { text: "  Verify the on-call expectation.  " },
    });
    expect(note.statusCode).toBe(200);
    expect(note.json()).toMatchObject({ text: "Verify the on-call expectation." });
    const refreshed = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(
      refreshed.applications.find((item: { id: string }) => item.id === application.json().id),
    ).toMatchObject({
      status: "tracked",
      outcomes: [],
      notes: [expect.objectContaining({ text: "Verify the on-call expectation." })],
    });
    expect(refreshed.personalFunnel).toMatchObject({
      replies: 0,
      screens: 0,
      interviews: 0,
      offers: 0,
    });
  });

  it("serves the complete candidate career ledger through scoped write seams", async () => {
    const { app, cookie } = await setup();
    const initial = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const application = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId: initial.jobs[0].id },
    });
    const applicationId = application.json().id as string;
    const secondApplication = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId: initial.jobs[1].id },
    });
    const secondApplicationId = secondApplication.json().id as string;
    const contact = await app.inject({
      method: "POST",
      url: "/v1/contacts",
      headers: { cookie },
      payload: {
        name: "Alex Recruiter",
        organization: "Northwind",
        kind: "recruiter",
        applicationId,
      },
    });
    expect(contact.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/contacts/${contact.json().id}/applications`,
          headers: { cookie },
          payload: { applicationId: secondApplicationId, role: "referral" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/contacts/${contact.json().id}/applications`,
          headers: { cookie },
          payload: { applicationId: secondApplicationId, role: "referral" },
        })
      ).statusCode,
    ).toBe(200);
    const activity = await app.inject({
      method: "POST",
      url: "/v1/application-activities",
      headers: { cookie },
      payload: {
        applicationId,
        contactId: contact.json().id,
        kind: "follow_up",
        title: "Send thank-you note",
        dueAt: "2026-09-01T15:00:00.000Z",
      },
    });
    expect(activity.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/application-activities/${activity.json().id}/state`,
          headers: { cookie },
          payload: { state: "completed" },
        })
      ).statusCode,
    ).toBe(200);
    const interview = await app.inject({
      method: "POST",
      url: "/v1/interview-rounds",
      headers: { cookie },
      payload: {
        applicationId,
        kind: "technical",
        scheduledAt: "2026-09-03T18:00:00.000Z",
        participants: ["Taylor"],
      },
    });
    expect(interview.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/interview-rounds/${interview.json().id}/state`,
          headers: { cookie },
          payload: { state: "completed", outcomeNotes: "Candidate-recorded round outcome." },
        })
      ).statusCode,
    ).toBe(200);
    const confirmedEvidence = initial.evidence.find(
      (claim: { status: string }) => claim.status === "confirmed",
    );
    const answer = await app.inject({
      method: "POST",
      url: "/v1/answer-blocks",
      headers: { cookie },
      payload: {
        topic: "accomplishment",
        prompt: "Tell me about a result.",
        answerText: "I improved a documented process.",
        evidenceIds: [confirmedEvidence.id],
      },
    });
    expect(answer.statusCode).toBe(200);
    const revision = await app.inject({
      method: "PUT",
      url: `/v1/answer-blocks/${answer.json().id}`,
      headers: { cookie },
      payload: {
        topic: "accomplishment",
        prompt: "Tell me about a result.",
        answerText: "I improved a documented process and retained the revision.",
        evidenceIds: [confirmedEvidence.id],
      },
    });
    expect(revision.statusCode).toBe(200);
    expect(revision.json().currentRevision).toBe(2);
    const firstPage = await app.inject({
      method: "GET",
      url: `/v1/answer-blocks/${answer.json().id}/revisions?limit=1`,
      headers: { cookie },
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json().currentRevision).toBe(2);
    expect(firstPage.json().revisions).toHaveLength(1);
    expect(firstPage.json().nextCursor).toBeTruthy();
    expect(firstPage.json().revisions[0].answerText).toContain("retained the revision");
    const secondPage = await app.inject({
      method: "GET",
      url: `/v1/answer-blocks/${answer.json().id}/revisions?cursor=${firstPage.json().nextCursor}&limit=1`,
      headers: { cookie },
    });
    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json().revisions).toHaveLength(1);
    expect(secondPage.json().nextCursor).toBe(null);
    expect(secondPage.json().revisions[0].revision).toBe(1);
    const pendingEvidence = await app.inject({
      method: "POST",
      url: "/v1/evidence",
      headers: { cookie },
      payload: { kind: "project", value: "Pending answer evidence" },
    });
    const rejectedAnswer = await app.inject({
      method: "POST",
      url: "/v1/answer-blocks",
      headers: { cookie },
      payload: {
        topic: "custom",
        prompt: "This should be rejected.",
        answerText: "Pending evidence is not linkable.",
        evidenceIds: [pendingEvidence.json().id],
      },
    });
    expect(rejectedAnswer.statusCode).toBe(409);
    expect(rejectedAnswer.json().error.code).toBe("EVIDENCE_SELECTION_CHANGED");
    const view = await app.inject({
      method: "POST",
      url: "/v1/application-views",
      headers: { cookie },
      payload: {
        name: "Tracked manual roles",
        filters: { status: "tracked", source: "manual", sort: "stored" },
      },
    });
    expect(view.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/application-views/${view.json().id}/review`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(200);
    const offer = await app.inject({
      method: "PUT",
      url: `/v1/applications/${applicationId}/offer`,
      headers: { cookie },
      payload: { currency: "USD", baseMinor: 15_000_000, bonusMinor: 1_000_000 },
    });
    expect(offer.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/offers/${offer.json().id}/state`,
          headers: { cookie },
          payload: { state: "accepted" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/applications/${applicationId}/offer`,
          headers: { cookie },
          payload: { currency: "USD", baseMinor: 15_000_000, startOn: "2026-02-30" },
        })
      ).statusCode,
    ).toBe(400);

    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(dashboard.careerOperations).toMatchObject({
      activities: [expect.objectContaining({ state: "completed", title: "Send thank-you note" })],
      contacts: [
        expect.objectContaining({
          name: "Alex Recruiter",
          applicationLinks: expect.arrayContaining([
            expect.objectContaining({ applicationId }),
            expect.objectContaining({ applicationId: secondApplicationId, role: "referral" }),
          ]),
        }),
      ],
      interviews: [
        expect.objectContaining({
          kind: "technical",
          state: "completed",
          outcomeNotes: "Candidate-recorded round outcome.",
        }),
      ],
      answerBlocks: [expect.objectContaining({ currentRevision: 2 })],
      savedViews: [expect.objectContaining({ lastReviewedAt: expect.any(String) })],
      offers: [expect.objectContaining({ baseMinor: 15_000_000, state: "accepted" })],
    });
    expect(dashboard.applications[0].statusEvents).toEqual([
      expect.objectContaining({ fromStatus: null, toStatus: "tracked", source: "candidate" }),
    ]);
  });

  it("validates answer revision history cursors and not-found answers", async () => {
    const { app, cookie } = await setup();
    const answer = await app.inject({
      method: "POST",
      url: "/v1/answer-blocks",
      headers: { cookie },
      payload: {
        topic: "accomplishment",
        prompt: "Tell me about a result.",
        answerText: "A short recorded answer for cursor checks.",
      },
    });
    expect(answer.statusCode).toBe(200);
    const malformedCursor = await app.inject({
      method: "GET",
      url: `/v1/answer-blocks/${answer.json().id}/revisions?cursor=not-a-uuid`,
      headers: { cookie },
    });
    expect(malformedCursor.statusCode).toBe(400);
    expect(malformedCursor.json().error.code).toBe("INVALID_CURSOR");
    const invalidCursor = await app.inject({
      method: "GET",
      url: `/v1/answer-blocks/${answer.json().id}/revisions?cursor=${randomUUID()}`,
      headers: { cookie },
    });
    expect(invalidCursor.statusCode).toBe(400);
    expect(invalidCursor.json().error.code).toBe("INVALID_CURSOR");
    const missing = await app.inject({
      method: "GET",
      url: "/v1/answer-blocks/no-such-answer/revisions",
      headers: { cookie },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("ANSWER_BLOCK_NOT_FOUND");
  });

  it("drafts locally from only the candidate-selected confirmed evidence", async () => {
    let received: { model: string; role: string; company: string; evidence: string[] } | null =
      null;
    const { app, cookie } = await setup({
      localModel: {
        status: async () => ({ available: true, models: ["qwen3:local"] }),
        draftSummary: async (input) => {
          received = input;
          return {
            text: "Candidate has supported platform evidence. The selected claim is relevant to this role.",
            model: input.model,
            label: "unverified_local_draft",
          };
        },
      },
    });
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const selected = dashboard.evidence.find(
      (claim: { status: string }) => claim.status === "confirmed",
    );
    expect(selected).toBeTruthy();
    expect(
      (await app.inject({ method: "GET", url: "/v1/models/status", headers: { cookie } })).json(),
    ).toEqual({ available: true, models: ["qwen3:local"] });
    const response = await app.inject({
      method: "POST",
      url: "/v1/models/draft-summary",
      headers: { cookie },
      payload: {
        model: "qwen3:local",
        jobId: dashboard.jobs[0].id,
        evidenceIds: [selected.id],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().label).toBe("unverified_local_draft");
    expect(received).toMatchObject({
      model: "qwen3:local",
      role: dashboard.jobs[0].title,
      company: dashboard.jobs[0].company,
      evidence: [selected.value],
    });

    const rejected = await app.inject({
      method: "POST",
      url: "/v1/models/draft-summary",
      headers: { cookie },
      payload: {
        model: "qwen3:local",
        jobId: dashboard.jobs[0].id,
        evidenceIds: [selected.id, selected.id],
      },
    });
    expect(rejected.statusCode).toBe(400);
  });

  it("rejects oversized local-draft evidence before calling the model adapter", async () => {
    let called = false;
    const { app, cookie } = await setup({
      localModel: {
        status: async () => ({ available: true, models: ["qwen3:local"] }),
        draftSummary: async (input) => {
          called = true;
          return {
            text: input.evidence.join(" "),
            model: input.model,
            label: "unverified_local_draft",
          };
        },
      },
    });
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const created = await app.inject({
      method: "POST",
      url: "/v1/evidence",
      headers: { cookie },
      payload: { kind: "project", value: "x".repeat(8 * 1024 + 1) },
    });
    expect(created.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/evidence/${created.json().id}/confirm`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(200);

    const response = await app.inject({
      method: "POST",
      url: "/v1/models/draft-summary",
      headers: { cookie },
      payload: {
        model: "qwen3:local",
        jobId: dashboard.jobs[0].id,
        evidenceIds: [created.json().id],
      },
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe("LOCAL_DRAFT_INPUT_TOO_LARGE");
    expect(called).toBe(false);
  });

  it("assembles a counts-only personalFunnel from candidate-reported outcomes", async () => {
    const { app, cookie } = await setup();
    const initial = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const first = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId: initial.jobs[0].id },
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId: initial.jobs[1].id },
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const recordedOutcomes: Array<{
      id: string;
      applicationId: string;
      type: string;
      note: string;
      occurredAt: string;
    }> = [];
    for (const type of ["reply", "screen"]) {
      const recorded = await app.inject({
        method: "POST",
        url: `/v1/applications/${first.json().id}/outcomes`,
        headers: { cookie },
        payload: { type, note: "Candidate record" },
      });
      expect(recorded.statusCode).toBe(200);
      recordedOutcomes.push(recorded.json());
    }

    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(dashboard.personalFunnel).toEqual({
      sampleSize: 2,
      replies: 1,
      screens: 1,
      interviews: 0,
      offers: 0,
      scope: "Candidate-reported outcomes in this local workspace; not a hiring probability.",
    });
    expect(Object.keys(dashboard.personalFunnel).sort()).toEqual([
      "interviews",
      "offers",
      "replies",
      "sampleSize",
      "scope",
      "screens",
    ]);
    const returnedApplication = dashboard.applications.find(
      (application: { id: string }) => application.id === first.json().id,
    );
    expect(returnedApplication.outcomes).toHaveLength(2);
    for (const recorded of recordedOutcomes) {
      expect(returnedApplication.outcomes).toContainEqual({
        id: recorded.id,
        applicationId: recorded.applicationId,
        type: recorded.type,
        note: recorded.note,
        occurredAt: recorded.occurredAt,
      });
    }
  });

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
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
          availability: {
            publicationState: "active",
            verificationHealth: "verified",
            verificationMethod: "complete_list",
          },
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
    expect(dashboard.sourceRuns).toEqual([
      expect.objectContaining({
        source: "greenhouse",
        boardId: "direct-board",
        complete: true,
        sourceItemCount: 1,
      }),
    ]);
  });

  it("binds provider roles to normalized content instead of provider fingerprints", async () => {
    let location = " Remote ";
    let providerFingerprint = "provider-fingerprint-one";
    const { app, cookie } = await setup({
      providerJobsFetcher: async ({ provider, board }) => [
        {
          source: provider,
          sourceJobId: "stable-provider-role",
          title: " Platform Engineer ",
          company: ` ${board} `,
          description: "Build dependable TypeScript services.",
          location,
          workMode: "remote",
          url: "https://example.test/jobs/stable-provider-role",
          requirements: [" TypeScript "],
          contentHash: providerFingerprint,
          sourceMeta: { fixture: true },
        },
      ],
    });
    const importRole = () =>
      app.inject({
        method: "POST",
        url: "/v1/jobs/import",
        headers: { cookie },
        payload: { provider: "greenhouse", board: "normalized-board" },
      });
    const first = await importRole();
    expect(first.statusCode).toBe(200);
    const job = first.json().jobs[0];
    expect(job.contentHash).toBe(roleSnapshotHash(job));
    await app.inject({ method: "POST", url: `/v1/jobs/${job.id}/match`, headers: { cookie } });

    providerFingerprint = "provider-fingerprint-two";
    const repeated = await importRole();
    expect(repeated.json().jobs[0].contentHash).toBe(job.contentHash);
    expect(
      (await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } }))
        .json()
        .matches.some((match: { jobId: string }) => match.jobId === job.id),
    ).toBe(true);

    location = "Chicago";
    const changed = await importRole();
    expect(changed.json().jobs[0].contentHash).not.toBe(job.contentHash);
    expect(
      (await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } }))
        .json()
        .matches.some((match: { jobId: string }) => match.jobId === job.id),
    ).toBe(false);
  });

  it("records a candidate-requested approved ATS recheck and keeps gated routes offline", async () => {
    const requests: Array<{ provider: string; board: string; sourceJobId: string }> = [];
    const attemptedAt = new Date().toISOString();
    const { app, cookie } = await setup({
      providerJobVerifier: async (request) => {
        requests.push(request);
        return {
          provider: request.provider,
          boardId: request.board,
          sourceJobId: request.sourceJobId,
          method: "detail_get",
          result: "present",
          attemptedAt,
          completedAt: new Date(Date.parse(attemptedAt) + 1_000).toISOString(),
          responseFingerprint: "verified-fingerprint",
          sourceItemCount: 1,
          job: null,
          failureCode: null,
        };
      },
    });
    const approved = await app.inject({
      method: "POST",
      url: "/v1/jobs",
      headers: { cookie },
      payload: {
        title: "Platform Engineer",
        company: "Northwind",
        description: "Build trustworthy systems.",
        url: "https://job-boards.greenhouse.io/northwind/jobs/17001?source=candidate",
        requirements: [],
      },
    });
    const verified = await app.inject({
      method: "POST",
      url: `/v1/jobs/${approved.json().id}/verify-route`,
      headers: { cookie },
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toMatchObject({
      job: {
        availability: {
          publicationState: "active",
          verificationHealth: "verified",
          verificationMethod: "detail_get",
        },
      },
      attempt: {
        authority: "employer_ats",
        method: "detail_get",
        result: "present",
        evidence: {
          provider: "greenhouse",
          boardId: "northwind",
          sourceJobId: "17001",
          ruleVersion: "ats_routing_v1",
        },
      },
    });
    expect(requests).toEqual([
      { provider: "greenhouse", board: "northwind", sourceJobId: "17001" },
    ]);

    const gated = await app.inject({
      method: "POST",
      url: "/v1/jobs",
      headers: { cookie },
      payload: {
        title: "Data Engineer",
        company: "Contoso",
        description: "Build data systems.",
        url: "https://jobs.smartrecruiters.com/Contoso/sr-7-data-engineer",
        requirements: [],
      },
    });
    const rejected = await app.inject({
      method: "POST",
      url: `/v1/jobs/${gated.json().id}/verify-route`,
      headers: { cookie },
    });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toMatchObject({ error: { code: "ATS_ROUTE_GATED" } });
    expect(requests).toHaveLength(1);
  });

  it("records a blocked ATS recheck while preserving the last publication state", async () => {
    const { app, cookie } = await setup({
      providerJobVerifier: async () => {
        throw new Error("PROVIDER_HTTP_503");
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/v1/jobs",
      headers: { cookie },
      payload: {
        title: "Product Engineer",
        company: "Northwind",
        description: "Build candidate tools.",
        url: "https://jobs.lever.co/northwind/lever-7",
        requirements: [],
      },
    });
    const checked = await app.inject({
      method: "POST",
      url: `/v1/jobs/${created.json().id}/verify-route`,
      headers: { cookie },
    });
    expect(checked.statusCode).toBe(200);
    expect(checked.json()).toMatchObject({
      job: {
        availability: {
          publicationState: "active",
          verificationHealth: "blocked",
          lastVerifiedAt: null,
        },
      },
      attempt: {
        result: "blocked",
        evidence: { errorCode: "PROVIDER_HTTP_503", provider: "lever" },
      },
    });
  });

  it("exposes the deny-by-default source registry and candidate-approved discovery profile", async () => {
    const { app, cookie } = await setup();
    const registry = await app.inject({
      method: "GET",
      url: "/v1/job-sources",
      headers: { cookie },
    });
    expect(registry.statusCode).toBe(200);
    expect(registry.json()).toMatchObject({
      executionPolicy: "deny_by_default",
      sources: expect.arrayContaining([
        expect.objectContaining({ id: "greenhouse", executionEnabled: true }),
        expect.objectContaining({ id: "smartrecruiters", executionEnabled: false }),
        expect.objectContaining({ id: "linkedin", commercialUseDecision: "prohibited" }),
      ]),
    });
    const blocked = await app.inject({
      method: "POST",
      url: "/v1/jobs/import",
      headers: { cookie },
      payload: { provider: "smartrecruiters", board: "northwind" },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ error: { code: "SOURCE_EXECUTION_DISABLED" } });

    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const payload = {
      profileVersionId: dashboard.profile.id,
      roleFamilies: ["ai_ml", "software_technical"],
      includeTitles: ["Engineer"],
      excludeTitles: ["Manager"],
      seniorityLevels: [],
      industries: [],
      mustHaveSkills: ["TypeScript"],
      preferredSkills: [],
      acceptedPhysicalAreas: [
        {
          displayLabel: "Chicago, IL",
          countryCode: "US",
          subdivisionCode: "US-IL",
          metroId: null,
          timeZone: "America/Chicago",
          resolution: "confirmed",
        },
      ],
      commuteRadiusMiles: 30,
      relocationPreference: "consider",
      workModes: ["remote", "hybrid"],
      eligibleRemoteAreas: [],
      minimumCompensation: { amount: 120000, currency: "USD" },
      currentPostingSponsorshipFilter: "show_all",
      authorizationStatementVersionId: dashboard.profile.id,
      authorizationStatementExpiresAt: null,
      freshnessMaximumHours: 168,
      sourceIds: ["greenhouse", "lever", "ashby"],
    };
    const saved = await app.inject({
      method: "POST",
      url: "/v1/discovery-profile",
      headers: { cookie },
      payload,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      created: true,
      profile: { input: { roleFamilies: payload.roleFamilies, workModes: payload.workModes } },
    });
    const idempotent = await app.inject({
      method: "POST",
      url: "/v1/discovery-profile",
      headers: { cookie },
      payload,
    });
    expect(idempotent.json()).toMatchObject({
      created: false,
      profile: { id: saved.json().profile.id },
    });
    const emptyStatement = await app.inject({
      method: "POST",
      url: "/v1/profile/versions",
      headers: { cookie },
      payload: { authorizationWording: "" },
    });
    expect(emptyStatement.statusCode).toBe(200);
    const rejectedExpiry = await app.inject({
      method: "POST",
      url: "/v1/discovery-profile",
      headers: { cookie },
      payload: {
        ...payload,
        authorizationStatementVersionId: emptyStatement.json().id,
        authorizationStatementExpiresAt: "2027-01-01T00:00:00.000Z",
      },
    });
    expect(rejectedExpiry.statusCode).toBe(400);
    expect(rejectedExpiry.json()).toMatchObject({
      error: { code: "DISCOVERY_AUTHORIZATION_STATEMENT_REQUIRED" },
    });
    const validExpiry = await app.inject({
      method: "POST",
      url: "/v1/discovery-profile",
      headers: { cookie },
      payload: {
        ...payload,
        authorizationStatementExpiresAt: "2027-01-01T00:00:00.000Z",
      },
    });
    expect(validExpiry.statusCode).toBe(200);
    const refreshed = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(refreshed.discoveryProfile.id).toBe(validExpiry.json().profile.id);
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
      headers: { cookie, "idempotency-key": "manual-role-create-001" },
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
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    const retried = await app.inject({
      method: "POST",
      url: "/v1/jobs",
      headers: { cookie, "idempotency-key": "manual-role-create-001" },
      payload: {
        title: "This retry payload is ignored",
        company: "Retry identity controls dedupe",
        description: "The original operation result remains authoritative.",
        requirements: [],
      },
    });
    expect(retried.json()).toMatchObject({
      id: created.json().id,
      sourceJobId: created.json().sourceJobId,
      title: "Staff Engineer",
    });

    const application = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId: created.json().id },
    });
    expect(application.statusCode).toBe(200);
    const edited = await app.inject({
      method: "PUT",
      url: `/v1/jobs/${created.json().id}`,
      headers: { cookie },
      payload: {
        title: "Staff Engineer",
        company: "Northwind",
        description: "Build trustworthy systems.",
        location: "Chicago Loop",
        workMode: "hybrid",
        requirements: ["TypeScript", "Evidence design"],
      },
    });
    expect(edited.json()).toMatchObject({
      id: created.json().id,
      sourceJobId: created.json().sourceJobId,
      location: "Chicago Loop",
    });
    expect(edited.json().contentHash).not.toBe(created.json().contentHash);
    const afterEdit = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(afterEdit.applications).toContainEqual(
      expect.objectContaining({ id: application.json().id, jobId: created.json().id }),
    );

    const unkeyedDuplicate = await app.inject({
      method: "POST",
      url: "/v1/jobs",
      headers: { cookie },
      payload: {
        title: "Staff Engineer",
        company: "Northwind",
        description: "Build trustworthy systems.",
        location: "Chicago Loop",
        workMode: "hybrid",
        requirements: ["TypeScript", "Evidence design"],
      },
    });
    expect(unkeyedDuplicate.json().id).not.toBe(created.json().id);
    expect(unkeyedDuplicate.json().sourceJobId).not.toBe(created.json().sourceJobId);

    const similar = await app.inject({
      method: "POST",
      url: "/v1/jobs",
      headers: { cookie },
      payload: {
        title: "Staff Engineer",
        company: "Northwind",
        description: "Build trustworthy systems.",
        location: "New York",
        workMode: "onsite",
        requirements: ["TypeScript", "Evidence design"],
      },
    });
    expect(similar.statusCode).toBe(200);
    expect(similar.json().id).not.toBe(created.json().id);
    expect(similar.json().sourceJobId).not.toBe(created.json().sourceJobId);
    expect(similar.json().contentHash).not.toBe(created.json().contentHash);
  });

  it("keeps government imports disabled without exact provenance and language review", async () => {
    const { app, cookie } = await setup();
    const rows = [
      {
        company: "Northwind Systems",
        label: "recent_positive_history",
        sourceLocator: "unapproved-fixture:row:1",
        sourcePeriod: "FY2026 Q2",
        observedAt: "2026-07-15T00:00:00.000Z",
      },
    ];
    const response = await app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "unapproved-fixture",
        checksum: canonicalHash(rows),
        provenanceChecksum: "a".repeat(64),
        rows,
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("GOVERNMENT_DATASET_NOT_APPROVED");

    const trustedProvenance: GovernmentDatasetProvenance = {
      version: "government_dataset_provenance_v1",
      sourceType: "dol_oflc_bulk",
      sourceEdition: "unapproved-fixture",
      sourcePageUrl: "https://dol.example.test/performance",
      archiveUrl: "https://dol.example.test/archive/unapproved-fixture.zip",
      archiveSha256: "a".repeat(64),
      layoutUrl: "https://dol.example.test/layout/unapproved-fixture.xlsx",
      layoutSha256: "b".repeat(64),
      layoutVersion: "unapproved-fixture-layout-v1",
      retrievedAt: "2026-08-29T00:00:00.000Z",
      dataAsOf: "2026-06-30",
      rowSetChecksum: canonicalHash(rows),
      transformationVersion: "government_ingest_v1",
      reuseNotice: "Synthetic fixture only; no production source approval is claimed.",
      reviewer: "Synthetic source provenance reviewer",
      reviewedAt: "2026-08-29T00:00:00.000Z",
    };
    const provenanceOnly = await setup({
      governmentDatasetTrust: { provenance: [trustedProvenance] },
    });
    const languageBlocked = await provenanceOnly.app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie: provenanceOnly.cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "unapproved-fixture",
        checksum: canonicalHash(rows),
        provenanceChecksum: governmentDatasetProvenanceChecksum(trustedProvenance),
        rows,
      },
    });
    expect(languageBlocked.statusCode).toBe(409);
    expect(languageBlocked.json().error.code).toBe("GOVERNMENT_EVIDENCE_LANGUAGE_NOT_REVIEWED");
    expect(languageBlocked.json().error.message).toContain("qualified language review");
  });

  it("runs evidence through match, packet assurance, approval, and the test outbox", async () => {
    const governmentRows = [
      {
        company: "Northwind Global",
        label: "recent_positive_history",
        sourceLocator: "synthetic-fixture-fy2026q2:H-1B:row:17",
        sourcePeriod: "FY2026 Q2",
        observedAt: "2026-07-15T00:00:00.000Z",
      },
    ];
    const governmentProvenance: GovernmentDatasetProvenance = {
      version: "government_dataset_provenance_v1",
      sourceType: "dol_oflc_bulk",
      sourceEdition: "synthetic-fixture-fy2026q2",
      sourcePageUrl: "https://dol.example.test/performance",
      archiveUrl: "https://dol.example.test/archive/synthetic-fixture-fy2026q2.zip",
      archiveSha256: "a".repeat(64),
      layoutUrl: "https://dol.example.test/layout/synthetic-fixture-fy2026q2.xlsx",
      layoutSha256: "b".repeat(64),
      layoutVersion: "synthetic-fixture-layout-v1",
      retrievedAt: "2026-08-28T00:00:00.000Z",
      dataAsOf: "2026-06-30",
      rowSetChecksum: canonicalHash(governmentRows),
      transformationVersion: "government_ingest_v1",
      reuseNotice: "Synthetic fixture only; no production source approval is claimed.",
      reviewer: "Synthetic source provenance reviewer",
      reviewedAt: "2026-08-28T00:00:00.000Z",
    };
    const provenanceChecksum = governmentDatasetProvenanceChecksum(governmentProvenance);
    const governmentLanguageReview: GovernmentEvidenceLanguageReview = {
      version: "government_evidence_language_review_v1",
      sourceType: "dol_oflc_bulk",
      transformationVersion: "government_ingest_v1",
      languageContractVersion: "government_evidence_language_v1",
      languageContractChecksum: governmentEvidenceLanguageContractChecksum(),
      reviewer: "Synthetic immigration-language reviewer",
      qualification: "Synthetic test fixture; no production qualification is claimed.",
      reviewedAt: "2026-08-29T00:00:00.000Z",
    };
    const languageReviewChecksum =
      governmentEvidenceLanguageReviewChecksum(governmentLanguageReview);
    const { app, cookie } = await setup({
      governmentDatasetTrust: {
        provenance: [governmentProvenance],
        languageReviews: [governmentLanguageReview],
      },
    });
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

    const reviewedAlias = await app.inject({
      method: "PUT",
      url: "/v1/h1b-employer-aliases",
      headers: { cookie },
      payload: {
        canonicalCompany: "Northwind Systems, Inc.",
        alias: "Northwind Global",
        sourceLocator: "https://northwind.example.test/legal-entities",
        observedAt: "2026-08-28T00:00:00.000Z",
        reviewed: true,
      },
    });
    expect(reviewedAlias.statusCode).toBe(200);
    expect(reviewedAlias.json()).toMatchObject({
      canonicalCompany: "Northwind Systems",
      normalizedName: "northwind systems",
      alias: "Northwind Global",
      normalizedAlias: "northwind global",
      evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    const aliases = await app.inject({
      method: "GET",
      url: "/v1/h1b-employer-aliases",
      headers: { cookie },
    });
    expect(aliases.json()).toEqual([reviewedAlias.json()]);
    const redundantAlias = await app.inject({
      method: "PUT",
      url: "/v1/h1b-employer-aliases",
      headers: { cookie },
      payload: {
        canonicalCompany: "Northwind Systems",
        alias: "Northwind Systems, Inc.",
        sourceLocator: "https://northwind.example.test/legal-entities",
        observedAt: "2026-08-28T00:00:00.000Z",
        reviewed: true,
      },
    });
    expect(redundantAlias.statusCode).toBe(400);
    expect(redundantAlias.json().error.code).toBe("EMPLOYER_ALIAS_REDUNDANT");

    const untrustedEvaluation = await app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fixture-fy2026q2",
        checksum: canonicalHash(governmentRows),
        provenanceChecksum,
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
        provenanceChecksum,
        rows: governmentRows,
      },
    });
    expect(governmentImport.statusCode).toBe(200);
    expect(governmentImport.json()).toMatchObject({
      imported: 1,
      created: true,
      transformationVersion: "government_ingest_v1",
      provenanceChecksum,
      provenance: { layoutVersion: "synthetic-fixture-layout-v1" },
      languageReviewChecksum,
      languageReview: {
        reviewer: "Synthetic immigration-language reviewer",
        qualification: "Synthetic test fixture; no production qualification is claimed.",
      },
      resolutionEvaluation: { enabled: false, precision: 0, sampleSize: 0 },
      resolutionEvaluationProvenance: null,
      signals: [
        {
          label: "possible",
          confidence: "low",
          sourceLocator: "synthetic-fixture-fy2026q2:H-1B:row:17",
        },
      ],
      employerRegistryChecksum: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    const idempotentImport = await app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fixture-fy2026q2",
        checksum: canonicalHash(governmentRows),
        provenanceChecksum,
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
        provenanceChecksum,
        rows: governmentRows,
      },
    });
    expect(transformationConflict.statusCode).toBe(409);
    expect(transformationConflict.json().error.code).toBe("GOVERNMENT_DATASET_PROVENANCE_MISMATCH");
    const conflictingRows = [{ ...governmentRows[0], sourcePeriod: "FY2026 Q3" }];
    const conflictingImport = await app.inject({
      method: "POST",
      url: "/v1/h1b-signals/government-import",
      headers: { cookie },
      payload: {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fixture-fy2026q2",
        checksum: canonicalHash(conflictingRows),
        provenanceChecksum,
        rows: conflictingRows,
      },
    });
    expect(conflictingImport.statusCode).toBe(409);
    expect(conflictingImport.json().error.code).toBe("GOVERNMENT_DATASET_PROVENANCE_MISMATCH");

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
      payload: {
        applicationId,
        contactEmail: "jobs@example.test",
        evidenceIds: initial.profile.claimIds.slice(0, 1),
      },
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

    const recordedSubmission = await app.inject({
      method: "PUT",
      url: `/v1/applications/${applicationId}/status`,
      headers: { cookie },
      payload: {
        status: "submitted_externally",
        confirmed: true,
        submission: {
          materialsCaptured: true,
          packetId,
          artifactFormats: ["ats_docx", "modern_pdf"],
          channel: "employer_portal",
          destination: "https://careers.example.test/apply",
          submittedAt: "2026-08-29T12:00:00.000Z",
        },
      },
    });
    expect(recordedSubmission.statusCode).toBe(200);
    expect(recordedSubmission.json()).toMatchObject({
      status: "submitted_externally",
      submissions: [
        expect.objectContaining({
          packetId,
          artifactFormats: ["ats_docx", "modern_pdf"],
          packetArtifactHash: createdPacket.json().artifactHash,
        }),
      ],
    });

    const reviewedDashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(reviewedDashboard.packets).toEqual([
      expect.objectContaining({
        id: packetId,
        artifactHash: expect.any(String),
        canonicalContent: expect.objectContaining({ schemaVersion: "packet_v2" }),
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
    expect(reviewedDashboard.applications[0].submissions).toEqual([
      expect.objectContaining({ packetId, materialsCaptured: true }),
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
      payload: {
        applicationId,
        contactEmail: "newer@example.test",
        evidenceIds: initial.profile.claimIds.slice(0, 1),
      },
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
    const staleAction = await app.inject({
      method: "POST",
      url: "/v1/actions",
      headers: { cookie },
      payload: {
        packetId,
        provider: "test_outbox",
        to: "stale@example.test",
        subject: "Retired packet",
        body: "This older packet must remain historical only.",
      },
    });
    expect(staleAction.statusCode).toBe(409);
    expect(staleAction.json().error.code).toBe("LATEST_APPROVED_PACKET_REQUIRED");

    const staleApproval = await app.inject({
      method: "POST",
      url: `/v1/actions/${actionId}/approve`,
      headers: { cookie },
    });
    expect(staleApproval.statusCode).toBe(409);
    expect(staleApproval.json().error.code).toBe("LATEST_APPROVED_PACKET_REQUIRED");

    const replacementPacketId = newerDraftPacket.json().id as string;
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/packets/${replacementPacketId}/assure`,
          headers: { cookie },
        })
      ).json().status,
    ).toBe("passed");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/packets/${replacementPacketId}/approve`,
          headers: { cookie },
        })
      ).json().status,
    ).toBe("approved");

    const currentAction = await app.inject({
      method: "POST",
      url: "/v1/actions",
      headers: { cookie },
      payload: {
        packetId: replacementPacketId,
        provider: "test_outbox",
        to: "jobs@example.test",
        subject: "Application",
        body: "Please find my reviewed packet attached separately.",
      },
    });
    expect(currentAction.statusCode).toBe(200);
    const currentActionId = currentAction.json().id as string;
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/actions/${currentActionId}/approve`,
          headers: { cookie },
        })
      ).json().state,
    ).toBe("approved");

    await app.inject({
      method: "PUT",
      url: "/v1/actions/runtime",
      headers: { cookie },
      payload: { enabled: true },
    });
    const executed = await app.inject({
      method: "POST",
      url: `/v1/actions/${currentActionId}/execute`,
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
      exportVersion: "nimanto-local-beta-v10",
      identity: { displayName: "Priya Shah", email: "priya@example.test" },
      workspace: {
        schemaVersion: "nimanto_export_v10",
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
    expect(reused.statusCode).toBe(401);
  });

  it("fails packet approval and download closed after artifact tampering", async () => {
    const { app, cookie, root, tenantId } = await setup();
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    const match = await app.inject({
      method: "POST",
      url: `/v1/jobs/${dashboard.jobs[0].id}/match`,
      headers: { cookie },
    });
    expect(match.statusCode).toBe(200);
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
      payload: {
        applicationId: tracked.json().id,
        evidenceIds: dashboard.profile.claimIds.slice(0, 1),
      },
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
    const match = await app.inject({
      method: "POST",
      url: `/v1/jobs/${dashboard.jobs[0].id}/match`,
      headers: { cookie },
    });
    expect(match.statusCode).toBe(200);
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
      payload: {
        applicationId: tracked.json().id,
        evidenceIds: dashboard.profile.claimIds.slice(0, 1),
      },
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
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    /* Pending cleanup is the operator's only signal that files are left behind,
     * and the status token is in scope at that call site. It stays out of the
     * line, and so does every address. */
    expect(warnings).toHaveBeenCalledTimes(1);
    const pendingLine = warnings.mock.calls[0]?.[0] as string;
    expect(JSON.parse(pendingLine)).toEqual({
      level: "warn",
      code: "FILESYSTEM_CLEANUP_PENDING",
      runId: expect.any(String),
    });
    expect(pendingLine).not.toContain(token);
    expect(pendingLine).not.toContain("@");
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

  it("recovers incomplete deletion and prunes expired completed tombstones at startup", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "nimanto-api-deletion-startup-"));
    const dataDirectory = path.join(root, "database");
    const initial = await NimantoStore.open(dataDirectory);
    const completedIdentity = await initial.createLocalTenant(
      "startup-completed@example.test",
      "Completed",
    );
    const completed = await initial.beginTenantDeletion(completedIdentity.tenantId);
    await initial.purgeTenantForDeletion(completed.id, completedIdentity.tenantId);
    await initial.completeDeletion(completed.id);
    const runningIdentity = await initial.createLocalTenant(
      "startup-running@example.test",
      "Running",
    );
    const running = await initial.beginTenantDeletion(runningIdentity.tenantId);
    await initial.close();

    const raw = await PGlite.create(dataDirectory);
    await raw.query("UPDATE deletion_runs SET expires_at = now() - interval '1 day'");
    await raw.close();

    const app = await buildServer({
      dataDirectory,
      artifactDirectory: path.join(root, "artifacts"),
      outboxDirectory: path.join(root, "outbox"),
      webOrigin: "http://127.0.0.1:4300",
      demoMode: true,
      externalActionsEnabled: false,
      bootstrapSecret,
      urlAllowlist: [],
      port: 4310,
      host: "127.0.0.1",
    });
    apps.push(app);
    await app.ready();
    await app.close();
    apps.splice(apps.indexOf(app), 1);

    const inspected = await PGlite.create(dataDirectory);
    const retained = await inspected.query<{ id: string }>(
      "SELECT id FROM deletion_runs WHERE id = $1 OR id = $2",
      [completed.id, running.id],
    );
    await inspected.close();
    expect(retained.rows).toEqual([]);
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

  it("sets and clears a candidate follow-up date while rejecting ambiguous dates", async () => {
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

    const scheduled = await app.inject({
      method: "PUT",
      url: `/v1/applications/${tracked.json().id}/follow-up`,
      headers: { cookie },
      payload: { followUpOn: "2026-08-29" },
    });
    expect(scheduled.statusCode).toBe(200);
    expect(scheduled.json()).toMatchObject({ status: "tracked", followUpOn: "2026-08-29" });

    for (const followUpOn of [
      "0000-01-01",
      "08/29/2026",
      "2026-02-30",
      "2026-08-29T12:00:00Z",
      "",
    ]) {
      const invalid = await app.inject({
        method: "PUT",
        url: `/v1/applications/${tracked.json().id}/follow-up`,
        headers: { cookie },
        payload: { followUpOn },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.code).toBe("INVALID_FOLLOW_UP_DATE");
    }

    const withdrawn = await app.inject({
      method: "PUT",
      url: `/v1/applications/${tracked.json().id}/status`,
      headers: { cookie },
      payload: { status: "withdrawn", confirmed: true },
    });
    expect(withdrawn.statusCode).toBe(200);
    expect(withdrawn.json()).toMatchObject({ status: "withdrawn", followUpOn: "2026-08-29" });

    const rescheduledWhileWithdrawn = await app.inject({
      method: "PUT",
      url: `/v1/applications/${tracked.json().id}/follow-up`,
      headers: { cookie },
      payload: { followUpOn: "2026-09-01" },
    });
    expect(rescheduledWhileWithdrawn.statusCode).toBe(409);
    expect(rescheduledWhileWithdrawn.json().error.code).toBe("FOLLOW_UP_UNAVAILABLE");

    const cleared = await app.inject({
      method: "PUT",
      url: `/v1/applications/${tracked.json().id}/follow-up`,
      headers: { cookie },
      payload: { followUpOn: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({ status: "withdrawn", followUpOn: null });
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

  it("rebinds an Application to the current Profile Version and retires its approved packet", async () => {
    const { app, cookie } = await setup();
    const dashboard = async () =>
      (await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })).json();
    const applicationOf = (body: { applications: Array<{ id: string }> }, id: string) =>
      body.applications.find((application) => application.id === id) as {
        id: string;
        status: string;
        profileVersionId: string;
        statusEvents: Array<{ fromStatus: string | null; toStatus: string; source: string }>;
      };

    const initial = await dashboard();
    const jobId = initial.jobs[0].id as string;
    const evidenceIds = initial.profile.claimIds.slice(0, 1) as string[];
    expect(
      (await app.inject({ method: "POST", url: `/v1/jobs/${jobId}/match`, headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    const tracked = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { cookie },
      payload: { jobId },
    });
    const applicationId = tracked.json().id as string;

    const compose = async (contactEmail: string) => {
      const created = await app.inject({
        method: "POST",
        url: "/v1/packets",
        headers: { cookie },
        payload: { applicationId, contactEmail, evidenceIds },
      });
      expect(created.statusCode).toBe(200);
      const id = created.json().id as string;
      expect(
        (
          await app.inject({ method: "POST", url: `/v1/packets/${id}/assure`, headers: { cookie } })
        ).json().status,
      ).toBe("passed");
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/v1/packets/${id}/approve`,
            headers: { cookie },
          })
        ).json().status,
      ).toBe("approved");
      return id;
    };
    const stalePacketId = await compose("jobs@example.test");
    expect(applicationOf(await dashboard(), applicationId).status).toBe("approved_for_export");

    const newProfile = await app.inject({
      method: "POST",
      url: "/v1/profile/versions",
      headers: { cookie },
      payload: { authorizationWording: "I would require H-1B transfer sponsorship." },
    });
    expect(newProfile.json().created).toBe(true);
    const profileVersionId = newProfile.json().id as string;
    expect(profileVersionId).not.toBe(initial.profile.id);

    const rebound = await app.inject({
      method: "PUT",
      url: `/v1/applications/${applicationId}/profile-version`,
      headers: { cookie },
    });
    expect(rebound.statusCode).toBe(200);
    expect(rebound.json()).toMatchObject({
      id: applicationId,
      profileVersionId,
      status: "prepared",
    });

    const afterRebind = await dashboard();
    const application = applicationOf(afterRebind, applicationId);
    expect(
      application.statusEvents.filter((event) => event.fromStatus === "approved_for_export"),
    ).toEqual([
      expect.objectContaining({
        fromStatus: "approved_for_export",
        toStatus: "prepared",
        source: "packet",
      }),
    ]);
    const reboundReceipts = (body: { receipts: Array<{ type: string }> }) =>
      body.receipts.filter((receipt) => receipt.type === "application.profile_rebound");
    expect(reboundReceipts(afterRebind)).toHaveLength(1);
    // The approved packet is history, not a rewrite target.
    expect(
      afterRebind.actionPackets
        .concat(afterRebind.packets)
        .filter((packet: { id: string }) => packet.id === stalePacketId)
        .every(
          (packet: { status: string; profileVersionId: string }) =>
            packet.status === "approved" && packet.profileVersionId === initial.profile.id,
        ),
    ).toBe(true);

    const repeated = await app.inject({
      method: "PUT",
      url: `/v1/applications/${applicationId}/profile-version`,
      headers: { cookie },
    });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json()).toMatchObject({ profileVersionId, status: "prepared" });
    expect(reboundReceipts(await dashboard())).toHaveLength(1);

    const staleAction = await app.inject({
      method: "POST",
      url: "/v1/actions",
      headers: { cookie },
      payload: {
        packetId: stalePacketId,
        provider: "test_outbox",
        to: "stale@example.test",
        subject: "Retired packet",
        body: "This packet was approved against the previous Profile Version.",
      },
    });
    expect(staleAction.statusCode).toBe(409);
    expect(staleAction.json().error.code).toBe("ACTION_APPROVAL_STALE");

    const staleSubmission = await app.inject({
      method: "PUT",
      url: `/v1/applications/${applicationId}/status`,
      headers: { cookie },
      payload: {
        status: "submitted_externally",
        confirmed: true,
        submission: {
          materialsCaptured: true,
          packetId: stalePacketId,
          artifactFormats: ["ats_docx"],
          channel: "employer_portal",
          destination: "https://careers.example.test/apply",
          submittedAt: "2026-08-29T12:00:00.000Z",
        },
      },
    });
    /* The rebind already returned the Application to prepared, so a Submission
     * Record against the retired packet is refused one step earlier than the
     * packet-binding guard: submitted_externally is not reachable from prepared. */
    expect(staleSubmission.statusCode).toBe(409);
    expect(staleSubmission.json().error.code).toBe("INVALID_APPLICATION_TRANSITION");

    expect(
      (await app.inject({ method: "POST", url: `/v1/jobs/${jobId}/match`, headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    const currentPacketId = await compose("current@example.test");
    const currentAction = await app.inject({
      method: "POST",
      url: "/v1/actions",
      headers: { cookie },
      payload: {
        packetId: currentPacketId,
        provider: "test_outbox",
        to: "jobs@example.test",
        subject: "Application",
        body: "Please find my reviewed packet attached separately.",
      },
    });
    expect(currentAction.statusCode).toBe(200);
    const currentSubmission = await app.inject({
      method: "PUT",
      url: `/v1/applications/${applicationId}/status`,
      headers: { cookie },
      payload: {
        status: "submitted_externally",
        confirmed: true,
        submission: {
          materialsCaptured: true,
          packetId: currentPacketId,
          artifactFormats: ["ats_docx"],
          channel: "employer_portal",
          destination: "https://careers.example.test/apply",
          submittedAt: "2026-08-29T12:00:00.000Z",
        },
      },
    });
    expect(currentSubmission.statusCode).toBe(200);

    const exported = await app.inject({ method: "GET", url: "/v1/export", headers: { cookie } });
    expect(exported.json().exportVersion).toBe("nimanto-local-beta-v10");
    expect(
      exported
        .json()
        .workspace.applications.find((record: { id: string }) => record.id === applicationId),
    ).toMatchObject({ profileVersionId });
    expect(
      exported
        .json()
        .workspace.receipts.filter(
          (receipt: { type: string }) => receipt.type === "application.profile_rebound",
        ),
    ).toHaveLength(1);
  });

  it("answers every parser and Submission Record rejection with a client error", async () => {
    const sources = await Promise.all(
      ["../../../packages/parsers/src/index.ts", "../../../packages/domain/src/submissions.ts"].map(
        (relative) => readFile(new URL(relative, import.meta.url), "utf8"),
      ),
    );
    const codes = [
      ...new Set(
        [...sources.join("\n").matchAll(/throw new Error\("([A-Z0-9_]+)"\)/g)].map(
          (match) => match[1] as string,
        ),
      ),
    ];
    expect(codes.length).toBeGreaterThan(20);
    expect(
      codes
        .map((code) => ({ code, status: messageForError(new Error(code)).status }))
        .filter((mapped) => mapped.status >= 500),
    ).toEqual([]);
    // An unrecognized code stays a 500 that says nothing about internals.
    expect(messageForError(new Error("NOT_A_REAL_CODE_FROM_A_PARSER"))).toEqual({
      code: "NOT_A_REAL_CODE_FROM_A_PARSER",
      status: 500,
      message: "Nimanto could not complete that operation.",
    });

    const { app, cookie } = await setup();
    const mismatch = await app.inject({
      method: "POST",
      url: "/v1/evidence/preview",
      headers: { cookie },
      payload: {
        filename: "cv.pdf",
        mimeType: "application/pdf",
        contentBase64: Buffer.from("This is plain text, not a PDF.", "utf8").toString("base64"),
      },
    });
    expect(mismatch.statusCode).toBe(422);
    expect(mismatch.json().error.code).toBe("FILE_TYPE_MISMATCH");
  });

  it("refuses a repeated deletion status token instead of failing as a server fault", async () => {
    const { app, cookie } = await setup();
    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/data",
      headers: { cookie },
      payload: { confirmation: "DELETE MY NIMANTO DATA" },
    });
    expect(deleted.statusCode).toBe(200);
    const token = deleted.json().token as string;

    const repeated = await app.inject({
      method: "GET",
      url: `/v1/deletion/status?token=${token}&token=other`,
    });
    expect(repeated.statusCode).toBe(400);
    expect(repeated.json().error.code).toBe("INVALID_TOKEN");

    const valid = await app.inject({ method: "GET", url: `/v1/deletion/status?token=${token}` });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().state).toBe("completed");

    const unknown = await app.inject({
      method: "GET",
      url: "/v1/deletion/status?token=00000000-0000-4000-8000-000000000000",
    });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe("DELETION_NOT_FOUND");
  });

  it("reports the same completion time from deletion status and deletion resume", async () => {
    const { app, cookie } = await setup();
    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/data",
      headers: { cookie },
      payload: { confirmation: "DELETE MY NIMANTO DATA" },
    });
    expect(deleted.statusCode).toBe(200);
    const token = deleted.json().token as string;
    const completedAt = deleted.json().completedAt as string;
    expect(completedAt).toEqual(expect.any(String));

    const status = await app.inject({ method: "GET", url: `/v1/deletion/status?token=${token}` });
    expect(status.json()).toMatchObject({ state: "completed", completedAt });

    const resumed = await app.inject({
      method: "POST",
      url: "/v1/deletion/resume",
      payload: { token },
    });
    expect(resumed.statusCode).toBe(200);
    expect(resumed.json()).toMatchObject({ state: "completed", completedAt });
  });

  it("logs one keyed line for a server fault and stays silent for a client error", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { app, cookie } = await setup({
      urlAllowlist: ["jobs.example.test"],
      urlTermsReviewedAt: "2026-08-01T00:00:00.000Z",
      allowlistedJobPageFetcher: async () => {
        throw new Error("INJECTED_UNMAPPED_INTAKE_FAULT");
      },
    });

    const faulted = await app.inject({
      method: "POST",
      url: "/v1/jobs/url-import?candidate=someone@example.test",
      headers: { cookie },
      payload: {
        url: "https://jobs.example.test/roles/1",
        title: "Platform Engineer",
        company: "Northwind",
        requirements: ["TypeScript"],
      },
    });
    expect(faulted.statusCode).toBe(500);
    expect(errors).toHaveBeenCalledTimes(1);
    const line = errors.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toEqual({
      level: "error",
      code: "INJECTED_UNMAPPED_INTAKE_FAULT",
      method: "POST",
      route: "/v1/jobs/url-import",
      requestId: expect.any(String),
    });
    // The route template is logged, never the request URL, its query, a body,
    // an email, or a cookie.
    expect(line).not.toContain("?");
    expect(line).not.toContain("@");
    expect(line).not.toContain("nimanto_session");
    expect(line).not.toContain("Northwind");

    errors.mockClear();
    const clientError = await app.inject({
      method: "GET",
      url: "/v1/deletion/status?token=a&token=b",
    });
    expect(clientError.statusCode).toBe(400);
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
  });

  it("never returns another workspace's answer history", async () => {
    const { app, cookie } = await setup();
    const saved = await app.inject({
      method: "POST",
      url: "/v1/answer-blocks",
      headers: { cookie },
      payload: {
        topic: "why_role",
        prompt: "Why this role?",
        answerText: "Because the work matches my confirmed evidence.",
        evidenceIds: [],
      },
    });
    expect(saved.statusCode).toBe(200);
    const answerBlockId = saved.json().id as string;
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/v1/answer-blocks/${answerBlockId}/revisions`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(200);

    const otherLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/local",
      headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
      payload: { email: "other-answers@example.test", displayName: "Other" },
    });
    const header = otherLogin.headers["set-cookie"];
    const otherCookie = (Array.isArray(header) ? header[0] : header)?.split(";")[0] ?? "";
    const foreign = await app.inject({
      method: "GET",
      url: `/v1/answer-blocks/${answerBlockId}/revisions`,
      headers: { cookie: otherCookie },
    });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json().error.code).toBe("ANSWER_BLOCK_NOT_FOUND");
    expect(foreign.json().error.message).toBe(
      "The requested record was not found in this workspace.",
    );
  });
});
