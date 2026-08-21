import { timingSafeEqual } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import path from "node:path";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { NimantoStore, type SessionIdentity } from "@nimanto/database";
import {
  applicationTransitions,
  canonicalHash,
  freshH1bLabel,
  normalizeRoleObservation,
  type ApplicationStatus,
  type EvidenceClaim,
  type ExternalActionProvider,
  type H1bSignalLabel,
  type OutcomeType,
} from "@nimanto/domain";
import {
  draftLocalSummary,
  fetchAllowlistedJobPage,
  localModelInventory,
  localModelStatus,
} from "@nimanto/providers";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { NimantoApiOptions } from "./config.js";
import { DeletionCoordinator } from "./deletion-coordinator.js";
import { DiscoveryCycle } from "./discovery-cycle.js";
import { EvidenceIntake } from "./evidence-intake.js";
import { ExternalActionLifecycle } from "./external-action-lifecycle.js";
import { GovernmentDatasetIngestion } from "./government-dataset.js";
import { publishMatch } from "./match-publication.js";
import {
  type ArtifactManifest,
  PacketLifecycle,
  verifiedArtifactBytes,
} from "./packet-lifecycle.js";

const SESSION_COOKIE = "nimanto_session";
const H1B_LABELS: H1bSignalLabel[] = [
  "current_role_transfer_support",
  "current_company_policy_support",
  "recent_positive_history",
  "possible",
  "uncertain",
  "no_sponsorship_of_any_kind",
  "no_new_cap_petitions",
  "no_permanent_sponsorship",
  "unspecified_negative",
];

declare module "fastify" {
  interface FastifyRequest {
    identity?: SessionIdentity;
  }
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("INVALID_REQUEST_BODY");
  }
  return value as JsonObject;
}

function string(value: unknown, field: string, options?: { allowEmpty?: boolean }): string {
  if (typeof value !== "string") throw new Error(`INVALID_${field.toUpperCase()}`);
  const normalized = value.normalize("NFC").trim();
  if (!options?.allowEmpty && normalized === "") throw new Error(`INVALID_${field.toUpperCase()}`);
  return normalized;
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return value.map((entry) => entry.normalize("NFC").trim()).filter(Boolean);
}

function historyOptions(query: unknown): { cursor?: string; limit: number } {
  const value = object(query ?? {});
  const cursor = value.cursor === undefined ? undefined : string(value.cursor, "cursor");
  if (
    cursor &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(cursor)
  ) {
    throw new Error("INVALID_CURSOR");
  }
  const parsed = value.limit === undefined ? 20 : Number(value.limit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) throw new Error("INVALID_LIMIT");
  return { ...(cursor ? { cursor } : {}), limit: parsed };
}

function privateSourceUrl(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const raw = string(value, "url");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("INVALID_URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("INVALID_URL");
  }
  return url.toString();
}

function identity(request: FastifyRequest): SessionIdentity {
  if (!request.identity) throw new Error("AUTHENTICATION_REQUIRED");
  return request.identity;
}

function secretsEqual(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string") return false;
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

async function secureRuntimeDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
}

function messageForError(error: Error): { code: string; status: number; message: string } {
  const code = /^[A-Z0-9_]+$/.test(error.message) ? error.message : "INTERNAL_ERROR";
  if (code === "AUTHENTICATION_REQUIRED")
    return { code, status: 401, message: "Start or resume a local Nimanto session." };
  if (code === "INVALID_BOOTSTRAP_SECRET")
    return {
      code,
      status: 401,
      message: "Use the private workspace link from the local launcher.",
    };
  if (code.startsWith("INVITATION_"))
    return {
      code,
      status: code === "INVITATION_EXPIRED" ? 410 : code === "INVITATION_USED" ? 409 : 401,
      message: "This private invitation cannot be used. Ask the local administrator for a new one.",
    };
  if (code.endsWith("_NOT_FOUND"))
    return { code, status: 404, message: "The requested record was not found in this workspace." };
  /* Specific codes first. `startsWith("INVALID_")` below is a catch-all, so
   * anything more precise has to be tested before it or it can never fire —
   * INVALID_TRANSITION's own 409 was unreachable for exactly that reason. */
  if (code === "INVALID_TRANSITION")
    return { code, status: 409, message: "That action is no longer in the required state." };
  if (code === "INVALID_APPLICATION_TRANSITION")
    return {
      code,
      status: 409,
      message:
        "An application moves Tracked to Prepared to Approved for export to Submitted externally. Move it to the next stage first, or withdraw it.",
    };
  if (code === "APPLICATION_TRANSITION_CONFIRMATION_REQUIRED")
    return {
      code,
      status: 409,
      message: "Confirm this consequential application change, then try again.",
    };
  if (
    code.includes("REQUIRED") ||
    code.startsWith("INVALID_") ||
    code === "FILE_TOO_LARGE" ||
    code === "TEXT_LIMIT_EXCEEDED" ||
    code === "PROHIBITED_DOCUMENT_CONTENT" ||
    code === "UNSUPPORTED_FILE_TYPE" ||
    code === "UNTRUSTED_RESOLUTION_EVALUATION"
  ) {
    return {
      code,
      status: 400,
      message: "The request needs attention before Nimanto can continue.",
    };
  }
  if (code === "EXTERNAL_ACTIONS_DISABLED")
    return {
      code,
      status: 409,
      message: "Turn on the external-action runtime switch before execution.",
    };
  if (code === "EVIDENCE_PREVIEW_CHANGED")
    return { code, status: 409, message: "Review the file preview again before importing it." };
  if (code === "ARTIFACT_INTEGRITY_FAILED")
    return {
      code,
      status: 409,
      message: "A packet artifact no longer matches its recorded SHA-256 hash.",
    };
  if (
    code === "DATASET_EDITION_CONFLICT" ||
    code === "PACKET_APPROVAL_STALE" ||
    code === "PACKET_CHANGED" ||
    code === "PACKET_INPUT_CHANGED" ||
    code === "ACTION_APPROVAL_STALE" ||
    code === "ACTION_INTENT_CHANGED" ||
    code === "ACTION_OUTCOME_AMBIGUOUS" ||
    code === "TENANT_NOT_ACTIVE"
  ) {
    return {
      code,
      status: 409,
      message: "The reviewed inputs changed or the workspace is no longer writable. Review again.",
    };
  }
  return { code, status: 500, message: "Nimanto could not complete that operation." };
}

async function seedDemo(store: NimantoStore, person: SessionIdentity): Promise<void> {
  const existing = await store.listEvidence(person.tenantId);
  if (existing.length === 0) {
    for (const [kind, value] of [
      ["skill", "TypeScript, Node.js, PostgreSQL, and accessible React interfaces"],
      ["employment", "Platform Engineer — shipped reliable APIs and candidate-facing tools"],
      ["project", "Led a typed service migration with test-first delivery"],
      ["accomplishment", "Reduced support handoffs by making evidence provenance visible"],
    ] satisfies Array<[EvidenceClaim["kind"], string]>) {
      await store.createEvidence(person.tenantId, {
        kind,
        value,
        status: "confirmed",
        confidence: "high",
        sourceName: "Synthetic beta workspace",
        locator: `seed:${kind}`,
        userAttested: true,
      });
    }
    await store.createProfileVersion(
      person.tenantId,
      "I am authorized to work in the United States and would require H-1B transfer support.",
    );
  }
  const jobs = await store.listJobs(person.tenantId);
  if (jobs.length === 0) {
    await store.upsertJob(person.tenantId, {
      source: "manual",
      sourceJobId: "synthetic-platform-engineer",
      title: "Platform Engineer",
      company: "Northwind Systems",
      description:
        "Build TypeScript services and accessible React tools. H-1B transfer support is reviewed case by case.",
      location: "Chicago or remote",
      workMode: "hybrid",
      url: "https://example.test/jobs/platform-engineer",
      requirements: ["TypeScript and Node.js", "PostgreSQL", "Accessible React interfaces"],
      capability: "deep_link",
      sourceMeta: { synthetic: true },
      contentHash: canonicalHash({ seed: "platform-engineer-v1" }),
    });
    await store.upsertJob(person.tenantId, {
      source: "manual",
      sourceJobId: "synthetic-product-engineer",
      title: "Product Engineer",
      company: "Contoso Labs",
      description:
        "Ship user-facing React and API features. No sponsorship of any kind is available for this role.",
      location: "New York",
      workMode: "onsite",
      url: "https://example.test/jobs/product-engineer",
      requirements: ["React", "API design", "User research"],
      capability: "deep_link",
      sourceMeta: { synthetic: true },
      contentHash: canonicalHash({ seed: "product-engineer-v1" }),
    });
  }
  if ((await store.listH1bSignals(person.tenantId)).length === 0) {
    await store.createH1bSignal(person.tenantId, {
      company: "Northwind Systems",
      label: "uncertain",
      sourceType: "synthetic_demo",
      sourceLocator: "Synthetic beta workspace",
      sourcePeriod: "Illustrative only",
      observedAt: "2026-08-05T12:00:00.000Z",
      confidence: "low",
      limitations:
        "Synthetic example. Verify current company policy and role wording before relying on it.",
    });
  }
}

export async function buildServer(options: NimantoApiOptions): Promise<FastifyInstance> {
  await Promise.all([
    secureRuntimeDirectory(options.artifactDirectory),
    secureRuntimeDirectory(options.outboxDirectory),
  ]);
  const store = await NimantoStore.open(options.dataDirectory);
  const evidenceIntake = new EvidenceIntake(store);
  const packetLifecycle = new PacketLifecycle(
    store,
    options.artifactDirectory,
    options.assuranceModel,
  );
  const externalActionLifecycle = new ExternalActionLifecycle(store, options.outboxDirectory);
  await externalActionLifecycle.recoverInterrupted();
  const discoveryCycle = new DiscoveryCycle(store, options.providerJobsFetcher);
  let governmentDataset: GovernmentDatasetIngestion;
  try {
    governmentDataset = new GovernmentDatasetIngestion(
      store,
      options.trustedEmployerResolutionEvaluation,
    );
  } catch (error) {
    await store.close();
    throw error;
  }
  const deletionCoordinator = new DeletionCoordinator(
    store,
    options.artifactDirectory,
    options.outboxDirectory,
    options.removePath,
  );
  const app = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024, trustProxy: false });

  await app.register(cookie, { hook: "onRequest" });
  await app.register(cors, {
    origin: options.webOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  /* A loopback service serving one candidate still wants a ceiling on a runaway
   * loop, but 180/minute is three requests a second, and a single candidate move
   * costs a write plus a dashboard refresh on top of the liveness poll. The
   * product's own release journey exhausted this budget, which is how a healthy
   * API came to report itself broken. The ceiling now bounds a loop without
   * bounding a person. */
  await app.register(rateLimit, { max: 1_200, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Nimanto local beta API",
        version: "0.5.1",
        description: "Candidate-side evidence and application workbench.",
      },
      servers: [{ url: `http://${options.host}:${options.port}` }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.addHook("onClose", async () => store.close());
  app.setErrorHandler((error, _request, reply) => {
    /* A framework rejection already carries the right status and does not use
     * this codebase's SCREAMING_CASE message convention. Folding it into
     * INTERNAL_ERROR reported the local service as broken when it was healthy
     * and merely throttling, and the workbench's connection probe drew the only
     * conclusion it could: "Connect the local service", sending the candidate to
     * restart a backend that was already running. */
    const raised = error instanceof Error ? error : new Error("INTERNAL_ERROR");
    const status = (error as { statusCode?: number } | null)?.statusCode ?? 0;
    if (status >= 400 && status < 500 && !/^[A-Z0-9_]+$/.test(raised.message)) {
      void reply.code(status).send({
        error:
          status === 429
            ? {
                code: "RATE_LIMITED",
                message:
                  "Too many requests to the local API. Wait a moment and retry — nothing was lost.",
              }
            : {
                code: `HTTP_${status}`,
                message: "Nimanto could not read that request.",
              },
      });
      return;
    }
    const safe = messageForError(raised);
    void reply.code(safe.status).send({ error: { code: safe.code, message: safe.message } });
  });
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/")) reply.header("cache-control", "no-store");
    return payload;
  });

  app.get("/health", async () => ({ status: "ok", version: "0.5.1" }));
  app.get("/v1/meta", async () => ({
    name: "Nimanto",
    version: "0.5.1",
    mode: "local_beta",
    externalActionsEnabled: externalActionLifecycle.runtime(),
    providers: {
      deepLink: true,
      testOutbox: true,
    },
    boundaries: [
      "Candidate-side qualification and role-fit evidence only.",
      "No employer screening, hiring probability, or legal advice.",
      "Company sponsorship signals are historical evidence, not current guarantees.",
    ],
  }));

  const startWorkspace = async (
    reply: FastifyReply,
    email: string,
    displayName: string,
  ): Promise<{ identity: SessionIdentity; expiresAt: string }> => {
    const local = await store.createLocalTenant(email, displayName);
    return establishSession(reply, local, true);
  };

  const establishSession = async (
    reply: FastifyReply,
    local: Omit<SessionIdentity, "sessionId">,
    withSyntheticStarter = false,
  ): Promise<{ identity: SessionIdentity; expiresAt: string }> => {
    const session = await store.createSession(local.userId, local.tenantId);
    const person: SessionIdentity = { ...local, sessionId: session.id };
    if (withSyntheticStarter) await seedDemo(store, person);
    reply.setCookie(SESSION_COOKIE, session.token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 12 * 60 * 60,
    });
    return { identity: person, expiresAt: session.expiresAt };
  };

  app.post("/v1/auth/invitations", async (request) => {
    if (!secretsEqual(request.headers["x-nimanto-bootstrap-secret"], options.bootstrapSecret)) {
      throw new Error("INVALID_BOOTSTRAP_SECRET");
    }
    const body = object(request.body ?? {});
    const email = string(body.email, "email").toLocaleLowerCase("en-US");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      throw new Error("INVALID_EMAIL");
    }
    return store.issueInvitation(email);
  });

  app.delete("/v1/auth/invitations/:id", async (request) => {
    if (!secretsEqual(request.headers["x-nimanto-bootstrap-secret"], options.bootstrapSecret)) {
      throw new Error("INVALID_BOOTSTRAP_SECRET");
    }
    const id = string((request.params as { id?: unknown }).id, "invitation_id");
    if (!(await store.revokeInvitation(id))) throw new Error("INVITATION_NOT_FOUND");
    return { revoked: true };
  });

  app.post("/v1/auth/invitations/accept", async (request, reply) => {
    const body = object(request.body ?? {});
    const token = string(body.token, "token");
    const email = string(body.email, "email");
    const displayName = string(body.displayName, "display_name");
    if (
      token.length > 256 ||
      email.length > 254 ||
      displayName.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
    ) {
      throw new Error("INVALID_INVITATION_ACCEPTANCE");
    }
    const local = await store.acceptInvitation(token, email, displayName);
    return establishSession(reply, local);
  });

  app.post("/v1/auth/local", async (request, reply) => {
    if (!options.demoMode) throw new Error("DEMO_MODE_DISABLED");
    if (!secretsEqual(request.headers["x-nimanto-bootstrap-secret"], options.bootstrapSecret)) {
      throw new Error("INVALID_BOOTSTRAP_SECRET");
    }
    const body = object(request.body ?? {});
    const email = string(body.email, "email");
    const displayName = string(body.displayName, "display_name");
    if (
      email.length > 254 ||
      displayName.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
    ) {
      throw new Error("INVALID_LOCAL_IDENTITY");
    }
    return startWorkspace(reply, email, displayName);
  });

  app.post("/v1/auth/demo", async (request, reply) => {
    if (!options.demoMode) throw new Error("DEMO_MODE_DISABLED");
    if (!secretsEqual(request.headers["x-nimanto-bootstrap-secret"], options.bootstrapSecret)) {
      throw new Error("INVALID_BOOTSTRAP_SECRET");
    }
    return startWorkspace(reply, "priya@example.test", "Priya Shah");
  });

  app.get("/v1/auth/status", async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return { authenticated: false };
    const session = await store.resolveSession(token);
    return session ? { authenticated: true, identity: session } : { authenticated: false };
  });

  app.get("/v1/deletion/status", async (request) => {
    const query = request.query as { token?: string };
    if (!query.token) throw new Error("INVALID_TOKEN");
    const status = await store.deletionStatus(query.token);
    if (!status) throw new Error("DELETION_NOT_FOUND");
    return status;
  });

  app.post("/v1/deletion/resume", async (request, reply) => {
    const body = object(request.body ?? {});
    const token = string(body.token, "token");
    const outcome = await deletionCoordinator.resume(token);
    if (outcome.pending) {
      return reply.code(202).send({
        token,
        state: "cleanup_pending",
        message: "Database access is removed; local file cleanup is pending and can be resumed.",
      });
    }
    return { token, state: "completed", completedAt: outcome.completedAt };
  });

  app.addHook("preHandler", async (request, reply) => {
    if (
      !request.url.startsWith("/v1/") ||
      request.url.startsWith("/v1/auth/demo") ||
      request.url.startsWith("/v1/auth/local") ||
      request.url.startsWith("/v1/auth/invitations") ||
      request.url.startsWith("/v1/auth/status") ||
      request.url.startsWith("/v1/worker/") ||
      request.url.startsWith("/v1/meta") ||
      request.url.startsWith("/v1/deletion/status") ||
      request.url.startsWith("/v1/deletion/resume")
    )
      return;
    const token = request.cookies[SESSION_COOKIE];
    if (!token)
      return reply.code(401).send({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Start or resume a local Nimanto session.",
        },
      });
    const session = await store.resolveSession(token);
    if (!session)
      return reply.code(401).send({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Start or resume a local Nimanto session.",
        },
      });
    request.identity = session;
  });

  app.get("/v1/session", async (request) => ({ identity: identity(request) }));
  app.delete("/v1/session", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await store.revokeSession(token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { signedOut: true };
  });

  app.post("/v1/worker/cycle", async (request) => {
    if (!secretsEqual(request.headers["x-nimanto-bootstrap-secret"], options.bootstrapSecret)) {
      throw new Error("INVALID_BOOTSTRAP_SECRET");
    }
    return discoveryCycle.runWorkerCycle();
  });

  app.get("/v1/schedules", async (request) => ({
    schedules: await store.listSourceSchedules(identity(request).tenantId),
  }));
  app.post("/v1/schedules", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const provider = string(body.provider, "provider") as "greenhouse" | "lever" | "ashby";
    if (!["greenhouse", "lever", "ashby"].includes(provider)) throw new Error("INVALID_PROVIDER");
    if (typeof body.cadenceMinutes !== "number") throw new Error("INVALID_CADENCE_MINUTES");
    return store.createSourceSchedule(person.tenantId, {
      provider,
      board: string(body.board, "board"),
      cadenceMinutes: body.cadenceMinutes,
    });
  });
  for (const [pathSuffix, operation] of [
    ["pause", store.pauseSourceSchedule.bind(store)],
    ["resume", store.resumeSourceSchedule.bind(store)],
    ["run-now", store.runSourceScheduleNow.bind(store)],
  ] as const) {
    app.post(`/v1/schedules/:id/${pathSuffix}`, async (request) => {
      const person = identity(request);
      const id = string((request.params as { id?: unknown }).id, "schedule_id");
      const schedule = await operation(person.tenantId, id);
      if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
      return schedule;
    });
  }
  app.delete("/v1/schedules/:id", async (request) => {
    const person = identity(request);
    const id = string((request.params as { id?: unknown }).id, "schedule_id");
    const schedule = await store.cancelSourceSchedule(person.tenantId, id);
    if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
    return schedule;
  });

  app.get("/v1/models/status", async () => localModelStatus());
  app.post("/v1/models/draft-summary", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const [job, evidence] = await Promise.all([
      store.getJob(person.tenantId, string(body.jobId, "job_id")),
      store.listEvidence(person.tenantId),
    ]);
    if (!job) throw new Error("JOB_NOT_FOUND");
    return draftLocalSummary({
      model: string(body.model, "model"),
      role: job.title,
      company: job.company,
      evidence: evidence
        .filter((claim) => claim.status === "confirmed")
        .map((claim) => claim.value),
    });
  });

  app.get("/v1/dashboard", async (request) => {
    const person = identity(request);
    const [
      evidence,
      jobs,
      matches,
      signals,
      applications,
      packets,
      actions,
      receipts,
      profile,
      schedules,
    ] = await Promise.all([
      store.listEvidence(person.tenantId),
      store.listJobs(person.tenantId),
      store.listLatestMatches(person.tenantId),
      store.listH1bSignals(person.tenantId),
      store.listApplications(person.tenantId),
      store.listLatestPackets(person.tenantId),
      store.listExternalActions(person.tenantId),
      store.listReceipts(person.tenantId),
      store.latestProfileVersion(person.tenantId),
      store.listSourceSchedules(person.tenantId),
    ]);
    const actionPackets = await store.listPacketsByIds(
      person.tenantId,
      actions.map((action) => action.packetId).filter((id): id is string => id !== null),
    );
    const assurancePackets = [
      ...new Map([...packets, ...actionPackets].map((packet) => [packet.id, packet])).values(),
    ];
    const assurances = await store.listLatestAssurancesForPackets(
      person.tenantId,
      assurancePackets.map((packet) => packet.id),
    );
    const assuranceByPacket = new Map(
      assurances.map((assurance) => [assurance.packetId, assurance]),
    );
    return {
      identity: person,
      profile,
      evidence,
      jobs,
      matches,
      h1bSignals: signals.map((signal) => ({ ...signal, ...freshH1bLabel(signal) })),
      applications,
      packets: packets.map((packet) => ({
        ...packet,
        latestAssurance: assuranceByPacket.get(packet.id) ?? null,
      })),
      actionPackets: actionPackets.map((packet) => ({
        ...packet,
        latestAssurance: assuranceByPacket.get(packet.id) ?? null,
      })),
      externalActions: actions,
      receipts,
      schedules,
      personalFunnel: {
        sampleSize: applications.length,
        replies: applications.filter((application) =>
          application.outcomes?.some((outcome) => outcome.type === "reply"),
        ).length,
        screens: applications.filter((application) =>
          application.outcomes?.some((outcome) => outcome.type === "screen"),
        ).length,
        interviews: applications.filter((application) =>
          application.outcomes?.some((outcome) => outcome.type === "interview"),
        ).length,
        offers: applications.filter((application) =>
          application.outcomes?.some((outcome) => outcome.type === "offer"),
        ).length,
        scope: "Candidate-reported outcomes in this local workspace; not a hiring probability.",
      },
      runtime: { externalActionsEnabled: externalActionLifecycle.runtime() },
    };
  });

  app.post("/v1/evidence", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const allowedKinds: EvidenceClaim["kind"][] = [
      "employment",
      "education",
      "project",
      "certification",
      "accomplishment",
      "skill",
      "preference",
      "authorization_wording",
    ];
    const kind = string(body.kind, "kind") as EvidenceClaim["kind"];
    if (!allowedKinds.includes(kind)) throw new Error("INVALID_KIND");
    return store.createEvidence(person.tenantId, {
      kind,
      value: string(body.value, "value"),
      status: "pending",
      confidence: "medium",
      sourceName:
        typeof body.sourceName === "string"
          ? string(body.sourceName, "source_name")
          : "Manual entry",
      /* A manual claim has no locator to record, and the form has no field for
       * one. Storing the source name again would put a value Nimanto invented
       * into a provenance field that travels into packets, exports and stored
       * history. Absence is the honest record; the column stays NOT NULL. */
      /* `allowEmpty` so the value this route now stores can be sent back to it.
       * Without it a manual claim could be read but not round-tripped: the empty
       * locator it was given would be rejected as INVALID_LOCATOR. */
      locator:
        typeof body.locator === "string"
          ? string(body.locator, "locator", { allowEmpty: true })
          : "",
      userAttested: true,
    });
  });

  app.post("/v1/evidence/preview", async (request) => {
    identity(request);
    return evidenceIntake.preview(request.body);
  });

  app.post("/v1/evidence/import", async (request) => {
    const person = identity(request);
    return evidenceIntake.commit(person.tenantId, request.body);
  });

  app.post("/v1/evidence/:id/confirm", async (request) => {
    const person = identity(request);
    const params = request.params as { id: string };
    const claim = await store.confirmEvidence(person.tenantId, params.id);
    if (!claim) throw new Error("EVIDENCE_NOT_FOUND");
    return claim;
  });
  app.post("/v1/evidence/:id/reject", async (request) => {
    const person = identity(request);
    const params = request.params as { id: string };
    const claim = await store.rejectEvidence(person.tenantId, params.id);
    if (!claim) throw new Error("EVIDENCE_NOT_FOUND");
    return claim;
  });
  app.post("/v1/profile/versions", async (request) => {
    const person = identity(request);
    const body = object(request.body ?? {});
    const saved = await store.saveProfileVersion(
      person.tenantId,
      typeof body.authorizationWording === "string" ? body.authorizationWording : "",
    );
    // Additive patch response: existing clients still receive the version's
    // top-level fields, while newer clients can distinguish a no-op save.
    return { ...saved.version, created: saved.created };
  });

  app.get("/v1/history/profile-versions", async (request) => {
    const person = identity(request);
    return store.listProfileVersions(person.tenantId, historyOptions(request.query));
  });

  app.get("/v1/history/match-runs", async (request) => {
    const person = identity(request);
    const query = object(request.query ?? {});
    const jobId = query.jobId === undefined ? undefined : string(query.jobId, "job_id");
    const page = await store.listMatchRuns(person.tenantId, {
      ...historyOptions(query),
      ...(jobId ? { jobId } : {}),
    });
    const jobs = new Map(
      (
        await store.listJobsByIds(
          person.tenantId,
          page.items.map((run) => run.jobId),
        )
      ).map((job) => [job.id, job]),
    );
    return {
      ...page,
      items: page.items.map((run) => ({ ...run, currentJob: jobs.get(run.jobId) ?? null })),
    };
  });

  app.post("/v1/jobs", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const title = string(body.title, "title");
    const company = string(body.company, "company");
    const description = string(body.description, "description");
    const requirements = strings(body.requirements ?? [], "requirements");
    const compensationMin = typeof body.compensationMin === "number" ? body.compensationMin : null;
    const compensationMax = typeof body.compensationMax === "number" ? body.compensationMax : null;
    if (
      (compensationMin !== null && (!Number.isFinite(compensationMin) || compensationMin < 0)) ||
      (compensationMax !== null && (!Number.isFinite(compensationMax) || compensationMax < 0)) ||
      (compensationMin !== null && compensationMax !== null && compensationMin > compensationMax)
    ) {
      throw new Error("INVALID_COMPENSATION");
    }
    return store.upsertJob(
      person.tenantId,
      normalizeRoleObservation({
        source: "manual",
        sourceRoleId: canonicalHash({ title, company, description }).slice(0, 24),
        title,
        company,
        description,
        location: typeof body.location === "string" ? body.location : "",
        workMode: typeof body.workMode === "string" ? body.workMode : "unspecified",
        url: privateSourceUrl(body.url),
        requirements,
        sourceMeta: {
          manual: true,
          compensation:
            compensationMin !== null || compensationMax !== null
              ? {
                  minimum: compensationMin,
                  maximum: compensationMax,
                  currency: "USD",
                  period: "annual",
                  source: "user_supplied_posting",
                }
              : null,
          benefits: Array.isArray(body.benefits)
            ? body.benefits
                .filter((value): value is string => typeof value === "string")
                .slice(0, 30)
            : [],
          interviewEvidence:
            typeof body.interviewEvidence === "string" && body.interviewEvidence.trim()
              ? {
                  text: body.interviewEvidence.normalize("NFC").trim(),
                  sourceLocator:
                    typeof body.interviewSource === "string"
                      ? body.interviewSource.normalize("NFC").trim()
                      : "user supplied",
                  observedAt: new Date().toISOString(),
                  confidence: "user_supplied",
                  limitations:
                    "Applies only to the recorded role/location context; verify freshness.",
                }
              : null,
        },
        contentHash: canonicalHash({ title, company, description, requirements }),
      }),
    );
  });

  app.post("/v1/jobs/import", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const provider = string(body.provider, "provider") as "greenhouse" | "lever" | "ashby";
    if (!["greenhouse", "lever", "ashby"].includes(provider)) throw new Error("INVALID_PROVIDER");
    const result = await discoveryCycle.directImport(
      person.tenantId,
      provider,
      string(body.board, "board"),
    );
    return { imported: result.imported, jobs: result.jobs };
  });

  app.post("/v1/jobs/url-import", async (request) => {
    const person = identity(request);
    if (options.urlAllowlist.length === 0 || !options.urlTermsReviewedAt) {
      throw new Error("URL_INTAKE_DISABLED");
    }
    const body = object(request.body);
    const page = await fetchAllowlistedJobPage({
      url: string(body.url, "url"),
      allowedHosts: options.urlAllowlist,
    });
    const title = string(body.title, "title");
    const company = string(body.company, "company");
    const requirements = strings(body.requirements ?? [], "requirements");
    return store.upsertJob(
      person.tenantId,
      normalizeRoleObservation({
        source: "allowlisted_url",
        sourceRoleId: canonicalHash(page.canonicalUrl).slice(0, 24),
        title,
        company,
        description: page.text,
        location: typeof body.location === "string" ? body.location : "",
        workMode: typeof body.workMode === "string" ? body.workMode : "unspecified",
        url: page.canonicalUrl,
        requirements,
        sourceMeta: {
          retrievalMethod: "allowlisted_https_get",
          observedAt: page.observedAt,
          termsReviewedAt: options.urlTermsReviewedAt,
          transientBodyDeleted: true,
          redistribution: "tenant_private_normalized_text_only",
        },
        contentHash: canonicalHash({
          title,
          company,
          description: page.text,
          requirements,
          url: page.canonicalUrl,
        }),
      }),
    );
  });

  app.post("/v1/jobs/:id/match", async (request) => {
    const person = identity(request);
    const params = request.params as { id: string };
    return publishMatch(store, person.tenantId, params.id, "manual");
  });

  app.post("/v1/h1b-signals", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const label = string(body.label, "label") as H1bSignalLabel;
    if (!H1B_LABELS.includes(label)) throw new Error("INVALID_LABEL");
    return store.createH1bSignal(person.tenantId, {
      company: string(body.company, "company"),
      label,
      sourceType: string(body.sourceType, "source_type"),
      sourceLocator: string(body.sourceLocator, "source_locator"),
      sourcePeriod: string(body.sourcePeriod, "source_period"),
      observedAt: typeof body.observedAt === "string" ? body.observedAt : new Date().toISOString(),
      confidence:
        body.confidence === "high" || body.confidence === "medium" ? body.confidence : "low",
      limitations: string(body.limitations, "limitations"),
    });
  });

  app.post("/v1/h1b-signals/government-import", async (request) => {
    const person = identity(request);
    return governmentDataset.import(person.tenantId, request.body);
  });

  app.post("/v1/applications", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const profile = await store.latestProfileVersion(person.tenantId);
    return store.createApplication(
      person.tenantId,
      string(body.jobId, "job_id"),
      profile?.id ?? null,
    );
  });
  app.put("/v1/applications/:id/status", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const requestedStatus = string(body.status, "status");
    if (!applicationTransitions.isStatus(requestedStatus)) throw new Error("INVALID_STATUS");
    const id = (request.params as { id: string }).id;
    const record = await store.transitionCandidateApplicationStatus(
      person.tenantId,
      id,
      requestedStatus,
      body.confirmed === true,
    );
    if (!record) throw new Error("APPLICATION_NOT_FOUND");
    return record;
  });
  app.post("/v1/applications/:id/outcomes", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const type = string(body.type, "type") as OutcomeType;
    const types: OutcomeType[] = [
      "reply",
      "screen",
      "interview",
      "offer",
      "rejection",
      "withdrawal",
    ];
    if (!types.includes(type)) throw new Error("INVALID_TYPE");
    return store.addOutcome(person.tenantId, (request.params as { id: string }).id, {
      type,
      note: typeof body.note === "string" ? body.note : "",
      occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : new Date().toISOString(),
    });
  });

  app.post("/v1/packets", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const applicationId = string(body.applicationId, "application_id");
    return packetLifecycle.create({
      tenantId: person.tenantId,
      applicationId,
      candidateName: person.displayName,
      ...(typeof body.contactEmail === "string"
        ? { contactEmail: string(body.contactEmail, "contact_email") }
        : {}),
    });
  });

  app.get("/v1/applications/:id/packets", async (request) => {
    const person = identity(request);
    const applicationId = string((request.params as { id?: unknown }).id, "application_id");
    return store.listApplicationPackets(
      person.tenantId,
      applicationId,
      historyOptions(request.query),
    );
  });

  app.get("/v1/packets/:id/assurance-runs", async (request) => {
    const person = identity(request);
    const packetId = string((request.params as { id?: unknown }).id, "packet_id");
    return store.listAssuranceRuns(person.tenantId, packetId, historyOptions(request.query));
  });

  app.post("/v1/packets/:id/assure", async (request) => {
    const person = identity(request);
    const packetId = (request.params as { id: string }).id;
    return packetLifecycle.assure(person.tenantId, packetId);
  });
  app.post("/v1/packets/:id/approve", async (request) => {
    const person = identity(request);
    const packetId = (request.params as { id: string }).id;
    return packetLifecycle.approve(person.tenantId, packetId);
  });
  app.get("/v1/packets/:id/artifacts/:format", async (request, reply) => {
    const person = identity(request);
    const { id, format } = request.params as { id: string; format: string };
    if (!["json", "txt", "modern_docx", "modern_pdf", "ats_docx", "ats_pdf"].includes(format))
      throw new Error("INVALID_FORMAT");
    const packet = await store.getPacket(person.tenantId, id);
    if (!packet) throw new Error("PACKET_NOT_FOUND");
    const manifest = packet.artifactManifest as ArtifactManifest;
    const artifact = manifest.artifacts?.find((item) => item.format === format);
    if (!artifact || path.basename(artifact.filename) !== artifact.filename)
      throw new Error("ARTIFACT_NOT_FOUND");
    const bytes = await verifiedArtifactBytes(
      options.artifactDirectory,
      person.tenantId,
      id,
      artifact,
    );
    const contentTypes: Record<string, string> = {
      json: "application/json",
      txt: "text/plain; charset=utf-8",
      modern_docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ats_docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      modern_pdf: "application/pdf",
      ats_pdf: "application/pdf",
    };
    return reply
      .header("content-type", contentTypes[format])
      .header("x-nimanto-sha256", artifact.sha256)
      .header("content-disposition", `attachment; filename=\"${artifact.filename}\"`)
      .send(bytes);
  });

  app.put("/v1/actions/runtime", async (request) => {
    const body = object(request.body);
    if (typeof body.enabled !== "boolean") throw new Error("INVALID_ENABLED");
    return externalActionLifecycle.setRuntime(body.enabled);
  });
  app.post("/v1/actions", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const packetId = string(body.packetId, "packet_id");
    const provider = string(body.provider, "provider") as ExternalActionProvider;
    return externalActionLifecycle.request({
      tenantId: person.tenantId,
      packetId,
      provider,
      to: string(body.to, "to"),
      subject: string(body.subject, "subject"),
      body: string(body.body, "body"),
    });
  });
  app.post("/v1/actions/:id/approve", async (request) => {
    const person = identity(request);
    const id = (request.params as { id: string }).id;
    return externalActionLifecycle.approve(person.tenantId, id);
  });
  app.post("/v1/actions/:id/cancel", async (request) => {
    const person = identity(request);
    const id = (request.params as { id: string }).id;
    return externalActionLifecycle.cancel(person.tenantId, id);
  });
  app.post("/v1/actions/:id/execute", async (request) => {
    const person = identity(request);
    const id = (request.params as { id: string }).id;
    return externalActionLifecycle.execute(person.tenantId, id);
  });

  app.get("/v1/export", async (request, reply) => {
    const person = identity(request);
    const workspace = await store.exportTenant(person.tenantId);
    return reply.header("content-disposition", 'attachment; filename="nimanto-export.json"').send({
      exportVersion: "nimanto-local-beta-v2",
      exportedAt: new Date().toISOString(),
      identity: {
        displayName: person.displayName,
        email: person.email,
      },
      workspace,
      artifactNote:
        "This inspection export includes stored profile, match, packet, assurance, application, and receipt records. Generated packet files remain individually downloadable. It is not a restore archive, immutable job history, or replay proof.",
    });
  });
  app.delete("/v1/data", async (request, reply) => {
    const person = identity(request);
    const body = object(request.body);
    if (body.confirmation !== "DELETE MY NIMANTO DATA") throw new Error("INVALID_CONFIRMATION");
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    const outcome = await deletionCoordinator.start(person.tenantId);
    if (outcome.pending) {
      return reply.code(202).send({
        token: outcome.run.token,
        state: "cleanup_pending",
        message: "Database access is removed; local file cleanup is pending and can be resumed.",
      });
    }
    return {
      token: outcome.run.token,
      state: "completed",
      completedAt: outcome.completedAt,
      message: "All workspace data was deleted. Keep this status token for seven days.",
    };
  });

  return app;
}
