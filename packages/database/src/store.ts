import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  applicationFollowUpPolicy,
  ACTIVITY_KINDS,
  ACTIVITY_STATES,
  ANSWER_TOPICS,
  canonicalHash,
  classifyRoleFamily,
  CONTACT_KINDS,
  applicationTransitions,
  INTERVIEW_ROUND_KINDS,
  INTERVIEW_ROUND_STATES,
  normalizeWorkplaceMode,
  normalizeEmployerName,
  OFFER_STATES,
  normalizeCandidateSubmission,
  scheduledFailureEvent,
  scheduledRetryDelayMinutes,
  validateStructuredArea,
  verifyReceipt,
  type ApplicationStatus,
  type ActivityKind,
  type ActivityState,
  type AnswerTopic,
  type ApplicationStatusEvent,
  type ContactKind,
  type DiscoveryProfileInput,
  type EvidenceClaim,
  type ExecutionReceipt,
  type ExternalActionProvider,
  type ExternalActionState,
  type H1bSignalLabel,
  type InterviewRoundKind,
  type InterviewRoundState,
  type MatchBlocker,
  type MatchResult,
  type OutcomeType,
  type OfferState,
  type CandidateSubmissionInput,
  type PacketArtifactFormat,
  type SubmissionChannel,
  type PublicationState,
  type RoleFamily,
  type ScheduledJobState,
  type VerificationAuthority,
  type VerificationHealth,
  type VerificationMethod,
  type VerificationResult,
  type WorkplaceEvidence,
  type WorkplaceMode,
  transitionScheduledJob,
} from "@nimanto/domain";
import { migrateDatabase } from "./migrations.js";

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

export const INVITATION_TOMBSTONE_RETENTION_DAYS = 30;
export const DELETION_STATUS_WINDOW_DAYS = 7;

export interface SessionIdentity extends LocalIdentity {
  sessionId: string;
}

export interface InvitationRecord {
  id: string;
  intendedEmail: string;
  token: string;
  expiresAt: string;
}

export interface InvitationRetentionRecord {
  accepted: boolean;
  retainsTokenHash: boolean;
  retainsIntendedEmail: boolean;
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
  workMode: WorkplaceMode;
  roleFamily: RoleFamily;
  workplaceEvidence: WorkplaceEvidence[];
  url: string;
  requirements: string[];
  status: string;
  capability: string;
  sourceMeta: Record<string, unknown>;
  contentHash: string;
  identityReview: {
    required: boolean;
    reason: string | null;
  };
  updatedAt: string;
  availability: RoleAvailabilityRecord;
  cluster: {
    id: string;
    size: number;
    sources: string[];
  };
  candidateDisposition: {
    state: "active" | "archived";
    archivedAt: string | null;
  };
}

export interface RoleAvailabilityRecord {
  firstSeenAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string | null;
  nextVerifyAt: string | null;
  sourcePostedAt: string | null;
  sourceUpdatedAt: string | null;
  validThrough: string | null;
  missingSince: string | null;
  publicationState: PublicationState;
  verificationHealth: VerificationHealth;
  verificationAuthority: VerificationAuthority;
  verificationMethod: VerificationMethod;
  consecutiveCompleteMisses: number;
  closedAt: string | null;
  closureReason: string | null;
}

export interface SourceRunRecord {
  id: string;
  source: string;
  boardId: string | null;
  startedAt: string;
  completedAt: string;
  complete: boolean;
  pagesRead: number;
  sourceItemCount: number;
  responseFingerprint: string;
  retryAfterObserved: boolean;
  sourcePolicyVersion: string;
}

export interface SourceRunInput extends Omit<SourceRunRecord, "id"> {
  queryReferenceHmac?: string | null;
}

export interface RoleObservationRecord {
  id: string;
  jobId: string;
  sourceRunId: string | null;
  source: string;
  sourceJobId: string;
  observedAt: string;
  contentHash: string;
  sourcePayloadHash: string;
  normalizedPayload: Record<string, unknown>;
  normalizerVersion: string;
}

export interface VerificationAttemptRecord {
  id: string;
  jobId: string;
  sourceRunId: string | null;
  attemptedAt: string;
  authority: VerificationAuthority;
  method: VerificationMethod;
  result: VerificationResult;
  evidence: Record<string, unknown>;
}

export interface RoleVerificationInput {
  attemptedAt: string;
  method: Extract<VerificationMethod, "detail_get" | "complete_list">;
  result: Extract<
    VerificationResult,
    "present" | "not_found" | "absent_from_complete_list" | "blocked"
  >;
  evidence: Record<string, unknown>;
}

export interface RoleVerificationOutcome {
  job: JobRecord;
  attempt: VerificationAttemptRecord;
}

export interface DiscoveryProfileRecord {
  id: string;
  input: DiscoveryProfileInput;
  inputHash: string;
  approvedAt: string;
  createdAt: string;
}

export interface DiscoveryProfileSaveResult {
  profile: DiscoveryProfileRecord;
  created: boolean;
}

export interface JobUpsertInput {
  id?: string;
  source: string;
  sourceJobId: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode?: WorkplaceMode | string;
  roleFamily?: RoleFamily;
  workplaceEvidence?: WorkplaceEvidence[];
  url: string;
  requirements: string[];
  status?: string;
  capability: string;
  sourceMeta: Record<string, unknown>;
  contentHash: string;
  observedAt?: string;
  sourcePostedAt?: string | null;
  sourceUpdatedAt?: string | null;
  validThrough?: string | null;
  rawPayload?: Record<string, unknown> | null;
}

export interface SourceObservationResult {
  sourceRun: SourceRunRecord;
  jobs: JobRecord[];
  possiblyClosed: number;
  closed: number;
}

export interface MatchRunRecord {
  id: string;
  jobId: string;
  profileVersionId: string | null;
  ruleVersion: string;
  result: MatchResult;
  inputHash: string;
  artifactHash: string;
  jobContentHash: string;
  createdAt: string;
}

export interface RoleWordingReviewRecord {
  id: string;
  jobId: string;
  matchRunId: string;
  blockerCode: Extract<MatchBlocker["code"], "no_sponsorship_of_any_kind" | "citizenship_required">;
  evidenceHash: string;
  sourceText: string;
  sourceLocator: string | null;
  observedAt: string | null;
  reviewedAt: string;
}

export interface H1bSignalRecord {
  id: string;
  company: string;
  sourceCompany: string;
  label: H1bSignalLabel;
  sourceType: string;
  sourceLocator: string;
  sourcePeriod: string;
  observedAt: string;
  confidence: "high" | "medium" | "low";
  limitations: string;
}

export interface DatasetEditionRecord {
  id: string;
  sourceType: string;
  sourceEdition: string;
  checksum: string;
  transformationVersion: string;
  provenance: Record<string, unknown> | null;
  provenanceChecksum: string | null;
  languageReview: Record<string, unknown> | null;
  languageReviewChecksum: string | null;
  evaluation: Record<string, unknown>;
  evaluationProvenance: Record<string, unknown> | null;
  createdAt: string;
}

export interface EmployerEntityRecord {
  id: string;
  canonicalCompany: string;
  normalizedName: string;
  createdAt: string;
}

export interface EmployerAliasRecord {
  id: string;
  employerEntityId: string;
  canonicalCompany: string;
  normalizedName: string;
  alias: string;
  normalizedAlias: string;
  sourceLocator: string;
  observedAt: string;
  evidenceHash: string;
  reviewedAt: string;
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  profileVersionId: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  followUpOn: string | null;
  createdAt: string;
  updatedAt: string;
  job?: Pick<JobRecord, "title" | "company">;
  outcomes?: OutcomeRecord[];
  notes?: ApplicationNoteRecord[];
  statusEvents?: ApplicationStatusEvent[];
  submissions?: ApplicationSubmissionRecord[];
}

export interface ApplicationSubmissionRecord {
  id: string;
  applicationId: string;
  packetId: string | null;
  materialsCaptured: boolean;
  artifactFormats: PacketArtifactFormat[];
  channel: SubmissionChannel;
  destination: string;
  submittedAt: string;
  packetArtifactHash: string | null;
  packetManifestHash: string | null;
  createdAt: string;
}

export interface OutcomeRecord {
  id: string;
  applicationId: string;
  type: OutcomeType;
  note: string;
  occurredAt: string;
}

export interface ApplicationNoteRecord {
  id: string;
  applicationId: string;
  text: string;
  recordedAt: string;
}

export interface ApplicationActivityRecord {
  id: string;
  applicationId: string;
  contactId: string | null;
  kind: ActivityKind;
  state: ActivityState;
  title: string;
  note: string;
  dueAt: string | null;
  occurredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRecord {
  id: string;
  name: string;
  organization: string;
  title: string;
  email: string;
  phone: string;
  kind: ContactKind;
  notes: string;
  applicationLinks: Array<{ applicationId: string; role: ContactKind }>;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewRoundRecord {
  id: string;
  applicationId: string;
  kind: InterviewRoundKind;
  state: InterviewRoundState;
  scheduledAt: string;
  format: string;
  location: string;
  participants: string[];
  prepNotes: string;
  outcomeNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerRevisionRecord {
  id: string;
  revision: number;
  /** Legacy revisions predate revision-owned question metadata. */
  topic: AnswerTopic | null;
  /** Legacy revisions use null rather than borrowing a newer prompt. */
  prompt: string | null;
  answerText: string;
  evidenceIds: string[];
  createdAt: string;
}

export interface AnswerBlockRecord {
  id: string;
  topic: AnswerTopic;
  prompt: string;
  currentRevision: number;
  latest: AnswerRevisionRecord;
  revisions?: AnswerRevisionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedApplicationViewRecord {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfferRecord {
  id: string;
  applicationId: string;
  state: OfferState;
  currency: string;
  baseMinor: number;
  bonusMinor: number | null;
  equity: string;
  benefits: string;
  startOn: string | null;
  expiresOn: string | null;
  workMode: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CareerOperationsSnapshot {
  activities: ApplicationActivityRecord[];
  contacts: ContactRecord[];
  interviews: InterviewRoundRecord[];
  answerBlocks: AnswerBlockRecord[];
  savedViews: SavedApplicationViewRecord[];
  offers: OfferRecord[];
}

export interface PacketRecord {
  id: string;
  applicationId: string;
  profileVersionId: string | null;
  status: "draft" | "assurance_passed" | "assurance_blocked" | "approved";
  canonicalContent: Record<string, unknown>;
  artifactManifest: Record<string, unknown>;
  artifactHash: string;
  manifestHash: string;
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
  packetArtifactHash: string;
  manifestHash: string;
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
  intentHash: string;
  approvedIntentHash: string | null;
  approvedPacketHash: string | null;
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

function isoRequired(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeList(values: readonly string[], maximum = 40): string[] {
  if (values.length > maximum) throw new Error("DISCOVERY_PROFILE_TOO_MANY_VALUES");
  return [...new Set(values.map((value) => value.normalize("NFC").trim()).filter(Boolean))];
}

function normalizeDiscoveryProfile(input: DiscoveryProfileInput): DiscoveryProfileInput {
  const roleFamilies = [...new Set(input.roleFamilies)];
  const validFamilies: readonly RoleFamily[] = [
    "ai_ml",
    "software_technical",
    "data_analytics",
    "product",
    "business_strategy_operations_solutions",
    "other",
  ];
  if (roleFamilies.some((family) => !validFamilies.includes(family))) {
    throw new Error("DISCOVERY_ROLE_FAMILY_INVALID");
  }
  const workModes = [...new Set(input.workModes.map((mode) => normalizeWorkplaceMode(mode)))];
  if (!Number.isInteger(input.freshnessMaximumHours) || input.freshnessMaximumHours < 1) {
    throw new Error("DISCOVERY_FRESHNESS_INVALID");
  }
  if (input.freshnessMaximumHours > 24 * 90) throw new Error("DISCOVERY_FRESHNESS_INVALID");
  if (
    input.commuteRadiusMiles !== null &&
    (!Number.isFinite(input.commuteRadiusMiles) ||
      input.commuteRadiusMiles < 0 ||
      input.commuteRadiusMiles > 500)
  ) {
    throw new Error("DISCOVERY_COMMUTE_RADIUS_INVALID");
  }
  const compensation = input.minimumCompensation;
  if (
    compensation &&
    (!Number.isFinite(compensation.amount) ||
      compensation.amount < 0 ||
      !/^[A-Z]{3}$/u.test(compensation.currency))
  ) {
    throw new Error("DISCOVERY_COMPENSATION_INVALID");
  }
  let authorizationStatementExpiresAt = input.authorizationStatementExpiresAt;
  if (authorizationStatementExpiresAt !== null) {
    const parsed = new Date(authorizationStatementExpiresAt);
    if (Number.isNaN(parsed.getTime())) throw new Error("DISCOVERY_AUTHORIZATION_EXPIRY_INVALID");
    authorizationStatementExpiresAt = parsed.toISOString();
  }
  return {
    ...input,
    roleFamilies,
    includeTitles: normalizeList(input.includeTitles),
    excludeTitles: normalizeList(input.excludeTitles),
    seniorityLevels: normalizeList(input.seniorityLevels, 20),
    industries: normalizeList(input.industries),
    mustHaveSkills: normalizeList(input.mustHaveSkills),
    preferredSkills: normalizeList(input.preferredSkills),
    acceptedPhysicalAreas: input.acceptedPhysicalAreas.map(validateStructuredArea),
    workModes,
    eligibleRemoteAreas: input.eligibleRemoteAreas.map(validateStructuredArea),
    sourceIds: normalizeList(input.sourceIds, 50),
    authorizationStatementExpiresAt,
  };
}

function clusterKey(row: Pick<JobRecord, "url" | "company" | "title" | "location">): string {
  return canonicalHash({
    company: row.company.normalize("NFKC").trim().toLocaleLowerCase("en-US"),
    title: row.title.normalize("NFKC").trim().toLocaleLowerCase("en-US"),
    location: row.location.normalize("NFKC").trim().toLocaleLowerCase("en-US"),
  });
}

function annotateClusters(jobs: JobRecord[]): JobRecord[] {
  const clusters = new Map<string, JobRecord[]>();
  for (const job of jobs) {
    const id = clusterKey(job);
    clusters.set(id, [...(clusters.get(id) ?? []), job]);
  }
  return jobs.map((job) => {
    const baseId = clusterKey(job);
    const members = clusters.get(baseId)!;
    const sources = [...new Set(members.map((member) => member.source))].sort();
    const crossSource = sources.length > 1 && sources.length === members.length;
    const id = crossSource
      ? baseId
      : canonicalHash({ baseId, source: job.source, sourceJobId: job.sourceJobId });
    return {
      ...job,
      cluster: {
        id,
        size: crossSource ? members.length : 1,
        sources: crossSource ? sources : [job.source],
      },
    };
  });
}

function historyLimit(value?: number): number {
  if (value === undefined) return 20;
  if (!Number.isInteger(value) || value < 1) throw new Error("INVALID_LIMIT");
  return Math.min(value, 50);
}

function recordText(value: string, field: string, maximum: number, required = false): string {
  const normalized = value.normalize("NFC").trim();
  if ((required && !normalized) || normalized.length > maximum) {
    throw new Error(`INVALID_${field.toLocaleUpperCase("en-US")}`);
  }
  return normalized;
}

function recordInstant(value: string | null, field: string): string | null {
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`INVALID_${field}`);
  return parsed.toISOString();
}

function recordDateOnly(value: string | null | undefined, field: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error(`INVALID_${field}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`INVALID_${field}`);
  }
  return value;
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
  readonly #transactional: boolean;

  private constructor(db: PGlite, transactional = false) {
    this.#db = db;
    this.#transactional = transactional;
  }

  static async open(dataDirectory: string): Promise<NimantoStore> {
    if (!dataDirectory.startsWith("memory://")) {
      await tightenPosixPermissions(dataDirectory);
    }
    const db = await PGlite.create(dataDirectory);
    try {
      await migrateDatabase(db);
      if (!dataDirectory.startsWith("memory://")) await tightenPosixPermissions(dataDirectory);
      return new NimantoStore(db);
    } catch (error) {
      await db.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.#db.close();
  }

  async transaction<T>(work: (store: NimantoStore) => Promise<T>): Promise<T> {
    if (this.#transactional) return work(this);
    return this.#db.transaction((tx) => work(new NimantoStore(tx as unknown as PGlite, true)));
  }

  async readSnapshot<T>(work: (store: NimantoStore) => Promise<T>): Promise<T> {
    if (this.#transactional) return work(this);
    return this.#db.transaction(async (tx) => {
      // This must be the first statement in the transaction. Unlike a lock
      // convention, REPEATABLE READ covers every present and future writer,
      // including deletes and append-only history tables.
      await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      return work(new NimantoStore(tx as unknown as PGlite, true));
    });
  }

  async assertTenantActive(tenantId: string): Promise<void> {
    const active = await this.#db.query<{ id: string }>(
      `SELECT id FROM tenants
       WHERE id = $1 AND deletion_state = 'active'
       FOR KEY SHARE`,
      [tenantId],
    );
    if (!active.rows[0]) throw new Error("TENANT_NOT_ACTIVE");
  }

  async lockTenantActive(tenantId: string): Promise<void> {
    const active = await this.#db.query<{ id: string }>(
      `SELECT id FROM tenants
       WHERE id = $1 AND deletion_state = 'active'
       FOR UPDATE`,
      [tenantId],
    );
    if (!active.rows[0]) throw new Error("TENANT_NOT_ACTIVE");
  }

  async assertTenantReadable(tenantId: string): Promise<void> {
    const active = await this.#db.query<{ id: string }>(
      `SELECT id FROM tenants
       WHERE id = $1 AND deletion_state = 'active'
       LIMIT 1`,
      [tenantId],
    );
    if (!active.rows[0]) throw new Error("TENANT_NOT_ACTIVE");
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
        intended_email: string | null;
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
        `UPDATE invitations
         SET accepted_at = now(), token_hash = NULL, intended_email = NULL
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

  async invitationRetention(id: string): Promise<InvitationRetentionRecord | null> {
    const result = await this.#db.query<{
      accepted_at: string | Date | null;
      token_hash: string | null;
      intended_email: string | null;
    }>(
      `SELECT accepted_at, token_hash, intended_email
       FROM invitations WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row
      ? {
          accepted: row.accepted_at !== null,
          retainsTokenHash: row.token_hash !== null,
          retainsIntendedEmail: row.intended_email !== null,
        }
      : null;
  }

  /** Delete terminal invitation tombstones after the documented 30-day
   * operator-audit window. Live unexpired and unrevoked invitations never
   * qualify. Accepted credentials and email are scrubbed immediately elsewhere. */
  async pruneTerminalInvitations(now = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - INVITATION_TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = await this.#db.query<{ id: string }>(
      `DELETE FROM invitations
       WHERE (accepted_at IS NOT NULL AND accepted_at <= $1)
          OR (revoked_at IS NOT NULL AND revoked_at <= $1)
          OR (accepted_at IS NULL AND revoked_at IS NULL AND expires_at <= $1)
       RETURNING id`,
      [cutoff],
    );
    return result.rows.length;
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
    work: (transaction: NimantoStore) => Promise<T>,
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
      const transactionalStore = new NimantoStore(tx as unknown as PGlite, true);
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

  async createEvidenceBatch(
    tenantId: string,
    inputs: Array<Omit<EvidenceClaim, "id" | "userAttested"> & { userAttested?: boolean }>,
  ): Promise<EvidenceClaim[]> {
    return this.transaction(async (database) => {
      await database.assertTenantActive(tenantId);
      const claims: EvidenceClaim[] = [];
      for (const input of inputs) claims.push(await database.createEvidence(tenantId, input));
      return claims;
    });
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

  async listEvidenceByIds(tenantId: string, ids: readonly string[]): Promise<EvidenceClaim[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    const result = await this.#db.query<EvidenceRow>(
      `SELECT id, kind, value, status, confidence, source_name, locator, user_attested
       FROM evidence_claims
       WHERE tenant_id = $1 AND id = ANY($2::text[])
       ORDER BY id`,
      [tenantId, uniqueIds],
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

  async getProfileVersion(tenantId: string, id: string): Promise<ProfileVersionRecord | null> {
    const result = await this.#db.query<{
      id: string;
      claim_ids: string[];
      authorization_wording: string | null;
      input_hash: string;
      created_at: string | Date;
    }>(
      `SELECT id, claim_ids, authorization_wording, input_hash, created_at
       FROM profile_versions WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, id],
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

  async upsertJob(tenantId: string, input: JobUpsertInput): Promise<JobRecord> {
    const id = input.id ?? randomUUID();
    const sourceJobId = input.sourceJobId || id;
    const title = input.title.normalize("NFC").trim();
    const observedAt = input.observedAt ?? new Date().toISOString();
    const roleFamily = input.roleFamily ?? classifyRoleFamily(title);
    const workMode = normalizeWorkplaceMode(input.workMode);
    const sourceMeta = {
      ...input.sourceMeta,
      workplaceEvidence: input.workplaceEvidence ?? [],
      observedAt,
    };
    const verificationAuthority: VerificationAuthority =
      input.source === "manual"
        ? "candidate_review"
        : input.source === "allowlisted_url"
          ? "authorized_employer_page"
          : "unknown";
    const verificationMethod: VerificationMethod =
      input.source === "allowlisted_url" ? "structured_employer_page" : "manual";
    const verificationHealth: VerificationHealth =
      input.source === "allowlisted_url" ? "verified" : "unknown";
    const lastVerifiedAt = input.source === "allowlisted_url" ? observedAt : null;
    const result = await this.#db.query<{
      id: string;
      source: string;
      source_job_id: string;
      title: string;
      company: string;
      description: string;
      location: string | null;
      work_mode: string | null;
      role_family: string | null;
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
         work_mode, role_family, url, requirements, status, capability, source_meta, content_hash
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15::jsonb,$16)
       ON CONFLICT (tenant_id, source, source_job_id) DO UPDATE SET
         title = EXCLUDED.title, company = EXCLUDED.company,
         description = EXCLUDED.description, location = EXCLUDED.location,
         work_mode = EXCLUDED.work_mode, role_family = EXCLUDED.role_family, url = EXCLUDED.url,
         requirements = EXCLUDED.requirements, status = EXCLUDED.status,
         capability = EXCLUDED.capability, source_meta = EXCLUDED.source_meta,
         content_hash = EXCLUDED.content_hash,
         updated_at = CASE WHEN
           jobs.title IS DISTINCT FROM EXCLUDED.title OR
           jobs.company IS DISTINCT FROM EXCLUDED.company OR
           jobs.description IS DISTINCT FROM EXCLUDED.description OR
           jobs.location IS DISTINCT FROM EXCLUDED.location OR
           jobs.work_mode IS DISTINCT FROM EXCLUDED.work_mode OR
           jobs.role_family IS DISTINCT FROM EXCLUDED.role_family OR
           jobs.url IS DISTINCT FROM EXCLUDED.url OR
           jobs.requirements IS DISTINCT FROM EXCLUDED.requirements OR
           jobs.status IS DISTINCT FROM EXCLUDED.status OR
           jobs.capability IS DISTINCT FROM EXCLUDED.capability OR
           jobs.content_hash IS DISTINCT FROM EXCLUDED.content_hash
         THEN now() ELSE jobs.updated_at END
       RETURNING id, source, source_job_id, title, company, description, location,
         work_mode, role_family, url, requirements, status, capability, source_meta, content_hash, updated_at`,
      [
        id,
        tenantId,
        input.source,
        sourceJobId,
        title,
        input.company.normalize("NFC").trim(),
        input.description.normalize("NFC").trim(),
        input.location,
        workMode,
        roleFamily,
        input.url,
        JSON.stringify(input.requirements),
        input.status ?? "active",
        input.capability,
        JSON.stringify(sourceMeta),
        input.contentHash,
      ],
    );
    await this.#db.query(
      `INSERT INTO role_availability(
         tenant_id, job_id, first_seen_at, last_seen_at, source_posted_at,
         source_updated_at, valid_through, last_verified_at, next_verify_at,
         publication_state, verification_health, verification_authority, verification_method
       ) VALUES (
         $1,$2,$3,$3,$4,$5,$6,$7,
         CASE WHEN $7::timestamptz IS NULL THEN NULL ELSE $7::timestamptz + interval '24 hours' END,
         'active',$8,$9,$10
       )
       ON CONFLICT (tenant_id, job_id) DO UPDATE SET
         last_seen_at = GREATEST(role_availability.last_seen_at, EXCLUDED.last_seen_at),
         source_posted_at = COALESCE(EXCLUDED.source_posted_at, role_availability.source_posted_at),
         source_updated_at = COALESCE(EXCLUDED.source_updated_at, role_availability.source_updated_at),
         valid_through = COALESCE(EXCLUDED.valid_through, role_availability.valid_through),
         last_verified_at = COALESCE(EXCLUDED.last_verified_at, role_availability.last_verified_at),
         next_verify_at = COALESCE(EXCLUDED.next_verify_at, role_availability.next_verify_at),
         verification_health = EXCLUDED.verification_health,
         verification_authority = EXCLUDED.verification_authority,
         verification_method = EXCLUDED.verification_method,
         updated_at = now()`,
      [
        tenantId,
        result.rows[0]!.id,
        observedAt,
        input.sourcePostedAt ?? null,
        input.sourceUpdatedAt ?? null,
        input.validThrough ?? null,
        lastVerifiedAt,
        verificationHealth,
        verificationAuthority,
        verificationMethod,
      ],
    );
    const saved = await this.getJob(tenantId, result.rows[0]!.id);
    if (!saved) throw new Error("JOB_NOT_FOUND");
    return saved;
  }

  async createManualJob(
    tenantId: string,
    operationId: string,
    input: JobUpsertInput,
  ): Promise<JobRecord> {
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const existing = await database.#db.query<{ role_id: string }>(
        `SELECT role_id FROM manual_role_operations
         WHERE tenant_id = $1 AND operation_id = $2 LIMIT 1`,
        [tenantId, operationId],
      );
      if (existing.rows[0]) {
        const role = await database.getJob(tenantId, existing.rows[0].role_id);
        if (!role) throw new Error("ROLE_OPERATION_INVALID");
        return role;
      }
      if (input.source !== "manual") throw new Error("MANUAL_ROLE_REQUIRED");
      const role = await database.upsertJob(tenantId, input);
      await database.#db.query(
        `INSERT INTO manual_role_operations(tenant_id, operation_id, role_id)
         VALUES ($1, $2, $3)`,
        [tenantId, operationId, role.id],
      );
      return role;
    });
  }

  async replaceManualJob(
    tenantId: string,
    roleId: string,
    input: JobUpsertInput,
  ): Promise<JobRecord> {
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const current = await database.getJob(tenantId, roleId);
      if (!current) throw new Error("ROLE_NOT_FOUND");
      if (current.source !== "manual") throw new Error("MANUAL_ROLE_REQUIRED");
      const reviewed = await database.upsertJob(tenantId, {
        ...input,
        id: current.id,
        source: "manual",
        sourceJobId: current.sourceJobId,
      });
      if (!reviewed.identityReview.required) return reviewed;
      await database.#db.query(
        `UPDATE jobs SET identity_review_required = false, identity_review_reason = NULL
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, current.id],
      );
      const cleared = await database.getJob(tenantId, current.id);
      if (!cleared) throw new Error("ROLE_NOT_FOUND");
      return cleared;
    });
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
    role_family: string | null;
    url: string | null;
    requirements: string[];
    status: string;
    capability: string;
    source_meta: Record<string, unknown>;
    content_hash: string;
    identity_review_required?: boolean;
    identity_review_reason?: string | null;
    updated_at: string | Date;
    archived_at?: string | Date | null;
    availability_first_seen_at?: string | Date | null;
    availability_last_seen_at?: string | Date | null;
    availability_last_verified_at?: string | Date | null;
    availability_next_verify_at?: string | Date | null;
    availability_source_posted_at?: string | Date | null;
    availability_source_updated_at?: string | Date | null;
    availability_valid_through?: string | Date | null;
    availability_missing_since?: string | Date | null;
    availability_publication_state?: PublicationState | null;
    availability_verification_health?: VerificationHealth | null;
    availability_verification_authority?: VerificationAuthority | null;
    availability_verification_method?: VerificationMethod | null;
    availability_consecutive_complete_misses?: number | null;
    availability_closed_at?: string | Date | null;
    availability_closure_reason?: string | null;
  }): JobRecord {
    const firstSeenAt = iso(row.availability_first_seen_at ?? row.updated_at)!;
    const lastSeenAt = iso(row.availability_last_seen_at ?? row.updated_at)!;
    const sourceMeta = row.source_meta ?? {};
    const evidence = Array.isArray(sourceMeta.workplaceEvidence)
      ? (sourceMeta.workplaceEvidence as WorkplaceEvidence[])
      : [];
    const nextVerifyAt = iso(row.availability_next_verify_at ?? null);
    const publicationState = row.availability_publication_state ?? "active";
    const storedVerificationHealth = row.availability_verification_health ?? "unknown";
    const verificationHealth =
      nextVerifyAt &&
      Date.parse(nextVerifyAt) < Date.now() &&
      publicationState === "active" &&
      (storedVerificationHealth === "verified" || storedVerificationHealth === "provider_reported")
        ? "overdue"
        : storedVerificationHealth;
    return {
      id: row.id,
      source: row.source,
      sourceJobId: row.source_job_id,
      title: row.title,
      company: row.company,
      description: row.description,
      location: row.location ?? "",
      workMode: normalizeWorkplaceMode(row.work_mode),
      roleFamily: (row.role_family as RoleFamily | null) ?? classifyRoleFamily(row.title),
      workplaceEvidence: evidence,
      url: row.url ?? "",
      requirements: row.requirements,
      status: row.status,
      capability: row.capability,
      sourceMeta,
      contentHash: row.content_hash,
      identityReview: {
        required: row.identity_review_required ?? false,
        reason: row.identity_review_reason ?? null,
      },
      updatedAt: iso(row.updated_at)!,
      availability: {
        firstSeenAt,
        lastSeenAt,
        lastVerifiedAt: iso(row.availability_last_verified_at ?? null),
        nextVerifyAt,
        sourcePostedAt: iso(row.availability_source_posted_at ?? null),
        sourceUpdatedAt: iso(row.availability_source_updated_at ?? null),
        validThrough: iso(row.availability_valid_through ?? null),
        missingSince: iso(row.availability_missing_since ?? null),
        publicationState,
        verificationHealth,
        verificationAuthority: row.availability_verification_authority ?? "unknown",
        verificationMethod: row.availability_verification_method ?? "manual",
        consecutiveCompleteMisses: row.availability_consecutive_complete_misses ?? 0,
        closedAt: iso(row.availability_closed_at ?? null),
        closureReason: row.availability_closure_reason ?? null,
      },
      cluster: { id: "", size: 1, sources: [row.source] },
      candidateDisposition: {
        state: row.archived_at ? "archived" : "active",
        archivedAt: iso(row.archived_at ?? null),
      },
    };
  }

  async getJob(tenantId: string, id: string): Promise<JobRecord | null> {
    const result = await this.#db.query<any>(
      `SELECT job.id, job.source, job.source_job_id, job.title, job.company, job.description,
        job.location, job.work_mode, job.role_family, job.url, job.requirements, job.status,
        job.capability, job.source_meta, job.content_hash, job.identity_review_required,
        job.identity_review_reason, job.updated_at, disposition.archived_at,
        availability.first_seen_at AS availability_first_seen_at,
        availability.last_seen_at AS availability_last_seen_at,
        availability.last_verified_at AS availability_last_verified_at,
        availability.next_verify_at AS availability_next_verify_at,
        availability.source_posted_at AS availability_source_posted_at,
        availability.source_updated_at AS availability_source_updated_at,
        availability.valid_through AS availability_valid_through,
        availability.missing_since AS availability_missing_since,
        availability.publication_state AS availability_publication_state,
        availability.verification_health AS availability_verification_health,
        availability.verification_authority AS availability_verification_authority,
        availability.verification_method AS availability_verification_method,
        availability.consecutive_complete_misses AS availability_consecutive_complete_misses,
        availability.closed_at AS availability_closed_at,
        availability.closure_reason AS availability_closure_reason
       FROM jobs AS job
       LEFT JOIN role_dispositions AS disposition
         ON disposition.tenant_id = job.tenant_id AND disposition.job_id = job.id
       LEFT JOIN role_availability AS availability
         ON availability.tenant_id = job.tenant_id AND availability.job_id = job.id
       WHERE job.tenant_id = $1 AND job.id = $2 LIMIT 1`,
      [tenantId, id],
    );
    const mapped = result.rows[0] ? this.#mapJob(result.rows[0]) : null;
    return mapped ? annotateClusters([mapped])[0]! : null;
  }

  async listJobs(tenantId: string): Promise<JobRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT job.id, job.source, job.source_job_id, job.title, job.company, job.description,
        job.location, job.work_mode, job.role_family, job.url, job.requirements, job.status,
        job.capability, job.source_meta, job.content_hash, job.identity_review_required,
        job.identity_review_reason, job.updated_at, disposition.archived_at,
        availability.first_seen_at AS availability_first_seen_at,
        availability.last_seen_at AS availability_last_seen_at,
        availability.last_verified_at AS availability_last_verified_at,
        availability.next_verify_at AS availability_next_verify_at,
        availability.source_posted_at AS availability_source_posted_at,
        availability.source_updated_at AS availability_source_updated_at,
        availability.valid_through AS availability_valid_through,
        availability.missing_since AS availability_missing_since,
        availability.publication_state AS availability_publication_state,
        availability.verification_health AS availability_verification_health,
        availability.verification_authority AS availability_verification_authority,
        availability.verification_method AS availability_verification_method,
        availability.consecutive_complete_misses AS availability_consecutive_complete_misses,
        availability.closed_at AS availability_closed_at,
        availability.closure_reason AS availability_closure_reason
       FROM jobs AS job
       LEFT JOIN role_dispositions AS disposition
         ON disposition.tenant_id = job.tenant_id AND disposition.job_id = job.id
       LEFT JOIN role_availability AS availability
         ON availability.tenant_id = job.tenant_id AND availability.job_id = job.id
       WHERE job.tenant_id = $1 ORDER BY job.updated_at DESC, job.id`,
      [tenantId],
    );
    return annotateClusters(result.rows.map((row) => this.#mapJob(row)));
  }

  async listJobsByIds(tenantId: string, ids: readonly string[]): Promise<JobRecord[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    const result = await this.#db.query<any>(
      `SELECT job.id, job.source, job.source_job_id, job.title, job.company, job.description,
        job.location, job.work_mode, job.role_family, job.url, job.requirements, job.status,
        job.capability, job.source_meta, job.content_hash, job.identity_review_required,
        job.identity_review_reason, job.updated_at, disposition.archived_at,
        availability.first_seen_at AS availability_first_seen_at,
        availability.last_seen_at AS availability_last_seen_at,
        availability.last_verified_at AS availability_last_verified_at,
        availability.next_verify_at AS availability_next_verify_at,
        availability.source_posted_at AS availability_source_posted_at,
        availability.source_updated_at AS availability_source_updated_at,
        availability.valid_through AS availability_valid_through,
        availability.missing_since AS availability_missing_since,
        availability.publication_state AS availability_publication_state,
        availability.verification_health AS availability_verification_health,
        availability.verification_authority AS availability_verification_authority,
        availability.verification_method AS availability_verification_method,
        availability.consecutive_complete_misses AS availability_consecutive_complete_misses,
        availability.closed_at AS availability_closed_at,
        availability.closure_reason AS availability_closure_reason
       FROM jobs AS job
       LEFT JOIN role_dispositions AS disposition
         ON disposition.tenant_id = job.tenant_id AND disposition.job_id = job.id
       LEFT JOIN role_availability AS availability
         ON availability.tenant_id = job.tenant_id AND availability.job_id = job.id
       WHERE job.tenant_id = $1 AND job.id = ANY($2::text[])
       ORDER BY job.updated_at DESC, job.id`,
      [tenantId, uniqueIds],
    );
    return annotateClusters(result.rows.map((row) => this.#mapJob(row)));
  }

  async recordSourceObservation(
    tenantId: string,
    run: SourceRunInput,
    inputs: readonly JobUpsertInput[],
  ): Promise<SourceObservationResult> {
    if (inputs.some((input) => input.source !== run.source)) {
      throw new Error("SOURCE_RUN_JOB_SOURCE_MISMATCH");
    }
    if (new Date(run.completedAt).getTime() < new Date(run.startedAt).getTime()) {
      throw new Error("SOURCE_RUN_TIME_INVALID");
    }
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const sourceRunId = randomUUID();
      await database.#db.query(
        `INSERT INTO source_runs(
           id, tenant_id, source, board_id, query_reference_hmac, started_at, completed_at,
           complete, pages_read, source_item_count, response_fingerprint,
           retry_after_observed, source_policy_version
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          sourceRunId,
          tenantId,
          run.source,
          run.boardId,
          run.queryReferenceHmac ?? null,
          run.startedAt,
          run.completedAt,
          run.complete,
          run.pagesRead,
          run.sourceItemCount,
          run.responseFingerprint,
          run.retryAfterObserved,
          run.sourcePolicyVersion,
        ],
      );

      const observedIds: string[] = [];
      const method: VerificationMethod =
        run.source === "licensed_feed" ? "provider_feed" : "complete_list";
      const authority: VerificationAuthority =
        run.source === "licensed_feed" ? "licensed_provider" : "employer_ats";

      for (const input of inputs) {
        const observedAt = input.observedAt ?? run.completedAt;
        const saved = await database.upsertJob(tenantId, { ...input, observedAt });
        observedIds.push(saved.id);
        const normalizedPayload = {
          source: input.source,
          sourceJobId: input.sourceJobId,
          title: input.title,
          company: input.company,
          description: input.description,
          location: input.location,
          workMode: normalizeWorkplaceMode(input.workMode),
          roleFamily: input.roleFamily ?? classifyRoleFamily(input.title),
          workplaceEvidence: input.workplaceEvidence ?? [],
          url: input.url,
          requirements: input.requirements,
          sourceMeta: input.sourceMeta,
          sourcePostedAt: input.sourcePostedAt ?? null,
          sourceUpdatedAt: input.sourceUpdatedAt ?? null,
          validThrough: input.validThrough ?? null,
        };
        await database.#db.query(
          `INSERT INTO role_observations(
             id, tenant_id, job_id, source_run_id, source, source_job_id, observed_at,
             content_hash, source_payload_hash, raw_payload, raw_retained_until,
             normalized_payload, normalizer_version
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,NULL,$10::jsonb,'role_normalizer_v2')
           ON CONFLICT (tenant_id, source, source_job_id, observed_at, content_hash) DO NOTHING`,
          [
            randomUUID(),
            tenantId,
            saved.id,
            sourceRunId,
            input.source,
            input.sourceJobId,
            observedAt,
            saved.contentHash,
            canonicalHash(input.rawPayload ?? normalizedPayload),
            JSON.stringify(normalizedPayload),
          ],
        );
        await database.#db.query(
          `UPDATE role_availability SET
             last_seen_at = $3,
             last_verified_at = $4,
             next_verify_at = $4::timestamptz + interval '24 hours',
             source_posted_at = COALESCE($5, source_posted_at),
             source_updated_at = COALESCE($6, source_updated_at),
             valid_through = COALESCE($7, valid_through),
             missing_since = NULL,
             publication_state = CASE
               WHEN $7::timestamptz IS NOT NULL AND $7::timestamptz < $4::timestamptz THEN 'expired'
               ELSE 'active'
             END,
             verification_health = 'verified',
             verification_authority = $8,
             verification_method = CASE
               WHEN $7::timestamptz IS NOT NULL AND $7::timestamptz < $4::timestamptz
                 THEN 'valid_through'
               ELSE $9
             END,
             consecutive_complete_misses = 0,
             closed_at = NULL,
             closure_reason = NULL,
             updated_at = now()
           WHERE tenant_id = $1 AND job_id = $2`,
          [
            tenantId,
            saved.id,
            observedAt,
            run.completedAt,
            input.sourcePostedAt ?? null,
            input.sourceUpdatedAt ?? null,
            input.validThrough ?? null,
            authority,
            method,
          ],
        );
        await database.#db.query(
          `INSERT INTO verification_attempts(
             id, tenant_id, job_id, source_run_id, attempted_at, authority, method, result, evidence
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,'present',$8::jsonb)`,
          [
            randomUUID(),
            tenantId,
            saved.id,
            sourceRunId,
            run.completedAt,
            authority,
            method,
            JSON.stringify({ responseFingerprint: run.responseFingerprint }),
          ],
        );
      }

      let possiblyClosed = 0;
      let closed = 0;
      if (run.complete) {
        const missing = await database.#db.query<{
          job_id: string;
          missing_since: string | Date | null;
          consecutive_complete_misses: number;
        }>(
          `SELECT availability.job_id, availability.missing_since,
             availability.consecutive_complete_misses
           FROM role_availability AS availability
           JOIN jobs AS job
             ON job.tenant_id = availability.tenant_id AND job.id = availability.job_id
           WHERE job.tenant_id = $1 AND job.source = $2
             AND COALESCE(job.source_meta->>'board', '') = COALESCE($3, '')
             AND NOT (job.id = ANY($4::text[]))
             AND availability.publication_state IN ('active','possibly_closed')
           FOR UPDATE`,
          [tenantId, run.source, run.boardId, observedIds],
        );
        const completedAtMs = new Date(run.completedAt).getTime();
        for (const row of missing.rows) {
          const missingAtMs = row.missing_since ? new Date(row.missing_since).getTime() : null;
          const closeNow =
            row.consecutive_complete_misses >= 1 &&
            missingAtMs !== null &&
            completedAtMs - missingAtMs >= 6 * 60 * 60 * 1000;
          if (closeNow) closed += 1;
          else possiblyClosed += 1;
          await database.#db.query(
            `UPDATE role_availability SET
               missing_since = COALESCE(missing_since, $3),
               publication_state = $4,
               verification_health = 'verified',
               verification_authority = $5,
               verification_method = $6,
               consecutive_complete_misses = CASE WHEN $7 THEN 2 ELSE GREATEST(consecutive_complete_misses, 1) END,
               closed_at = CASE WHEN $7 THEN $3 ELSE NULL END,
               closure_reason = CASE WHEN $7 THEN 'source_removed_after_two_complete_runs' ELSE NULL END,
               last_verified_at = $3,
               next_verify_at = CASE WHEN $7 THEN NULL ELSE $3::timestamptz + interval '6 hours' END,
               updated_at = now()
             WHERE tenant_id = $1 AND job_id = $2`,
            [
              tenantId,
              row.job_id,
              run.completedAt,
              closeNow ? "closed" : "possibly_closed",
              authority,
              method,
              closeNow,
            ],
          );
          await database.#db.query(
            `INSERT INTO verification_attempts(
               id, tenant_id, job_id, source_run_id, attempted_at, authority, method,
               result, evidence
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,'absent_from_complete_list',$8::jsonb)`,
            [
              randomUUID(),
              tenantId,
              row.job_id,
              sourceRunId,
              run.completedAt,
              authority,
              method,
              JSON.stringify({
                responseFingerprint: run.responseFingerprint,
                consecutiveCompleteMiss: closeNow ? 2 : 1,
              }),
            ],
          );
        }
      }

      const jobs = await database.listJobsByIds(tenantId, observedIds);
      return {
        sourceRun: { id: sourceRunId, ...run },
        jobs,
        possiblyClosed,
        closed,
      };
    });
  }

  /** Persist one candidate-requested employer-ATS liveness check. A detail 404
   * is definitive; absence from a complete board remains subject to two checks
   * at least six hours apart. Blocked network attempts never change the last
   * known publication state or successful-verification timestamp. */
  async recordRoleVerification(
    tenantId: string,
    jobId: string,
    input: RoleVerificationInput,
  ): Promise<RoleVerificationOutcome> {
    const attemptedAtMs = new Date(input.attemptedAt).getTime();
    if (!Number.isFinite(attemptedAtMs)) throw new Error("INVALID_VERIFICATION_TIME");
    if (input.result === "not_found" && input.method !== "detail_get") {
      throw new Error("INVALID_VERIFICATION_RESULT");
    }
    if (input.result === "absent_from_complete_list" && input.method !== "complete_list") {
      throw new Error("INVALID_VERIFICATION_RESULT");
    }
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const current = await database.#db.query<{
        missing_since: string | Date | null;
        consecutive_complete_misses: number;
      }>(
        `SELECT availability.missing_since, availability.consecutive_complete_misses
         FROM jobs AS job
         JOIN role_availability AS availability
           ON availability.tenant_id = job.tenant_id AND availability.job_id = job.id
         WHERE job.tenant_id = $1 AND job.id = $2
         FOR UPDATE`,
        [tenantId, jobId],
      );
      const availability = current.rows[0];
      if (!availability) throw new Error("JOB_NOT_FOUND");

      if (input.result === "present") {
        await database.#db.query(
          `UPDATE role_availability SET
             last_seen_at = GREATEST(last_seen_at, $3), last_verified_at = $3,
             next_verify_at = $3::timestamptz + interval '24 hours', missing_since = NULL,
             publication_state = 'active', verification_health = 'verified',
             verification_authority = 'employer_ats', verification_method = $4,
             consecutive_complete_misses = 0, closed_at = NULL, closure_reason = NULL,
             updated_at = now()
           WHERE tenant_id = $1 AND job_id = $2`,
          [tenantId, jobId, input.attemptedAt, input.method],
        );
      } else if (input.result === "not_found") {
        await database.#db.query(
          `UPDATE role_availability SET
             last_verified_at = $3, next_verify_at = NULL,
             missing_since = COALESCE(missing_since, $3), publication_state = 'closed',
             verification_health = 'verified', verification_authority = 'employer_ats',
             verification_method = 'detail_get', closed_at = $3,
             closure_reason = 'detail_not_found', updated_at = now()
           WHERE tenant_id = $1 AND job_id = $2`,
          [tenantId, jobId, input.attemptedAt],
        );
      } else if (input.result === "absent_from_complete_list") {
        const missingSinceMs = availability.missing_since
          ? new Date(availability.missing_since).getTime()
          : null;
        const closeNow =
          availability.consecutive_complete_misses >= 1 &&
          missingSinceMs !== null &&
          attemptedAtMs - missingSinceMs >= 6 * 60 * 60 * 1000;
        await database.#db.query(
          `UPDATE role_availability SET
             last_verified_at = $3,
             next_verify_at = CASE WHEN $4 THEN NULL ELSE $3::timestamptz + interval '6 hours' END,
             missing_since = COALESCE(missing_since, $3),
             publication_state = CASE WHEN $4 THEN 'closed' ELSE 'possibly_closed' END,
             verification_health = 'verified', verification_authority = 'employer_ats',
             verification_method = 'complete_list',
             consecutive_complete_misses = CASE
               WHEN $4 THEN 2 ELSE GREATEST(consecutive_complete_misses, 1)
             END,
             closed_at = CASE WHEN $4 THEN $3 ELSE NULL END,
             closure_reason = CASE
               WHEN $4 THEN 'source_removed_after_two_complete_runs' ELSE NULL
             END,
             updated_at = now()
           WHERE tenant_id = $1 AND job_id = $2`,
          [tenantId, jobId, input.attemptedAt, closeNow],
        );
      } else {
        await database.#db.query(
          `UPDATE role_availability SET
             next_verify_at = $3::timestamptz + interval '1 hour',
             verification_health = 'blocked', verification_authority = 'employer_ats',
             verification_method = $4, updated_at = now()
           WHERE tenant_id = $1 AND job_id = $2`,
          [tenantId, jobId, input.attemptedAt, input.method],
        );
      }

      const attempt: VerificationAttemptRecord = {
        id: randomUUID(),
        jobId,
        sourceRunId: null,
        attemptedAt: input.attemptedAt,
        authority: "employer_ats",
        method: input.method,
        result: input.result,
        evidence: input.evidence,
      };
      await database.#db.query(
        `INSERT INTO verification_attempts(
           id, tenant_id, job_id, source_run_id, attempted_at, authority, method, result, evidence
         ) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8::jsonb)`,
        [
          attempt.id,
          tenantId,
          jobId,
          attempt.attemptedAt,
          attempt.authority,
          attempt.method,
          attempt.result,
          JSON.stringify(attempt.evidence),
        ],
      );
      const job = await database.getJob(tenantId, jobId);
      if (!job) throw new Error("JOB_NOT_FOUND");
      return { job, attempt };
    });
  }

  async listSourceRuns(tenantId: string): Promise<SourceRunRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, source, board_id, started_at, completed_at, complete, pages_read,
         source_item_count, response_fingerprint, retry_after_observed, source_policy_version
       FROM source_runs WHERE tenant_id = $1 ORDER BY completed_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      source: row.source,
      boardId: row.board_id,
      startedAt: isoRequired(row.started_at),
      completedAt: isoRequired(row.completed_at),
      complete: row.complete,
      pagesRead: row.pages_read,
      sourceItemCount: row.source_item_count,
      responseFingerprint: row.response_fingerprint,
      retryAfterObserved: row.retry_after_observed,
      sourcePolicyVersion: row.source_policy_version,
    }));
  }

  async listRoleObservations(tenantId: string): Promise<RoleObservationRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, job_id, source_run_id, source, source_job_id, observed_at,
         content_hash, source_payload_hash, normalized_payload, normalizer_version
       FROM role_observations WHERE tenant_id = $1 ORDER BY observed_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      sourceRunId: row.source_run_id,
      source: row.source,
      sourceJobId: row.source_job_id,
      observedAt: isoRequired(row.observed_at),
      contentHash: row.content_hash,
      sourcePayloadHash: row.source_payload_hash,
      normalizedPayload: row.normalized_payload,
      normalizerVersion: row.normalizer_version,
    }));
  }

  async listLatestRoleObservations(tenantId: string): Promise<RoleObservationRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT DISTINCT ON (job_id)
         id, job_id, source_run_id, source, source_job_id, observed_at,
         content_hash, source_payload_hash, normalized_payload, normalizer_version
       FROM role_observations
       WHERE tenant_id = $1
       ORDER BY job_id, observed_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      sourceRunId: row.source_run_id,
      source: row.source,
      sourceJobId: row.source_job_id,
      observedAt: isoRequired(row.observed_at),
      contentHash: row.content_hash,
      sourcePayloadHash: row.source_payload_hash,
      normalizedPayload: row.normalized_payload,
      normalizerVersion: row.normalizer_version,
    }));
  }

  async listVerificationAttempts(tenantId: string): Promise<VerificationAttemptRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, job_id, source_run_id, attempted_at, authority, method, result, evidence
       FROM verification_attempts WHERE tenant_id = $1 ORDER BY attempted_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      sourceRunId: row.source_run_id,
      attemptedAt: isoRequired(row.attempted_at),
      authority: row.authority,
      method: row.method,
      result: row.result,
      evidence: row.evidence,
    }));
  }

  async listLatestVerificationAttempts(tenantId: string): Promise<VerificationAttemptRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT DISTINCT ON (job_id)
         id, job_id, source_run_id, attempted_at, authority, method, result, evidence
       FROM verification_attempts
       WHERE tenant_id = $1
       ORDER BY job_id, attempted_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      sourceRunId: row.source_run_id,
      attemptedAt: isoRequired(row.attempted_at),
      authority: row.authority,
      method: row.method,
      result: row.result,
      evidence: row.evidence,
    }));
  }

  async saveDiscoveryProfile(
    tenantId: string,
    input: DiscoveryProfileInput,
    approvedAt = new Date().toISOString(),
  ): Promise<DiscoveryProfileSaveResult> {
    const normalized = normalizeDiscoveryProfile(input);
    const linkedProfileIds = [
      normalized.profileVersionId,
      normalized.authorizationStatementVersionId,
    ].filter((id): id is string => id !== null);
    let linkedProfiles: Array<{ id: string; authorization_wording: string | null }> = [];
    if (linkedProfileIds.length > 0) {
      const linked = await this.#db.query<{
        id: string;
        authorization_wording: string | null;
      }>(
        `SELECT id, authorization_wording FROM profile_versions
         WHERE tenant_id = $1 AND id = ANY($2::text[])`,
        [tenantId, [...new Set(linkedProfileIds)]],
      );
      if (linked.rows.length !== new Set(linkedProfileIds).size) {
        throw new Error("PROFILE_VERSION_NOT_FOUND");
      }
      linkedProfiles = linked.rows;
    }
    if (
      normalized.authorizationStatementExpiresAt !== null &&
      normalized.authorizationStatementVersionId === null
    ) {
      throw new Error("DISCOVERY_AUTHORIZATION_STATEMENT_REQUIRED");
    }
    if (normalized.authorizationStatementVersionId !== null) {
      const statement = linkedProfiles.find(
        (profile) => profile.id === normalized.authorizationStatementVersionId,
      );
      if (!statement?.authorization_wording?.normalize("NFC").trim()) {
        throw new Error("DISCOVERY_AUTHORIZATION_STATEMENT_REQUIRED");
      }
    }
    const inputHash = canonicalHash(normalized);
    const latest = await this.latestDiscoveryProfile(tenantId);
    if (latest?.inputHash === inputHash) return { profile: latest, created: false };
    const id = randomUUID();
    const saved = await this.#db.query<any>(
      `INSERT INTO discovery_profiles(
         id, tenant_id, profile_version_id, input, input_hash, matcher_version,
         normalizer_version, approved_at
       ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
       RETURNING id, input, input_hash, approved_at, created_at`,
      [
        id,
        tenantId,
        normalized.profileVersionId,
        JSON.stringify(normalized),
        inputHash,
        normalized.matcherVersion,
        normalized.normalizerVersion,
        approvedAt,
      ],
    );
    return { profile: this.#mapDiscoveryProfile(saved.rows[0]), created: true };
  }

  #mapDiscoveryProfile(row: any): DiscoveryProfileRecord {
    return {
      id: row.id,
      input: row.input,
      inputHash: row.input_hash,
      approvedAt: isoRequired(row.approved_at),
      createdAt: isoRequired(row.created_at),
    };
  }

  async latestDiscoveryProfile(tenantId: string): Promise<DiscoveryProfileRecord | null> {
    const result = await this.#db.query<any>(
      `SELECT id, input, input_hash, approved_at, created_at
       FROM discovery_profiles WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
      [tenantId],
    );
    return result.rows[0] ? this.#mapDiscoveryProfile(result.rows[0]) : null;
  }

  async listDiscoveryProfiles(tenantId: string): Promise<DiscoveryProfileRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, input, input_hash, approved_at, created_at
       FROM discovery_profiles WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapDiscoveryProfile(row));
  }

  /** Candidate organization is stored beside Current Role source content. A
   * provider refresh may update the Role, but it cannot erase this decision. */
  async setRoleArchived(
    tenantId: string,
    id: string,
    archived: boolean,
  ): Promise<JobRecord | null> {
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const job = await database.getJob(tenantId, id);
      if (!job) return null;
      if (archived) {
        await database.#db.query(
          `INSERT INTO role_dispositions(tenant_id, job_id, state, archived_at)
           VALUES ($1,$2,'archived',now())
           ON CONFLICT (tenant_id, job_id) DO NOTHING`,
          [tenantId, id],
        );
      } else {
        await database.#db.query(
          "DELETE FROM role_dispositions WHERE tenant_id = $1 AND job_id = $2",
          [tenantId, id],
        );
      }
      return database.getJob(tenantId, id);
    });
  }

  async saveMatch(
    tenantId: string,
    jobId: string,
    profileVersionId: string | null,
    result: MatchResult,
    exactInputHash?: string,
  ): Promise<MatchRunRecord> {
    const id = randomUUID();
    const inputHash = exactInputHash ?? canonicalHash({ jobId, profileVersionId });
    const artifactHash = canonicalHash(result);
    const saved = await this.#db.query<any>(
      `INSERT INTO match_runs(
         id, tenant_id, job_id, profile_version_id, rule_version, result, input_hash,
         artifact_hash, job_content_hash
       ) SELECT $1,$2,$3,$4,$5,$6::jsonb,$7,$8,job.content_hash
       FROM jobs AS job WHERE job.id = $3 AND job.tenant_id = $2
       RETURNING id, job_id, profile_version_id, rule_version, result, input_hash,
         artifact_hash, job_content_hash, created_at`,
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
      jobContentHash: row.job_content_hash,
      createdAt: iso(row.created_at)!,
    };
  }

  async listLatestMatches(tenantId: string): Promise<Array<MatchRunRecord & { job: JobRecord }>> {
    const matches = await this.#db.query<any>(
      `SELECT DISTINCT ON (m.job_id)
         m.id, m.job_id, m.profile_version_id, m.rule_version, m.result,
         m.input_hash, m.artifact_hash, m.job_content_hash, m.created_at
       FROM match_runs m
       JOIN jobs job ON job.tenant_id = m.tenant_id AND job.id = m.job_id
       WHERE m.tenant_id = $1
         AND m.job_content_hash = job.content_hash
         AND m.profile_version_id IS NOT DISTINCT FROM (
           SELECT profile.id FROM profile_versions profile
           WHERE profile.tenant_id = m.tenant_id
           ORDER BY profile.created_at DESC, profile.id DESC LIMIT 1
         )
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
          jobContentHash: row.job_content_hash,
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
              artifact_hash, job_content_hash, created_at
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
      jobContentHash: row.job_content_hash,
      createdAt: iso(row.created_at)!,
    }));
    return {
      items,
      nextCursor: result.rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  #mapRoleWordingReview(row: any): RoleWordingReviewRecord {
    return {
      id: row.id,
      jobId: row.job_id,
      matchRunId: row.match_run_id,
      blockerCode: row.blocker_code,
      evidenceHash: row.evidence_hash,
      sourceText: row.source_text,
      sourceLocator: row.source_locator,
      observedAt: iso(row.observed_at),
      reviewedAt: isoRequired(row.reviewed_at),
    };
  }

  async listRoleWordingReviews(tenantId: string): Promise<RoleWordingReviewRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, job_id, match_run_id, blocker_code, evidence_hash, source_text,
         source_locator, observed_at, reviewed_at
       FROM role_wording_reviews
       WHERE tenant_id = $1
       ORDER BY reviewed_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapRoleWordingReview(row));
  }

  /** Record only that the candidate inspected an exact, current matcher quote.
   * This never rewrites the immutable Match Publication, confirms a legal
   * conclusion, changes fit, or enables recommendation exclusion. */
  async setRoleWordingReviewed(
    tenantId: string,
    jobId: string,
    matchRunId: string,
    blockerCode: string,
    reviewed: boolean,
  ): Promise<RoleWordingReviewRecord | null> {
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const snapshot = await database.#db.query<any>(
        `SELECT match_run.id, match_run.result, match_run.artifact_hash,
           match_run.job_content_hash,
           job.content_hash AS current_job_content_hash,
           (
             SELECT latest.id FROM match_runs AS latest
             WHERE latest.tenant_id = match_run.tenant_id
               AND latest.job_id = match_run.job_id
             ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1
           ) AS latest_match_run_id
         FROM match_runs AS match_run
         JOIN jobs AS job
           ON job.id = match_run.job_id AND job.tenant_id = match_run.tenant_id
         WHERE match_run.tenant_id = $1 AND match_run.job_id = $2 AND match_run.id = $3
         LIMIT 1 FOR UPDATE OF match_run, job`,
        [tenantId, jobId, matchRunId],
      );
      const row = snapshot.rows[0];
      if (!row) throw new Error("MATCH_RUN_NOT_FOUND");
      if (
        row.latest_match_run_id !== matchRunId ||
        row.job_content_hash !== row.current_job_content_hash
      ) {
        throw new Error("ROLE_WORDING_REVIEW_STALE");
      }
      const blocker = (row.result as MatchResult).blockers.find(
        (candidate) => candidate.code === blockerCode,
      );
      if (
        !blocker ||
        !(["no_sponsorship_of_any_kind", "citizenship_required"] as string[]).includes(blocker.code)
      ) {
        throw new Error("ROLE_WORDING_NOT_REVIEWABLE");
      }
      const evidenceHash = canonicalHash({
        matchRunId,
        matchArtifactHash: row.artifact_hash,
        jobContentHash: row.job_content_hash,
        blocker,
      });
      if (!reviewed) {
        await database.#db.query(
          `DELETE FROM role_wording_reviews
           WHERE tenant_id = $1 AND match_run_id = $2 AND blocker_code = $3`,
          [tenantId, matchRunId, blocker.code],
        );
        return null;
      }
      const saved = await database.#db.query<any>(
        `INSERT INTO role_wording_reviews(
           id, tenant_id, job_id, match_run_id, blocker_code, evidence_hash,
           source_text, source_locator, observed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (tenant_id, match_run_id, blocker_code) DO UPDATE SET
           id = role_wording_reviews.id
         RETURNING id, job_id, match_run_id, blocker_code, evidence_hash,
           source_text, source_locator, observed_at, reviewed_at`,
        [
          randomUUID(),
          tenantId,
          jobId,
          matchRunId,
          blocker.code,
          evidenceHash,
          blocker.sourceText,
          blocker.sourceLocator ?? null,
          blocker.observedAt ?? null,
        ],
      );
      return database.#mapRoleWordingReview(saved.rows[0]);
    });
  }

  #mapEmployerEntity(row: any): EmployerEntityRecord {
    return {
      id: row.id,
      canonicalCompany: row.canonical_company,
      normalizedName: row.normalized_name,
      createdAt: isoRequired(row.created_at),
    };
  }

  #mapEmployerAlias(row: any): EmployerAliasRecord {
    return {
      id: row.id,
      employerEntityId: row.employer_entity_id,
      canonicalCompany: row.canonical_company,
      normalizedName: row.normalized_name,
      alias: row.alias,
      normalizedAlias: row.normalized_alias,
      sourceLocator: row.source_locator,
      observedAt: isoRequired(row.observed_at),
      evidenceHash: row.evidence_hash,
      reviewedAt: isoRequired(row.reviewed_at),
    };
  }

  async setEmployerAliasReviewed(
    tenantId: string,
    input: {
      canonicalCompany: string;
      alias: string;
      sourceLocator?: string;
      observedAt?: string;
      reviewed: boolean;
    },
  ): Promise<EmployerAliasRecord | null> {
    const canonicalInput = input.canonicalCompany.normalize("NFC").trim();
    const alias = input.alias.normalize("NFC").trim();
    const normalizedName = normalizeEmployerName(canonicalInput);
    const normalizedAlias = normalizeEmployerName(alias);
    if (!normalizedName || !normalizedAlias) throw new Error("INVALID_EMPLOYER_ALIAS");
    if (normalizedName === normalizedAlias) throw new Error("EMPLOYER_ALIAS_REDUNDANT");

    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const entityResult = await database.#db.query<any>(
        `SELECT * FROM employer_entities
         WHERE tenant_id = $1 AND normalized_name = $2 LIMIT 1 FOR UPDATE`,
        [tenantId, normalizedName],
      );
      const entity = entityResult.rows[0] as any | undefined;
      if (!input.reviewed) {
        if (!entity) return null;
        await database.#db.query(
          `DELETE FROM employer_aliases
           WHERE tenant_id = $1 AND employer_entity_id = $2 AND normalized_alias = $3`,
          [tenantId, entity.id, normalizedAlias],
        );
        await database.#db.query(
          `DELETE FROM employer_entities AS entity
           WHERE entity.id = $1 AND entity.tenant_id = $2
             AND NOT EXISTS (
               SELECT 1 FROM employer_aliases AS alias
               WHERE alias.employer_entity_id = entity.id AND alias.tenant_id = entity.tenant_id
             )`,
          [entity.id, tenantId],
        );
        return null;
      }

      const jobs = await database.#db.query<{ company: string }>(
        `SELECT company FROM jobs WHERE tenant_id = $1 ORDER BY company, id FOR UPDATE`,
        [tenantId],
      );
      const canonicalCompanies = [
        ...new Set(
          jobs.rows
            .map((job) => job.company)
            .filter((company) => normalizeEmployerName(company) === normalizedName),
        ),
      ].sort((left, right) => left.localeCompare(right, "en-US"));
      if (canonicalCompanies.length === 0) throw new Error("EMPLOYER_CANONICAL_NOT_FOUND");

      const sourceLocator = input.sourceLocator?.normalize("NFC").trim() ?? "";
      const observed = new Date(input.observedAt ?? "");
      if (!sourceLocator) throw new Error("INVALID_EMPLOYER_ALIAS_SOURCE");
      if (!Number.isFinite(observed.getTime()))
        throw new Error("INVALID_EMPLOYER_ALIAS_OBSERVED_AT");
      const observedAt = observed.toISOString();
      const canonicalCompany = entity?.canonical_company ?? canonicalCompanies[0]!;
      const employerEntityId = entity?.id ?? randomUUID();
      if (!entity) {
        await database.#db.query(
          `INSERT INTO employer_entities(
             id, tenant_id, canonical_company, normalized_name
           ) VALUES ($1,$2,$3,$4)`,
          [employerEntityId, tenantId, canonicalCompany, normalizedName],
        );
      }
      const evidenceHash = canonicalHash({
        version: "employer_alias_review_v1",
        canonicalCompany,
        normalizedName,
        alias,
        normalizedAlias,
        sourceLocator,
        observedAt,
      });
      const existing = await database.#db.query<any>(
        `SELECT alias.*, entity.canonical_company, entity.normalized_name
         FROM employer_aliases AS alias
         JOIN employer_entities AS entity ON entity.id = alias.employer_entity_id
         WHERE alias.tenant_id = $1 AND alias.employer_entity_id = $2
           AND alias.normalized_alias = $3
         LIMIT 1 FOR UPDATE OF alias`,
        [tenantId, employerEntityId, normalizedAlias],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].evidence_hash !== evidenceHash) {
          throw new Error("EMPLOYER_ALIAS_CONFLICT");
        }
        return database.#mapEmployerAlias(existing.rows[0]);
      }
      const saved = await database.#db.query<any>(
        `INSERT INTO employer_aliases(
           id, tenant_id, employer_entity_id, alias, normalized_alias,
           source_locator, observed_at, evidence_hash
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          randomUUID(),
          tenantId,
          employerEntityId,
          alias,
          normalizedAlias,
          sourceLocator,
          observedAt,
          evidenceHash,
        ],
      );
      return database.#mapEmployerAlias({
        ...saved.rows[0],
        canonical_company: canonicalCompany,
        normalized_name: normalizedName,
      });
    });
  }

  async listEmployerEntities(tenantId: string): Promise<EmployerEntityRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT * FROM employer_entities
       WHERE tenant_id = $1 ORDER BY normalized_name, id`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapEmployerEntity(row));
  }

  async listEmployerAliases(tenantId: string): Promise<EmployerAliasRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT alias.*, entity.canonical_company, entity.normalized_name
       FROM employer_aliases AS alias
       JOIN employer_entities AS entity ON entity.id = alias.employer_entity_id
       WHERE alias.tenant_id = $1
       ORDER BY entity.normalized_name, alias.normalized_alias, alias.id`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapEmployerAlias(row));
  }

  async createH1bSignal(
    tenantId: string,
    input: Omit<H1bSignalRecord, "id">,
  ): Promise<H1bSignalRecord> {
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO h1b_signals(
        id, tenant_id, company, source_company, label, source_type, source_locator, source_period,
        observed_at, confidence, limitations
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, company, source_company, label, source_type, source_locator, source_period,
         observed_at, confidence, limitations`,
      [
        id,
        tenantId,
        input.company,
        input.sourceCompany,
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

  async importH1bDatasetEdition(
    tenantId: string,
    input: {
      sourceType: string;
      sourceEdition: string;
      checksum: string;
      transformationVersion: string;
      provenance: object;
      provenanceChecksum: string;
      languageReview: object;
      languageReviewChecksum: string;
      evaluation: Record<string, unknown>;
      evaluationProvenance: Record<string, unknown> | null;
      signals: Array<Omit<H1bSignalRecord, "id">>;
    },
  ): Promise<{ created: boolean; edition: DatasetEditionRecord; signals: H1bSignalRecord[] }> {
    if (canonicalHash(input.provenance) !== input.provenanceChecksum) {
      throw new Error("DATASET_PROVENANCE_CHECKSUM_MISMATCH");
    }
    if (canonicalHash(input.languageReview) !== input.languageReviewChecksum) {
      throw new Error("GOVERNMENT_LANGUAGE_REVIEW_CHECKSUM_MISMATCH");
    }
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const existing = await database.#db.query<any>(
        `SELECT * FROM dataset_editions
         WHERE tenant_id = $1 AND source_type = $2 AND source_edition = $3 LIMIT 1`,
        [tenantId, input.sourceType, input.sourceEdition],
      );
      if (existing.rows[0]) {
        if (
          existing.rows[0].checksum !== input.checksum ||
          existing.rows[0].transformation_version !== input.transformationVersion ||
          existing.rows[0].provenance_checksum !== input.provenanceChecksum ||
          existing.rows[0].language_review_checksum !== input.languageReviewChecksum
        ) {
          throw new Error("DATASET_EDITION_CONFLICT");
        }
        const signals = await database.#db.query<any>(
          `SELECT id, company, source_company, label, source_type, source_locator,
             source_period, observed_at, confidence, limitations
           FROM h1b_signals
           WHERE tenant_id = $1 AND dataset_edition_id = $2
           ORDER BY created_at, id`,
          [tenantId, existing.rows[0].id],
        );
        return {
          created: false,
          edition: database.#mapDatasetEdition(existing.rows[0]),
          signals: signals.rows.map((row) => database.#mapSignal(row)),
        };
      }
      const editionId = randomUUID();
      const editionResult = await database.#db.query<any>(
        `INSERT INTO dataset_editions(
           id, tenant_id, source_type, source_edition, checksum,
           transformation_version, provenance, provenance_checksum,
           language_review, language_review_checksum, evaluation, evaluation_provenance
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11::jsonb,$12::jsonb)
         RETURNING *`,
        [
          editionId,
          tenantId,
          input.sourceType,
          input.sourceEdition,
          input.checksum,
          input.transformationVersion,
          JSON.stringify(input.provenance),
          input.provenanceChecksum,
          JSON.stringify(input.languageReview),
          input.languageReviewChecksum,
          JSON.stringify(input.evaluation),
          input.evaluationProvenance ? JSON.stringify(input.evaluationProvenance) : null,
        ],
      );
      const signals: H1bSignalRecord[] = [];
      for (const signal of input.signals) {
        const id = randomUUID();
        const inserted = await database.#db.query<any>(
          `INSERT INTO h1b_signals(
             id, tenant_id, company, source_company, label, source_type, source_locator,
             source_period, observed_at, confidence, limitations, dataset_edition_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id, company, source_company, label, source_type, source_locator, source_period,
             observed_at, confidence, limitations`,
          [
            id,
            tenantId,
            signal.company,
            signal.sourceCompany,
            signal.label,
            signal.sourceType,
            signal.sourceLocator,
            signal.sourcePeriod,
            signal.observedAt,
            signal.confidence,
            signal.limitations,
            editionId,
          ],
        );
        signals.push(database.#mapSignal(inserted.rows[0]));
      }
      return {
        created: true,
        edition: database.#mapDatasetEdition(editionResult.rows[0]),
        signals,
      };
    });
  }

  #mapDatasetEdition(row: any): DatasetEditionRecord {
    const provenance = row.provenance ?? null;
    const provenanceChecksum = row.provenance_checksum ?? null;
    const languageReview = row.language_review ?? null;
    const languageReviewChecksum = row.language_review_checksum ?? null;
    if (
      (provenance === null) !== (provenanceChecksum === null) ||
      (provenance !== null && canonicalHash(provenance) !== provenanceChecksum)
    ) {
      throw new Error("DATASET_PROVENANCE_INTEGRITY_FAILED");
    }
    if (
      (languageReview === null) !== (languageReviewChecksum === null) ||
      (languageReview !== null && canonicalHash(languageReview) !== languageReviewChecksum)
    ) {
      throw new Error("GOVERNMENT_LANGUAGE_REVIEW_INTEGRITY_FAILED");
    }
    return {
      id: row.id,
      sourceType: row.source_type,
      sourceEdition: row.source_edition,
      checksum: row.checksum,
      transformationVersion: row.transformation_version,
      provenance,
      provenanceChecksum,
      languageReview,
      languageReviewChecksum,
      evaluation: row.evaluation,
      evaluationProvenance: row.evaluation_provenance,
      createdAt: iso(row.created_at)!,
    };
  }

  async listDatasetEditions(tenantId: string): Promise<DatasetEditionRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT * FROM dataset_editions
       WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapDatasetEdition(row));
  }

  #mapSignal(row: any): H1bSignalRecord {
    return {
      id: row.id,
      company: row.company,
      sourceCompany: row.source_company,
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
      `SELECT id, company, source_company, label, source_type, source_locator, source_period,
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
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const id = randomUUID();
      const result = await database.#db.query<any>(
        `INSERT INTO applications(id, tenant_id, job_id, profile_version_id, status)
         SELECT $1,$2,$3,$4,'tracked'
         WHERE EXISTS (SELECT 1 FROM jobs WHERE id = $3 AND tenant_id = $2)
         RETURNING id, job_id, profile_version_id, status, submitted_at, follow_up_on,
           created_at, updated_at`,
        [id, tenantId, jobId, profileVersionId],
      );
      if (!result.rows[0]) throw new Error("JOB_NOT_FOUND");
      await database.#db.query(
        `INSERT INTO application_status_events(
           id, tenant_id, application_id, from_status, to_status, source, occurred_at
         ) VALUES ($1,$2,$3,NULL,'tracked','candidate',$4)`,
        [randomUUID(), tenantId, id, iso(result.rows[0].created_at)],
      );
      return database.#mapApplication(result.rows[0]);
    });
  }

  #mapApplication(row: any): ApplicationRecord {
    return {
      id: row.id,
      jobId: row.job_id,
      profileVersionId: row.profile_version_id,
      status: row.status,
      submittedAt: iso(row.submitted_at),
      followUpOn: iso(row.follow_up_on)?.slice(0, 10) ?? null,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async setApplicationStatus(
    tenantId: string,
    id: string,
    status: ApplicationStatus,
    source: ApplicationStatusEvent["source"] = "packet",
  ): Promise<ApplicationRecord | null> {
    /* Packet lifecycle and candidate intent are distinct actors, but both use
     * this persistence primitive. The old SELECT followed by UPDATE could race
     * and derive submitted_at from stale state. PostgreSQL evaluates this CASE
     * against the row being updated, so stamping and clearing stay atomic. */
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const current = await database.#db.query<{ status: ApplicationStatus }>(
        `SELECT status FROM applications WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
        [tenantId, id],
      );
      const from = current.rows[0]?.status;
      if (!from) return null;
      const result = await database.#db.query<any>(
        `UPDATE applications SET status = $3,
           submitted_at = CASE
             WHEN status = 'submitted_externally' AND $3 <> 'submitted_externally' THEN NULL
             WHEN $3 = 'submitted_externally' THEN COALESCE(submitted_at, now())
             ELSE submitted_at END,
           updated_at = now()
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, job_id, profile_version_id, status, submitted_at, follow_up_on,
           created_at, updated_at`,
        [tenantId, id, status],
      );
      const record = result.rows[0] ? database.#mapApplication(result.rows[0]) : null;
      if (record && from !== status) {
        await database.#db.query(
          `INSERT INTO application_status_events(
             id, tenant_id, application_id, from_status, to_status, source, occurred_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [randomUUID(), tenantId, id, from, status, source, record.updatedAt],
        );
      }
      return record;
    });
  }

  async setApplicationFollowUp(
    tenantId: string,
    id: string,
    followUpOn: string | null,
  ): Promise<ApplicationRecord | null> {
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const current = await database.#db.query<{ status: ApplicationStatus }>(
        `SELECT status FROM applications
         WHERE tenant_id = $1 AND id = $2
         FOR UPDATE`,
        [tenantId, id],
      );
      const status = current.rows[0]?.status;
      if (!status) return null;
      applicationFollowUpPolicy.change(status, followUpOn);
      const result = await database.#db.query<any>(
        `UPDATE applications
         SET follow_up_on = $3::date, updated_at = now()
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, job_id, profile_version_id, status, submitted_at, follow_up_on,
           created_at, updated_at`,
        [tenantId, id, followUpOn],
      );
      return result.rows[0] ? database.#mapApplication(result.rows[0]) : null;
    });
  }

  /** Candidate-only read-policy-write transaction. Packet consequences bypass
   * this method and call setApplicationStatus inside PacketLifecycle's larger
   * transaction. */
  async transitionCandidateApplicationStatus(
    tenantId: string,
    id: string,
    status: ApplicationStatus,
    confirmed: boolean,
    submission?: CandidateSubmissionInput,
  ): Promise<ApplicationRecord | null> {
    if (status === "submitted_externally") {
      return this.recordCandidateSubmission(tenantId, id, submission, confirmed);
    }
    if (submission) throw new Error("UNEXPECTED_SUBMISSION_RECORD");
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const current = await database.#db.query<{ status: ApplicationStatus }>(
        `SELECT status FROM applications
         WHERE tenant_id = $1 AND id = $2
         FOR UPDATE`,
        [tenantId, id],
      );
      const from = current.rows[0]?.status;
      if (!from) return null;
      const decision = applicationTransitions
        .candidate(from)
        .decide(status, confirmed ? { confirmed: true } : undefined);
      if (decision.kind === "confirmation_required") {
        throw new Error("APPLICATION_TRANSITION_CONFIRMATION_REQUIRED");
      }
      if (decision.kind === "illegal") throw new Error(decision.code);
      if (decision.kind === "unchanged") {
        const unchanged = await database.#db.query<any>(
          `SELECT id, job_id, profile_version_id, status, submitted_at, follow_up_on,
             created_at, updated_at
           FROM applications WHERE tenant_id = $1 AND id = $2`,
          [tenantId, id],
        );
        return unchanged.rows[0] ? database.#mapApplication(unchanged.rows[0]) : null;
      }
      return database.setApplicationStatus(tenantId, id, decision.transition.to, "candidate");
    });
  }

  #mapApplicationSubmission(row: any): ApplicationSubmissionRecord {
    return {
      id: row.id,
      applicationId: row.application_id,
      packetId: row.packet_id,
      materialsCaptured: row.materials_captured,
      artifactFormats: row.artifact_formats,
      channel: row.channel,
      destination: row.destination,
      submittedAt: isoRequired(row.submitted_at),
      packetArtifactHash: row.packet_artifact_hash,
      packetManifestHash: row.packet_manifest_hash,
      createdAt: isoRequired(row.created_at),
    };
  }

  async listApplicationSubmissions(
    tenantId: string,
    applicationId?: string,
  ): Promise<ApplicationSubmissionRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT * FROM application_submissions
       WHERE tenant_id = $1 AND ($2::text IS NULL OR application_id = $2)
       ORDER BY submitted_at DESC, id DESC`,
      [tenantId, applicationId ?? null],
    );
    return result.rows.map((row) => this.#mapApplicationSubmission(row));
  }

  async recordCandidateSubmission(
    tenantId: string,
    applicationId: string,
    rawInput: CandidateSubmissionInput | undefined,
    confirmed: boolean,
  ): Promise<ApplicationRecord | null> {
    return this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const current = await database.#db.query<any>(
        `SELECT * FROM applications
         WHERE tenant_id = $1 AND id = $2
         FOR UPDATE`,
        [tenantId, applicationId],
      );
      const row = current.rows[0];
      if (!row) return null;
      const decision = applicationTransitions
        .candidate(row.status as ApplicationStatus)
        .decide("submitted_externally", confirmed ? { confirmed: true } : undefined);
      if (decision.kind === "confirmation_required") {
        throw new Error("APPLICATION_TRANSITION_CONFIRMATION_REQUIRED");
      }
      if (decision.kind === "illegal") throw new Error(decision.code);
      if (decision.kind === "unchanged") throw new Error("APPLICATION_ALREADY_SUBMITTED");
      if (!rawInput) throw new Error("SUBMISSION_RECORD_REQUIRED");
      const input = normalizeCandidateSubmission(rawInput);

      let packetArtifactHash: string | null = null;
      let packetManifestHash: string | null = null;
      if (input.materialsCaptured) {
        const packet = await database.getPacket(tenantId, input.packetId!);
        const latestPacket = await database.getLatestPacketForApplication(tenantId, applicationId);
        if (
          !packet ||
          packet.applicationId !== applicationId ||
          packet.id !== latestPacket?.id ||
          packet.status !== "approved"
        ) {
          throw new Error("SUBMISSION_CURRENT_APPROVED_PACKET_REQUIRED");
        }
        if (packet.profileVersionId !== row.profile_version_id) {
          throw new Error("SUBMISSION_PACKET_PROFILE_CHANGED");
        }
        const content = packet.canonicalContent as {
          schemaVersion?: unknown;
          composition?: {
            profileVersionId?: unknown;
            matchRunId?: unknown;
            matchInputHash?: unknown;
            matchArtifactHash?: unknown;
            jobContentHash?: unknown;
            evidenceIds?: unknown;
          };
        };
        const composition = content.composition;
        if (
          content.schemaVersion !== "packet_v2" ||
          !composition ||
          composition.profileVersionId !== row.profile_version_id ||
          typeof composition.matchRunId !== "string" ||
          typeof composition.matchInputHash !== "string" ||
          typeof composition.matchArtifactHash !== "string" ||
          typeof composition.jobContentHash !== "string" ||
          !Array.isArray(composition.evidenceIds)
        ) {
          throw new Error("SUBMISSION_PACKET_COMPOSITION_REQUIRED");
        }
        const [job, latestMatch, evidence] = await Promise.all([
          database.getJob(tenantId, row.job_id),
          database
            .listLatestMatches(tenantId)
            .then((matches) => matches.find((match) => match.jobId === row.job_id)),
          database.listEvidenceByIds(tenantId, composition.evidenceIds as string[]),
        ]);
        if (
          !job ||
          !latestMatch ||
          latestMatch.id !== composition.matchRunId ||
          latestMatch.profileVersionId !== row.profile_version_id ||
          latestMatch.inputHash !== composition.matchInputHash ||
          latestMatch.artifactHash !== composition.matchArtifactHash ||
          latestMatch.jobContentHash !== composition.jobContentHash ||
          job.contentHash !== composition.jobContentHash
        ) {
          throw new Error("SUBMISSION_PACKET_INPUT_CHANGED");
        }
        if (
          evidence.length !== composition.evidenceIds.length ||
          evidence.some((claim) => claim.status !== "confirmed")
        ) {
          throw new Error("SUBMISSION_PACKET_EVIDENCE_CHANGED");
        }
        const artifacts = (
          packet.artifactManifest as {
            artifacts?: Array<{ format?: unknown; sha256?: unknown }>;
          }
        ).artifacts;
        if (
          !artifacts ||
          input.artifactFormats.some(
            (format) =>
              !artifacts.some(
                (artifact) => artifact.format === format && typeof artifact.sha256 === "string",
              ),
          )
        ) {
          throw new Error("SUBMISSION_PACKET_FORMAT_UNAVAILABLE");
        }
        packetArtifactHash = packet.artifactHash;
        packetManifestHash = packet.manifestHash;
      }

      const updated = await database.#db.query<any>(
        `UPDATE applications
         SET status = 'submitted_externally', submitted_at = $3, updated_at = now()
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, job_id, profile_version_id, status, submitted_at, follow_up_on,
           created_at, updated_at`,
        [tenantId, applicationId, input.submittedAt],
      );
      const submissionId = randomUUID();
      await database.#db.query(
        `INSERT INTO application_submissions(
           id, tenant_id, application_id, packet_id, materials_captured,
           artifact_formats, channel, destination, submitted_at,
           packet_artifact_hash, packet_manifest_hash
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)`,
        [
          submissionId,
          tenantId,
          applicationId,
          input.packetId,
          input.materialsCaptured,
          JSON.stringify(input.artifactFormats),
          input.channel,
          input.destination,
          input.submittedAt,
          packetArtifactHash,
          packetManifestHash,
        ],
      );
      await database.#db.query(
        `INSERT INTO application_status_events(
           id, tenant_id, application_id, from_status, to_status, source, occurred_at
         ) VALUES ($1,$2,$3,$4,'submitted_externally','candidate',$5)`,
        [randomUUID(), tenantId, applicationId, row.status, input.submittedAt],
      );
      const application = database.#mapApplication(updated.rows[0]);
      application.submissions = await database.listApplicationSubmissions(tenantId, applicationId);
      return application;
    });
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

  async addApplicationNote(
    tenantId: string,
    applicationId: string,
    input: { text: string; recordedAt: string },
  ): Promise<ApplicationNoteRecord> {
    const text = input.text.normalize("NFC").trim();
    if (!text || text.length > 2_000) throw new Error("INVALID_APPLICATION_NOTE");
    if (!Number.isFinite(Date.parse(input.recordedAt))) throw new Error("INVALID_RECORDED_AT");
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO application_notes(id, tenant_id, application_id, text, recorded_at)
       SELECT $1,$2,$3,$4,$5
       WHERE EXISTS (SELECT 1 FROM applications WHERE id = $3 AND tenant_id = $2)
       RETURNING id, application_id, text, recorded_at`,
      [id, tenantId, applicationId, text, input.recordedAt],
    );
    const row = result.rows[0];
    if (!row) throw new Error("APPLICATION_NOT_FOUND");
    return {
      id: row.id,
      applicationId: row.application_id,
      text: row.text,
      recordedAt: iso(row.recorded_at)!,
    };
  }

  async listApplications(tenantId: string): Promise<ApplicationRecord[]> {
    const [applications, outcomes, notes, statusEvents, submissions, jobs] = await Promise.all([
      this.#db.query<any>(
        `SELECT id, job_id, profile_version_id, status, submitted_at, follow_up_on,
           created_at, updated_at
         FROM applications WHERE tenant_id = $1 ORDER BY updated_at DESC, id`,
        [tenantId],
      ),
      this.#db.query<any>(
        `SELECT id, application_id, type, note, occurred_at
         FROM outcomes WHERE tenant_id = $1 ORDER BY occurred_at DESC, id`,
        [tenantId],
      ),
      this.#db.query<any>(
        `SELECT id, application_id, text, recorded_at
         FROM application_notes WHERE tenant_id = $1 ORDER BY recorded_at DESC, id`,
        [tenantId],
      ),
      this.#db.query<any>(
        `SELECT id, application_id, from_status, to_status, source, occurred_at
         FROM application_status_events
         WHERE tenant_id = $1 ORDER BY occurred_at, id`,
        [tenantId],
      ),
      this.#db.query<any>(
        `SELECT * FROM application_submissions
         WHERE tenant_id = $1 ORDER BY submitted_at DESC, id DESC`,
        [tenantId],
      ),
      this.listJobs(tenantId),
    ]);
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const groupByApplication = <T extends { application_id: string }>(rows: T[]) => {
      const grouped = new Map<string, T[]>();
      for (const row of rows) {
        const group = grouped.get(row.application_id);
        if (group) group.push(row);
        else grouped.set(row.application_id, [row]);
      }
      return grouped;
    };
    const outcomesByApplication = groupByApplication(outcomes.rows);
    const notesByApplication = groupByApplication(notes.rows);
    const submissionsByApplication = groupByApplication(submissions.rows);
    const statusEventsByApplication = groupByApplication(statusEvents.rows);
    return applications.rows.map((row) => {
      const record = this.#mapApplication(row);
      const job = jobsById.get(record.jobId);
      return {
        ...record,
        ...(job ? { job: { title: job.title, company: job.company } } : {}),
        outcomes: (outcomesByApplication.get(record.id) ?? []).map((outcome) => ({
          id: outcome.id,
          applicationId: outcome.application_id,
          type: outcome.type,
          note: outcome.note,
          occurredAt: iso(outcome.occurred_at)!,
        })),
        notes: (notesByApplication.get(record.id) ?? []).map((note) => ({
          id: note.id,
          applicationId: note.application_id,
          text: note.text,
          recordedAt: iso(note.recorded_at)!,
        })),
        submissions: (submissionsByApplication.get(record.id) ?? []).map((submission) =>
          this.#mapApplicationSubmission(submission),
        ),
        statusEvents: (statusEventsByApplication.get(record.id) ?? []).map((event) => ({
          id: event.id,
          applicationId: event.application_id,
          fromStatus: event.from_status,
          toStatus: event.to_status,
          source: event.source,
          occurredAt: iso(event.occurred_at)!,
        })),
      };
    });
  }

  async createApplicationActivity(
    tenantId: string,
    input: {
      applicationId: string;
      contactId?: string | null;
      kind: ActivityKind;
      title: string;
      note?: string;
      dueAt?: string | null;
    },
  ): Promise<ApplicationActivityRecord> {
    if (!ACTIVITY_KINDS.includes(input.kind)) throw new Error("INVALID_ACTIVITY_KIND");
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO application_activities(
         id, tenant_id, application_id, contact_id, kind, state, title, note, due_at
       )
       SELECT $1,$2,$3,$4,$5,'planned',$6,$7,$8
       WHERE EXISTS (
         SELECT 1 FROM applications WHERE id = $3 AND tenant_id = $2
       ) AND ($4::text IS NULL OR EXISTS (
         SELECT 1 FROM contacts WHERE id = $4 AND tenant_id = $2
       ))
       RETURNING *`,
      [
        id,
        tenantId,
        input.applicationId,
        input.contactId ?? null,
        input.kind,
        recordText(input.title, "activity_title", 180, true),
        recordText(input.note ?? "", "activity_note", 2_000),
        recordInstant(input.dueAt ?? null, "ACTIVITY_DUE_AT"),
      ],
    );
    if (!result.rows[0]) throw new Error("APPLICATION_OR_CONTACT_NOT_FOUND");
    return this.#mapApplicationActivity(result.rows[0]);
  }

  #mapApplicationActivity(row: any): ApplicationActivityRecord {
    return {
      id: row.id,
      applicationId: row.application_id,
      contactId: row.contact_id,
      kind: row.kind,
      state: row.state,
      title: row.title,
      note: row.note,
      dueAt: iso(row.due_at),
      occurredAt: iso(row.occurred_at),
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async setApplicationActivityState(
    tenantId: string,
    id: string,
    state: ActivityState,
  ): Promise<ApplicationActivityRecord | null> {
    if (!ACTIVITY_STATES.includes(state)) throw new Error("INVALID_ACTIVITY_STATE");
    const result = await this.#db.query<any>(
      `UPDATE application_activities
       SET state = $3,
         occurred_at = CASE
           WHEN $3 = 'completed' THEN COALESCE(occurred_at, now())
           WHEN $3 = 'planned' THEN NULL
           ELSE occurred_at END,
         updated_at = now()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [tenantId, id, state],
    );
    return result.rows[0] ? this.#mapApplicationActivity(result.rows[0]) : null;
  }

  async listApplicationActivities(tenantId: string): Promise<ApplicationActivityRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT * FROM application_activities
       WHERE tenant_id = $1
       ORDER BY CASE WHEN state = 'planned' THEN 0 ELSE 1 END,
         due_at NULLS LAST, updated_at DESC, id`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapApplicationActivity(row));
  }

  async createContact(
    tenantId: string,
    input: {
      name: string;
      organization?: string;
      title?: string;
      email?: string;
      phone?: string;
      kind: ContactKind;
      notes?: string;
      applicationId?: string | null;
      applicationRole?: ContactKind;
    },
  ): Promise<ContactRecord> {
    if (!CONTACT_KINDS.includes(input.kind)) throw new Error("INVALID_CONTACT_KIND");
    const id = randomUUID();
    await this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const created = await database.#db.query<{ id: string }>(
        `INSERT INTO contacts(
           id, tenant_id, name, organization, title, email, phone, kind, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          id,
          tenantId,
          recordText(input.name, "contact_name", 180, true),
          recordText(input.organization ?? "", "contact_organization", 180),
          recordText(input.title ?? "", "contact_title", 180),
          recordText(input.email ?? "", "contact_email", 320),
          recordText(input.phone ?? "", "contact_phone", 80),
          input.kind,
          recordText(input.notes ?? "", "contact_notes", 2_000),
        ],
      );
      if (!created.rows[0]) throw new Error("CONTACT_NOT_CREATED");
      if (input.applicationId) {
        const linked = await database.#db.query<{ contact_id: string }>(
          `INSERT INTO application_contacts(tenant_id, application_id, contact_id, role)
           SELECT $1,$2,$3,$4
           WHERE EXISTS (
             SELECT 1 FROM applications WHERE tenant_id = $1 AND id = $2
           ) RETURNING contact_id`,
          [tenantId, input.applicationId, id, input.applicationRole ?? input.kind],
        );
        if (!linked.rows[0]) throw new Error("APPLICATION_NOT_FOUND");
      }
    });
    return (await this.listContacts(tenantId)).find((contact) => contact.id === id)!;
  }

  async linkContactToApplication(
    tenantId: string,
    contactId: string,
    applicationId: string,
    role: ContactKind,
  ): Promise<boolean> {
    if (!CONTACT_KINDS.includes(role)) throw new Error("INVALID_CONTACT_KIND");
    const result = await this.#db.query<{ contact_id: string }>(
      `INSERT INTO application_contacts(tenant_id, application_id, contact_id, role)
       SELECT $1,$2,$3,$4
       WHERE EXISTS (SELECT 1 FROM applications WHERE tenant_id = $1 AND id = $2)
         AND EXISTS (SELECT 1 FROM contacts WHERE tenant_id = $1 AND id = $3)
       ON CONFLICT DO NOTHING
       RETURNING contact_id`,
      [tenantId, applicationId, contactId, role],
    );
    if (result.rows[0]) return true;
    const existing = await this.#db.query<{ contact_id: string }>(
      `SELECT contact_id FROM application_contacts
       WHERE tenant_id = $1 AND application_id = $2 AND contact_id = $3 AND role = $4`,
      [tenantId, applicationId, contactId, role],
    );
    return Boolean(existing.rows[0]);
  }

  async listContacts(tenantId: string): Promise<ContactRecord[]> {
    const [contacts, links] = await Promise.all([
      this.#db.query<any>(
        `SELECT * FROM contacts WHERE tenant_id = $1 ORDER BY updated_at DESC, id`,
        [tenantId],
      ),
      this.#db.query<any>(
        `SELECT application_id, contact_id, role FROM application_contacts
         WHERE tenant_id = $1 ORDER BY created_at, application_id`,
        [tenantId],
      ),
    ]);
    return contacts.rows.map((row) => ({
      id: row.id,
      name: row.name,
      organization: row.organization,
      title: row.title,
      email: row.email,
      phone: row.phone,
      kind: row.kind,
      notes: row.notes,
      applicationLinks: links.rows
        .filter((link) => link.contact_id === row.id)
        .map((link) => ({ applicationId: link.application_id, role: link.role })),
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    }));
  }

  async createInterviewRound(
    tenantId: string,
    input: {
      applicationId: string;
      kind: InterviewRoundKind;
      scheduledAt: string;
      format?: string;
      location?: string;
      participants?: string[];
      prepNotes?: string;
    },
  ): Promise<InterviewRoundRecord> {
    if (!INTERVIEW_ROUND_KINDS.includes(input.kind)) throw new Error("INVALID_INTERVIEW_KIND");
    const participants = [
      ...new Set(
        (input.participants ?? [])
          .map((value) => recordText(value, "interview_participant", 180))
          .filter(Boolean),
      ),
    ];
    if (participants.length > 20) throw new Error("INVALID_INTERVIEW_PARTICIPANTS");
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO interview_rounds(
         id, tenant_id, application_id, kind, state, scheduled_at,
         format, location, participants, prep_notes
       )
       SELECT $1,$2,$3,$4,'scheduled',$5,$6,$7,$8::jsonb,$9
       WHERE EXISTS (SELECT 1 FROM applications WHERE tenant_id = $2 AND id = $3)
       RETURNING *`,
      [
        id,
        tenantId,
        input.applicationId,
        input.kind,
        recordInstant(input.scheduledAt, "INTERVIEW_SCHEDULED_AT"),
        recordText(input.format ?? "", "interview_format", 120),
        recordText(input.location ?? "", "interview_location", 320),
        JSON.stringify(participants),
        recordText(input.prepNotes ?? "", "interview_prep_notes", 4_000),
      ],
    );
    if (!result.rows[0]) throw new Error("APPLICATION_NOT_FOUND");
    return this.#mapInterviewRound(result.rows[0]);
  }

  #mapInterviewRound(row: any): InterviewRoundRecord {
    return {
      id: row.id,
      applicationId: row.application_id,
      kind: row.kind,
      state: row.state,
      scheduledAt: iso(row.scheduled_at)!,
      format: row.format,
      location: row.location,
      participants: row.participants,
      prepNotes: row.prep_notes,
      outcomeNotes: row.outcome_notes,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async setInterviewRoundState(
    tenantId: string,
    id: string,
    state: InterviewRoundState,
    outcomeNotes = "",
  ): Promise<InterviewRoundRecord | null> {
    if (!INTERVIEW_ROUND_STATES.includes(state)) throw new Error("INVALID_INTERVIEW_STATE");
    const result = await this.#db.query<any>(
      `UPDATE interview_rounds SET state = $3, outcome_notes = $4, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      [tenantId, id, state, recordText(outcomeNotes, "interview_outcome_notes", 4_000)],
    );
    return result.rows[0] ? this.#mapInterviewRound(result.rows[0]) : null;
  }

  async listInterviewRounds(tenantId: string): Promise<InterviewRoundRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT * FROM interview_rounds
       WHERE tenant_id = $1 ORDER BY scheduled_at, id`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapInterviewRound(row));
  }

  async saveAnswerBlock(
    tenantId: string,
    input: {
      id?: string;
      topic: AnswerTopic;
      prompt: string;
      answerText: string;
      evidenceIds?: string[];
    },
  ): Promise<AnswerBlockRecord> {
    if (!ANSWER_TOPICS.includes(input.topic)) throw new Error("INVALID_ANSWER_TOPIC");
    const evidenceIds = [...new Set(input.evidenceIds ?? [])];
    if (evidenceIds.length > 40) throw new Error("INVALID_ANSWER_EVIDENCE");
    const id = input.id ?? randomUUID();
    await this.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      if (evidenceIds.length) {
        const evidence = await database.#db.query<{ id: string }>(
          `SELECT id FROM evidence_claims
           WHERE tenant_id = $1 AND status = 'confirmed' AND id = ANY($2::text[])`,
          [tenantId, evidenceIds],
        );
        if (evidence.rows.length !== evidenceIds.length) {
          throw new Error("EVIDENCE_SELECTION_CHANGED");
        }
      }
      const current = await database.#db.query<{ current_revision: number }>(
        `SELECT current_revision FROM answer_blocks
         WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
        [tenantId, id],
      );
      if (input.id && !current.rows[0]) throw new Error("ANSWER_BLOCK_NOT_FOUND");
      const revision = Number(current.rows[0]?.current_revision ?? 0) + 1;
      if (current.rows[0]) {
        await database.#db.query(
          `UPDATE answer_blocks
           SET topic = $3, prompt = $4, current_revision = $5, updated_at = now()
           WHERE tenant_id = $1 AND id = $2`,
          [
            tenantId,
            id,
            input.topic,
            recordText(input.prompt, "answer_prompt", 500, true),
            revision,
          ],
        );
      } else {
        await database.#db.query(
          `INSERT INTO answer_blocks(
             id, tenant_id, topic, prompt, current_revision
           ) VALUES ($1,$2,$3,$4,$5)`,
          [
            id,
            tenantId,
            input.topic,
            recordText(input.prompt, "answer_prompt", 500, true),
            revision,
          ],
        );
      }
      await database.#db.query(
        `INSERT INTO answer_revisions(
           id, tenant_id, answer_block_id, revision, topic, prompt, answer_text, evidence_ids
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [
          randomUUID(),
          tenantId,
          id,
          revision,
          input.topic,
          recordText(input.prompt, "answer_prompt", 500, true),
          recordText(input.answerText, "answer_text", 8_000, true),
          JSON.stringify(evidenceIds),
        ],
      );
    });
    return (await this.getAnswerBlock(tenantId, id, true))!;
  }

  async listAnswerBlocks(tenantId: string, includeHistory = false): Promise<AnswerBlockRecord[]> {
    return this.#readAnswerBlocks(tenantId, null, includeHistory);
  }

  async getAnswerBlock(
    tenantId: string,
    id: string,
    includeHistory = false,
  ): Promise<AnswerBlockRecord | null> {
    return (await this.#readAnswerBlocks(tenantId, id, includeHistory))[0] ?? null;
  }

  async listAnswerRevisions(
    tenantId: string,
    id: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<HistoryPage<AnswerRevisionRecord>> {
    const exists = await this.#db.query<{ id: string }>(
      `SELECT id FROM answer_blocks WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, id],
    );
    if (!exists.rows[0]) throw new Error("ANSWER_BLOCK_NOT_FOUND");
    const limit = historyLimit(options.limit);
    let anchorRevision: number | null = null;
    if (options.cursor) {
      const result = await this.#db.query<{ revision: string | number }>(
        `SELECT revision FROM answer_revisions
         WHERE tenant_id = $1 AND answer_block_id = $2 AND id = $3 LIMIT 1`,
        [tenantId, id, options.cursor],
      );
      if (!result.rows[0]) throw new Error("INVALID_CURSOR");
      anchorRevision = Number(result.rows[0].revision);
    }
    const result = await this.#db.query<any>(
      `SELECT id, revision, topic, prompt, answer_text, evidence_ids, created_at
       FROM answer_revisions
       WHERE tenant_id = $1
         AND answer_block_id = $2
         AND ($3::bigint IS NULL OR revision < $3::bigint)
       ORDER BY revision DESC LIMIT $4`,
      [tenantId, id, anchorRevision, limit + 1],
    );
    const items = result.rows.slice(0, limit).map((row) => ({
      id: row.id,
      revision: Number(row.revision),
      topic: row.topic,
      prompt: row.prompt,
      answerText: row.answer_text,
      evidenceIds: row.evidence_ids,
      createdAt: iso(row.created_at)!,
    }));
    return {
      items,
      nextCursor: result.rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async #readAnswerBlocks(
    tenantId: string,
    id: string | null,
    includeHistory: boolean,
  ): Promise<AnswerBlockRecord[]> {
    const blocks = await this.#db.query<any>(
      `SELECT block.*,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', revision.id,
               'revision', revision.revision,
               'topic', revision.topic,
               'prompt', revision.prompt,
               'answerText', revision.answer_text,
               'evidenceIds', revision.evidence_ids,
               'createdAt', revision.created_at
             ) ORDER BY revision.revision DESC
           ) FILTER (WHERE revision.id IS NOT NULL),
           '[]'::jsonb
         ) AS revisions
       FROM answer_blocks block
       LEFT JOIN answer_revisions revision
         ON revision.tenant_id = block.tenant_id
           AND revision.answer_block_id = block.id
           AND ($3::boolean OR revision.revision = block.current_revision)
       WHERE block.tenant_id = $1 AND ($2::text IS NULL OR block.id = $2)
       GROUP BY block.id
       ORDER BY block.updated_at DESC, block.id`,
      [tenantId, id, includeHistory],
    );
    return blocks.rows.map((row) => {
      const history: AnswerRevisionRecord[] = (
        row.revisions as Array<{
          id: string;
          revision: string | number;
          topic: AnswerTopic | null;
          prompt: string | null;
          answerText: string;
          evidenceIds: string[];
          createdAt: string | Date;
        }>
      ).map((revision) => ({
        id: revision.id,
        revision: Number(revision.revision),
        topic: revision.topic,
        prompt: revision.prompt,
        answerText: revision.answerText,
        evidenceIds: revision.evidenceIds,
        createdAt: iso(revision.createdAt)!,
      }));
      return {
        id: row.id,
        topic: row.topic,
        prompt: row.prompt,
        currentRevision: Number(row.current_revision),
        latest: history[0]!,
        ...(includeHistory ? { revisions: history } : {}),
        createdAt: iso(row.created_at)!,
        updatedAt: iso(row.updated_at)!,
      };
    });
  }

  async saveApplicationView(
    tenantId: string,
    input: { id?: string; name: string; filters: Record<string, unknown> },
  ): Promise<SavedApplicationViewRecord> {
    const id = input.id ?? randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO saved_application_views(id, tenant_id, name, filters)
       VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         filters = EXCLUDED.filters,
         updated_at = now()
       WHERE saved_application_views.tenant_id = EXCLUDED.tenant_id
       RETURNING *`,
      [id, tenantId, recordText(input.name, "view_name", 120, true), JSON.stringify(input.filters)],
    );
    if (!result.rows[0]) throw new Error("SAVED_VIEW_NOT_FOUND");
    return this.#mapSavedView(result.rows[0]);
  }

  #mapSavedView(row: any): SavedApplicationViewRecord {
    return {
      id: row.id,
      name: row.name,
      filters: row.filters,
      lastReviewedAt: iso(row.last_reviewed_at),
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async markApplicationViewReviewed(
    tenantId: string,
    id: string,
  ): Promise<SavedApplicationViewRecord | null> {
    const result = await this.#db.query<any>(
      `UPDATE saved_application_views
       SET last_reviewed_at = now(), updated_at = now()
       WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      [tenantId, id],
    );
    return result.rows[0] ? this.#mapSavedView(result.rows[0]) : null;
  }

  async listApplicationViews(tenantId: string): Promise<SavedApplicationViewRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT * FROM saved_application_views
       WHERE tenant_id = $1 ORDER BY updated_at DESC, id`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapSavedView(row));
  }

  async saveOffer(
    tenantId: string,
    input: {
      applicationId: string;
      currency: string;
      baseMinor: number;
      bonusMinor?: number | null;
      equity?: string;
      benefits?: string;
      startOn?: string | null;
      expiresOn?: string | null;
      workMode?: string;
      notes?: string;
    },
  ): Promise<OfferRecord> {
    const currency = input.currency.trim().toLocaleUpperCase("en-US");
    const validMoney = (value: number | null | undefined) =>
      value === null ||
      value === undefined ||
      (Number.isSafeInteger(value) && value >= 0 && value <= 900_000_000_000_000);
    if (
      !/^[A-Z]{3}$/u.test(currency) ||
      !validMoney(input.baseMinor) ||
      !validMoney(input.bonusMinor)
    ) {
      throw new Error("INVALID_OFFER_COMPENSATION");
    }
    const id = randomUUID();
    const result = await this.#db.query<any>(
      `INSERT INTO offers(
         id, tenant_id, application_id, state, currency, base_minor, bonus_minor,
         equity, benefits, start_on, expires_on, work_mode, notes
       )
       SELECT $1,$2,$3,'reviewing',$4,$5,$6,$7,$8,$9::date,$10::date,$11,$12
       WHERE EXISTS (SELECT 1 FROM applications WHERE tenant_id = $2 AND id = $3)
       ON CONFLICT (tenant_id, application_id) DO UPDATE SET
         currency = EXCLUDED.currency,
         base_minor = EXCLUDED.base_minor,
         bonus_minor = EXCLUDED.bonus_minor,
         equity = EXCLUDED.equity,
         benefits = EXCLUDED.benefits,
         start_on = EXCLUDED.start_on,
         expires_on = EXCLUDED.expires_on,
         work_mode = EXCLUDED.work_mode,
         notes = EXCLUDED.notes,
         updated_at = now()
       RETURNING *`,
      [
        id,
        tenantId,
        input.applicationId,
        currency,
        input.baseMinor,
        input.bonusMinor ?? null,
        recordText(input.equity ?? "", "offer_equity", 1_000),
        recordText(input.benefits ?? "", "offer_benefits", 4_000),
        recordDateOnly(input.startOn, "OFFER_START_ON"),
        recordDateOnly(input.expiresOn, "OFFER_EXPIRES_ON"),
        recordText(input.workMode ?? "", "offer_work_mode", 80),
        recordText(input.notes ?? "", "offer_notes", 4_000),
      ],
    );
    if (!result.rows[0]) throw new Error("APPLICATION_NOT_FOUND");
    return this.#mapOffer(result.rows[0]);
  }

  #mapOffer(row: any): OfferRecord {
    return {
      id: row.id,
      applicationId: row.application_id,
      state: row.state,
      currency: row.currency,
      baseMinor: Number(row.base_minor),
      bonusMinor: row.bonus_minor === null ? null : Number(row.bonus_minor),
      equity: row.equity,
      benefits: row.benefits,
      startOn: iso(row.start_on)?.slice(0, 10) ?? null,
      expiresOn: iso(row.expires_on)?.slice(0, 10) ?? null,
      workMode: row.work_mode,
      notes: row.notes,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async setOfferState(
    tenantId: string,
    id: string,
    state: OfferState,
  ): Promise<OfferRecord | null> {
    if (!OFFER_STATES.includes(state)) throw new Error("INVALID_OFFER_STATE");
    const result = await this.#db.query<any>(
      `UPDATE offers SET state = $3, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      [tenantId, id, state],
    );
    return result.rows[0] ? this.#mapOffer(result.rows[0]) : null;
  }

  async listOffers(tenantId: string): Promise<OfferRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT * FROM offers WHERE tenant_id = $1 ORDER BY updated_at DESC, id`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapOffer(row));
  }

  async readCareerOperations(
    tenantId: string,
    includeAnswerHistory = true,
  ): Promise<CareerOperationsSnapshot> {
    const [activities, contacts, interviews, answerBlocks, savedViews, offers] = await Promise.all([
      this.listApplicationActivities(tenantId),
      this.listContacts(tenantId),
      this.listInterviewRounds(tenantId),
      this.listAnswerBlocks(tenantId, includeAnswerHistory),
      this.listApplicationViews(tenantId),
      this.listOffers(tenantId),
    ]);
    return { activities, contacts, interviews, answerBlocks, savedViews, offers };
  }

  async createPacket(
    tenantId: string,
    input: {
      id?: string;
      applicationId: string;
      profileVersionId: string | null;
      canonicalContent: Record<string, unknown>;
      artifactManifest: Record<string, unknown>;
    },
  ): Promise<PacketRecord> {
    const id = input.id ?? randomUUID();
    const artifactHash = canonicalHash(input.canonicalContent);
    const manifestHash = canonicalHash(input.artifactManifest);
    return this.transaction(async (database) => {
      // The sequence is allocated only after taking the same tenant lock used
      // by current-packet action decisions. This makes generation order exact
      // even when PostgreSQL timestamps tie within one transaction.
      await database.lockTenantActive(tenantId);
      const result = await database.#db.query<any>(
        `INSERT INTO packets(
          id, tenant_id, application_id, profile_version_id, status,
          canonical_content, artifact_manifest, artifact_hash, manifest_hash
         ) SELECT $1,$2,$3,$4,'draft',$5::jsonb,$6::jsonb,$7,$8
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
          manifestHash,
        ],
      );
      if (!result.rows[0]) throw new Error("APPLICATION_NOT_FOUND");
      return database.#mapPacket(result.rows[0]);
    });
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
      manifestHash: row.manifest_hash || canonicalHash(row.artifact_manifest),
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

  async getLatestPacketForApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<PacketRecord | null> {
    const result = await this.#db.query<any>(
      `SELECT * FROM packets
       WHERE tenant_id = $1 AND application_id = $2
       ORDER BY generation_sequence DESC
       LIMIT 1`,
      [tenantId, applicationId],
    );
    return result.rows[0] ? this.#mapPacket(result.rows[0]) : null;
  }

  async isPacketCurrent(tenantId: string, packetId: string): Promise<boolean> {
    const result = await this.#db.query<any>(
      `SELECT packet.canonical_content, packet.profile_version_id,
         application.profile_version_id AS application_profile_version_id,
         job.content_hash AS job_content_hash,
         (SELECT profile.id FROM profile_versions AS profile
          WHERE profile.tenant_id = packet.tenant_id
          ORDER BY profile.created_at DESC, profile.id DESC LIMIT 1) AS latest_profile_version_id,
         (SELECT match.id FROM match_runs AS match
          WHERE match.tenant_id = packet.tenant_id AND match.job_id = application.job_id
          ORDER BY match.created_at DESC, match.id DESC LIMIT 1) AS latest_match_run_id
       FROM packets AS packet
       JOIN applications AS application
         ON application.tenant_id = packet.tenant_id AND application.id = packet.application_id
       JOIN jobs AS job
         ON job.tenant_id = application.tenant_id AND job.id = application.job_id
       WHERE packet.tenant_id = $1 AND packet.id = $2 LIMIT 1`,
      [tenantId, packetId],
    );
    const row = result.rows[0];
    if (!row) return false;
    const content = row.canonical_content as {
      schemaVersion?: unknown;
      composition?: {
        profileVersionId?: unknown;
        matchRunId?: unknown;
        jobContentHash?: unknown;
        evidenceIds?: unknown;
      };
    };
    const composition = content.composition;
    if (
      content.schemaVersion !== "packet_v2" ||
      !composition ||
      composition.profileVersionId !== row.profile_version_id ||
      composition.profileVersionId !== row.application_profile_version_id ||
      composition.profileVersionId !== row.latest_profile_version_id ||
      composition.matchRunId !== row.latest_match_run_id ||
      composition.jobContentHash !== row.job_content_hash ||
      !Array.isArray(composition.evidenceIds) ||
      composition.evidenceIds.some((id) => typeof id !== "string")
    ) {
      return false;
    }
    const evidenceIds = composition.evidenceIds as string[];
    const evidence = await this.listEvidenceByIds(tenantId, evidenceIds);
    return (
      evidence.length === evidenceIds.length &&
      evidence.every((claim) => claim.status === "confirmed")
    );
  }

  async listPackets(tenantId: string): Promise<PacketRecord[]> {
    const result = await this.#db.query<any>(
      "SELECT * FROM packets WHERE tenant_id = $1 ORDER BY generation_sequence DESC",
      [tenantId],
    );
    return result.rows.map((row) => this.#mapPacket(row));
  }

  async listLatestPackets(tenantId: string): Promise<PacketRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT * FROM (
         SELECT DISTINCT ON (application_id) * FROM packets
         WHERE tenant_id = $1
         ORDER BY application_id, generation_sequence DESC
       ) AS latest ORDER BY generation_sequence DESC`,
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
       ORDER BY generation_sequence DESC`,
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
    let anchor: { generation_sequence: string | number } | undefined;
    if (options.cursor) {
      const result = await this.#db.query<{ generation_sequence: string | number }>(
        `SELECT generation_sequence FROM packets
         WHERE tenant_id = $1 AND application_id = $2 AND id = $3 LIMIT 1`,
        [tenantId, applicationId, options.cursor],
      );
      anchor = result.rows[0];
      if (!anchor) throw new Error("INVALID_CURSOR");
    }
    const result = await this.#db.query<any>(
      `SELECT * FROM packets
       WHERE tenant_id = $1 AND application_id = $2
         AND ($3::bigint IS NULL OR generation_sequence < $3::bigint)
       ORDER BY generation_sequence DESC LIMIT $4`,
      [tenantId, applicationId, anchor?.generation_sequence ?? null, limit + 1],
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
    input: {
      status: "passed" | "blocked";
      ruleVersion: string;
      findings: unknown[];
      packetArtifactHash?: string;
      manifestHash?: string;
    },
  ): Promise<AssuranceRecord> {
    return this.transaction(async (database) => {
      await database.assertTenantActive(tenantId);
      const packet = await database.getPacket(tenantId, packetId);
      if (!packet) throw new Error("PACKET_NOT_FOUND");
      const packetArtifactHash = input.packetArtifactHash ?? packet.artifactHash;
      const manifestHash = input.manifestHash ?? packet.manifestHash;
      if (packet.artifactHash !== packetArtifactHash || packet.manifestHash !== manifestHash) {
        throw new Error("PACKET_CHANGED");
      }
      const id = randomUUID();
      const result = await database.#db.query<any>(
        `INSERT INTO assurance_runs(
           id, tenant_id, packet_id, status, rule_version, findings,
           packet_artifact_hash, manifest_hash
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
         RETURNING id, packet_id, status, rule_version, findings,
           packet_artifact_hash, manifest_hash, created_at`,
        [
          id,
          tenantId,
          packetId,
          input.status,
          input.ruleVersion,
          JSON.stringify(input.findings),
          packetArtifactHash,
          manifestHash,
        ],
      );
      const row = result.rows[0]!;
      await database.#db.query(
        `UPDATE packets SET status = $3, updated_at = now()
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, packetId, input.status === "passed" ? "assurance_passed" : "assurance_blocked"],
      );
      return database.#mapAssurance(row);
    });
  }

  #mapAssurance(row: any): AssuranceRecord {
    return {
      id: row.id,
      packetId: row.packet_id,
      status: row.status,
      ruleVersion: row.rule_version,
      findings: row.findings,
      packetArtifactHash: row.packet_artifact_hash ?? "",
      manifestHash: row.manifest_hash ?? "",
      createdAt: iso(row.created_at)!,
    };
  }

  async latestAssurance(tenantId: string, packetId: string): Promise<AssuranceRecord | null> {
    const result = await this.#db.query<any>(
      `SELECT id, packet_id, status, rule_version, findings,
         packet_artifact_hash, manifest_hash, created_at
       FROM assurance_runs WHERE tenant_id = $1 AND packet_id = $2
       ORDER BY run_sequence DESC LIMIT 1`,
      [tenantId, packetId],
    );
    const row = result.rows[0];
    return row ? this.#mapAssurance(row) : null;
  }

  async listLatestAssurances(tenantId: string): Promise<AssuranceRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, packet_id, status, rule_version, findings,
         packet_artifact_hash, manifest_hash, created_at
       FROM (
         SELECT DISTINCT ON (packet_id)
           id, packet_id, status, rule_version, findings,
           packet_artifact_hash, manifest_hash, created_at
         FROM assurance_runs
         WHERE tenant_id = $1
         ORDER BY packet_id, run_sequence DESC
       ) AS latest
       ORDER BY created_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.#mapAssurance(row));
  }

  async listLatestAssurancesForPackets(
    tenantId: string,
    packetIds: readonly string[],
  ): Promise<AssuranceRecord[]> {
    if (packetIds.length === 0) return [];
    const result = await this.#db.query<any>(
      `SELECT id, packet_id, status, rule_version, findings,
         packet_artifact_hash, manifest_hash, created_at
       FROM (
         SELECT DISTINCT ON (packet_id)
           id, packet_id, status, rule_version, findings,
           packet_artifact_hash, manifest_hash, created_at
         FROM assurance_runs
         WHERE tenant_id = $1 AND packet_id = ANY($2::text[])
         ORDER BY packet_id, run_sequence DESC
       ) AS latest
       ORDER BY created_at DESC, id DESC`,
      [tenantId, [...packetIds]],
    );
    return result.rows.map((row) => this.#mapAssurance(row));
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
      `SELECT id, packet_id, status, rule_version, findings,
         packet_artifact_hash, manifest_hash, created_at, packet_ordinal
       FROM (
         SELECT id, packet_id, status, rule_version, findings,
                packet_artifact_hash, manifest_hash, created_at, run_sequence,
                ROW_NUMBER() OVER (PARTITION BY packet_id ORDER BY run_sequence ASC)::int AS packet_ordinal
         FROM assurance_runs WHERE tenant_id = $1 AND packet_id = $2
       ) AS history
       WHERE ($3::bigint IS NULL OR run_sequence < $3::bigint)
       ORDER BY run_sequence DESC LIMIT $4`,
      [tenantId, packetId, anchorSequence, limit + 1],
    );
    const items = result.rows.slice(0, limit).map((row) => ({
      ...this.#mapAssurance(row),
      packetOrdinal: Number(row.packet_ordinal),
    }));
    return {
      items,
      nextCursor: result.rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async listAssuranceHistory(tenantId: string): Promise<AssuranceHistoryRecord[]> {
    const result = await this.#db.query<any>(
      `SELECT id, packet_id, status, rule_version, findings,
         packet_artifact_hash, manifest_hash, created_at, packet_ordinal
       FROM (
         SELECT id, packet_id, status, rule_version, findings,
                packet_artifact_hash, manifest_hash, created_at,
                ROW_NUMBER() OVER (PARTITION BY packet_id ORDER BY run_sequence ASC)::int AS packet_ordinal
         FROM assurance_runs WHERE tenant_id = $1
       ) AS history ORDER BY created_at DESC, id DESC`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      ...this.#mapAssurance(row),
      packetOrdinal: Number(row.packet_ordinal),
    }));
  }

  async approvePacketExact(
    tenantId: string,
    packetId: string,
    assuranceId: string,
    packetArtifactHash: string,
    manifestHash: string,
  ): Promise<PacketRecord> {
    const result = await this.#db.query<any>(
      `UPDATE packets SET status = 'approved', approved_at = now(), updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status = 'assurance_passed'
         AND artifact_hash = $4 AND manifest_hash = $5
         AND EXISTS (
           SELECT 1 FROM assurance_runs
           WHERE id = $3 AND tenant_id = $1 AND packet_id = $2 AND status = 'passed'
             AND packet_artifact_hash = $4 AND manifest_hash = $5
             AND run_sequence = (
               SELECT MAX(run_sequence) FROM assurance_runs
               WHERE tenant_id = $1 AND packet_id = $2
             )
         )
       RETURNING *`,
      [tenantId, packetId, assuranceId, packetArtifactHash, manifestHash],
    );
    if (!result.rows[0]) throw new Error("PACKET_APPROVAL_STALE");
    return this.#mapPacket(result.rows[0]);
  }

  async updatePacketManifest(
    tenantId: string,
    packetId: string,
    artifactManifest: Record<string, unknown>,
  ): Promise<PacketRecord | null> {
    const result = await this.#db.query<any>(
      `UPDATE packets SET artifact_manifest = $3::jsonb, manifest_hash = $4, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status = 'draft' RETURNING *`,
      [tenantId, packetId, JSON.stringify(artifactManifest), canonicalHash(artifactManifest)],
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
    const intentHash = canonicalHash({
      packetId: input.packetId,
      provider: input.provider,
      target: input.target,
      payload: input.payload,
    });
    const result = await this.#db.query<any>(
      `INSERT INTO external_actions(
         id, tenant_id, packet_id, provider, state, target, payload, idempotency_key, intent_hash
       ) VALUES ($1,$2,$3,$4,'pending_approval',$5::jsonb,$6::jsonb,$7,$8)
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
        intentHash,
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
      intentHash:
        row.intent_hash ||
        canonicalHash({
          packetId: row.packet_id,
          provider: row.provider,
          target: row.target,
          payload: row.payload,
        }),
      approvedIntentHash: row.approved_intent_hash,
      approvedPacketHash: row.approved_packet_hash,
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
    if (to === "approved") throw new Error("EXACT_ACTION_APPROVAL_REQUIRED");
    const result = await this.#db.query<any>(
      `UPDATE external_actions SET state = $4,
        attempted_at = CASE WHEN $4 = 'executing' THEN now() ELSE attempted_at END,
        result = COALESCE($5::jsonb, result), updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND state = $3 RETURNING *`,
      [tenantId, id, from, to, resultValue ? JSON.stringify(resultValue) : null],
    );
    return result.rows[0] ? this.#mapAction(result.rows[0]) : null;
  }

  async approveExternalActionExact(tenantId: string, id: string): Promise<ExternalActionRecord> {
    return this.transaction(async (database) => {
      // Packet generation uses this same tenant lock. The packet that the
      // candidate reviewed must therefore still be current at the exact
      // approval boundary, not merely when the action draft was created.
      await database.lockTenantActive(tenantId);
      const action = await database.getExternalAction(tenantId, id);
      if (!action) throw new Error("ACTION_NOT_FOUND");
      if (!action.packetId) throw new Error("APPROVED_PACKET_REQUIRED");
      const packet = await database.getPacket(tenantId, action.packetId);
      if (packet?.status !== "approved") throw new Error("APPROVED_PACKET_REQUIRED");
      const latest = await database.getLatestPacketForApplication(tenantId, packet.applicationId);
      if (latest?.id !== packet.id) throw new Error("LATEST_APPROVED_PACKET_REQUIRED");
      const currentIntentHash = canonicalHash({
        packetId: action.packetId,
        provider: action.provider,
        target: action.target,
        payload: action.payload,
      });
      if (currentIntentHash !== action.intentHash) throw new Error("ACTION_INTENT_CHANGED");
      const result = await database.#db.query<any>(
        `UPDATE external_actions SET state = 'approved', approved_at = now(),
           approved_intent_hash = $4, approved_packet_hash = $5, updated_at = now()
         WHERE tenant_id = $1 AND id = $2 AND state = $3 AND intent_hash = $4
         RETURNING *`,
        [tenantId, id, "pending_approval", currentIntentHash, packet.artifactHash],
      );
      if (!result.rows[0]) throw new Error("INVALID_TRANSITION");
      return database.#mapAction(result.rows[0]);
    });
  }

  async markInterruptedActionsAmbiguous(): Promise<number> {
    const result = await this.#db.query<{ id: string }>(
      `UPDATE external_actions AS action
       SET state = 'ambiguous',
         result = jsonb_build_object('errorCode', 'EXECUTION_INTERRUPTED'),
         updated_at = now()
       FROM tenants
       WHERE action.tenant_id = tenants.id
         AND tenants.deletion_state = 'active'
         AND action.state = 'executing'
       RETURNING action.id`,
    );
    return result.rows.length;
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
    if (!this.#transactional) {
      return this.readSnapshot(async (database) => {
        await database.assertTenantReadable(tenantId);
        return database.exportTenant(tenantId);
      });
    }
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
      datasetEditions,
      sourceRuns,
      roleObservations,
      verificationAttempts,
      discoveryProfiles,
      roleWordingReviews,
      employerEntities,
      employerAliases,
      careerOperations,
      applicationSubmissions,
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
      this.listDatasetEditions(tenantId),
      this.listSourceRuns(tenantId),
      this.listRoleObservations(tenantId),
      this.listVerificationAttempts(tenantId),
      this.listDiscoveryProfiles(tenantId),
      this.listRoleWordingReviews(tenantId),
      this.listEmployerEntities(tenantId),
      this.listEmployerAliases(tenantId),
      this.readCareerOperations(tenantId),
      this.listApplicationSubmissions(tenantId),
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
      schemaVersion: "nimanto_export_v10",
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
      datasetEditions,
      sourceRuns,
      roleObservations,
      verificationAttempts,
      discoveryProfiles,
      roleWordingReviews,
      employerEntities,
      employerAliases,
      careerOperations,
      applicationSubmissions,
    };
  }

  async beginTenantDeletion(
    tenantId: string,
    _legacyActionIds: string[] = [],
  ): Promise<{ id: string; token: string; tenantId: string; state: string; actionIds: string[] }> {
    const id = randomUUID();
    const token = randomBytes(24).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DELETION_STATUS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const actionIds = await this.#db.transaction(async (tx) => {
      const tenant = await tx.query<{ id: string }>(
        `UPDATE tenants SET deletion_state = 'deleting'
         WHERE id = $1 AND deletion_state = 'active'
         RETURNING id`,
        [tenantId],
      );
      if (!tenant.rows[0]) throw new Error("TENANT_NOT_ACTIVE");
      const actions = await tx.query<{ id: string }>(
        "SELECT id FROM external_actions WHERE tenant_id = $1 ORDER BY id",
        [tenantId],
      );
      const capturedActionIds = actions.rows.map((action) => action.id);
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
          JSON.stringify({ actionIds: capturedActionIds }),
        ],
      );
      return capturedActionIds;
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

  async recoverableDeletionRuns(): Promise<
    Array<{ id: string; tenantId: string; state: string; actionIds: string[] }>
  > {
    const result = await this.#db.query<{
      id: string;
      tenant_id: string;
      state: string;
      cleanup_inventory: { actionIds?: unknown };
    }>(
      `SELECT id, tenant_id, state, cleanup_inventory
       FROM deletion_runs
       WHERE state IN ('running','database_deleted','cleanup_pending')
       ORDER BY requested_at, id`,
    );
    return result.rows.map((row) => {
      const values = row.cleanup_inventory.actionIds;
      return {
        id: row.id,
        tenantId: row.tenant_id,
        state: row.state,
        actionIds: Array.isArray(values)
          ? values.filter((value): value is string => typeof value === "string")
          : [],
      };
    });
  }

  /** Completed deletion rows are public status tombstones only. Keep them for
   * the complete candidate-facing token window, and never let pruning touch
   * unfinished database or filesystem cleanup. */
  async pruneCompletedDeletionRuns(now = new Date()): Promise<number> {
    const result = await this.#db.query<{ id: string }>(
      `DELETE FROM deletion_runs
       WHERE state = 'completed' AND completed_at IS NOT NULL AND expires_at <= $1
       RETURNING id`,
      [now.toISOString()],
    );
    return result.rows.length;
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
