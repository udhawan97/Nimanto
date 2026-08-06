import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { NimantoStore, type SessionIdentity } from "@nimanto/database";
import {
  inspectPacketArtifacts,
  type CanonicalPacket,
  type DocumentInspection,
  renderPacketArtifacts,
} from "@nimanto/documents";
import {
  assurePacket,
  canonicalHash,
  createReceipt,
  evaluateEmployerResolution,
  freshH1bLabel,
  isApplicationTransitionLegal,
  matchJob,
  resolveEmployer,
  transitionExternalAction,
  type ApplicationStatus,
  type EvidenceClaim,
  type ExternalActionProvider,
  type ExternalActionState,
  type H1bSignalLabel,
  type OutcomeType,
} from "@nimanto/domain";
import { parseEvidenceFile, type ParsedEvidence } from "@nimanto/parsers";
import {
  draftLocalSummary,
  executeProviderAction,
  fetchAllowlistedJobPage,
  fetchProviderJobs,
  localModelStatus,
  localModelInventory,
  reviewLocalPacket,
  validateActionPayload,
} from "@nimanto/providers";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { NimantoApiOptions } from "./config.js";

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
type ArtifactManifest = {
  artifacts?: Array<{ format: string; filename: string; sha256: string }>;
  documentInspection?: DocumentInspection;
};

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

async function parseEvidenceUpload(value: unknown): Promise<{
  filename: string;
  mimeType?: string;
  parsed: ParsedEvidence;
}> {
  const body = object(value);
  const filename = string(body.filename, "filename");
  const contentBase64 = string(body.contentBase64, "content_base64");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64)) {
    throw new Error("INVALID_CONTENT_BASE64");
  }
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : undefined;
  const parsed = await parseEvidenceFile({
    filename,
    ...(mimeType ? { mimeType } : {}),
    bytes: Buffer.from(contentBase64, "base64"),
  });
  return { filename, ...(mimeType ? { mimeType } : {}), parsed };
}

function evidencePreviewHash(upload: {
  filename: string;
  mimeType?: string;
  parsed: ParsedEvidence;
}): string {
  return canonicalHash({
    filename: upload.filename,
    mimeType: upload.mimeType ?? "",
    claims: upload.parsed.claims,
    warnings: upload.parsed.warnings,
    preview: upload.parsed.preview ?? null,
  });
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

async function verifiedArtifactBytes(
  artifactDirectory: string,
  tenantId: string,
  packetId: string,
  artifact: { filename: string; sha256: string },
): Promise<Buffer> {
  if (
    path.basename(artifact.filename) !== artifact.filename ||
    !/^[a-f0-9]{64}$/u.test(artifact.sha256)
  ) {
    throw new Error("ARTIFACT_INTEGRITY_FAILED");
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(path.join(artifactDirectory, tenantId, packetId, artifact.filename));
  } catch {
    throw new Error("ARTIFACT_INTEGRITY_FAILED");
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== artifact.sha256) throw new Error("ARTIFACT_INTEGRITY_FAILED");
  return bytes;
}

async function verifyPacketArtifacts(
  artifactDirectory: string,
  tenantId: string,
  packetId: string,
  manifest: ArtifactManifest,
): Promise<void> {
  if (!manifest.artifacts?.length) throw new Error("ARTIFACT_INTEGRITY_FAILED");
  await Promise.all(
    manifest.artifacts.map((artifact) =>
      verifiedArtifactBytes(artifactDirectory, tenantId, packetId, artifact),
    ),
  );
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
  if (code === "INVALID_TRANSITION")
    return { code, status: 409, message: "That action is no longer in the required state." };
  if (code === "EVIDENCE_PREVIEW_CHANGED")
    return { code, status: 409, message: "Review the file preview again before importing it." };
  if (code === "ARTIFACT_INTEGRITY_FAILED")
    return {
      code,
      status: 409,
      message: "A packet artifact no longer matches its recorded SHA-256 hash.",
    };
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
  const providerJobsFetcher = options.providerJobsFetcher ?? fetchProviderJobs;
  const trustedEmployerEvaluation = options.trustedEmployerResolutionEvaluation;
  if (trustedEmployerEvaluation) {
    if (
      !trustedEmployerEvaluation.reviewer.trim() ||
      !Number.isFinite(new Date(trustedEmployerEvaluation.reviewedAt).getTime()) ||
      canonicalHash(trustedEmployerEvaluation.fixtures) !==
        trustedEmployerEvaluation.datasetChecksum
    ) {
      await store.close();
      throw new Error("INVALID_TRUSTED_EMPLOYER_EVALUATION");
    }
  }
  const removePath = options.removePath ?? rm;
  const finishDeletion = async (run: {
    id: string;
    tenantId: string;
    state: string;
    actionIds: string[];
  }): Promise<string> => {
    if (run.state !== "database_deleted") {
      await store.purgeTenantForDeletion(run.id, run.tenantId);
    }
    await removePath(path.join(options.artifactDirectory, run.tenantId), {
      recursive: true,
      force: true,
    });
    await Promise.all(
      run.actionIds.map((actionId) =>
        removePath(path.join(options.outboxDirectory, `${actionId}.json`), { force: true }),
      ),
    );
    return store.completeDeletion(run.id);
  };
  type ScheduleWriteStore = Pick<
    NimantoStore,
    "upsertJob" | "listEvidence" | "latestProfileVersion" | "saveMatch" | "saveReceipt"
  >;
  const persistProviderSource = async (
    database: ScheduleWriteStore,
    tenantId: string,
    remote: Awaited<ReturnType<typeof providerJobsFetcher>>,
    scoreImportedJobs: boolean,
  ): Promise<{
    imported: number;
    matched: number;
    jobs: Awaited<ReturnType<ScheduleWriteStore["upsertJob"]>>[];
  }> => {
    const jobs = [];
    for (const job of remote.slice(0, 500)) {
      jobs.push(await database.upsertJob(tenantId, { ...job, capability: "deep_link" }));
    }
    if (!scoreImportedJobs || jobs.length === 0) return { imported: jobs.length, matched: 0, jobs };
    const [evidence, profile] = await Promise.all([
      database.listEvidence(tenantId),
      database.latestProfileVersion(tenantId),
    ]);
    let matched = 0;
    for (const job of jobs) {
      const result = matchJob({
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          description: job.description,
          requirements: job.requirements,
          location: job.location,
          workMode: job.workMode,
        },
        evidence,
      });
      const saved = await database.saveMatch(tenantId, job.id, profile?.id ?? null, result);
      const receipt = createReceipt({
        id: randomUUID(),
        type: "match.published",
        occurredAt: new Date().toISOString(),
        input: {
          jobId: job.id,
          profileVersionId: profile?.id ?? null,
          inputHash: saved.inputHash,
          source: "scheduled_discovery",
        },
        artifact: {
          artifactHash: saved.artifactHash,
          ruleVersion: saved.ruleVersion,
          band: result.band,
        },
      });
      await database.saveReceipt(tenantId, receipt, {
        jobId: job.id,
        matchRunId: saved.id,
        evidenceIds: result.requirements.flatMap((requirement) => requirement.evidenceIds),
      });
      matched += 1;
    }
    return { imported: jobs.length, matched, jobs };
  };
  const importProviderSource = async (
    tenantId: string,
    provider: "greenhouse" | "lever" | "ashby",
    board: string,
    scoreImportedJobs: boolean,
  ) =>
    persistProviderSource(
      store,
      tenantId,
      await providerJobsFetcher({ provider, board }),
      scoreImportedJobs,
    );
  const scheduledErrorCode = (error: unknown): string => {
    const message = error instanceof Error ? error.message : "";
    return /^(?:PROVIDER_[A-Z0-9_]+|INVALID_BOARD_IDENTIFIER)$/u.test(message)
      ? message
      : "PROVIDER_REFRESH_FAILED";
  };
  const scheduleLeaseWasLost = (error: unknown): boolean =>
    error instanceof Error && error.message === "SCHEDULE_LEASE_INVALID";
  let externalActionsEnabled = false;
  const app = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024, trustProxy: false });

  await app.register(cookie, { hook: "onRequest" });
  await app.register(cors, {
    origin: options.webOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Nimanto local beta API",
        version: "0.2.0",
        description: "Candidate-side evidence and application workbench.",
      },
      servers: [{ url: `http://${options.host}:${options.port}` }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.addHook("onClose", async () => store.close());
  app.setErrorHandler((error, _request, reply) => {
    const safe = messageForError(error instanceof Error ? error : new Error("INTERNAL_ERROR"));
    void reply.code(safe.status).send({ error: { code: safe.code, message: safe.message } });
  });
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/")) reply.header("cache-control", "no-store");
    return payload;
  });

  app.get("/health", async () => ({ status: "ok", version: "0.2.0" }));
  app.get("/v1/meta", async () => ({
    name: "Nimanto",
    version: "0.2.0",
    mode: "local_beta",
    externalActionsEnabled,
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
    const run = await store.deletionRunByToken(token);
    if (!run) throw new Error("DELETION_NOT_FOUND");
    if (run.state === "completed") return { token, state: "completed" };
    try {
      const completedAt = await finishDeletion(run);
      return { token, state: "completed", completedAt };
    } catch {
      await store.markDeletionCleanupPending(run.id, "FILESYSTEM_CLEANUP_FAILED");
      return reply.code(202).send({
        token,
        state: "cleanup_pending",
        message: "Database access is removed; local file cleanup is pending and can be resumed.",
      });
    }
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
    const totals = { processed: 0, failed: 0, imported: 0, matched: 0 };
    for (let index = 0; index < 3; index += 1) {
      const claim = await store.claimDueSourceSchedule();
      if (!claim) break;
      totals.processed += 1;
      try {
        const remote = await providerJobsFetcher({
          provider: claim.schedule.provider,
          board: claim.schedule.board,
        });
        const execution = await store.executeSourceSchedule(
          claim.schedule.id,
          claim.leaseToken,
          (transaction) =>
            persistProviderSource(transaction, claim.schedule.tenantId, remote, true),
        );
        const result = execution.result;
        totals.imported += result.imported;
        totals.matched += result.matched;
      } catch (error) {
        totals.failed += 1;
        try {
          await store.failSourceSchedule(
            claim.schedule.id,
            claim.leaseToken,
            scheduledErrorCode(error),
          );
        } catch (leaseError) {
          if (!scheduleLeaseWasLost(leaseError)) throw leaseError;
        }
      }
    }
    return totals;
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
      store.listPackets(person.tenantId),
      store.listExternalActions(person.tenantId),
      store.listReceipts(person.tenantId),
      store.latestProfileVersion(person.tenantId),
      store.listSourceSchedules(person.tenantId),
    ]);
    return {
      identity: person,
      profile,
      evidence,
      jobs,
      matches,
      h1bSignals: signals.map((signal) => ({ ...signal, ...freshH1bLabel(signal) })),
      applications,
      packets,
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
      runtime: { externalActionsEnabled },
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
      locator: typeof body.locator === "string" ? string(body.locator, "locator") : "Manual entry",
      userAttested: true,
    });
  });

  app.post("/v1/evidence/preview", async (request) => {
    identity(request);
    const upload = await parseEvidenceUpload(request.body);
    return {
      claimCount: upload.parsed.claims.length,
      warnings: upload.parsed.warnings,
      preview: upload.parsed.preview ?? null,
      previewHash: evidencePreviewHash(upload),
    };
  });

  app.post("/v1/evidence/import", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const upload = await parseEvidenceUpload(body);
    if (
      string(body.confirmedPreviewHash, "confirmed_preview_hash") !== evidencePreviewHash(upload)
    ) {
      throw new Error("EVIDENCE_PREVIEW_CHANGED");
    }
    const claims = [];
    for (const claim of upload.parsed.claims.slice(0, 500))
      claims.push(await store.createEvidence(person.tenantId, claim));
    return {
      claims,
      warnings: upload.parsed.warnings,
      preview: upload.parsed.preview ?? null,
    };
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
    return store.createProfileVersion(
      person.tenantId,
      typeof body.authorizationWording === "string" ? body.authorizationWording : "",
    );
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
    return store.upsertJob(person.tenantId, {
      source: "manual",
      sourceJobId: canonicalHash({ title, company, description }).slice(0, 24),
      title,
      company,
      description,
      location: typeof body.location === "string" ? body.location : "",
      workMode: typeof body.workMode === "string" ? body.workMode : "unspecified",
      url: privateSourceUrl(body.url),
      requirements,
      capability: "deep_link",
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
          ? body.benefits.filter((value): value is string => typeof value === "string").slice(0, 30)
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
    });
  });

  app.post("/v1/jobs/import", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const provider = string(body.provider, "provider") as "greenhouse" | "lever" | "ashby";
    if (!["greenhouse", "lever", "ashby"].includes(provider)) throw new Error("INVALID_PROVIDER");
    const result = await importProviderSource(
      person.tenantId,
      provider,
      string(body.board, "board"),
      false,
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
    return store.upsertJob(person.tenantId, {
      source: "allowlisted_url",
      sourceJobId: canonicalHash(page.canonicalUrl).slice(0, 24),
      title,
      company,
      description: page.text,
      location: typeof body.location === "string" ? body.location : "",
      workMode: typeof body.workMode === "string" ? body.workMode : "unspecified",
      url: page.canonicalUrl,
      requirements,
      capability: "deep_link",
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
    });
  });

  app.post("/v1/jobs/:id/match", async (request) => {
    const person = identity(request);
    const params = request.params as { id: string };
    const [job, evidence, profile] = await Promise.all([
      store.getJob(person.tenantId, params.id),
      store.listEvidence(person.tenantId),
      store.latestProfileVersion(person.tenantId),
    ]);
    if (!job) throw new Error("JOB_NOT_FOUND");
    const result = matchJob({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
        location: job.location,
        workMode: job.workMode,
      },
      evidence,
    });
    const saved = await store.saveMatch(person.tenantId, job.id, profile?.id ?? null, result);
    const receipt = createReceipt({
      id: randomUUID(),
      type: "match.published",
      occurredAt: new Date().toISOString(),
      input: { jobId: job.id, profileVersionId: profile?.id ?? null, inputHash: saved.inputHash },
      artifact: {
        artifactHash: saved.artifactHash,
        ruleVersion: saved.ruleVersion,
        band: result.band,
      },
    });
    await store.saveReceipt(person.tenantId, receipt, {
      jobId: job.id,
      matchRunId: saved.id,
      evidenceIds: result.requirements.flatMap((requirement) => requirement.evidenceIds),
    });
    return saved;
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
    const body = object(request.body);
    const sourceType = string(body.sourceType, "source_type");
    if (!["dol_oflc_bulk", "uscis_h1b_employer_data"].includes(sourceType)) {
      throw new Error("INVALID_SOURCE_TYPE");
    }
    const sourceEdition = string(body.sourceEdition, "source_edition");
    if (body.resolutionEvaluation !== undefined) {
      throw new Error("UNTRUSTED_RESOLUTION_EVALUATION");
    }
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 500) {
      throw new Error("INVALID_DATASET_ROWS");
    }
    const rows = body.rows.map((value) => object(value));
    const calculatedChecksum = canonicalHash(rows);
    if (string(body.checksum, "checksum") !== calculatedChecksum) {
      throw new Error("DATASET_CHECKSUM_MISMATCH");
    }
    const jobs = await store.listJobs(person.tenantId);
    const companies = [...new Set(jobs.map((job) => job.company))].map((name) => ({
      id: name,
      name,
    }));
    const resolutionEvaluation = evaluateEmployerResolution(
      trustedEmployerEvaluation?.fixtures ?? [],
      companies,
    );
    const positive: H1bSignalLabel[] = [
      "current_role_transfer_support",
      "current_company_policy_support",
      "recent_positive_history",
    ];
    const imported = [];
    for (const [index, row] of rows.entries()) {
      const company = string(row.company, "company");
      const requestedLabel = string(row.label, "label") as H1bSignalLabel;
      if (!H1B_LABELS.includes(requestedLabel)) throw new Error("INVALID_LABEL");
      const resolution = resolveEmployer(company, companies);
      const label =
        positive.includes(requestedLabel) &&
        (resolution.state !== "resolved" || !resolutionEvaluation.enabled)
          ? "possible"
          : requestedLabel;
      imported.push(
        await store.createH1bSignal(person.tenantId, {
          company,
          label,
          sourceType,
          sourceLocator: `${sourceEdition}:row:${index + 1}`,
          sourcePeriod: string(row.sourcePeriod, "source_period"),
          observedAt: string(row.observedAt, "observed_at"),
          confidence:
            resolution.state === "resolved" && resolutionEvaluation.enabled ? "high" : "low",
          limitations: `Historical ${sourceType} evidence from ${sourceEdition}, checksum ${calculatedChecksum}; employer resolution ${resolution.state}; evaluation n=${resolutionEvaluation.sampleSize}, precision=${resolutionEvaluation.precision.toFixed(3)}, recall=${resolutionEvaluation.recall.toFixed(3)}, abstention=${resolutionEvaluation.abstentionRate.toFixed(3)}, enabled=${resolutionEvaluation.enabled}. Not legal advice or a current transfer guarantee.`,
        }),
      );
    }
    return {
      imported: imported.length,
      checksum: calculatedChecksum,
      resolutionEvaluation,
      resolutionEvaluationProvenance: trustedEmployerEvaluation
        ? {
            datasetChecksum: trustedEmployerEvaluation.datasetChecksum,
            reviewedAt: trustedEmployerEvaluation.reviewedAt,
            reviewer: trustedEmployerEvaluation.reviewer,
          }
        : null,
      signals: imported,
    };
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
    const status = string(body.status, "status") as ApplicationStatus;
    const statuses: ApplicationStatus[] = [
      "tracked",
      "prepared",
      "approved_for_export",
      "submitted_externally",
      "withdrawn",
    ];
    if (!statuses.includes(status)) throw new Error("INVALID_STATUS");
    const id = (request.params as { id: string }).id;
    const existing = (await store.listApplications(person.tenantId)).find(
      (application) => application.id === id,
    );
    if (!existing) throw new Error("APPLICATION_NOT_FOUND");
    // Membership in the union is not enough: the board must not be able to
    // record a submission that skipped preparation, and leaving
    // submitted_externally has to clear the timestamp the store stamped.
    if (!isApplicationTransitionLegal(existing.status, status)) {
      throw new Error("INVALID_APPLICATION_TRANSITION");
    }
    const record = await store.setApplicationStatus(person.tenantId, id, status);
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
    const [applications, evidence, profile] = await Promise.all([
      store.listApplications(person.tenantId),
      store.listEvidence(person.tenantId),
      store.latestProfileVersion(person.tenantId),
    ]);
    const application = applications.find((item) => item.id === applicationId);
    if (!application?.job) throw new Error("APPLICATION_NOT_FOUND");
    const confirmed = evidence.filter((claim) => claim.status === "confirmed");
    const generatedAt = new Date().toISOString();
    const packet: CanonicalPacket = {
      schemaVersion: "packet_v1",
      candidateName: person.displayName,
      destination: {
        company: application.job.company,
        role: application.job.title,
        ...(typeof body.contactEmail === "string" ? { contactEmail: body.contactEmail } : {}),
      },
      summary: `${person.displayName} brings ${confirmed.length} confirmed evidence item${confirmed.length === 1 ? "" : "s"} relevant to this application.`,
      claims: confirmed
        .slice(0, 8)
        .map((claim) => ({ text: claim.value, evidenceIds: [claim.id] })),
      authorizationWording: profile?.authorizationWording ?? "",
      generatedAt,
    };
    const saved = await store.createPacket(person.tenantId, {
      applicationId,
      profileVersionId: profile?.id ?? null,
      canonicalContent: packet as unknown as Record<string, unknown>,
      artifactManifest: {},
    });
    const artifacts = await renderPacketArtifacts(
      saved.id,
      packet,
      path.join(options.artifactDirectory, person.tenantId, saved.id),
    );
    const documentInspection = await inspectPacketArtifacts(saved.id, packet, artifacts);
    const updated = await store.updatePacketManifest(person.tenantId, saved.id, {
      artifacts: artifacts.map(({ format, filename, sha256 }) => ({ format, filename, sha256 })),
      documentInspection,
    });
    await store.setApplicationStatus(person.tenantId, applicationId, "prepared");
    const receipt = createReceipt({
      id: randomUUID(),
      type: "packet.generated",
      occurredAt: new Date().toISOString(),
      input: {
        applicationId,
        profileVersionId: profile?.id ?? null,
        evidenceIds: confirmed.map((claim) => claim.id),
      },
      artifact: {
        packetId: saved.id,
        packetHash: saved.artifactHash,
        artifacts: artifacts.map(({ format, sha256 }) => ({ format, sha256 })),
        documentInspection: documentInspection.status,
      },
    });
    await store.saveReceipt(person.tenantId, receipt, {
      packetId: saved.id,
      applicationId,
      artifactHashes: artifacts.map(({ format, sha256 }) => ({ format, sha256 })),
    });
    return updated;
  });

  app.post("/v1/packets/:id/assure", async (request) => {
    const person = identity(request);
    const packetId = (request.params as { id: string }).id;
    const [packet, evidence, profile] = await Promise.all([
      store.getPacket(person.tenantId, packetId),
      store.listEvidence(person.tenantId),
      store.latestProfileVersion(person.tenantId),
    ]);
    if (!packet) throw new Error("PACKET_NOT_FOUND");
    const manifest = packet.artifactManifest as ArtifactManifest;
    await verifyPacketArtifacts(options.artifactDirectory, person.tenantId, packetId, manifest);
    const content = packet.canonicalContent as unknown as CanonicalPacket;
    const result = assurePacket({
      authorizationWording: content.authorizationWording,
      ...(profile ? { lockedAuthorizationWording: profile.authorizationWording } : {}),
      claims: content.claims,
      confirmedEvidenceIds: evidence
        .filter((claim) => claim.status === "confirmed")
        .map((claim) => claim.id),
      destination: content.destination,
    });
    const documentFindings = (manifest.documentInspection?.checks ?? [])
      .filter((check) => check.status === "blocked")
      .map((check) => ({
        code: check.code,
        severity: "required" as const,
        message: `${check.format ?? "packet"}: ${check.detail}`,
      }));
    if (!manifest.documentInspection) {
      documentFindings.push({
        code: "DOCUMENT_INSPECTION_REQUIRED",
        severity: "required",
        message: "The frozen packet is missing its deterministic document inspection report.",
      });
    }
    const modelFindings: Array<{ code: string; severity: "required"; message: string }> = [];
    let modelRule = "model_review_not_configured";
    if (options.assuranceModel) {
      try {
        const inventory = await localModelInventory();
        const configured = inventory.find((model) => model.name === options.assuranceModel);
        if (!configured) {
          modelFindings.push({
            code: "MODEL_REVIEW_BLOCKED_UNAVAILABLE",
            severity: "required",
            message: `Configured local reviewer ${options.assuranceModel} is unavailable; no fallback was used.`,
          });
          modelRule = "ollama_packet_review_v1:blocked_unavailable";
        } else {
          const review = await reviewLocalPacket({ model: configured, packet: content });
          modelRule = `${review.reviewerVersion}:${review.model}@${review.digest}`;
          if (review.verdict === "block") {
            modelFindings.push(
              ...(review.findings.length
                ? review.findings
                : ["The local reviewer blocked approval."]
              ).map((message) => ({
                code: "MODEL_REVIEW_BLOCKED",
                severity: "required" as const,
                message,
              })),
            );
          }
        }
      } catch {
        modelFindings.push({
          code: "MODEL_REVIEW_BLOCKED_UNAVAILABLE",
          severity: "required",
          message:
            "The configured local reviewer did not return a valid result; no fallback was used.",
        });
        modelRule = "ollama_packet_review_v1:blocked_unavailable";
      }
    }
    const savedAssurance = await store.saveAssurance(person.tenantId, packetId, {
      status:
        result.status === "passed" && documentFindings.length === 0 && modelFindings.length === 0
          ? "passed"
          : "blocked",
      ruleVersion: `${result.ruleVersion}+document_assurance_v1+${modelRule}`,
      findings: [...result.findings, ...documentFindings, ...modelFindings],
    });
    const receipt = createReceipt({
      id: randomUUID(),
      type: "packet.assured",
      occurredAt: new Date().toISOString(),
      input: { packetId, packetHash: packet.artifactHash },
      artifact: {
        assuranceId: savedAssurance.id,
        status: savedAssurance.status,
        ruleVersion: savedAssurance.ruleVersion,
        findingCodes: (savedAssurance.findings as Array<{ code?: unknown }>).map((finding) =>
          String(finding.code ?? "UNKNOWN"),
        ),
      },
    });
    await store.saveReceipt(person.tenantId, receipt, {
      packetId,
      assuranceId: savedAssurance.id,
      status: savedAssurance.status,
      ruleVersion: savedAssurance.ruleVersion,
    });
    return savedAssurance;
  });
  app.post("/v1/packets/:id/approve", async (request) => {
    const person = identity(request);
    const packetId = (request.params as { id: string }).id;
    const pending = await store.getPacket(person.tenantId, packetId);
    if (!pending) throw new Error("PACKET_NOT_FOUND");
    await verifyPacketArtifacts(
      options.artifactDirectory,
      person.tenantId,
      packetId,
      pending.artifactManifest as ArtifactManifest,
    );
    const packet = await store.approvePacket(person.tenantId, packetId);
    if (!packet) throw new Error("PACKET_NOT_FOUND");
    await store.setApplicationStatus(person.tenantId, packet.applicationId, "approved_for_export");
    const assurance = await store.latestAssurance(person.tenantId, packetId);
    const receipt = createReceipt({
      id: randomUUID(),
      type: "packet.approved",
      occurredAt: new Date().toISOString(),
      input: { packetId, assuranceId: assurance?.id ?? null },
      artifact: {
        packetHash: packet.artifactHash,
        manifest: packet.artifactManifest,
        approvedAt: packet.approvedAt,
      },
    });
    await store.saveReceipt(person.tenantId, receipt, {
      packetId,
      assuranceId: assurance?.id ?? null,
      artifactManifest: packet.artifactManifest,
    });
    return packet;
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
    externalActionsEnabled = body.enabled;
    return { externalActionsEnabled };
  });
  app.post("/v1/actions", async (request) => {
    const person = identity(request);
    const body = object(request.body);
    const packetId = string(body.packetId, "packet_id");
    const packet = await store.getPacket(person.tenantId, packetId);
    if (packet?.status !== "approved") throw new Error("APPROVED_PACKET_REQUIRED");
    const provider = string(body.provider, "provider") as ExternalActionProvider;
    const providers: ExternalActionProvider[] = ["deep_link", "test_outbox"];
    if (!providers.includes(provider)) throw new Error("INVALID_PROVIDER");
    const to = string(body.to, "to");
    const subject = string(body.subject, "subject");
    const messageBody = string(body.body, "body");
    validateActionPayload({
      actionId: "pending",
      provider,
      to,
      subject,
      body: messageBody,
    });
    return store.createExternalAction(person.tenantId, {
      packetId,
      provider,
      target: { to },
      payload: { subject, body: messageBody },
      idempotencyKey: canonicalHash({ packetId, provider, to, subject, body: messageBody }),
    });
  });
  app.post("/v1/actions/:id/approve", async (request) => {
    const person = identity(request);
    const id = (request.params as { id: string }).id;
    const current = await store.getExternalAction(person.tenantId, id);
    if (!current) throw new Error("ACTION_NOT_FOUND");
    try {
      transitionExternalAction(current.state, "approve");
    } catch {
      throw new Error("INVALID_TRANSITION");
    }
    const updated = await store.transitionExternalAction(
      person.tenantId,
      id,
      current.state,
      "approved",
    );
    if (!updated) throw new Error("INVALID_TRANSITION");
    return updated;
  });
  app.post("/v1/actions/:id/cancel", async (request) => {
    const person = identity(request);
    const id = (request.params as { id: string }).id;
    const current = await store.getExternalAction(person.tenantId, id);
    if (!current) throw new Error("ACTION_NOT_FOUND");
    try {
      transitionExternalAction(current.state, "cancel");
    } catch {
      throw new Error("INVALID_TRANSITION");
    }
    const updated = await store.transitionExternalAction(
      person.tenantId,
      id,
      current.state,
      "cancelled",
    );
    if (!updated) throw new Error("INVALID_TRANSITION");
    return updated;
  });
  app.post("/v1/actions/:id/execute", async (request) => {
    const person = identity(request);
    if (!externalActionsEnabled) throw new Error("EXTERNAL_ACTIONS_DISABLED");
    const id = (request.params as { id: string }).id;
    const current = await store.getExternalAction(person.tenantId, id);
    if (!current) throw new Error("ACTION_NOT_FOUND");
    try {
      transitionExternalAction(current.state, "execute");
    } catch {
      throw new Error("INVALID_TRANSITION");
    }
    const executing = await store.transitionExternalAction(
      person.tenantId,
      id,
      current.state,
      "executing",
    );
    if (!executing) throw new Error("INVALID_TRANSITION");
    try {
      const target = executing.target as { to?: unknown };
      const payload = executing.payload as { subject?: unknown; body?: unknown };
      const result = await executeProviderAction(
        {
          actionId: id,
          provider: executing.provider,
          to: string(target.to, "to"),
          subject: string(payload.subject, "subject"),
          body: string(payload.body, "body"),
        },
        {
          outboxDirectory: options.outboxDirectory,
        },
      );
      transitionExternalAction("executing", "mark_succeeded");
      const succeeded = await store.transitionExternalAction(
        person.tenantId,
        id,
        "executing",
        "succeeded",
        result as unknown as Record<string, unknown>,
      );
      const receipt = createReceipt({
        id: crypto.randomUUID(),
        type: "external_action",
        occurredAt: new Date().toISOString(),
        input: executing,
        artifact: result,
      });
      await store.saveReceipt(person.tenantId, receipt, { actionId: id, result });
      return succeeded;
    } catch (error) {
      transitionExternalAction("executing", "mark_failed");
      await store.transitionExternalAction(person.tenantId, id, "executing", "failed", {
        errorCode:
          error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
            ? error.message
            : "PROVIDER_ERROR",
      });
      throw error;
    }
  });

  app.get("/v1/export", async (request, reply) => {
    const person = identity(request);
    const workspace = await store.exportTenant(person.tenantId);
    return reply.header("content-disposition", 'attachment; filename="nimanto-export.json"').send({
      exportVersion: "nimanto-local-beta-v1",
      exportedAt: new Date().toISOString(),
      identity: {
        displayName: person.displayName,
        email: person.email,
      },
      workspace,
      artifactNote:
        "Generated packet files remain individually downloadable; this JSON includes their manifests, provenance, and hashes.",
    });
  });
  app.delete("/v1/data", async (request, reply) => {
    const person = identity(request);
    const body = object(request.body);
    if (body.confirmation !== "DELETE MY NIMANTO DATA") throw new Error("INVALID_CONFIRMATION");
    const actions = await store.listExternalActions(person.tenantId);
    const run = await store.beginTenantDeletion(
      person.tenantId,
      actions.map((action) => action.id),
    );
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    try {
      const completedAt = await finishDeletion(run);
      return {
        token: run.token,
        state: "completed",
        completedAt,
        message: "All workspace data was deleted. Keep this status token for seven days.",
      };
    } catch {
      await store.markDeletionCleanupPending(run.id, "FILESYSTEM_CLEANUP_FAILED");
      return reply.code(202).send({
        token: run.token,
        state: "cleanup_pending",
        message: "Database access is removed; local file cleanup is pending and can be resumed.",
      });
    }
  });

  return app;
}
