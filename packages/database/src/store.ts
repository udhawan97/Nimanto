import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  canonicalHash,
  scheduledFailureEvent,
  scheduledRetryDelayMinutes,
  verifyReceipt,
  type ApplicationStatus,
  type EvidenceClaim,
  type ExecutionReceipt,
  type ExternalActionProvider,
  type ExternalActionState,
  type H1bSignalLabel,
  type MatchResult,
  type OutcomeType,
  type ScheduledJobState,
  transitionScheduledJob,
} from "@nimanto/domain";
import { schemaSql } from "./schema.js";

interface EvidenceRow {
  id: string;
  kind: EvidenceClaim["kind"];
  value: string;
  status: EvidenceClaim["status"];
  confidence: EvidenceClaim["confidence"];
  source_name: string;
  locator: string;
  user_attested: boolean;
}

interface SessionRow {
  user_id: string;
  tenant_id: string;
  email: string;
  display_name: string;
}

export interface LocalIdentity {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
}

export interface SessionIdentity extends LocalIdentity {
  sessionId: string;
}

export interface InvitationRecord {
  id: string;
  intendedEmail: string;
  token: string;
  expiresAt: string;
}

export interface ProfileVersionRecord {
  id: string;
  claimIds: string[];
  authorizationWording: string;
  inputHash: string;
  createdAt: string;
}

export interface ProfileVersionSaveResult {
  version: ProfileVersionRecord;
  created: boolean;
}

export interface HistoryPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface JobRecord {
  id: string;
  source: string;
  sourceJobId: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode: string;
  url: string;
  requirements: string[];
  status: string;
  capability: string;
  sourceMeta: Record<string, unknown>;
  contentHash: string;
  updatedAt: string;
}

export interface MatchRunRecord {
  id: string;
  jobId: string;
  profileVersionId: string | null;
  ruleVersion: string;
  result: MatchResult;
  inputHash: string;
  artifactHash: string;
  createdAt: string;
}

export interface H1bSignalRecord {
  id: string;
  company: string;
  label: H1bSignalLabel;
  sourceType: string;
  sourceLocator: string;
  sourcePeriod: string;
  observedAt: string;
  confidence: "high" | "medium" | "low";
  limitations: string;
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  profileVersionId: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  job?: Pick<JobRecord, "title" | "company">;
  outcomes?: OutcomeRecord[];
}

export interface OutcomeRecord {
  id: string;
  applicationId: string;
  type: OutcomeType;
  note: string;
  occurredAt: string;
}

export interface PacketRecord {
  id: string;
  applicationId: string;
  profileVersionId: string | null;
  status: "draft" | "assurance_passed" | "assurance_blocked" | "approved";
  canonicalContent: Record<string, unknown>;
  artifactManifest: Record<string, unknown>;
  artifactHash: string;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssuranceRecord {
  id: string;
  packetId: string;
  status: "passed" | "blocked";
  ruleVersion: string;
  findings: unknown[];
  createdAt: string;
}

export interface AssuranceHistoryRecord extends AssuranceRecord {
  /** Tenant-safe ordinal within this packet. The database-wide sequence is
   * intentionally never returned. */
  packetOrdinal: number;
}

export interface ExternalActionRecord {
  id: string;
  packetId: string | null;
  provider: ExternalActionProvider;
  state: ExternalActionState;
  target: Record<string, unknown>;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  approvedAt: string | null;
  attemptedAt: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type SourceScheduleProvider = "greenhouse" | "lever" | "ashby";

export interface SourceScheduleRecord {
  id: string;
  provider: SourceScheduleProvider;
  board: string;
  cadenceMinutes: number;
  state: ScheduledJobState;
  notBefore: string;
  attempts: number;
  maxAttempts: number;
  lastRunAt: string | null;
  lastResult: { imported: number; matched: number } | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimedSourceSchedule {
  schedule: SourceScheduleRecord & { tenantId: string };
  leaseToken: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function iso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function historyLimit(value?: number): number {
  if (value === undefined) return 20;
  if (!Number.isInteger(value) || value < 1) throw new Error("INVALID_LIMIT");
  return Math.min(value, 50);
}

async function tightenPosixPermissions(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("UNSAFE_DATABASE_PATH");
    if (entry.isDirectory()) await tightenPosixPermissions(target);
    else if (entry.isFile()) await chmod(target, 0o600);
  }
}

function mapEvidence(row: EvidenceRow): EvidenceClaim {
  return {
    id: row.id,
    kind: row.kind,
    value: row.value,
    status: row.status,
    confidence: row.confidence,
    sourceName: row.source_name,
    locator: row.locator,
    userAttested: row.user_attested,
  };
}

export class NimantoStore {
  readonly #db: PGlite;

  private constructor(db: PGlite) {
    this.#db = db;
  }

  static async open(dataDirectory: string): Promise<NimantoStore> {
    if (!dataDirectory.startsWith("memory://")) {
      await tightenPosixPermissions(dataDirectory);
    }
    const db = await PGlite.create(dataDirectory);
    await db.exec(schemaSql);
    if (!dataDirectory.startsWith("memory://")) await tightenPosixPermissions(dataDirectory);
    return new NimantoStore(db);
  }

  async close(): Promise<void> {
    await this.#db.close();
  }

  async createLocalTenant(email: string, displayName: string): Promise<LocalIdentity> {
    const normalizedEmail = email.trim().toLocaleLowerCase("en-US");
    const existing = await this.#db.query<{
      user_id: string;
      tenant_id: string;
      email: string;
      display_name: string;
    }>(
      `SELECT u.id AS user_id, m.tenant_id, u.email, u.display_name
       FROM users u JOIN memberships m ON m.user_id = u.id
       WHERE u.email = $1 LIMIT 1`,
      [normalizedEmail],
    );
    const current = existing.rows[0];
    if (current) {
      return {
        userId: current.user_id,
        tenantId: current.tenant_id,
        email: current.email,
        displayName: current.display_name,
      };
    }

    const userId = randomUUID();
    const tenantId = randomUUID();
    await this.#db.transaction(async (tx) => {
      await tx.query("INSERT INTO tenants(id, name) VALUES ($1, $2)", [
        tenantId,
        `${displayName.trim()}'s workspace`,
      ]);
      await tx.query("INSERT INTO users(id, email, display_name) VALUES ($1, $2, $3)", [
        userId,
        normalizedEmail,
        displayName.trim(),
      ]);
      await tx.query("INSERT INTO memberships(tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [
        tenantId,
        userId,
      ]);
    });
    return { userId, tenantId, email: normalizedEmail, displayName: displayName.trim() };
  }

  async issueInvitation(intendedEmail: string, lifetimeHours = 72): Promise<InvitationRecord> {
    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const normalizedEmail = intendedEmail.trim().toLocaleLowerCase("en-US");
    const expiresAt = new Date(Date.now() + lifetimeHours * 60 * 60 * 1000).toISOString();
    await this.#db.query(
      `INSERT INTO invitations(id, token_hash, intended_email, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, sha256(token), normalizedEmail, expiresAt],
    );
    return { id, intendedEmail: normalizedEmail, token, expiresAt };
  }

  async revokeInvitation(id: string): Promise<boolean> {
    const result = await this.#db.query<{ id: string }>(
      `UPDATE invitations SET revoked_at = now()
       WHERE id = $1 AND revoked_at IS NULL AND accepted_at IS NULL
       RETURNING id`,
      [id],
    );
    return Boolean(result.rows[0]);
  }

  async acceptInvitation(
    token: string,
    email: string,
    displayName: string,
  ): Promise<LocalIdentity> {
    const normalizedEmail = email.trim().toLocaleLowerCase("en-US");
    const normalizedName = displayName.trim();
    const userId = randomUUID();
    const tenantId = randomUUID();
    return this.#db.transaction(async (tx) => {
      const invite = await tx.query<{
        id: string;
        intended_email: string;
        expires_at: string | Date;
        accepted_at: string | Date | null;
        revoked_at: string | Date | null;
      }>(
        `SELECT id, intended_email, expires_at, accepted_at, revoked_at
         FROM invitations WHERE token_hash = $1 LIMIT 1`,
        [sha256(token)],
      );
      const row = invite.rows[0];
      if (!row) throw new Error("INVITATION_INVALID");
      if (row.revoked_at) throw new Error("INVITATION_REVOKED");
      if (row.accepted_at) throw new Error("INVITATION_USED");
      if (new Date(row.expires_at).getTime() <= Date.now()) throw new Error("INVITATION_EXPIRED");
      if (row.intended_email !== normalizedEmail) throw new Error("INVITATION_EMAIL_MISMATCH");

      const consumed = await tx.query<{ id: string }>(
        `UPDATE invitations SET accepted_at = now()
         WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
         RETURNING id`,
        [row.id],
      );
      if (!consumed.rows[0]) throw new Error("INVITATION_USED");
      const existing = await tx.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [
        normalizedEmail,
      ]);
      if (existing.rows[0]) throw new Error("INVITATION_EMAIL_UNAVAILABLE");
      await tx.query("INSERT INTO tenants(id, name) VALUES ($1, $2)", [
        tenantId,
        `${normalizedName}'s workspace`,
      ]);
      await tx.query("INSERT INTO users(id, email, display_name) VALUES ($1, $2, $3)", [
        userId,
        normalizedEmail,
        normalizedName,
      ]);
      await tx.query("INSERT INTO memberships(tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [
        tenantId,
        userId,
      ]);
      return { userId, tenantId, email: normalizedEmail, displayName: normalizedName };
    });
  }

  async createSession(
    userId: string,
    tenantId: string,
    lifetimeHours = 12,
  ): Promise<{ id: string; token: string; expiresAt: string }> {
    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + lifetimeHours * 60 * 60 * 1000).toISOString();
    await this.#db.query(
      `INSERT INTO sessions(id, user_id, tenant_id, token_hash, expires_at)
       SELECT $1, $2, $3, $4, $5
       WHERE EXISTS (
         SELECT 1 FROM memberships WHERE user_id = $2 AND tenant_id = $3
       )`,
      [id, userId, tenantId, sha256(token), expiresAt],
    );
    return { id, token, expiresAt };
  }

  async resolveSession(token: string): Promise<SessionIdentity | null> {
    const result = await this.#db.query<SessionRow & { session_id: string }>(
      `SELECT s.id AS session_id, s.user_id, s.tenant_id, u.email, u.display_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
         AND t.deletion_state = 'active'
       LIMIT 1`,
      [sha256(token)],
    );
    const row = result.rows[0];
    return row
      ? {
          sessionId: row.session_id,
          userId: row.user_id,
          tenantId: row.tenant_id,
          email: row.email,
          displayName: row.display_name,
        }
      : null;
  }

  async revokeSession(token: string): Promise<void> {
    await this.#db.query(
      "UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
      [sha256(token)],
    );
  }

  async databaseContains(rawToken: string): Promise<boolean> {
    const result = await this.#db.query<{ found: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM sessions
         WHERE id = $1 OR token_hash = $1 OR user_id = $1 OR tenant_id = $1
       ) AS found`,
      [rawToken],
    );
    return Boolean(result.rows[0]?.found);
  }

  async createSourceSchedule(
    tenantId: string,
    input: {
      provider: SourceScheduleProvider;
      board: string;
      cadenceMinutes: number;
      notBefore?: string;
    },
  ): Promise<SourceScheduleRecord> {
    if (!(["greenhouse", "lever", "ashby"] as string[]).includes(input.provider)) {
      throw new Error("INVALID_PROVIDER");
    }
    if (
      !Number.isInteger(input.cadenceMinutes) ||
      input.cadenceMinutes < 60 ||
      input.cadenceMinutes > 10_080
    ) {
      throw new Error("INVALID_CADENCE_MINUTES");
    }
    const board = input.board.normalize("NFC").trim();
    if (!/^[A-Za-z0-9_-]{1,80}$/u.test(board)) throw new Error("INVALID_BOARD");
    const notBefore = input.notBefore ?? new Date().toISOString();
    if (!Number.isFinite(new Date(notBefore).getTime())) throw new Error("INVALID_NOT_BEFORE");
    const existing = await this.#db.query<any>(
      `SELECT id, tenant_id, state, payload, not_before, attempts, max_attempts,
         last_run_at, last_result, last_error_code, created_at, updated_at
       FROM scheduled_jobs
       WHERE tenant_id = $1 AND type = 'source.refresh'
         AND payload->>'provider' = $2 AND payload->>'board' = $3
         AND state <> 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, input.provider, board],
    );
    if (existing.rows[0]) return this.#mapSourceSchedule(existing.rows[0]);

    const id = randomUUID();
    const created = await this.#db.query<any>(
      `INSERT INTO scheduled_jobs(id, tenant_id, type, state, payload, not_before)
       SELECT $1,$2,'source.refresh','queued',$3::jsonb,$4
       WHERE EXISTS (SELECT 1 FROM tenants WHERE id = $2 AND deletion_state = 'active')
       ON CONFLICT DO NOTHING
       RETURNING id, tenant_id, state, payload, not_before, attempts, max_attempts,
         last_run_at, last_result, last_error_code, created_at, updated_at`,
      [
        id,
        tenantId,
        JSON.stringify({
          provider: input.provider,
          board,
          cadenceMinutes: input.cadenceMinutes,
        }),
        notBefore,
      ],
    );
    if (created.rows[0]) return this.#mapSourceSchedule(created.rows[0]);
    const concurrent = await this.#db.query<any>(
      `SELECT id, tenant_id, state, payload, not_before, attempts, max_attempts,
         last_run_at, last_result, last_error_code, created_at, updated_at
       FROM scheduled_jobs
       WHERE tenant_id = $1 AND type = 'source.refresh'
         AND payload->>'provider' = $2 AND payload->>'board' = $3
         AND state <> 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, input.provider, board],
    );
    if (!concurrent.rows[0]) throw new Error("TENANT_NOT_FOUND");
    return this.#mapSourceSchedule(concurrent.rows[0]);
  }

  async listSourceSchedules(tenantId: string): Promise<SourceScheduleRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, tenant_id, state, payload, not_before, attempts, max_attempts,
         last_run_at, last_result, last_error_code, created_at, updated_at
       FROM scheduled_jobs
       WHERE tenant_id = $1 AND type = 'source.refresh'
       ORDER BY created_at DESC, id`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapSourceSchedule(row));
  }

  async pauseSourceSchedule(tenantId: string, id: string): Promise<SourceScheduleRecord | null> {
    const result = await this.#db.query<any>(
      `UPDATE scheduled_jobs SET state = 'paused', updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND type = 'source.refresh'
         AND state IN ('queued','retry_wait')
       RETURNING id, tenant_id, state, payload, not_before, attempts, max_attempts,
         last_run_at, last_result, last_error_code, created_at, updated_at`,
      [tenantId, id],
    );
    return result.rows[0] ? this.#mapSourceSchedule(result.rows[0]) : null;
  }

  async resumeSourceSchedule(tenantId: string, id: string): Promise<SourceScheduleRecord | null> {
    const result = await this.#db.query<any>(
      `UPDATE scheduled_jobs SET state = 'queued', not_before = now(), attempts = 0,
         lease_token_hash = NULL, lease_expires_at = NULL, last_error_code = NULL,
         updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND type = 'source.refresh'
         AND state IN ('paused','dead_letter')
       RETURNING id, tenant_id, state, payload, not_before, attempts, max_attempts,
         last_run_at, last_result, last_error_code, created_at, updated_at`,
      [tenantId, id],
    );
    return result.rows[0] ? this.#mapSourceSchedule(result.rows[0]) : null;
  }

  async runSourceScheduleNow(tenantId: string, id: string): Promise<SourceScheduleRecord | null> {
    const result = await this.#db.query<any>(
      `UPDATE scheduled_jobs SET not_before = now(), updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND type = 'source.refresh'
         AND state IN ('queued','retry_wait')
       RETURNING id, tenant_id, state, payload, not_before, attempts, max_attempts,
         last_run_at, last_result, last_error_code, created_at, updated_at`,
      [tenantId, id],
    );
    return result.rows[0] ? this.#mapSourceSchedule(result.rows[0]) : null;
  }

  async cancelSourceSchedule(tenantId: string, id: string): Promise<SourceScheduleRecord | null> {
    const result = await this.#db.query<any>(
      `UPDATE scheduled_jobs SET state = 'cancelled', lease_token_hash = NULL,
         lease_expires_at = NULL, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND type = 'source.refresh' AND state <> 'cancelled'
       RETURNING id, tenant_id, state, payload, not_before, attempts, max_attempts,
         last_run_at, last_result, last_error_code, created_at, updated_at`,
      [tenantId, id],
    );
    return result.rows[0] ? this.#mapSourceSchedule(result.rows[0]) : null;
  }

  async claimDueSourceSchedule(
    leaseSeconds = 120,
    now = new Date().toISOString(),
  ): Promise<ClaimedSourceSchedule | null> {
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 900) {
      throw new Error("INVALID_LEASE_SECONDS");
    }
    if (!Number.isFinite(new Date(now).getTime())) throw new Error("INVALID_CLAIMED_AT");
    return this.#db.transaction(async (tx) => {
      await tx.query(
        `UPDATE scheduled_jobs
         SET state = CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'retry_wait' END,
           not_before = $1, lease_token_hash = NULL, lease_expires_at = NULL,
           last_error_code = 'LEASE_EXPIRED', updated_at = $1
         WHERE type = 'source.refresh' AND state = 'running'
           AND lease_expires_at IS NOT NULL AND lease_expires_at <= $1`,
        [now],
      );
      const selected = await tx.query<any>(
        `SELECT j.id, j.tenant_id, j.state
         FROM scheduled_jobs j
         JOIN tenants t ON t.id = j.tenant_id AND t.deletion_state = 'active'
         WHERE j.type = 'source.refresh'
           AND j.state IN ('queued','retry_wait')
           AND j.not_before <= $1
           AND (j.expires_at IS NULL OR j.expires_at > $1)
         ORDER BY j.not_before, j.created_at, j.id
         FOR UPDATE SKIP LOCKED LIMIT 1`,
        [now],
      );
      const row = selected.rows[0];
      if (!row) return null;
      transitionScheduledJob(row.state as ScheduledJobState, "claim");
      const leaseToken = randomBytes(32).toString("base64url");
      const leaseExpiresAt = new Date(new Date(now).getTime() + leaseSeconds * 1000).toISOString();
      const claimed = await tx.query<any>(
        `UPDATE scheduled_jobs
         SET state = 'running', attempts = attempts + 1,
           lease_token_hash = $2, lease_expires_at = $3, updated_at = now()
         WHERE id = $1 AND state IN ('queued','retry_wait')
         RETURNING id, tenant_id, state, payload, not_before, attempts, max_attempts,
           last_run_at, last_result, last_error_code, created_at, updated_at`,
        [row.id, sha256(leaseToken), leaseExpiresAt],
      );
      if (!claimed.rows[0]) return null;
      return {
        schedule: {
          ...this.#mapSourceSchedule(claimed.rows[0]),
          tenantId: claimed.rows[0].tenant_id,
        },
        leaseToken,
      };
    });
  }

  async executeSourceSchedule<T extends { imported: number; matched: number }>(
    id: string,
    leaseToken: string,
    work: (
      transaction: Pick<
        NimantoStore,
        "upsertJob" | "listEvidence" | "latestProfileVersion" | "saveMatch" | "saveReceipt"
      >,
    ) => Promise<T>,
    completedAt = new Date().toISOString(),
  ): Promise<{ schedule: SourceScheduleRecord; result: T }> {
    if (!Number.isFinite(new Date(completedAt).getTime())) throw new Error("INVALID_COMPLETED_AT");
    return this.#db.transaction(async (tx) => {
      const current = await tx.query<any>(
        `SELECT id, state, payload FROM scheduled_jobs
         WHERE id = $1 AND type = 'source.refresh' AND state = 'running'
           AND lease_token_hash = $2 AND lease_expires_at > $3
         FOR UPDATE LIMIT 1`,
        [id, sha256(leaseToken), completedAt],
      );
      const row = current.rows[0];
      if (!row) throw new Error("SCHEDULE_LEASE_INVALID");
      transitionScheduledJob(row.state as ScheduledJobState, "succeed");
      const transactionalStore = new NimantoStore(tx as unknown as PGlite);
      const result = await work(transactionalStore);
      const cadenceMinutes = Number(row.payload.cadenceMinutes);
      const notBefore = new Date(
        new Date(completedAt).getTime() + cadenceMinutes * 60_000,
      ).toISOString();
      const updated = await tx.query<any>(
        `UPDATE scheduled_jobs SET state = 'queued', not_before = $3, attempts = 0,
           lease_token_hash = NULL, lease_expires_at = NULL, last_run_at = $4,
           last_result = $5::jsonb, last_error_code = NULL, updated_at = now()
         WHERE id = $1 AND state = 'running' AND lease_token_hash = $2
         RETURNING id, tenant_id, state, payload, not_before, attempts, max_attempts,
           last_run_at, last_result, last_error_code, created_at, updated_at`,
        [id, sha256(leaseToken), notBefore, completedAt, JSON.stringify(result)],
      );
      if (!updated.rows[0]) throw new Error("SCHEDULE_LEASE_INVALID");
      return { schedule: this.#mapSourceSchedule(updated.rows[0]), result };
    });
  }

  async completeSourceSchedule(
    id: string,
    leaseToken: string,
    result: { imported: number; matched: number },
    completedAt = new Date().toISOString(),
  ): Promise<SourceScheduleRecord> {
    return (await this.executeSourceSchedule(id, leaseToken, async () => result, completedAt))
      .schedule;
  }

  async failSourceSchedule(
    id: string,
    leaseToken: string,
    errorCode: string,
    failedAt = new Date().toISOString(),
  ): Promise<SourceScheduleRecord> {
    if (!/^[A-Z0-9_]{1,80}$/u.test(errorCode)) throw new Error("INVALID_SCHEDULE_ERROR_CODE");
    if (!Number.isFinite(new Date(failedAt).getTime())) throw new Error("INVALID_FAILED_AT");
    const current = await this.#db.query<any>(
      `SELECT id, state, attempts, max_attempts FROM scheduled_jobs
       WHERE id = $1 AND type = 'source.refresh' AND lease_token_hash = $2
         AND lease_expires_at > $3 LIMIT 1`,
      [id, sha256(leaseToken), failedAt],
    );
    const row = current.rows[0];
    if (!row) throw new Error("SCHEDULE_LEASE_INVALID");
    const event = scheduledFailureEvent(Number(row.attempts), Number(row.max_attempts));
    const state = transitionScheduledJob(row.state as ScheduledJobState, event);
    const notBefore =
      state === "retry_wait"
        ? new Date(
            new Date(failedAt).getTime() +
              scheduledRetryDelayMinutes(Number(row.attempts)) * 60_000,
          ).toISOString()
        : failedAt;
    const updated = await this.#db.query<any>(
      `UPDATE scheduled_jobs SET state = $3, not_before = $4,
         lease_token_hash = NULL, lease_expires_at = NULL, last_run_at = $5,
         last_error_code = $6, updated_at = now()
       WHERE id = $1 AND state = 'running' AND lease_token_hash = $2
         AND lease_expires_at > $5
       RETURNING id, tenant_id, state, payload, not_before, attempts, max_attempts,
         last_run_at, last_result, last_error_code, created_at, updated_at`,
      [id, sha256(leaseToken), state, notBefore, failedAt, errorCode],
    );
    if (!updated.rows[0]) throw new Error("SCHEDULE_LEASE_INVALID");
    return this.#mapSourceSchedule(updated.rows[0]);
  }

  #mapSourceSchedule(row: any): SourceScheduleRecord {
    return {
      id: row.id,
      provider: row.payload.provider,
      board: row.payload.board,
      cadenceMinutes: Number(row.payload.cadenceMinutes),
      state: row.state,
      notBefore: iso(row.not_before)!,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      lastRunAt: iso(row.last_run_at),
      lastResult: row.last_result
        ? {
            imported: Number(row.last_result.imported),
            matched: Number(row.last_result.matched),
          }
        : null,
      lastErrorCode: row.last_error_code,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async createEvidence(
    tenantId: string,
    input: Omit<EvidenceClaim, "id" | "userAttested"> & { userAttested?: boolean },
  ): Promise<EvidenceClaim> {
    const id = randomUUID();
    const result = await this.#db.query<EvidenceRow>(
      `INSERT INTO evidence_claims(
         id, tenant_id, kind, value, status, confidence, source_name, locator, user_attested
       )
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
       WHERE EXISTS (SELECT 1 FROM tenants WHERE id = $2 AND deletion_state = 'active')
       RETURNING id, kind, value, status, confidence, source_name, locator, user_attested`,
      [
        id,
        tenantId,
        input.kind,
        input.value.normalize("NFC").trim(),
        input.status,
        input.confidence,
        input.sourceName.normalize("NFC").trim(),
        input.locator.normalize("NFC").trim(),
        input.userAttested ?? false,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("TENANT_NOT_FOUND");
    return mapEvidence(row);
  }

  async getEvidence(tenantId: string, id: string): Promise<EvidenceClaim | null> {
    const result = await this.#db.query<EvidenceRow>(
      `SELECT id, kind, value, status, confidence, source_name, locator, user_attested
       FROM evidence_claims WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, id],
    );
    const row = result.rows[0];
    return row ? mapEvidence(row) : null;
  }

  async listEvidence(tenantId: string): Promise<EvidenceClaim[]> {
    const result = await this.#db.query<EvidenceRow>(
      `SELECT id, kind, value, status, confidence, source_name, locator, user_attested
       FROM evidence_claims WHERE tenant_id = $1 ORDER BY created_at DESC, id`,
      [tenantId],
    );
    return result.rows.map(mapEvidence);
  }

  async confirmEvidence(tenantId: string, id: string): Promise<EvidenceClaim | null> {
    const result = await this.#db.query<EvidenceRow>(
      `UPDATE evidence_claims SET status = 'confirmed'
       WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
       RETURNING id, kind, value, status, confidence, source_name, locator, user_attested`,
      [tenantId, id],
    );
    const row = result.rows[0];
    return row ? mapEvidence(row) : this.getEvidence(tenantId, id);
  }

  async rejectEvidence(tenantId: string, id: string): Promise<EvidenceClaim | null> {
    const result = await this.#db.query<EvidenceRow>(
      `UPDATE evidence_claims SET status = 'rejected'
       WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
       RETURNING id, kind, value, status, confidence, source_name, locator, user_attested`,
      [tenantId, id],
    );
    const row = result.rows[0];
    return row ? mapEvidence(row) : this.getEvidence(tenantId, id);
  }

  async createProfileVersion(
    tenantId: string,
    authorizationWording = "",
  ): Promise<ProfileVersionRecord> {
    return (await this.saveProfileVersion(tenantId, authorizationWording)).version;
  }

  /** Serializes profile snapshots per tenant, then compares normalized literal
   * inputs instead of trusting an older stored hash. The UI may avoid an
   * unchanged request, but this transaction is the correctness boundary. */
  async saveProfileVersion(
    tenantId: string,
    authorizationWording = "",
  ): Promise<ProfileVersionSaveResult> {
    return this.#db.transaction(async (tx) => {
      const tenant = await tx.query<{ id: string }>(
        `SELECT id FROM tenants
         WHERE id = $1 AND deletion_state = 'active'
         FOR UPDATE`,
        [tenantId],
      );
      if (!tenant.rows[0]) throw new Error("TENANT_NOT_ACTIVE");

      const claims = await tx.query<{ id: string }>(
        `SELECT id FROM evidence_claims
         WHERE tenant_id = $1 AND status = 'confirmed'
         ORDER BY id`,
        [tenantId],
      );
      const claimIds = claims.rows.map((row) => row.id);
      const normalizedWording = authorizationWording.normalize("NFC").trim();
      const latest = await tx.query<{
        id: string;
        claim_ids: string[];
        authorization_wording: string | null;
        input_hash: string;
        created_at: string | Date;
      }>(
        `SELECT id, claim_ids, authorization_wording, input_hash, created_at
         FROM profile_versions WHERE tenant_id = $1
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [tenantId],
      );
      const current = latest.rows[0];
      const currentClaimIds = current ? [...current.claim_ids].toSorted() : [];
      const unchanged =
        current !== undefined &&
        (current.authorization_wording ?? "").normalize("NFC").trim() === normalizedWording &&
        currentClaimIds.length === claimIds.length &&
        currentClaimIds.every((id, index) => id === claimIds[index]);
      if (current && unchanged) {
        return {
          created: false,
          version: {
            id: current.id,
            claimIds: current.claim_ids,
            authorizationWording: current.authorization_wording ?? "",
            inputHash: current.input_hash,
            createdAt: iso(current.created_at)!,
          },
        };
      }

      const id = randomUUID();
      const inputHash = canonicalHash({ authorizationWording: normalizedWording, claimIds });
      const inserted = await tx.query<{
        id: string;
        claim_ids: string[];
        authorization_wording: string | null;
        input_hash: string;
        created_at: string | Date;
      }>(
        `INSERT INTO profile_versions(id, tenant_id, claim_ids, authorization_wording, input_hash)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         RETURNING id, claim_ids, authorization_wording, input_hash, created_at`,
        [id, tenantId, JSON.stringify(claimIds), normalizedWording, inputHash],
      );
      const row = inserted.rows[0]!;
      return {
        created: true,
        version: {
          id: row.id,
          claimIds: row.claim_ids,
          authorizationWording: row.authorization_wording ?? "",
          inputHash: row.input_hash,
          createdAt: iso(row.created_at)!,
        },
      };
    });
  }

  async latestProfileVersion(tenantId: string): Promise<ProfileVersionRecord | null> {
    const result = await this.#db.query<{
      id: string;
      claim_ids: string[];
      authorization_wording: string | null;
      input_hash: string;
      created_at: string | Date;
    }>(
      `SELECT id, claim_ids, authorization_wording, input_hash, created_at
       FROM profile_versions WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
      [tenantId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          claimIds: row.claim_ids,
          authorizationWording: row.authorization_wording ?? "",
          inputHash: row.input_hash,
          createdAt: iso(row.created_at)!,
        }
      : null;
  }

  async listProfileVersions(
    tenantId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<HistoryPage<ProfileVersionRecord>> {
    const limit = historyLimit(options.limit);
    let anchor: { created_at: string | Date; id: string } | undefined;
    if (options.cursor) {
      const result = await this.#db.query<{ created_at: string | Date; id: string }>(
        `SELECT created_at, id FROM profile_versions
         WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, options.cursor],
      );
      anchor = result.rows[0];
      if (!anchor) throw new Error("INVALID_CURSOR");
    }
    const result = await this.#db.query<any>(
      `SELECT id, claim_ids, authorization_wording, input_hash, created_at
       FROM profile_versions
       WHERE tenant_id = $1
         AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::text))
       ORDER BY created_at DESC, id DESC LIMIT $4`,
      [tenantId, anchor ? iso(anchor.created_at) : null, anchor?.id ?? null, limit + 1],
    );
    const items = result.rows.slice(0, limit).map((row) => ({
      id: row.id,
      claimIds: row.claim_ids,
      authorizationWording: row.authorization_wording ?? "",
      inputHash: row.input_hash,
      createdAt: iso(row.created_at)!,
    }));
    return {
      items,
      nextCursor: result.rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async upsertJob(
    tenantId: string,
    input: Omit<JobRecord, "id" | "updatedAt" | "status"> & { id?: string; status?: string },
  ): Promise<JobRecord> {
    const id = input.id ?? randomUUID();
    const sourceJobId = input.sourceJobId || id;
    const result = await this.#db.query<{
      id: string;
      source: string;
      source_job_id: string;
      title: string;
      company: string;
      description: string;
      location: string | null;
      work_mode: string | null;
      url: string | null;
      requirements: string[];
      status: string;
      capability: string;
      source_meta: Record<string, unknown>;
      content_hash: string;
      updated_at: string | Date;
    }>(
      `INSERT INTO jobs(
         id, tenant_id, source, source_job_id, title, company, description, location,
         work_mode, url, requirements, status, capability, source_meta, content_hash
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb,$15)
       ON CONFLICT (tenant_id, source, source_job_id) DO UPDATE SET
         title = EXCLUDED.title, company = EXCLUDED.company,
         description = EXCLUDED.description, location = EXCLUDED.location,
         work_mode = EXCLUDED.work_mode, url = EXCLUDED.url,
         requirements = EXCLUDED.requirements, status = EXCLUDED.status,
         capability = EXCLUDED.capability, source_meta = EXCLUDED.source_meta,
         content_hash = EXCLUDED.content_hash, updated_at = now()
       RETURNING id, source, source_job_id, title, company, description, location,
         work_mode, url, requirements, status, capability, source_meta, content_hash, updated_at`,
      [
        id,
        tenantId,
        input.source,
        sourceJobId,
        input.title.normalize("NFC").trim(),
        input.company.normalize("NFC").trim(),
        input.description.normalize("NFC").trim(),
        input.location,
        input.workMode,
        input.url,
        JSON.stringify(input.requirements),
        input.status ?? "active",
        input.capability,
        JSON.stringify(input.sourceMeta),
        input.contentHash,
      ],
    );
    return this.#mapJob(result.rows[0]!);
  }

  #mapJob(row: {
    id: string;
    source: string;
    source_job_id: string;
    title: string;
    company: string;
    description: string;
    location: string | null;
    work_mode: string | null;
    url: string | null;
    requirements: string[];
    status: string;
    capability: string;
    source_meta: Record<string, unknown>;
    content_hash: string;
    updated_at: string | Date;
  }): JobRecord {
    return {
      id: row.id,
      source: row.source,
      sourceJobId: row.source_job_id,
      title: row.title,
      company: row.company,
      description: row.description,
      location: row.location ?? "",
      workMode: row.work_mode ?? "unspecified",
      url: row.url ?? "",
      requirements: row.requirements,
      status: row.status,
      capability: row.capability,
      sourceMeta: row.source_meta,
      contentHash: row.content_hash,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async getJob(tenantId: string, id: string): Promise<JobRecord | null> {
    const result = await this.#db.query<any>(
      `SELECT id, source, source_job_id, title, company, description, location,
        work_mode, url, requirements, status, capability, source_meta, content_hash, updated_at
       FROM jobs WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, id],
    );
    return result.rows[0] ? this.#mapJob(result.rows[0]) : null;
  }

  async listJobs(tenantId: string): Promise<JobRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, source, source_job_id, title, company, description, location,
        work_mode, url, requirements, status, capability, source_meta, content_hash, updated_at
       FROM jobs WHERE tenant_id = $1 ORDER BY updated_at DESC, id`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapJob(row));
  }

  async listJobsByIds(tenantId: string, ids: readonly string[]): Promise<JobRecord[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    const result = await this.#db.query<any>(
      `SELECT id, source, source_job_id, title, company, description, location,
        work_mode, url, requirements, status, capability, source_meta, content_hash, updated_at
       FROM jobs WHERE tenant_id = $1 AND id = ANY($2::text[])
       ORDER BY updated_at DESC, id`,
      [tenantId, uniqueIds],
    );
    return result.rows.map((row) => this.#mapJob(row));
  }

  async saveMatch(
    tenantId: string,
    jobId: string,
    profileVersionId: string | null,
    result: MatchResult,
  ): Promise<MatchRunRecord> {
    const id = randomUUID();
    const inputHash = canonicalHash({ jobId, profileVersionId });
    const artifactHash = canonicalHash(result);
    const saved = await this.#db.query<any>(
      `INSERT INTO match_runs(
         id, tenant_id, job_id, profile_version_id, rule_version, result, input_hash, artifact_hash
       ) SELECT $1,$2,$3,$4,$5,$6::jsonb,$7,$8
       WHERE EXISTS (SELECT 1 FROM jobs WHERE id = $3 AND tenant_id = $2)
       RETURNING id, job_id, profile_version_id, rule_version, result, input_hash, artifact_hash, created_at`,
      [
        id,
        tenantId,
        jobId,
        profileVersionId,
        result.ruleVersion,
        JSON.stringify(result),
        inputHash,
        artifactHash,
      ],
    );
    const row = saved.rows[0];
    if (!row) throw new Error("JOB_NOT_FOUND");
    return {
      id: row.id,
      jobId: row.job_id,
      profileVersionId: row.profile_version_id,
      ruleVersion: row.rule_version,
      result: row.result,
      inputHash: row.input_hash,
      artifactHash: row.artifact_hash,
      createdAt: iso(row.created_at)!,
    };
  }

  async listLatestMatches(tenantId: string): Promise<Array<MatchRunRecord & { job: JobRecord }>> {
    const matches = await this.#db.query<any>(
      `SELECT DISTINCT ON (m.job_id)
         m.id, m.job_id, m.profile_version_id, m.rule_version, m.result,
         m.input_hash, m.artifact_hash, m.created_at
       FROM match_runs m WHERE m.tenant_id = $1
       ORDER BY m.job_id, m.created_at DESC, m.id DESC`,
      [tenantId],
    );
    const jobs = new Map((await this.listJobs(tenantId)).map((job) => [job.id, job]));
    return matches.rows.flatMap((row) => {
      const job = jobs.get(row.job_id);
      if (!job) return [];
      return [
        {
          id: row.id,
          jobId: row.job_id,
          profileVersionId: row.profile_version_id,
          ruleVersion: row.rule_version,
          result: row.result,
          inputHash: row.input_hash,
          artifactHash: row.artifact_hash,
          createdAt: iso(row.created_at)!,
          job,
        },
      ];
    });
  }

  async listMatchRuns(
    tenantId: string,
    options: { cursor?: string; limit?: number; jobId?: string } = {},
  ): Promise<HistoryPage<MatchRunRecord>> {
    const limit = historyLimit(options.limit);
    if (options.jobId && !(await this.getJob(tenantId, options.jobId))) {
      throw new Error("JOB_NOT_FOUND");
    }
    let anchor: { created_at: string | Date; id: string } | undefined;
    if (options.cursor) {
      const result = await this.#db.query<{ created_at: string | Date; id: string }>(
        `SELECT created_at, id FROM match_runs
         WHERE tenant_id = $1 AND id = $2
           AND ($3::text IS NULL OR job_id = $3::text) LIMIT 1`,
        [tenantId, options.cursor, options.jobId ?? null],
      );
      anchor = result.rows[0];
      if (!anchor) throw new Error("INVALID_CURSOR");
    }
    const result = await this.#db.query<any>(
      `SELECT id, job_id, profile_version_id, rule_version, result, input_hash,
              artifact_hash, created_at
       FROM match_runs
       WHERE tenant_id = $1
         AND ($2::text IS NULL OR job_id = $2::text)
         AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::text))
       ORDER BY created_at DESC, id DESC LIMIT $5`,
      [
        tenantId,
        options.jobId ?? null,
        anchor ? iso(anchor.created_at) : null,
        anchor?.id ?? null,
        limit + 1,
      ],
    );
    const items = result.rows.slice(0, limit).map((row) => ({
      id: row.id,
      jobId: row.job_id,
      profileVersionId: row.profile_version_id,
      ruleVersion: row.rule_version,
      result: row.result,
      inputHash: row.input_hash,
      artifactHash: row.artifact_hash,
      createdAt: iso(row.created_at)!,
    }));
    return {
      items,
      nextCursor: result.rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async createH1bSignal(
    tenantId: string,
    input: Omit<H1bSignalRecord, "id">,
  ): Promise<H1bSignalRecord> {
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO h1b_signals(
        id, tenant_id, company, label, source_type, source_locator, source_period,
        observed_at, confidence, limitations
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, company, label, source_type, source_locator, source_period,
         observed_at, confidence, limitations`,
      [
        id,
        tenantId,
        input.company,
        input.label,
        input.sourceType,
        input.sourceLocator,
        input.sourcePeriod,
        input.observedAt,
        input.confidence,
        input.limitations,
      ],
    );
    return this.#mapSignal(result.rows[0]!);
  }

  #mapSignal(row: any): H1bSignalRecord {
    return {
      id: row.id,
      company: row.company,
      label: row.label,
      sourceType: row.source_type,
      sourceLocator: row.source_locator,
      sourcePeriod: row.source_period,
      observedAt: iso(row.observed_at)!,
      confidence: row.confidence,
      limitations: row.limitations,
    };
  }

  async listH1bSignals(tenantId: string): Promise<H1bSignalRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, company, label, source_type, source_locator, source_period,
         observed_at, confidence, limitations
       FROM h1b_signals WHERE tenant_id = $1 ORDER BY observed_at DESC, id`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapSignal(row));
  }

  async createApplication(
    tenantId: string,
    jobId: string,
    profileVersionId: string | null,
  ): Promise<ApplicationRecord> {
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO applications(id, tenant_id, job_id, profile_version_id, status)
       SELECT $1,$2,$3,$4,'tracked'
       WHERE EXISTS (SELECT 1 FROM jobs WHERE id = $3 AND tenant_id = $2)
       RETURNING id, job_id, profile_version_id, status, submitted_at, created_at, updated_at`,
      [id, tenantId, jobId, profileVersionId],
    );
    if (!result.rows[0]) throw new Error("JOB_NOT_FOUND");
    return this.#mapApplication(result.rows[0]);
  }

  #mapApplication(row: any): ApplicationRecord {
    return {
      id: row.id,
      jobId: row.job_id,
      profileVersionId: row.profile_version_id,
      status: row.status,
      submittedAt: iso(row.submitted_at),
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async setApplicationStatus(
    tenantId: string,
    id: string,
    status: ApplicationStatus,
  ): Promise<ApplicationRecord | null> {
    const current = await this.#db.query<any>(
      `SELECT status FROM applications WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    if (!current.rows[0]) return null;
    /* This method serves two different callers and only one of them is the
     * candidate. Packet creation and packet approval write "prepared" and
     * "approved_for_export" as system consequences, and they must keep working
     * for an application in any prior state. So the *policy* question — may the
     * candidate move this card here — is enforced in the API route, and what
     * stays here is the *data* invariant that applies no matter who writes:
     * leaving submitted_externally clears the submission timestamp, which the
     * previous COALESCE-only version never did. */
    const from = current.rows[0].status as ApplicationStatus;
    const clearSubmittedAt = from === "submitted_externally" && status !== "submitted_externally";
    const result = await this.#db.query<any>(
      `UPDATE applications SET status = $3,
         submitted_at = CASE
           WHEN $4 THEN NULL
           WHEN $3 = 'submitted_externally' THEN COALESCE(submitted_at, now())
           ELSE submitted_at END,
         updated_at = now()
       WHERE tenant_id = $1 AND id = $2
       RETURNING id, job_id, profile_version_id, status, submitted_at, created_at, updated_at`,
      [tenantId, id, status, clearSubmittedAt],
    );
    return result.rows[0] ? this.#mapApplication(result.rows[0]) : null;
  }

  async addOutcome(
    tenantId: string,
    applicationId: string,
    input: { type: OutcomeType; note: string; occurredAt: string },
  ): Promise<OutcomeRecord> {
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO outcomes(id, tenant_id, application_id, type, note, occurred_at)
       SELECT $1,$2,$3,$4,$5,$6
       WHERE EXISTS (SELECT 1 FROM applications WHERE id = $3 AND tenant_id = $2)
       RETURNING id, application_id, type, note, occurred_at`,
      [
        id,
        tenantId,
        applicationId,
        input.type,
        input.note.normalize("NFC").trim(),
        input.occurredAt,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("APPLICATION_NOT_FOUND");
    return {
      id: row.id,
      applicationId: row.application_id,
      type: row.type,
      note: row.note,
      occurredAt: iso(row.occurred_at)!,
    };
  }

  async listApplications(tenantId: string): Promise<ApplicationRecord[]> {
    const [applications, outcomes, jobs] = await Promise.all([
      this.#db.query<any>(
        `SELECT id, job_id, profile_version_id, status, submitted_at, created_at, updated_at
         FROM applications WHERE tenant_id = $1 ORDER BY updated_at DESC, id`,
        [tenantId],
      ),
      this.#db.query<any>(
        `SELECT id, application_id, type, note, occurred_at
         FROM outcomes WHERE tenant_id = $1 ORDER BY occurred_at DESC, id`,
        [tenantId],
      ),
      this.listJobs(tenantId),
    ]);
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    return applications.rows.map((row) => {
      const record = this.#mapApplication(row);
      const job = jobsById.get(record.jobId);
      return {
        ...record,
        ...(job ? { job: { title: job.title, company: job.company } } : {}),
        outcomes: outcomes.rows
          .filter((outcome) => outcome.application_id === record.id)
          .map((outcome) => ({
            id: outcome.id,
            applicationId: outcome.application_id,
            type: outcome.type,
            note: outcome.note,
            occurredAt: iso(outcome.occurred_at)!,
          })),
      };
    });
  }

  async createPacket(
    tenantId: string,
    input: {
      applicationId: string;
      profileVersionId: string | null;
      canonicalContent: Record<string, unknown>;
      artifactManifest: Record<string, unknown>;
    },
  ): Promise<PacketRecord> {
    const id = randomUUID();
    const artifactHash = canonicalHash(input.canonicalContent);
    const result = await this.#db.query<any>(
      `INSERT INTO packets(
        id, tenant_id, application_id, profile_version_id, status,
        canonical_content, artifact_manifest, artifact_hash
       ) SELECT $1,$2,$3,$4,'draft',$5::jsonb,$6::jsonb,$7
       WHERE EXISTS (SELECT 1 FROM applications WHERE id = $3 AND tenant_id = $2)
       RETURNING *`,
      [
        id,
        tenantId,
        input.applicationId,
        input.profileVersionId,
        JSON.stringify(input.canonicalContent),
        JSON.stringify(input.artifactManifest),
        artifactHash,
      ],
    );
    if (!result.rows[0]) throw new Error("APPLICATION_NOT_FOUND");
    return this.#mapPacket(result.rows[0]);
  }

  #mapPacket(row: any): PacketRecord {
    return {
      id: row.id,
      applicationId: row.application_id,
      profileVersionId: row.profile_version_id,
      status: row.status,
      canonicalContent: row.canonical_content,
      artifactManifest: row.artifact_manifest,
      artifactHash: row.artifact_hash,
      approvedAt: iso(row.approved_at),
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async getPacket(tenantId: string, id: string): Promise<PacketRecord | null> {
    const result = await this.#db.query<any>(
      "SELECT * FROM packets WHERE tenant_id = $1 AND id = $2 LIMIT 1",
      [tenantId, id],
    );
    return result.rows[0] ? this.#mapPacket(result.rows[0]) : null;
  }

  async listPackets(tenantId: string): Promise<PacketRecord[]> {
    const result = await this.#db.query<any>(
      "SELECT * FROM packets WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC",
      [tenantId],
    );
    return result.rows.map((row) => this.#mapPacket(row));
  }

  async listLatestPackets(tenantId: string): Promise<PacketRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT * FROM (
         SELECT DISTINCT ON (application_id) * FROM packets
         WHERE tenant_id = $1
         ORDER BY application_id, created_at DESC, id DESC
       ) AS latest ORDER BY created_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapPacket(row));
  }

  async listPacketsByIds(tenantId: string, ids: readonly string[]): Promise<PacketRecord[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    const result = await this.#db.query<any>(
      `SELECT * FROM packets
       WHERE tenant_id = $1 AND id = ANY($2::text[])
       ORDER BY created_at DESC, id DESC`,
      [tenantId, uniqueIds],
    );
    return result.rows.map((row) => this.#mapPacket(row));
  }

  async listApplicationPackets(
    tenantId: string,
    applicationId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<HistoryPage<PacketRecord>> {
    const application = await this.#db.query<{ id: string }>(
      "SELECT id FROM applications WHERE tenant_id = $1 AND id = $2 LIMIT 1",
      [tenantId, applicationId],
    );
    if (!application.rows[0]) throw new Error("APPLICATION_NOT_FOUND");
    const limit = historyLimit(options.limit);
    let anchor: { created_at: string | Date; id: string } | undefined;
    if (options.cursor) {
      const result = await this.#db.query<{ created_at: string | Date; id: string }>(
        `SELECT created_at, id FROM packets
         WHERE tenant_id = $1 AND application_id = $2 AND id = $3 LIMIT 1`,
        [tenantId, applicationId, options.cursor],
      );
      anchor = result.rows[0];
      if (!anchor) throw new Error("INVALID_CURSOR");
    }
    const result = await this.#db.query<any>(
      `SELECT * FROM packets
       WHERE tenant_id = $1 AND application_id = $2
         AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::text))
       ORDER BY created_at DESC, id DESC LIMIT $5`,
      [
        tenantId,
        applicationId,
        anchor ? iso(anchor.created_at) : null,
        anchor?.id ?? null,
        limit + 1,
      ],
    );
    const items = result.rows.slice(0, limit).map((row) => this.#mapPacket(row));
    return {
      items,
      nextCursor: result.rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async saveAssurance(
    tenantId: string,
    packetId: string,
    input: { status: "passed" | "blocked"; ruleVersion: string; findings: unknown[] },
  ): Promise<AssuranceRecord> {
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO assurance_runs(id, tenant_id, packet_id, status, rule_version, findings)
       SELECT $1,$2,$3,$4,$5,$6::jsonb
       WHERE EXISTS (SELECT 1 FROM packets WHERE id = $3 AND tenant_id = $2)
       RETURNING id, packet_id, status, rule_version, findings, created_at`,
      [id, tenantId, packetId, input.status, input.ruleVersion, JSON.stringify(input.findings)],
    );
    const row = result.rows[0];
    if (!row) throw new Error("PACKET_NOT_FOUND");
    await this.#db.query(
      `UPDATE packets SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
      [tenantId, packetId, input.status === "passed" ? "assurance_passed" : "assurance_blocked"],
    );
    return {
      id: row.id,
      packetId: row.packet_id,
      status: row.status,
      ruleVersion: row.rule_version,
      findings: row.findings,
      createdAt: iso(row.created_at)!,
    };
  }

  async latestAssurance(tenantId: string, packetId: string): Promise<AssuranceRecord | null> {
    const result = await this.#db.query<any>(
      `SELECT id, packet_id, status, rule_version, findings, created_at
       FROM assurance_runs WHERE tenant_id = $1 AND packet_id = $2
       ORDER BY run_sequence DESC LIMIT 1`,
      [tenantId, packetId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          packetId: row.packet_id,
          status: row.status,
          ruleVersion: row.rule_version,
          findings: row.findings,
          createdAt: iso(row.created_at)!,
        }
      : null;
  }

  async listLatestAssurances(tenantId: string): Promise<AssuranceRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, packet_id, status, rule_version, findings, created_at
       FROM (
         SELECT DISTINCT ON (packet_id)
           id, packet_id, status, rule_version, findings, created_at
         FROM assurance_runs
         WHERE tenant_id = $1
         ORDER BY packet_id, run_sequence DESC
       ) AS latest
       ORDER BY created_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      packetId: row.packet_id,
      status: row.status,
      ruleVersion: row.rule_version,
      findings: row.findings,
      createdAt: iso(row.created_at)!,
    }));
  }

  async listLatestAssurancesForPackets(
    tenantId: string,
    packetIds: readonly string[],
  ): Promise<AssuranceRecord[]> {
    if (packetIds.length === 0) return [];
    const result = await this.#db.query<any>(
      `SELECT id, packet_id, status, rule_version, findings, created_at
       FROM (
         SELECT DISTINCT ON (packet_id)
           id, packet_id, status, rule_version, findings, created_at
         FROM assurance_runs
         WHERE tenant_id = $1 AND packet_id = ANY($2::text[])
         ORDER BY packet_id, run_sequence DESC
       ) AS latest
       ORDER BY created_at DESC, id DESC`,
      [tenantId, [...packetIds]],
    );
    return result.rows.map((row) => ({
      id: row.id,
      packetId: row.packet_id,
      status: row.status,
      ruleVersion: row.rule_version,
      findings: row.findings,
      createdAt: iso(row.created_at)!,
    }));
  }

  async listAssuranceRuns(
    tenantId: string,
    packetId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<HistoryPage<AssuranceHistoryRecord>> {
    const packet = await this.getPacket(tenantId, packetId);
    if (!packet) throw new Error("PACKET_NOT_FOUND");
    const limit = historyLimit(options.limit);
    let anchorSequence: number | null = null;
    if (options.cursor) {
      const result = await this.#db.query<{ run_sequence: number }>(
        `SELECT run_sequence FROM assurance_runs
         WHERE tenant_id = $1 AND packet_id = $2 AND id = $3 LIMIT 1`,
        [tenantId, packetId, options.cursor],
      );
      if (!result.rows[0]) throw new Error("INVALID_CURSOR");
      anchorSequence = Number(result.rows[0].run_sequence);
    }
    const result = await this.#db.query<any>(
      `SELECT id, packet_id, status, rule_version, findings, created_at, packet_ordinal
       FROM (
         SELECT id, packet_id, status, rule_version, findings, created_at, run_sequence,
                ROW_NUMBER() OVER (PARTITION BY packet_id ORDER BY run_sequence ASC)::int AS packet_ordinal
         FROM assurance_runs WHERE tenant_id = $1 AND packet_id = $2
       ) AS history
       WHERE ($3::bigint IS NULL OR run_sequence < $3::bigint)
       ORDER BY run_sequence DESC LIMIT $4`,
      [tenantId, packetId, anchorSequence, limit + 1],
    );
    const items = result.rows.slice(0, limit).map((row) => ({
      id: row.id,
      packetId: row.packet_id,
      status: row.status,
      ruleVersion: row.rule_version,
      findings: row.findings,
      createdAt: iso(row.created_at)!,
      packetOrdinal: Number(row.packet_ordinal),
    }));
    return {
      items,
      nextCursor: result.rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async listAssuranceHistory(tenantId: string): Promise<AssuranceHistoryRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, packet_id, status, rule_version, findings, created_at, packet_ordinal
       FROM (
         SELECT id, packet_id, status, rule_version, findings, created_at,
                ROW_NUMBER() OVER (PARTITION BY packet_id ORDER BY run_sequence ASC)::int AS packet_ordinal
         FROM assurance_runs WHERE tenant_id = $1
       ) AS history ORDER BY created_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      packetId: row.packet_id,
      status: row.status,
      ruleVersion: row.rule_version,
      findings: row.findings,
      createdAt: iso(row.created_at)!,
      packetOrdinal: Number(row.packet_ordinal),
    }));
  }

  async approvePacket(tenantId: string, packetId: string): Promise<PacketRecord | null> {
    const assurance = await this.latestAssurance(tenantId, packetId);
    if (assurance?.status !== "passed") throw new Error("ASSURANCE_REQUIRED");
    const result = await this.#db.query<any>(
      `UPDATE packets SET status = 'approved', approved_at = now(), updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status = 'assurance_passed'
       RETURNING *`,
      [tenantId, packetId],
    );
    return result.rows[0] ? this.#mapPacket(result.rows[0]) : this.getPacket(tenantId, packetId);
  }

  async updatePacketManifest(
    tenantId: string,
    packetId: string,
    artifactManifest: Record<string, unknown>,
  ): Promise<PacketRecord | null> {
    const result = await this.#db.query<any>(
      `UPDATE packets SET artifact_manifest = $3::jsonb, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      [tenantId, packetId, JSON.stringify(artifactManifest)],
    );
    return result.rows[0] ? this.#mapPacket(result.rows[0]) : null;
  }

  async createExternalAction(
    tenantId: string,
    input: {
      packetId: string | null;
      provider: ExternalActionProvider;
      target: Record<string, unknown>;
      payload: Record<string, unknown>;
      idempotencyKey: string;
    },
  ): Promise<ExternalActionRecord> {
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO external_actions(
         id, tenant_id, packet_id, provider, state, target, payload, idempotency_key
       ) VALUES ($1,$2,$3,$4,'pending_approval',$5::jsonb,$6::jsonb,$7)
       ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET updated_at = external_actions.updated_at
       RETURNING *`,
      [
        id,
        tenantId,
        input.packetId,
        input.provider,
        JSON.stringify(input.target),
        JSON.stringify(input.payload),
        input.idempotencyKey,
      ],
    );
    return this.#mapAction(result.rows[0]!);
  }

  #mapAction(row: any): ExternalActionRecord {
    return {
      id: row.id,
      packetId: row.packet_id,
      provider: row.provider,
      state: row.state,
      target: row.target,
      payload: row.payload,
      idempotencyKey: row.idempotency_key,
      approvedAt: iso(row.approved_at),
      attemptedAt: iso(row.attempted_at),
      result: row.result,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async getExternalAction(tenantId: string, id: string): Promise<ExternalActionRecord | null> {
    const result = await this.#db.query<any>(
      "SELECT * FROM external_actions WHERE tenant_id = $1 AND id = $2 LIMIT 1",
      [tenantId, id],
    );
    return result.rows[0] ? this.#mapAction(result.rows[0]) : null;
  }

  async listExternalActions(tenantId: string): Promise<ExternalActionRecord[]> {
    const result = await this.#db.query<any>(
      "SELECT * FROM external_actions WHERE tenant_id = $1 ORDER BY updated_at DESC, id",
      [tenantId],
    );
    return result.rows.map((row) => this.#mapAction(row));
  }

  async transitionExternalAction(
    tenantId: string,
    id: string,
    from: ExternalActionState,
    to: ExternalActionState,
    resultValue?: Record<string, unknown>,
  ): Promise<ExternalActionRecord | null> {
    const result = await this.#db.query<any>(
      `UPDATE external_actions SET state = $4,
        approved_at = CASE WHEN $4 = 'approved' THEN now() ELSE approved_at END,
        attempted_at = CASE WHEN $4 = 'executing' THEN now() ELSE attempted_at END,
        result = COALESCE($5::jsonb, result), updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND state = $3 RETURNING *`,
      [tenantId, id, from, to, resultValue ? JSON.stringify(resultValue) : null],
    );
    return result.rows[0] ? this.#mapAction(result.rows[0]) : null;
  }

  async saveReceipt(
    tenantId: string,
    receipt: ExecutionReceipt,
    material: unknown,
  ): Promise<ExecutionReceipt> {
    if (!verifyReceipt(receipt)) throw new Error("RECEIPT_INTEGRITY_INVALID");
    await this.#db.query(
      `INSERT INTO receipts(
        id, tenant_id, type, occurred_at, input_hash, artifact_hash, receipt_hash, material
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        receipt.id,
        tenantId,
        receipt.type,
        receipt.occurredAt,
        receipt.inputHash,
        receipt.artifactHash,
        receipt.receiptHash,
        JSON.stringify(material),
      ],
    );
    return receipt;
  }

  async listReceipts(tenantId: string): Promise<Array<ExecutionReceipt & { material: unknown }>> {
    const result = await this.#db.query<any>(
      `SELECT id, type, occurred_at, input_hash, artifact_hash, receipt_hash, material
       FROM receipts WHERE tenant_id = $1 ORDER BY occurred_at DESC, id`,
      [tenantId],
    );
    return result.rows.map((row) => {
      const receipt: ExecutionReceipt = {
        schemaVersion: "receipt_v1" as const,
        id: row.id,
        type: row.type,
        occurredAt: iso(row.occurred_at)!,
        inputHash: row.input_hash,
        artifactHash: row.artifact_hash,
        receiptHash: row.receipt_hash,
      };
      if (!verifyReceipt(receipt)) throw new Error("RECEIPT_INTEGRITY_INVALID");
      return { ...receipt, material: row.material };
    });
  }

  async exportTenant(tenantId: string): Promise<Record<string, unknown>> {
    const [
      evidence,
      profile,
      jobs,
      matches,
      signals,
      applications,
      packets,
      actions,
      receipts,
      schedules,
      profileVersionsPage,
      matchRunsPage,
      assuranceRuns,
    ] = await Promise.all([
      this.listEvidence(tenantId),
      this.latestProfileVersion(tenantId),
      this.listJobs(tenantId),
      this.listLatestMatches(tenantId),
      this.listH1bSignals(tenantId),
      this.listApplications(tenantId),
      this.listPackets(tenantId),
      this.listExternalActions(tenantId),
      this.listReceipts(tenantId),
      this.listSourceSchedules(tenantId),
      this.listProfileVersions(tenantId, { limit: 50 }),
      this.listMatchRuns(tenantId, { limit: 50 }),
      this.listAssuranceHistory(tenantId),
    ]);
    const profileVersions = [...profileVersionsPage.items];
    let profileCursor = profileVersionsPage.nextCursor;
    while (profileCursor) {
      const page = await this.listProfileVersions(tenantId, { cursor: profileCursor, limit: 50 });
      profileVersions.push(...page.items);
      profileCursor = page.nextCursor;
    }
    const matchRuns = [...matchRunsPage.items];
    let matchCursor = matchRunsPage.nextCursor;
    while (matchCursor) {
      const page = await this.listMatchRuns(tenantId, { cursor: matchCursor, limit: 50 });
      matchRuns.push(...page.items);
      matchCursor = page.nextCursor;
    }
    return {
      schemaVersion: "nimanto_export_v2",
      exportedAt: new Date().toISOString(),
      evidence,
      profile,
      jobs,
      matches,
      h1bSignals: signals,
      applications,
      packets,
      externalActions: actions,
      receipts,
      schedules,
      profileVersions,
      matchRuns,
      assuranceRuns,
    };
  }

  async beginTenantDeletion(
    tenantId: string,
    actionIds: string[],
  ): Promise<{ id: string; token: string; tenantId: string; state: string; actionIds: string[] }> {
    const id = randomUUID();
    const token = randomBytes(24).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await this.#db.transaction(async (tx) => {
      const tenant = await tx.query<{ id: string }>(
        `UPDATE tenants SET deletion_state = 'deleting'
         WHERE id = $1 AND deletion_state = 'active'
         RETURNING id`,
        [tenantId],
      );
      if (!tenant.rows[0]) throw new Error("TENANT_NOT_ACTIVE");
      await tx.query(
        `INSERT INTO deletion_runs(
          id, tenant_id, status_token_hash, state, requested_at, expires_at, cleanup_inventory
         ) VALUES ($1,$2,$3,'running',$4,$5,$6::jsonb)`,
        [
          id,
          tenantId,
          sha256(token),
          now.toISOString(),
          expiresAt.toISOString(),
          JSON.stringify({ actionIds }),
        ],
      );
    });
    return { id, token, tenantId, state: "running", actionIds };
  }

  async purgeTenantForDeletion(runId: string, tenantId: string): Promise<void> {
    await this.#db.transaction(async (tx) => {
      const members = await tx.query<{ user_id: string }>(
        "SELECT user_id FROM memberships WHERE tenant_id = $1",
        [tenantId],
      );
      await tx.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      for (const member of members.rows) {
        await tx.query(
          `DELETE FROM users WHERE id = $1
           AND NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = $1)`,
          [member.user_id],
        );
      }
      await tx.query(
        `UPDATE deletion_runs SET state = 'database_deleted', last_error_code = NULL
         WHERE id = $1 AND tenant_id = $2 AND state IN ('running','cleanup_pending')`,
        [runId, tenantId],
      );
    });
  }

  async markDeletionCleanupPending(runId: string, errorCode: string): Promise<void> {
    await this.#db.query(
      `UPDATE deletion_runs SET state = 'cleanup_pending', last_error_code = $2
       WHERE id = $1 AND state <> 'completed'`,
      [runId, errorCode],
    );
  }

  async completeDeletion(runId: string): Promise<string> {
    const completedAt = new Date().toISOString();
    const result = await this.#db.query<{ completed_at: string | Date }>(
      `UPDATE deletion_runs SET state = 'completed', completed_at = $2, last_error_code = NULL
       WHERE id = $1 AND state IN ('database_deleted','cleanup_pending')
       RETURNING completed_at`,
      [runId, completedAt],
    );
    if (!result.rows[0]) throw new Error("DELETION_NOT_FOUND");
    return iso(result.rows[0].completed_at)!;
  }

  async deletionRunByToken(token: string): Promise<{
    id: string;
    tenantId: string;
    state: string;
    actionIds: string[];
  } | null> {
    const result = await this.#db.query<{
      id: string;
      tenant_id: string;
      state: string;
      cleanup_inventory: { actionIds?: unknown };
    }>(
      `SELECT id, tenant_id, state, cleanup_inventory FROM deletion_runs
       WHERE status_token_hash = $1 AND expires_at > now() LIMIT 1`,
      [sha256(token)],
    );
    const row = result.rows[0];
    const values = row?.cleanup_inventory.actionIds;
    return row
      ? {
          id: row.id,
          tenantId: row.tenant_id,
          state: row.state,
          actionIds: Array.isArray(values)
            ? values.filter((value): value is string => typeof value === "string")
            : [],
        }
      : null;
  }

  async deletionStatus(
    token: string,
  ): Promise<{ state: string; completedAt: string | null } | null> {
    const result = await this.#db.query<{ state: string; completed_at: string | Date | null }>(
      `SELECT state, completed_at FROM deletion_runs
       WHERE status_token_hash = $1 AND expires_at > now() LIMIT 1`,
      [sha256(token)],
    );
    const row = result.rows[0];
    return row ? { state: row.state, completedAt: iso(row.completed_at) } : null;
  }
}
