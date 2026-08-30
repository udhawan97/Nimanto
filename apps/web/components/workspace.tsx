"use client";

import { normalizeEmployerName } from "@nimanto/domain";
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CalendarPlus,
  Check,
  CircleAlert,
  Clock3,
  Database,
  Download,
  FileCheck2,
  FileClock,
  FileOutput,
  FolderSearch2,
  LogOut,
  Link2,
  MailCheck,
  Menu,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserRoundCheck,
  X,
} from "lucide-react";
import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Brand } from "./brand.js";
import { CommandPalette, type PaletteEntry } from "./command-palette.js";
import { ConnectionBanner, ConnectionIndicator, useConnection } from "./connection.js";
import { CopyLine } from "./copy-line.js";
import { H1bEvidencePanel, type RoleWordingReview } from "./h1b-evidence.js";
import {
  RoleProvenanceCard,
  type RoleProvenanceData,
  type RoleSourcePolicy,
} from "./role-provenance.js";
import {
  BOARD_COLUMNS,
  APPLICATION_MATCH_BUCKETS,
  applicationCohortCounts,
  boardColumns,
  canMove,
  countedNoun,
  confirmationPrompt,
  failureMessage,
  filterEvidence,
  filterApplications,
  followUpNote,
  funnelStages,
  legalTargets,
  needsConfirmation,
  nextSteps,
  packetInventoryNotice,
  profileInputChanged,
  explanationFreshness,
  unscoredConfirmedClaims,
  profileVersionDiff,
  recordReviewQueue,
  recordedApplicationTimeline,
  sortApplications,
  type EvidenceFilters,
  type ApplicationStatus,
  type Section,
} from "../lib/derive.js";
import {
  emptyRoleDiscoveryFilters,
  projectRoleDiscovery,
  type DiscoveryProfileReason,
  type RoleDiscoveryFilters,
} from "../lib/role-discovery.js";
import {
  workspaceIdentityTransitions,
  type DeletionReceipt,
  type IdentityTransitionEvent,
} from "../lib/identity-transitions.js";
import {
  createWorkspaceNavigationTransitions,
  focusSectionBelowHeader,
  sectionFromHash,
  trapMobileNavigationKey,
} from "../lib/navigation-transitions.js";
import {
  createWorkbenchMutations,
  type RefreshOutcome,
  type WorkbenchMutations,
} from "../lib/workbench-mutations.js";
import { createScopedRequestGate } from "../lib/scoped-request-gate.js";
import {
  applicationsWorkbenchReducer,
  createApplicationsWorkbenchState,
  type ApplicationsWorkbench,
  type ApplicationViewState,
  type OutcomeDraft,
  type ReminderDraft,
  type ApplicationNoteDraft,
} from "../lib/applications-workbench.js";
import { buildFollowUpCalendar } from "../lib/calendar-export.js";
import { buildApplicationCsv } from "../lib/application-csv-export.js";

const API = process.env.NEXT_PUBLIC_NIMANTO_API_ORIGIN ?? "http://127.0.0.1:4310";
const API_HOST_LABEL = new URL(API).host;

/* Often enough that a candidate staring at the workbench learns the API died
 * before they try to use it; rarely enough to stay invisible on a laptop
 * battery. The probe writes `apiReachable` and nothing else. */
const HEALTH_PROBE_MS = 15_000;
/* Long enough to read a one-line confirmation without hurrying, short enough
 * that it is gone before the candidate scrolls to the thing it announced. */
const NOTICE_DISMISS_MS = 6_000;

type Evidence = {
  id: string;
  kind: string;
  value: string;
  status: string;
  confidence: string;
  sourceName: string;
  locator: string;
};
type Job = {
  id: string;
  source: string;
  sourceJobId: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode: "remote" | "hybrid" | "onsite" | "unknown" | "conflicting";
  roleFamily:
    | "ai_ml"
    | "software_technical"
    | "data_analytics"
    | "product"
    | "business_strategy_operations_solutions"
    | "other";
  workplaceEvidence: Array<{
    mode: string;
    method: string;
    sourceText: string;
    sourceFieldOrLocator: string;
    observedAt: string;
    confidence: string;
    eligibleRemoteAreas?: StructuredArea[];
    physicalLocations?: StructuredArea[];
  }>;
  requirements: string[];
  url: string;
  contentHash: string;
  updatedAt: string;
  atsRoute: {
    state: "ready" | "gated" | "unrecognized";
    provider: "greenhouse" | "lever" | "ashby" | "smartrecruiters" | null;
    boardId: string | null;
    sourceJobId: string | null;
    targetUrl: string | null;
    routeKind: "provider_source" | "recognized_url" | null;
    verificationMethod: "detail_get" | "complete_list" | null;
    verificationState: "ready" | "gated" | "unavailable";
    reason: string;
    ruleVersion: "ats_routing_v1";
  };
  availability: {
    firstSeenAt: string;
    lastSeenAt: string;
    lastVerifiedAt: string | null;
    nextVerifyAt: string | null;
    sourcePostedAt: string | null;
    sourceUpdatedAt: string | null;
    validThrough: string | null;
    missingSince: string | null;
    publicationState: "active" | "possibly_closed" | "closed" | "expired";
    verificationHealth: "verified" | "provider_reported" | "blocked" | "overdue" | "unknown";
    verificationAuthority: string;
    verificationMethod: string;
    consecutiveCompleteMisses: number;
    closedAt: string | null;
    closureReason: string | null;
  };
  cluster: { id: string; size: number; sources: string[] };
  candidateDisposition: { state: "active" | "archived"; archivedAt: string | null };
  sourceMeta: {
    board?: string;
    compensation?: { minimum?: number | null; maximum?: number | null; currency?: string } | null;
    benefits?: string[];
    interviewEvidence?: { text?: string; sourceLocator?: string; observedAt?: string } | null;
  };
  provenance: RoleProvenanceData;
};
type Match = {
  id: string;
  jobId: string;
  profileVersionId: string | null;
  ruleVersion: string;
  inputHash: string;
  artifactHash: string;
  jobContentHash: string;
  createdAt: string;
  result: {
    ruleVersion: string;
    band: string;
    coverage: string;
    dimensions: Array<{
      name: string;
      state: string;
      weightUnits: number;
      evidenceIds: string[];
    }>;
    blockers: Array<{
      code: string;
      sourceText: string;
      sourceLocator?: string;
      observedAt?: string;
      candidateConfirmed?: boolean;
    }>;
    exclusions: string[];
    requirements: Array<{
      requirement: string;
      state: string;
      evidenceIds: string[];
      reason: string;
    }>;
  };
  job: Job;
};
type ComparableRole = Job & { match: Match | null; tracked: boolean };
type Outcome = { id: string; type: string; note: string; occurredAt: string };
type ApplicationNote = { id: string; text: string; recordedAt: string };
type Application = {
  id: string;
  jobId: string;
  // Narrowed from string: the board maps status to a column and the API rejects
  // anything outside the union, so a widened type here just hides the mismatch.
  status: ApplicationStatus;
  followUpOn?: string | null;
  submittedAt?: string | null;
  // The API has always returned these; the type simply never declared them, and
  // the follow-up observation needs createdAt as its baseline.
  createdAt?: string;
  updatedAt?: string;
  job?: { title: string; company: string };
  outcomes?: Outcome[];
  notes?: ApplicationNote[];
};
type Packet = {
  id: string;
  applicationId: string;
  profileVersionId: string | null;
  status: string;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  artifactHash: string;
  canonicalContent: {
    schemaVersion?: string;
    candidateName?: string;
    destination?: { company?: string; role?: string; contactEmail?: string };
    summary?: string;
    claims?: Array<{ text: string; evidenceIds: string[] }>;
    authorizationWording?: string;
    generatedAt?: string;
  };
  artifactManifest: {
    artifacts?: Array<{ format: string; filename: string; sha256: string }>;
    documentInspection?: {
      ruleVersion: string;
      status: "passed" | "blocked";
      checks: Array<{
        code: string;
        status: "passed" | "blocked";
        format?: string;
        detail: string;
      }>;
    };
  };
  latestAssurance: {
    id: string;
    status: "passed" | "blocked";
    ruleVersion: string;
    findings: Array<{ code?: string; severity?: string; message?: string; detail?: string }>;
    createdAt: string;
  } | null;
};
type ProfileVersion = {
  id: string;
  claimIds: string[];
  authorizationWording: string;
  inputHash: string;
  createdAt: string;
};
type ProfileVersionResponse = ProfileVersion & { created: boolean };
type ManualRoleDraft = {
  title: string;
  company: string;
  location: string;
  workMode: string;
  url: string;
  description: string;
  requirements: string;
  compensationMin: string;
  compensationMax: string;
  benefits: string;
  interviewEvidence: string;
  interviewSource: string;
};
type EvidenceDraft = {
  kind: string;
  value: string;
  authorization: string;
};
type StructuredArea = {
  displayLabel: string;
  countryCode: string | null;
  subdivisionCode: string | null;
  metroId: string | null;
  timeZone: string | null;
  resolution: "confirmed" | "unknown";
};
type StructuredAreaDraft = {
  displayLabel: string;
  countryCode: string;
  subdivisionCode: string;
  metroId: string;
  timeZone: string;
  resolution: "confirmed" | "unknown";
};
type DiscoveryDraft = {
  roleFamilies: Job["roleFamily"][];
  includeTitles: string;
  excludeTitles: string;
  seniorityLevels: string;
  industries: string;
  mustHaveSkills: string;
  preferredSkills: string;
  workModes: Job["workMode"][];
  acceptedPhysicalAreas: StructuredAreaDraft[];
  eligibleRemoteAreas: StructuredAreaDraft[];
  commuteRadiusMiles: string;
  relocationPreference: "no" | "consider" | "yes";
  minimumCompensation: string;
  compensationCurrency: string;
  authorizationStatementExpiresOn: string;
  sourceIds: string[];
  freshnessDays: string;
};
type ActionDraft = {
  packetId: string;
  provider: "deep_link" | "test_outbox";
  to: string;
  subject: string;
  body: string;
};
const emptyActionDraft = (packetId: string): ActionDraft => ({
  packetId,
  provider: "deep_link",
  to: "",
  subject: "Application materials",
  body: "Please find my reviewed application materials attached separately.",
});
const sameActionDraft = (left: ActionDraft, right: ActionDraft) =>
  left.packetId === right.packetId &&
  left.provider === right.provider &&
  left.to === right.to &&
  left.subject === right.subject &&
  left.body === right.body;
const emptyEvidenceFilters = (): EvidenceFilters => ({
  query: "",
  kind: "all",
  status: "all",
  source: "all",
});
const emptyManualRoleDraft = (): ManualRoleDraft => ({
  title: "",
  company: "",
  location: "",
  workMode: "unspecified",
  url: "",
  description: "",
  requirements: "",
  compensationMin: "",
  compensationMax: "",
  benefits: "",
  interviewEvidence: "",
  interviewSource: "",
});
const sameManualRoleDraft = (left: ManualRoleDraft, right: ManualRoleDraft) =>
  (Object.keys(left) as Array<keyof ManualRoleDraft>).every(
    (field) => left[field] === right[field],
  );
type ReviewedUrlDraft = {
  url: string;
  title: string;
  company: string;
  location: string;
  workMode: string;
  requirements: string;
};
const emptyReviewedUrlDraft = (): ReviewedUrlDraft => ({
  url: "",
  title: "",
  company: "",
  location: "",
  workMode: "unspecified",
  requirements: "",
});
const sameReviewedUrlDraft = (left: ReviewedUrlDraft, right: ReviewedUrlDraft) =>
  (Object.keys(left) as Array<keyof ReviewedUrlDraft>).every(
    (field) => left[field] === right[field],
  );
type MatchHistoryRun = Omit<Match, "job"> & { currentJob: Job | null };
type AssuranceHistoryRun = NonNullable<Packet["latestAssurance"]> & {
  packetId: string;
  packetOrdinal: number;
};
type PacketHistoryRecord = Omit<Packet, "latestAssurance">;
type HistoryPage<T> = { items: T[]; nextCursor: string | null };
type Action = {
  id: string;
  packetId: string;
  provider: string;
  state: string;
  target: { to?: string };
  payload: { subject?: string; body?: string };
  result?: { providerReference?: string };
};
type Signal = {
  id: string;
  company: string;
  label: string;
  sourceType: string;
  sourceLocator: string;
  sourcePeriod: string;
  confidence: string;
  limitations: string;
  observedAt: string;
  freshness: "current" | "stale";
  originalLabel: string;
};
type Receipt = {
  schemaVersion: "receipt_v1";
  id: string;
  type: string;
  occurredAt: string;
  inputHash: string;
  artifactHash: string;
  receiptHash: string;
};
type SourceSchedule = {
  id: string;
  provider: "greenhouse" | "lever" | "ashby";
  board: string;
  cadenceMinutes: number;
  state: "queued" | "running" | "retry_wait" | "paused" | "dead_letter" | "cancelled";
  notBefore: string;
  attempts: number;
  maxAttempts: number;
  lastRunAt: string | null;
  lastResult: { imported: number; matched: number } | null;
  lastErrorCode: string | null;
};
type DiscoveryProfile = {
  id: string;
  inputHash: string;
  approvedAt: string;
  input: {
    profileVersionId: string | null;
    roleFamilies: Job["roleFamily"][];
    includeTitles: string[];
    excludeTitles: string[];
    seniorityLevels: string[];
    industries: string[];
    mustHaveSkills: string[];
    preferredSkills: string[];
    acceptedPhysicalAreas: StructuredArea[];
    commuteRadiusMiles: number | null;
    relocationPreference: "no" | "consider" | "yes";
    workModes: Job["workMode"][];
    eligibleRemoteAreas: StructuredArea[];
    minimumCompensation: { amount: number; currency: string } | null;
    currentPostingSponsorshipFilter: "show_all" | "hide_confirmed_exact_conflicts_from_recommended";
    authorizationStatementVersionId: string | null;
    authorizationStatementExpiresAt: string | null;
    freshnessMaximumHours: number;
    sourceIds: string[];
    matcherVersion: "scoring_rules_v1";
    normalizerVersion: "discovery_profile_v1";
  };
};
type SourceRun = NonNullable<RoleProvenanceData["sourceRun"]>;
type SourceRegistryEntry = RoleSourcePolicy & {
  id: string;
  state: string;
  executionEnabled: boolean;
  supportsCompleteSnapshot: boolean;
};
type Dashboard = {
  identity: {
    userId: string;
    tenantId: string;
    sessionId: string;
    displayName: string;
    email: string;
  };
  profile: ProfileVersion | null;
  evidence: Evidence[];
  jobs: Job[];
  matches: Match[];
  h1bSignals: Signal[];
  roleWordingReviews: RoleWordingReview[];
  applications: Application[];
  packets: Packet[];
  actionPackets: Packet[];
  externalActions: Action[];
  receipts: Receipt[];
  schedules: SourceSchedule[];
  discoveryProfile: DiscoveryProfile | null;
  sourceRuns: SourceRun[];
  sourceRegistry: SourceRegistryEntry[];
  personalFunnel: {
    sampleSize: number;
    replies: number;
    screens: number;
    interviews: number;
    offers: number;
    scope: string;
  };
  runtime: { externalActionsEnabled: boolean };
};
type RuntimeMeta = {
  providers: {
    reviewedUrlIntake: boolean;
    reviewedUrlTermsAt: string | null;
    reviewedUrlHosts: string[];
  };
};
type ActionRunner = WorkbenchMutations;
type EvidenceImportPreview = {
  filename: string;
  mimeType: string;
  contentBase64: string;
  claimCount: number;
  // What the file parsed to, before the import limit. Only differs when a file
  // is large enough for the cap to bite, and the candidate is told when it does.
  parsedCount: number;
  claims: Array<{ kind: string; value: string; sourceName: string; locator: string }>;
  warnings: string[];
  preview: {
    acceptedFiles: string[];
    ignoredFiles: string[];
    acceptedFields: Array<{ file: string; fields: string[] }>;
  } | null;
  previewHash: string;
};

class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/* The HttpOnly cookie is shared by sibling tabs, while this session generation
 * is not. Authenticated writes carry the generation that rendered this tab. */
let expectedSessionId: string | null = null;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  if (
    expectedSessionId &&
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    !path.startsWith("/v1/auth/") &&
    path !== "/v1/deletion/resume"
  ) {
    headers.set("x-nimanto-expected-session-id", expectedSessionId);
  }
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new ApiError(
      payload.error?.code ?? `HTTP_${response.status}`,
      payload.error?.message ?? "Nimanto could not complete that request.",
    );
  }
  return response.json() as Promise<T>;
}

function human(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

const discoveryReasonLabels: Record<DiscoveryProfileReason["code"], string> = {
  role_family: "Role family",
  include_title: "Included title",
  exclude_title: "Excluded title",
  seniority: "Seniority",
  industry: "Industry",
  must_have_skill: "Required skill",
  preferred_skill: "Preferred skill",
  area: "Area",
  commute_radius: "Commute radius",
  relocation: "Relocation",
  work_mode: "Work mode",
  minimum_compensation: "Minimum compensation",
  freshness: "Observation age",
  source: "Source",
  authorization_expiry: "Authorization review",
};

function dateInputValue(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? "";
}

const emptyStructuredAreaDraft = (): StructuredAreaDraft => ({
  displayLabel: "",
  countryCode: "",
  subdivisionCode: "",
  metroId: "",
  timeZone: "",
  resolution: "unknown",
});

function structuredAreaDraft(area: StructuredArea): StructuredAreaDraft {
  return {
    displayLabel: area.displayLabel,
    countryCode: area.countryCode ?? "",
    subdivisionCode: area.subdivisionCode ?? "",
    metroId: area.metroId ?? "",
    timeZone: area.timeZone ?? "",
    resolution: area.resolution,
  };
}

function StructuredAreaEditor({
  kind,
  areas,
  onChange,
}: {
  kind: "Physical" | "Remote";
  areas: StructuredAreaDraft[];
  onChange: (areas: StructuredAreaDraft[]) => void;
}) {
  const update = (
    index: number,
    field: keyof StructuredAreaDraft,
    value: StructuredAreaDraft[keyof StructuredAreaDraft],
  ) =>
    onChange(
      areas.map((area, areaIndex) =>
        areaIndex === index
          ? {
              ...area,
              [field]: value,
              ...(field === "resolution" ? {} : { resolution: "unknown" as const }),
            }
          : area,
      ),
    );

  return (
    <fieldset className="structured-area-editor">
      <legend>{kind === "Physical" ? "Accepted physical areas" : "Remote-eligible areas"}</legend>
      <p className="field-note">
        Keep each stable country, subdivision, metro, and timezone identity. New or edited areas
        stay unresolved; confirm the exact structured area again before saving identifiers.
      </p>
      {areas.map((area, index) => (
        <div className="structured-area-row" key={`${kind}-${index}`}>
          <div className="structured-area-heading">
            <strong>
              {kind} area {index + 1}
            </strong>
            <span className={`state ${area.resolution === "confirmed" ? "supported" : "warning"}`}>
              {area.resolution === "confirmed" ? "Confirmed" : "Needs confirmation"}
            </span>
            <button
              type="button"
              className="button mini quiet"
              onClick={() => onChange(areas.filter((_, areaIndex) => areaIndex !== index))}
            >
              Remove
            </button>
          </div>
          <div className="field-grid structured-area-fields">
            <label>
              {kind} area {index + 1} label
              <input
                required
                value={area.displayLabel}
                placeholder={kind === "Physical" ? "Chicago, IL" : "United States"}
                onChange={(event) => update(index, "displayLabel", event.target.value)}
              />
            </label>
            <label>
              {kind} area {index + 1} country code
              <input
                value={area.countryCode}
                maxLength={2}
                pattern="[A-Za-z]{2}"
                placeholder="US"
                onChange={(event) => update(index, "countryCode", event.target.value)}
              />
            </label>
            <label>
              {kind} area {index + 1} subdivision code
              <input
                value={area.subdivisionCode}
                placeholder="US-IL"
                onChange={(event) => update(index, "subdivisionCode", event.target.value)}
              />
            </label>
            <label>
              {kind} area {index + 1} metro ID
              <input
                value={area.metroId}
                placeholder="reviewed-chicago"
                onChange={(event) => update(index, "metroId", event.target.value)}
              />
            </label>
            <label>
              {kind} area {index + 1} timezone
              <input
                value={area.timeZone}
                placeholder="America/Chicago"
                onChange={(event) => update(index, "timeZone", event.target.value)}
              />
            </label>
            <label>
              {kind} area {index + 1} confirmation
              <select
                value={area.resolution}
                onChange={(event) =>
                  update(
                    index,
                    "resolution",
                    event.target.value as StructuredAreaDraft["resolution"],
                  )
                }
              >
                <option value="unknown">Needs canonical confirmation</option>
                <option value="confirmed">Confirmed exact structured area</option>
              </select>
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="button mini quiet"
        disabled={areas.length >= 20}
        onClick={() => onChange([...areas, emptyStructuredAreaDraft()])}
      >
        <Plus size={14} /> Add {kind.toLocaleLowerCase("en-US")} area
      </button>
    </fieldset>
  );
}

function cadenceLabel(minutes: number): string {
  if (minutes === 60) return "Every hour";
  if (minutes < 1_440) return `Every ${minutes / 60} hours`;
  if (minutes === 1_440) return "Every day";
  if (minutes === 10_080) return "Every week";
  return `Every ${minutes / 1_440} days`;
}

function localDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function postingVerificationLabel(job: Job): string {
  const availability = job.availability;
  if (availability.publicationState === "possibly_closed") {
    return `Possibly closed · missing from one complete source run since ${localDateTime(availability.missingSince ?? availability.lastSeenAt)}`;
  }
  if (availability.publicationState === "closed") {
    return `Closed after two complete source runs · ${localDateTime(availability.closedAt ?? availability.lastSeenAt)}`;
  }
  if (availability.publicationState === "expired") {
    return `Expired by source valid-through date · ${localDateTime(availability.validThrough ?? availability.lastSeenAt)}`;
  }
  if (availability.lastVerifiedAt) {
    return `${human(availability.verificationMethod)} verification · ${localDateTime(availability.lastVerifiedAt)}${availability.verificationHealth === "overdue" ? " · recheck overdue" : ""}`;
  }
  return `Observed ${localDateTime(availability.lastSeenAt)} · not source-verified`;
}

function atsRouteGateLabel(job: Job): string {
  if (job.atsRoute.reason === "origin_source_rights_required") {
    return "Original source retained · canonical-link rights are not approved.";
  }
  return `${human(job.atsRoute.provider ?? "ATS")} link recognized · deep-link rights gate closed.`;
}

function packetCanonicalDelta(before: PacketHistoryRecord, after: PacketHistoryRecord): string[] {
  const fields: Array<keyof Packet["canonicalContent"]> = [
    "schemaVersion",
    "candidateName",
    "destination",
    "summary",
    "claims",
    "authorizationWording",
    "generatedAt",
  ];
  return fields.filter(
    (field) =>
      JSON.stringify(before.canonicalContent[field]) !==
      JSON.stringify(after.canonicalContent[field]),
  );
}

function packetManifestDelta(before: PacketHistoryRecord, after: PacketHistoryRecord): string[] {
  const beforeArtifacts = new Map(
    (before.artifactManifest.artifacts ?? []).map((artifact) => [
      artifact.format + ":" + artifact.filename,
      artifact.sha256,
    ]),
  );
  const afterArtifacts = new Map(
    (after.artifactManifest.artifacts ?? []).map((artifact) => [
      artifact.format + ":" + artifact.filename,
      artifact.sha256,
    ]),
  );
  const keys = [...new Set([...beforeArtifacts.keys(), ...afterArtifacts.keys()])].toSorted();
  const changes = keys.flatMap((key) => {
    if (!beforeArtifacts.has(key)) return ["Added " + key];
    if (!afterArtifacts.has(key)) return ["Removed " + key];
    if (beforeArtifacts.get(key) !== afterArtifacts.get(key)) return ["Changed " + key];
    return [];
  });
  if (
    JSON.stringify(before.artifactManifest.documentInspection) !==
    JSON.stringify(after.artifactManifest.documentInspection)
  ) {
    changes.push("Changed document inspection");
  }
  return changes;
}

function localDayInstant(value: string, offsetDays = 0): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day! + offsetDays).toISOString();
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function downloadTextFile(content: string, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const navigation: Array<{ id: Section; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "evidence", label: "Evidence vault", icon: FolderSearch2 },
  { id: "jobs", label: "Role discovery", icon: BriefcaseBusiness },
  { id: "applications", label: "Applications", icon: UserRoundCheck },
  { id: "packets", label: "Review packets", icon: FileOutput },
  { id: "history", label: "Stored history", icon: FileClock },
  { id: "actions", label: "Approved actions", icon: Send },
  { id: "activity", label: "Local activity", icon: FileClock },
  { id: "data", label: "Data controls", icon: Database },
];

export function Workspace() {
  const [section, setSection] = useState<Section>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [runtimeMeta, setRuntimeMeta] = useState<RuntimeMeta | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
    transient?: boolean;
  } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [apiReachable, setApiReachable] = useState(true);
  // Declared with the other hooks: the component returns early for the auth and
  // loading states, so a hook below those returns changes the hook count
  // between renders.
  const connection = useConnection(apiReachable);
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  // Section routing may not touch the hash until the credential handshake below
  // has scrubbed it, or a secret freezes into the back stack.
  const [routeReady, setRouteReady] = useState(false);
  // Carries role wording as visible context beside the candidate's draft. It
  // must never become evidence or replace candidate-authored text.
  const [evidenceContext, setEvidenceContext] = useState<string | null>(null);
  const clearEvidenceContext = useCallback(() => setEvidenceContext(null), []);
  // A manual role can be long. Keep it above the section boundary so navigation
  // cannot erase it, but never persist it or carry it into another identity.
  const [manualRoleDraft, setManualRoleDraft] = useState<ManualRoleDraft | null>(null);
  const [reviewedUrlDraft, setReviewedUrlDraft] = useState<ReviewedUrlDraft | null>(null);
  const commitManualRoleDraft = useCallback((submitted: ManualRoleDraft) => {
    setManualRoleDraft((current) =>
      current && sameManualRoleDraft(current, submitted) ? null : current,
    );
  }, []);
  /* Exact evidence and authorization wording are candidate work, just like the
   * manual role draft below. Keep them above the section boundary so ordinary
   * navigation cannot erase them; identity transitions still clear them and
   * nothing is written to browser storage. */
  const [evidenceDraft, setEvidenceDraft] = useState<EvidenceDraft | null>(null);
  const [evidenceFilters, setEvidenceFilters] = useState<EvidenceFilters>(emptyEvidenceFilters);
  const [roleFilters, setRoleFilters] = useState<RoleDiscoveryFilters>(emptyRoleDiscoveryFilters);
  const [comparisonRoleIds, setComparisonRoleIds] = useState<string[]>([]);
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null);
  const [applicationsWorkbenchState, dispatchApplicationsWorkbench] = useReducer(
    applicationsWorkbenchReducer,
    undefined,
    () => createApplicationsWorkbenchState(),
  );
  const commitActionDraft = useCallback((submitted: ActionDraft) => {
    setActionDraft((current) => (current && sameActionDraft(current, submitted) ? null : current));
  }, []);
  /* Cookies are shared between tabs. A second tab can replace the authenticated
   * workspace while this one still has candidate-authored drafts in memory, so
   * dashboard replacement needs a stable identity fence of its own. */
  const dashboardIdentity = useRef<string | null>(null);
  const [identityEpoch, setIdentityEpoch] = useState(0);
  // Held here, not in Data controls: deleting the workspace clears the session,
  // so that panel unmounts before the candidate could copy the token.
  const [deletionReceipt, setDeletionReceipt] = useState<DeletionReceipt | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigationPanel = useRef<HTMLElement>(null);
  const closeNavigationButton = useRef<HTMLButtonElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const workspaceHeader = useRef<HTMLElement>(null);
  const workspaceMain = useRef<HTMLElement>(null);
  const noticeRegion = useRef<HTMLDivElement>(null);
  const focusNoticeOnRender = useRef(false);
  const contentHeading = useRef<HTMLDivElement>(null);
  /* The control that started the current mutation. It is about to be disabled
   * for the duration, which is what drops focus to <body>. */
  const focusOrigin = useRef<HTMLElement | null>(null);

  const focusSectionContent = useCallback(() => {
    focusSectionBelowHeader({
      target: contentHeading.current,
      header: workspaceHeader.current,
      root: document.documentElement,
      scrollY: window.scrollY,
      scrollTo: (top) => window.scrollTo(0, top),
      scrollBy: (delta) => window.scrollBy(0, delta),
      schedule: (work) => window.requestAnimationFrame(work),
    });
  }, []);

  const navigationTransitions = useMemo(
    () =>
      createWorkspaceNavigationTransitions({
        routeReady: () => routeReady,
        currentHash: () => window.location.hash,
        writeHash: (hash) => {
          window.location.hash = hash;
        },
        setSection,
        clearNotice: () => setNotice(null),
        setMobileOpen: setMobileNav,
        schedule: (work) => window.requestAnimationFrame(work),
        focusSection: focusSectionContent,
        focusMenu: () => menuButton.current?.focus(),
        focusNotice: () => noticeRegion.current?.focus({ preventScroll: true }),
      }),
    [focusSectionContent, routeReady],
  );

  /* Consume the hash, then scrub it — in that order, and never one without the
   * other. A credential can arrive on load or long after it, by pasting an
   * invitation link into a tab that already has the workbench open, so both
   * entry points run this. Scrubbing without consuming would wipe the token out
   * of the address bar and the back stack before anything read it, leaving the
   * candidate with an invitation they can no longer accept. */
  const readHash = useCallback(() => {
    try {
      const disposition = workspaceIdentityTransitions.consumeLocation({
        hash: window.location.hash,
        rememberBootstrap: (value) => window.sessionStorage.setItem("nimanto_bootstrap", value),
        scrub: () =>
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          ),
      });
      if (disposition.kind === "invite") setInviteToken(disposition.token);
      if (disposition.kind === "bootstrap") setBootstrapSecret(disposition.secret);
      if (disposition.kind === "route") {
        const opened = sectionFromHash(disposition.hash);
        if (opened) setSection(opened);
      }
      return disposition;
    } catch {
      setNotice({
        kind: "error",
        text: "Nimanto could not safely consume the private workspace link. Open a fresh local launch link.",
      });
      return { kind: "blocked" } as const;
    }
  }, []);

  useEffect(() => {
    setBootstrapSecret(window.sessionStorage.getItem("nimanto_bootstrap") ?? "");
    const disposition = readHash();
    setRouteReady(disposition.kind !== "blocked");
  }, [readHash]);

  /* Back, forward and a pasted link all arrive here. Without it the section
   * lived only in React state, so Back left the workbench entirely and a reload
   * always dropped the candidate back on Overview. */
  useEffect(() => {
    if (!routeReady) return;
    const onHashChange = () => {
      const disposition = readHash();
      // Identity gets first refusal. A consumed or discarded credential is not
      // a navigation event and must leave the current section alone.
      if (disposition.kind !== "route" && disposition.kind !== "empty") return;
      navigationTransitions.restore(window.location.hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [navigationTransitions, readHash, routeReady]);

  const applyIdentityTransition = useCallback((event: IdentityTransitionEvent) => {
    const plan = workspaceIdentityTransitions.plan(event);
    if (plan.clearCredentials) {
      window.sessionStorage.removeItem("nimanto_bootstrap");
      setBootstrapSecret("");
      setInviteToken("");
    }
    if (plan.clearDrafts) {
      setManualRoleDraft(null);
      setReviewedUrlDraft(null);
      setEvidenceContext(null);
      setEvidenceDraft(null);
      setEvidenceFilters(emptyEvidenceFilters());
      setRoleFilters(emptyRoleDiscoveryFilters());
      setComparisonRoleIds([]);
      setActionDraft(null);
      dispatchApplicationsWorkbench({ type: "reset" });
      // Remount the active section too: import previews and other child-local
      // state are identity-scoped even though they are not durable drafts.
      setIdentityEpoch((epoch) => epoch + 1);
    }
    if (plan.closeMobileNavigation) setMobileNav(false);
    if (plan.clearDashboard) {
      dashboardIdentity.current = null;
      expectedSessionId = null;
      setDashboard(null);
    }
    if (plan.requireAuthentication) setAuthRequired(true);
    if (plan.receipt === "retire_completed") {
      setDeletionReceipt((receipt) => (receipt?.state === "completed" ? null : receipt));
    } else if (plan.receipt) {
      setDeletionReceipt(plan.receipt);
    }
  }, []);

  /* Opening a workspace retires a *finished* deletion receipt. Signing out does
   * not reload the page, so without this the next visit to the sign-in screen
   * would re-announce "Workspace deleted" and a spent token over a workspace
   * that now exists. A cleanup_pending receipt is kept: its token is the only
   * handle on an unfinished cleanup, and nothing else in the app holds it. */
  const startFresh = useCallback(() => {
    applyIdentityTransition("workspace_opened");
  }, [applyIdentityTransition]);

  const closeMobileNavigation = useCallback(() => {
    navigationTransitions.closeMobile();
  }, [navigationTransitions]);

  useEffect(() => {
    if (!mobileNav) return;
    closeNavigationButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      trapMobileNavigationKey(event, {
        panel: navigationPanel.current,
        close: closeMobileNavigation,
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMobileNavigation, mobileNav]);

  useEffect(() => {
    const narrowViewport = window.matchMedia("(max-width: 880px)");
    const closeAtDesktopWidth = () => {
      if (!narrowViewport.matches) navigationTransitions.closeForDesktop();
    };
    narrowViewport.addEventListener("change", closeAtDesktopWidth);
    return () => narrowViewport.removeEventListener("change", closeAtDesktopWidth);
  }, [navigationTransitions]);

  useEffect(() => {
    const header = workspaceHeader.current;
    const main = workspaceMain.current;
    if (!header || !main) return;
    const recordHeaderHeight = () => {
      main.style.setProperty(
        "--workspace-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    };
    const observer = new ResizeObserver(recordHeaderHeight);
    observer.observe(header);
    recordHeaderHeight();
    return () => observer.disconnect();
  }, [dashboard?.identity.email]);

  useEffect(() => {
    if (notice?.kind !== "error" || !focusNoticeOnRender.current) return;
    focusNoticeOnRender.current = false;
    navigationTransitions.presentGlobalError();
  }, [navigationTransitions, notice]);

  /* Retire a transient confirmation once it has been read, so it stops riding
   * the scroll over the content it announced.
   *
   * Three guards, each load-bearing:
   *  - only `transient` notices, so instructions the candidate must act on stay;
   *  - only while a dashboard exists. This is no longer about screen selection —
   *    a notice cannot change which screen renders any more. It is that the entry
   *    screens carry their notice as their only explanation of what just happened,
   *    and nothing there is transient anyway, so retiring one could only ever
   *    remove information;
   *  - never while it holds focus, which would drop focus to <body>. A notice
   *    focused at the deadline is kept for good rather than rescheduled: the
   *    candidate is reading it, and a notice that vanishes from under the cursor
   *    is worse than one that outstays. */
  useEffect(() => {
    if (!notice?.transient || !dashboard) return;
    const timer = window.setTimeout(() => {
      if (noticeRegion.current?.contains(document.activeElement)) return;
      setNotice((current) => (current?.transient ? null : current));
    }, NOTICE_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [dashboard, notice]);

  /* The API returns a precise `code` behind a deliberately generic message.
   * Only the client knows which screen the candidate is on, so this is where a
   * rejection becomes something to act on — and where a raw `TypeError` is
   * swallowed, because the connection banner already explains that failure
   * better than "Failed to fetch" ever could. */
  const describeFailure = useCallback(
    (error: unknown): string | null =>
      failureMessage({
        code: error instanceof ApiError ? error.code : null,
        message: error instanceof Error ? error.message : null,
        transport: error instanceof TypeError,
      }),
    [],
  );

  const enterSignedOutState = useCallback(() => {
    // An expired or revoked session is an identity transition even when it is
    // discovered by an action rather than a dashboard refresh. Nothing drafted
    // for the previous candidate may survive into the next session.
    applyIdentityTransition("session_lost");
  }, [applyIdentityTransition]);

  const requireAuthentication = useCallback(() => {
    // An incoming bootstrap or invitation is not a credential from a lost
    // identity. Preserve it through the initial unauthenticated status check;
    // workspace_opened retires it immediately after a successful handshake.
    applyIdentityTransition("authentication_required");
  }, [applyIdentityTransition]);

  const refresh = useCallback(async (): Promise<RefreshOutcome> => {
    try {
      const status = await api<{ authenticated: boolean }>("/v1/auth/status");
      setApiReachable(true);
      if (!status.authenticated) {
        requireAuthentication();
        return "signed_out";
      }
      const [value, meta] = await Promise.all([
        api<Dashboard>("/v1/dashboard"),
        api<RuntimeMeta>("/v1/meta"),
      ]);
      const incomingIdentity = value.identity.sessionId;
      if (dashboardIdentity.current && dashboardIdentity.current !== incomingIdentity) {
        // A sibling tab rotated the shared authenticated cookie. Clear every
        // identity-bound draft before the replacement dashboard is rendered.
        applyIdentityTransition("identity_changed");
      }
      dashboardIdentity.current = incomingIdentity;
      expectedSessionId = incomingIdentity;
      setDashboard(value);
      setRuntimeMeta(meta);
      setAuthRequired(false);
      return "ready";
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTHENTICATION_REQUIRED") {
        // The API answered, it just refused. That is a reachable service.
        setApiReachable(true);
        requireAuthentication();
        return "signed_out";
      } else {
        // A transport failure means the local half is not answering at all.
        setApiReachable(!(error instanceof TypeError));
        const text = describeFailure(error);
        if (text) setNotice({ kind: "error", text });
        return error instanceof TypeError ? "unreachable" : "failed";
      }
    }
  }, [applyIdentityTransition, describeFailure, requireAuthentication]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* `apiReachable` used to change only when the candidate did something, so the
   * indicator kept reporting "connected" indefinitely after the API stopped.
   * This is deliberately not `refresh()` on a timer: that reloads the whole
   * workspace and would clobber in-flight edits. */
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const response = await fetch(`${API}/health`, { cache: "no-store" });
        if (!cancelled) setApiReachable(response.ok);
      } catch {
        if (!cancelled) setApiReachable(false);
      }
    };
    const timer = window.setInterval(() => void probe(), HEALTH_PROBE_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void probe();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const mutations = useMemo(
    () =>
      createWorkbenchMutations({
        setBusy,
        captureFocus: () => {
          const active = document.activeElement;
          focusOrigin.current =
            active instanceof HTMLElement && active !== document.body ? active : null;
        },
        /* Only when nothing else has claimed focus. A control that survived the
         * commit takes focus back; one the commit replaced — Track becoming
         * Tracked, Generate becoming Generate new — falls back to the section
         * container the product already focuses on navigation, because the
         * alternative is <body> and a walk back through the whole sidebar. */
        restoreFocus: () => {
          const target = focusOrigin.current;
          focusOrigin.current = null;
          if (document.activeElement !== document.body) return;
          if (target?.isConnected && !target.matches(":disabled")) {
            target.focus();
            return;
          }
          contentHeading.current?.focus({ preventScroll: true });
        },
        clearNotice: () => setNotice(null),
        setNoticeFocus: (focus) => {
          focusNoticeOnRender.current = focus;
        },
        setReachable: setApiReachable,
        enterSignedOutState,
        refresh,
        describeFailure,
        publishNotice: (kind, text, transient) =>
          setNotice({ kind, text, transient: transient === true }),
        schedule: navigationTransitions.scheduleFocus,
      }),
    [describeFailure, enterSignedOutState, navigationTransitions, refresh],
  );

  /* `notice` is a message, never a screen selector. It used to sit in this
   * predicate, so clearing it — which three modules do as routine cleanup —
   * silently swapped which screen rendered: the button kept its pixels and
   * changed what it did, POSTing an identity where it had re-read the
   * dashboard. The screen now depends only on whether identity is required and
   * whether a dashboard exists, so the two branches below are distinct
   * surfaces rather than one surface with two behaviours. */
  if (authRequired) {
    return (
      <WorkspaceStart
        unavailable={false}
        onStart={(identity) => {
          void mutations.run({
            request: () =>
              inviteToken
                ? api("/v1/auth/invitations/accept", {
                    method: "POST",
                    body: JSON.stringify({ ...identity, token: inviteToken }),
                  })
                : api("/v1/auth/local", {
                    method: "POST",
                    body: JSON.stringify(identity),
                    headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
                  }),
            success: "Your private beta workspace is ready.",
            commit: startFresh,
          });
        }}
        onDemo={() => {
          void mutations.run({
            request: () =>
              api("/v1/auth/demo", {
                method: "POST",
                body: "{}",
                headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
              }),
            success: "The synthetic Priya Shah workspace is ready.",
            commit: startFresh,
          });
        }}
        bootstrapSecret={bootstrapSecret}
        inviteMode={Boolean(inviteToken)}
        onBootstrapSecret={setBootstrapSecret}
        busy={busy}
        notice={notice}
        deletionReceipt={deletionReceipt}
      />
    );
  }
  if (!dashboard)
    return (
      <WorkspaceStart
        unavailable
        onStart={() => void refresh()}
        onDemo={() => void refresh()}
        busy={busy}
        notice={notice}
        bootstrapSecret={bootstrapSecret}
        inviteMode={false}
        onBootstrapSecret={setBootstrapSecret}
        deletionReceipt={deletionReceipt}
      />
    );

  const selected = navigation.find((item) => item.id === section)!;
  /* One door for every section change: clears the previous screen's message so
   * it cannot follow the candidate somewhere it no longer describes, writes the
   * section to the hash so Back and reload work, and moves focus to the new
   * heading so a keyboard or screen-reader user is told where they landed. */
  const goToSection = (id: string) => {
    navigationTransitions.go(id as Section);
  };
  // Sections plus whatever the candidate is actually working on. Every entry is
  // a destination; none can carry an action.
  const paletteEntries: PaletteEntry[] = [
    ...navigation.map((item) => ({
      label: item.label,
      detail: "Section",
      section: item.id,
    })),
    /* Build from the whole list. Slicing here meant the search filtered an
     * already-truncated array, so the 21st role or application could not be
     * found by typing its exact title — and both lists are ordered by most
     * recently touched, so what fell off the end was the stalest work, which is
     * exactly what the candidate loses track of. The palette caps what it
     * *renders* instead. Applications have no other search surface. */
    ...dashboard.jobs.map((job) => ({
      label: `${job.title} · ${job.company}`,
      detail: "Role",
      section: "jobs",
    })),
    /* A job-less application would only contribute a raw identifier, which is
     * not something a candidate can search for. */
    ...dashboard.applications
      .filter((application) => application.job)
      .map((application) => ({
        label: `${application.job!.title} · ${application.job!.company}`,
        detail: "Application",
        section: "applications",
      })),
  ];

  return (
    <div className="workspace-shell" data-nav={mobileNav ? "open" : "closed"}>
      <aside
        ref={navigationPanel}
        id="workspace-navigation"
        className={mobileNav ? "workspace-sidebar is-open" : "workspace-sidebar"}
        role={mobileNav ? "dialog" : undefined}
        aria-modal={mobileNav ? true : undefined}
        aria-label={mobileNav ? "Workspace navigation" : undefined}
      >
        <div className="workspace-brand">
          <a href="../">
            <Brand />
          </a>
          <button
            ref={closeNavigationButton}
            className="icon-button mobile-close"
            type="button"
            onClick={closeMobileNavigation}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <p className="workspace-label">
          Private workbench
          <span className="workspace-principles">
            <span>Evidence</span>
            <i aria-hidden="true" />
            <span>Decision</span>
            <span>Approval</span>
          </span>
        </p>
        <nav aria-label="Workbench">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={
                  section === item.id ? "workspace-nav-item is-active" : "workspace-nav-item"
                }
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => goToSection(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          {/* The palette trigger lives here rather than in the header: the header
           * runs a hand-rolled Tab interception for the mobile menu, and adding a
           * control between those two buttons would strand it or break the focus
           * order. Cmd/Ctrl-K reaches it from anywhere regardless. */}
          <CommandPalette entries={paletteEntries} onNavigate={goToSection} label="Jump to" />
          <ConnectionIndicator state={connection} />
          <button
            type="button"
            className="workspace-nav-item"
            onClick={() => {
              void mutations.run({
                request: () => api("/v1/session", { method: "DELETE" }),
                success: "Signed out.",
                commit: () => applyIdentityTransition("signed_out"),
              });
            }}
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-scrim"
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          aria-label="Close navigation"
          onClick={closeMobileNavigation}
        />
      )}

      <main
        ref={workspaceMain}
        id="main"
        className="workspace-main"
        inert={mobileNav ? true : undefined}
      >
        <header className="workspace-header" ref={workspaceHeader}>
          <button
            ref={menuButton}
            className="icon-button menu-button"
            type="button"
            onClick={navigationTransitions.openMobile}
            onKeyDown={(event) => {
              if (event.key === "Tab" && !event.shiftKey && !mobileNav && !busy) {
                event.preventDefault();
                refreshButton.current?.focus();
              }
            }}
            aria-label="Open navigation"
            aria-controls="workspace-navigation"
            aria-expanded={mobileNav}
          >
            <Menu />
          </button>
          <div>
            <p id="workspace-section-name">{selected.label}</p>
            <span>{dashboard.identity.email}</span>
          </div>
          <button
            ref={refreshButton}
            className="button mini quiet"
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </header>
        <ConnectionBanner state={connection} onRetry={() => void refresh()} />
        {/* The container stays mounted whether or not there is a message.
         * Rendering it conditionally made it a positional sibling of the
         * section below, so retiring a notice shifted the sibling list and
         * React remounted the open section — discarding whatever the candidate
         * had typed into it. A stable element keeps reconciliation boring.
         *
         * A failure announced politely waits behind whatever the screen reader
         * is already saying. The sign-in screen already made this distinction;
         * the workbench did not.
         *
         * Two regions rather than one that changes `role`: assistive technology
         * registers a live region's politeness when the element enters the tree,
         * so flipping status/alert on a mounted node is unreliably honoured —
         * which would lose exactly the urgency this distinction buys. Each
         * politeness gets its own stable element and the message goes to the
         * matching one. */}
        {/* No `hidden`: an element hidden until its message arrives is not in the
         * accessibility tree beforehand, which is the whole reason for keeping
         * these stable. Empty, they carry no rule and so occupy nothing.
         *
         * The ref follows the live region rather than sitting on a wrapper. A
         * wrapper would need `display: contents` to keep `.notice` sticky against
         * the main column — and an element with `display: contents` generates no
         * box, so it cannot take focus at all. That silently killed
         * `focusNotice`, which is how a keyboard user reaches a failed mutation's
         * message. With the ref here it targets a real box, and it is null while
         * there is nothing to read, so both callers correctly do nothing. */}
        {(["ok", "error"] as const).map((kind) => (
          <div
            key={kind}
            ref={notice?.kind === kind ? noticeRegion : null}
            tabIndex={notice?.kind === kind ? -1 : undefined}
            className={notice?.kind === kind ? `notice ${kind}` : "notice-empty"}
            role={kind === "error" ? "alert" : "status"}
            aria-live={kind === "error" ? "assertive" : "polite"}
          >
            {notice?.kind === kind && (
              <>
                {kind === "ok" ? <Check size={17} /> : <CircleAlert size={17} />}
                <span>{notice.text}</span>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setNotice(null)}
                  aria-label="Dismiss message"
                >
                  <X size={15} />
                </button>
              </>
            )}
          </div>
        ))}
        {/* Focus target for every section change. Without it, choosing a
         * destination — from the sidebar or from quick navigation — dropped
         * focus to <body> and a keyboard user restarted from the top. */}
        <div
          key={identityEpoch}
          className="workspace-content"
          ref={contentHeading}
          tabIndex={-1}
          aria-labelledby="workspace-section-name"
        >
          {section === "overview" && (
            <Overview dashboard={dashboard} onGo={goToSection} onAct={mutations} busy={busy} />
          )}
          {section === "evidence" && (
            <EvidenceVault
              dashboard={dashboard}
              onAct={mutations}
              busy={busy}
              draft={
                evidenceDraft ?? {
                  kind: "skill",
                  value: "",
                  authorization: dashboard.profile?.authorizationWording ?? "",
                }
              }
              onDraftChange={setEvidenceDraft}
              onClaimCommitted={(submitted) =>
                setEvidenceDraft((current) =>
                  current?.kind === submitted.kind &&
                  current.value === submitted.value &&
                  current.authorization === submitted.authorization
                    ? { ...current, value: "" }
                    : current,
                )
              }
              roleRequirement={evidenceContext}
              onDismissRoleRequirement={clearEvidenceContext}
              filters={evidenceFilters}
              onFiltersChange={setEvidenceFilters}
            />
          )}
          {section === "jobs" && (
            <Jobs
              dashboard={dashboard}
              onAct={mutations}
              busy={busy}
              draft={manualRoleDraft}
              onDraftOpen={() => setManualRoleDraft((value) => value ?? emptyManualRoleDraft())}
              onDraftChange={setManualRoleDraft}
              onDraftClose={() => setManualRoleDraft(null)}
              onDraftCommitted={commitManualRoleDraft}
              filters={roleFilters}
              onFiltersChange={setRoleFilters}
              comparisonRoleIds={comparisonRoleIds}
              onComparisonRoleIdsChange={setComparisonRoleIds}
              reviewedUrlEnabled={runtimeMeta?.providers.reviewedUrlIntake === true}
              reviewedUrlTermsAt={runtimeMeta?.providers.reviewedUrlTermsAt ?? null}
              reviewedUrlHosts={runtimeMeta?.providers.reviewedUrlHosts ?? []}
              reviewedUrlDraft={reviewedUrlDraft}
              onReviewedUrlDraftOpen={() =>
                setReviewedUrlDraft((value) => value ?? emptyReviewedUrlDraft())
              }
              onReviewedUrlDraftChange={setReviewedUrlDraft}
              onReviewedUrlDraftClose={() => setReviewedUrlDraft(null)}
              onReviewedUrlDraftCommitted={(submitted) =>
                setReviewedUrlDraft((current) =>
                  current && sameReviewedUrlDraft(current, submitted) ? null : current,
                )
              }
              onAddEvidence={(requirement) => {
                setEvidenceContext(requirement);
                goToSection("evidence");
              }}
            />
          )}
          {section === "applications" && (
            <Applications
              dashboard={dashboard}
              onAct={mutations}
              busy={busy}
              onGo={goToSection}
              workbench={{
                state: applicationsWorkbenchState,
                dispatch: dispatchApplicationsWorkbench,
              }}
            />
          )}
          {section === "packets" && <Packets dashboard={dashboard} onAct={mutations} busy={busy} />}
          {section === "history" && <StoredHistory />}
          {section === "actions" && (
            <Actions
              dashboard={dashboard}
              onAct={mutations}
              busy={busy}
              draft={actionDraft}
              onDraftChange={setActionDraft}
              onDraftCommitted={commitActionDraft}
            />
          )}
          {section === "activity" && <ActivityLedger dashboard={dashboard} />}
          {section === "data" && (
            <DataControls
              dashboard={dashboard}
              onAct={mutations}
              busy={busy}
              onDeleted={(receipt) => {
                applyIdentityTransition({ kind: "deletion_recorded", receipt });
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function WorkspaceStart({
  unavailable,
  onStart,
  busy,
  notice,
  bootstrapSecret,
  inviteMode,
  onBootstrapSecret,
  onDemo,
  deletionReceipt,
}: {
  unavailable: boolean;
  onStart: (identity: { displayName: string; email: string }) => void;
  onDemo: () => void;
  busy: boolean;
  notice: { kind: "ok" | "error"; text: string; transient?: boolean } | null;
  bootstrapSecret: string;
  inviteMode: boolean;
  onBootstrapSecret: (value: string) => void;
  deletionReceipt?: DeletionReceipt | null;
}) {
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  const launchKeyNoteId = useId();
  const needsLaunchKey = !unavailable && !inviteMode && !bootstrapSecret;
  useEffect(() => {
    if (deletionReceipt) receiptHeading.current?.focus();
  }, [deletionReceipt]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onStart({
      displayName: String(data.get("displayName") ?? ""),
      email: String(data.get("email") ?? ""),
    });
  };
  return (
    <main id="main" className="workspace-start">
      <a className="back-link" href="../">
        <ArrowLeft size={16} /> Back to Nimanto
      </a>
      {/* Deletion signs the candidate out, so this is the only screen left that
       * can hand them the receipt for what they just did. */}
      {deletionReceipt && (
        <section
          className={
            deletionReceipt.state === "completed"
              ? "start-panel receipt"
              : "start-panel receipt is-pending"
          }
          /* Polite, not assertive: an assertive region makes a screen reader
           * interrupt to spell out a 32-character token. The heading carries
           * the outcome; the token is there to be copied, not recited. */
          role="status"
          aria-label="Deletion receipt"
        >
          {/* Focused on mount: a polite region added with its content already
           * inside is routinely missed by assistive technology, and this is the
           * one screen carrying a token the candidate cannot get back. */}
          <h2 ref={receiptHeading} tabIndex={-1}>
            {deletionReceipt.state === "completed"
              ? "Workspace deleted"
              : "Database records removed — local file cleanup is still pending"}
          </h2>
          <p>{deletionReceipt.message}</p>
          <p className="field-note">
            This token is the only way to check or resume the deletion, and it works without a
            session — treat it like a password.
          </p>
          <CopyLine command={deletionReceipt.token} />
          <p className="field-note">
            Check it with <code>GET /v1/deletion/status?token=…</code>; finish an interrupted
            cleanup with <code>POST /v1/deletion/resume</code>.
          </p>
        </section>
      )}
      <form className="start-panel" onSubmit={submit}>
        <Brand />
        <div className="design-line compact" aria-label="Evidence, decision, and approval">
          <span>Evidence</span>
          <i aria-hidden="true" />
          <span>Decision</span>
          <i aria-hidden="true" />
          <span>Approval</span>
        </div>
        <p className="eyebrow">
          <span /> {inviteMode ? "Private invitation" : "Local-first beta"}
        </p>
        <h1>{unavailable ? "Connect the local service." : "Your evidence stays with you."}</h1>
        <p>
          {unavailable ? (
            <>
              Start the Nimanto backend at <code>{API_HOST_LABEL}</code>, then try again.
            </>
          ) : inviteMode ? (
            "Accept this single-use invitation to create an empty, tenant-isolated candidate workspace."
          ) : (
            "Open the synthetic starter workspace, inspect every source link, and replace examples with your own confirmed evidence."
          )}
        </p>
        {needsLaunchKey && (
          <label className="launch-secret-field">
            Private launch key
            <input
              type="password"
              autoComplete="off"
              value={bootstrapSecret}
              onChange={(event) => onBootstrapSecret(event.target.value)}
              placeholder="Paste the key shown by the local launcher"
              aria-describedby={launchKeyNoteId}
            />
            {/* The key arrives in a URL fragment that this screen scrubs on
             * sign-in, so signing out, deleting the workspace, a bookmark and
             * the URL printed in the operations guide all land here without it.
             * Saying which file holds it is the difference between a screen the
             * candidate can act on and two dead buttons. */}
            <small id={launchKeyNoteId}>
              Both ways in need this key. The launcher fills it automatically; otherwise copy it
              from <code>.nimanto-data/launch-secret</code> in the Nimanto folder, or from the
              address the API prints when it starts.
            </small>
          </label>
        )}
        {!unavailable && (
          <div className="field-grid identity-fields">
            <label>
              Your name
              <input name="displayName" required maxLength={120} autoComplete="name" />
            </label>
            <label>
              Your email
              <input name="email" type="email" required maxLength={254} autoComplete="email" />
            </label>
          </div>
        )}
        <button
          className="button primary"
          type={unavailable ? "button" : "submit"}
          onClick={unavailable ? () => onStart({ displayName: "", email: "" }) : undefined}
          disabled={busy || needsLaunchKey}
          aria-describedby={needsLaunchKey ? launchKeyNoteId : undefined}
        >
          {unavailable ? <RefreshCw size={17} /> : <Play size={17} />}
          {busy ? "Connecting…" : unavailable ? "Try again" : "Start private workspace"}
        </button>
        {!unavailable && !inviteMode && (
          <button
            className="button quiet"
            type="button"
            onClick={onDemo}
            disabled={busy || !bootstrapSecret}
            aria-describedby={needsLaunchKey ? launchKeyNoteId : undefined}
          >
            Use clearly labeled synthetic demo
          </button>
        )}
        {notice && (
          <div
            className={`notice ${notice.kind}`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.kind === "ok" ? <Check size={17} /> : <CircleAlert size={17} />}
            {notice.text}
          </div>
        )}
        <small>Synthetic starter data is labeled and can be deleted at any time.</small>
      </form>
    </main>
  );
}

/* Five stages at a 250px minimum need about 1314px, which is wider than the
 * content column at every width that still shows the desktop sidebar. Scrolling
 * was already possible; nothing said so, and the container could not be reached
 * by keyboard, so two stages were simply unreachable at 1024px. */
function useOverflowFlag<T extends HTMLElement>(measurementKey?: unknown) {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      setOverflowing(false);
      return;
    }
    const measure = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
    const resizeObserver = new ResizeObserver(measure);
    const observeChildren = () => {
      for (const child of element.children) resizeObserver.observe(child);
    };
    /* Observing only the scroll container misses the important change: its
     * client width stays fixed while grid tracks establish a wider scroll
     * width. Observe those tracks too, and re-register when React replaces or
     * moves their contents. */
    const contentObserver = new MutationObserver(() => {
      observeChildren();
      measure();
    });
    resizeObserver.observe(element);
    observeChildren();
    contentObserver.observe(element, { childList: true, subtree: true });
    measure();
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      resizeObserver.disconnect();
      contentObserver.disconnect();
    };
  }, [measurementKey]);
  return { ref, overflowing };
}

/* One inline confirmation for every consequential candidate decision.
 *
 * `window.confirm` could only ever offer OK and Cancel, which names neither of
 * the two outcomes in a product that is otherwise careful to name both. It also
 * blocks the tab, carries the origin in some browsers, and — the reason this is
 * not merely cosmetic — can be suppressed by the browser after repeated use,
 * from which point it returns false immediately and the control becomes a
 * silent no-op with nothing on screen to explain it.
 *
 * Arming is deliberately local state: nothing is sent until the second press. */
function ConfirmAction({
  label,
  question,
  supportingContent,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled,
  className = "button mini",
  triggerLabel,
  descriptionId,
}: {
  label: ReactNode;
  question: string;
  supportingContent?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
  triggerLabel?: string;
  descriptionId?: string;
}) {
  const [armed, setArmed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  /* Cancelling puts focus back on the control the candidate pressed. The
   * trigger is unmounted while armed, so this waits for it to come back. */
  useEffect(() => {
    if (armed || !returnFocus.current) return;
    returnFocus.current = false;
    trigger.current?.focus();
  }, [armed]);

  const cancel = () => {
    returnFocus.current = true;
    setArmed(false);
  };

  if (!armed) {
    return (
      <button
        ref={trigger}
        className={className}
        type="button"
        disabled={disabled}
        onClick={() => setArmed(true)}
        aria-label={triggerLabel}
        aria-describedby={descriptionId}
      >
        {label}
      </button>
    );
  }

  return (
    <ConfirmationStrip
      question={question}
      supportingContent={supportingContent}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={() => {
        setArmed(false);
        onConfirm();
      }}
      onCancel={cancel}
      disabled={disabled}
    />
  );
}

function ConfirmationStrip({
  question,
  supportingContent,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  disabled,
}: {
  question: string;
  supportingContent?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean | undefined;
}) {
  return (
    <div
      className="confirm-strip"
      role="group"
      aria-label={question}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <span className="confirm-question">{question}</span>
      {supportingContent && <div className="confirm-support">{supportingContent}</div>}
      <button
        className="button mini danger-button"
        type="button"
        disabled={disabled}
        autoFocus
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
      <button className="button mini quiet" type="button" onClick={onCancel}>
        {cancelLabel}
      </button>
    </div>
  );
}

function PacketApprovalContext({ packet }: { packet: Packet }) {
  const artifacts = packet.artifactManifest.artifacts ?? [];
  return (
    <div className="packet-approval-context">
      <span className="confirm-summary">
        Assurance passed · {artifacts.length} generated artifact{artifacts.length === 1 ? "" : "s"}
        {" · "}packet hash <code>{packet.artifactHash.slice(0, 12)}…</code>
      </span>
      <span className="confirm-impact">
        This records approval for this exact frozen packet. Only the latest approved packet can
        drive a future action.
      </span>
      <details className="confirm-details">
        <summary>Inspect exact packet binding</summary>
        <dl className="confirm-binding">
          <div>
            <dt>Frozen packet ID</dt>
            <dd>
              <code aria-label="Exact frozen packet ID">{packet.id}</code>
            </dd>
          </div>
          <div>
            <dt>Packet SHA-256</dt>
            <dd>
              <code aria-label="Full packet SHA-256">{packet.artifactHash}</code>
            </dd>
          </div>
        </dl>
        <ul className="confirm-artifact-hashes">
          {artifacts.map((artifact) => (
            <li key={`${artifact.filename}-${artifact.sha256}`}>
              <span>{artifact.filename}</span>
              <code aria-label={`Full SHA-256 for ${artifact.filename}`}>{artifact.sha256}</code>
            </li>
          ))}
        </ul>
        <small>
          Inspecting this binding is local and performs no approval, download, or external action.
        </small>
      </details>
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">
          <span /> {eyebrow}
        </p>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

function Metric({
  value,
  label,
  detail,
}: {
  value: string | number;
  label: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

/* Counts only, and the API's own scope caveat kept verbatim. A conversion rate
 * computed off a sample of one or two would read as a hiring-probability claim,
 * which is exactly what this product refuses to make. */
function Funnel({ funnel }: { funnel: Dashboard["personalFunnel"] }) {
  return (
    <section className="funnel-strip" aria-label="Your recorded application funnel">
      {funnelStages(funnel).map((stage) => (
        <div className="funnel-stage" key={stage.id}>
          <strong>{stage.count}</strong>
          <span>{stage.label}</span>
        </div>
      ))}
      <small className="funnel-scope">{funnel.scope}</small>
    </section>
  );
}

function Overview({
  dashboard,
  onGo,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onGo: (section: Section) => void;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const pending = dashboard.evidence.filter((item) => item.status === "pending").length;
  const activeJobs = dashboard.jobs.filter((job) => job.candidateDisposition.state !== "archived");
  const activeJobIds = new Set(activeJobs.map((job) => job.id));
  const activeMatches = dashboard.matches.filter((match) => activeJobIds.has(match.jobId));
  const blockers = activeMatches.reduce((count, match) => count + match.result.blockers.length, 0);
  const latestMatches = activeMatches.slice(0, 3);
  const steps = nextSteps(dashboard);
  return (
    <>
      <PageIntro
        eyebrow="Today’s record"
        title={`Good to see you, ${dashboard.identity.displayName.split(" ")[0]}.`}
        copy="One calm view of what is confirmed, what needs review, and what is ready for your decision."
        action={
          <button className="button primary" type="button" onClick={() => onGo("jobs")}>
            <Plus size={17} /> Add a role
          </button>
        }
      />
      {/* Keep the first available decision ahead of summary accounting in both
       * visual and DOM order. CSS-only reordering would make keyboard and
       * assistive-technology order disagree with the mobile presentation. */}
      {activeJobs.length > 0 && activeMatches.length === 0 && (
        <div className="focus-strip">
          <div>
            <SlidersHorizontal />
            <span>
              <strong>Your starter roles are ready.</strong>
              <small>
                Run both deterministic explanations—no model is used; only confirmed career evidence
                is scored.
              </small>
            </span>
          </div>
          <button
            className="button inverted"
            type="button"
            disabled={busy}
            onClick={() => {
              void onAct.run({
                request: async () => {
                  for (const job of activeJobs)
                    await api(`/v1/jobs/${job.id}/match`, { method: "POST" });
                },
                success: "Role explanations are ready.",
              });
            }}
          >
            Run starter matches
          </button>
        </div>
      )}
      <div className="metric-row">
        <Metric
          value={dashboard.evidence.filter((item) => item.status === "confirmed").length}
          label="Confirmed evidence"
          detail={`${pending} awaiting review`}
        />
        <Metric
          value={activeMatches.length}
          label="Explained matches"
          detail={`${blockers} visible blocker${blockers === 1 ? "" : "s"}`}
        />
        <Metric
          value={dashboard.applications.length}
          label="Tracked applications"
          detail={`${dashboard.packets.filter((item) => item.status === "approved").length} approved packets`}
        />
        <Metric
          value={dashboard.receipts.length}
          label="Local receipts"
          detail="Local audit trail"
        />
      </div>
      <Funnel funnel={dashboard.personalFunnel} />
      <div className="workspace-columns">
        <section className="work-panel">
          <div className="panel-heading">
            <div>
              <span>Role evidence</span>
              <h2>Recent explanations</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onGo("jobs")}>
              All roles <ArrowRight size={15} />
            </button>
          </div>
          {latestMatches.length ? (
            latestMatches.map((match) => (
              <div className="match-row" key={match.id}>
                <div className="company-initial">{match.job.company.charAt(0)}</div>
                <div>
                  <strong>{match.job.title}</strong>
                  <span>{match.job.company}</span>
                </div>
                <span className={`state ${match.result.blockers.length ? "warning" : "supported"}`}>
                  {human(match.result.band)}
                </span>
              </div>
            ))
          ) : (
            <Empty
              icon={Sparkles}
              title="No explanations yet"
              copy="Run a match from Role discovery to see every supported and missing requirement."
            />
          )}
        </section>
        <section className="work-panel">
          <div className="panel-heading">
            <div>
              <span>Next decisions</span>
              <h2>What to do next</h2>
            </div>
          </div>
          {/* Ordered by where the flow is blocked earliest, not by how many
           * items each bucket holds. Confirming one claim unblocks matching,
           * which unblocks packets, which unblocks actions. */}
          {steps.length > 0 ? (
            <div className="next-steps">
              {steps.map((step) => (
                <button
                  key={step.id}
                  className="next-step"
                  data-tone={step.tone}
                  type="button"
                  onClick={() => onGo(step.section as Section)}
                >
                  <div>
                    <strong>{step.title}</strong>
                    <small>{step.detail}</small>
                  </div>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="queue-row is-complete">
              <ShieldCheck />
              <span>
                <strong>Nothing is waiting on you</strong>
                <small>Every claim, role, packet and action has a decision</small>
              </span>
              <Check />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Empty({
  icon: Icon,
  title,
  copy,
  action,
}: {
  icon: typeof Activity;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon />
      <strong>{title}</strong>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function postedCompensation(role: ComparableRole): string {
  const compensation = role.sourceMeta.compensation;
  if (!compensation) return "Not recorded";
  const minimum = compensation.minimum?.toLocaleString() ?? "unknown";
  const maximum = compensation.maximum?.toLocaleString() ?? "unknown";
  return `${minimum}–${maximum} ${compensation.currency ?? "USD"}`;
}

function RoleComparison({
  roles,
  onRemove,
  onClear,
}: {
  roles: readonly ComparableRole[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previousRoleCount = useRef(roles.length);
  const scrollRegion = useOverflowFlag<HTMLDivElement>(roles.length);
  useEffect(() => {
    const comparisonCompleted = previousRoleCount.current === 1 && roles.length === 2;
    previousRoleCount.current = roles.length;
    if (!comparisonCompleted) return;
    const frame = window.requestAnimationFrame(() => {
      const target = heading.current;
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [roles.length]);
  const cells = (role: ComparableRole) => {
    const supported =
      role.match?.result.requirements.filter((requirement) => requirement.state === "supported")
        .length ?? 0;
    const unmet =
      role.match?.result.requirements
        .filter((requirement) => requirement.state !== "supported")
        .map((requirement) => requirement.requirement) ?? [];
    return {
      record: role.candidateDisposition.state === "archived" ? "Archived" : "Current shortlist",
      source: human(role.source),
      location: role.location || "Not specified",
      tracking: role.tracked ? "Application tracked" : "Not tracked",
      fit: role.match ? human(role.match.result.band) : "Not explained",
      coverage: role.match
        ? `${human(role.match.result.coverage)} · ${supported}/${role.match.result.requirements.length} requirements supported`
        : "Not explained",
      blockers: role.match
        ? role.match.result.blockers.length
          ? role.match.result.blockers.map((blocker) => blocker.sourceText).join(" · ")
          : "None in latest explanation"
        : "Not explained",
      unmet: role.match ? (unmet.length ? unmet.join(" · ") : "None") : "Not explained",
      compensation: postedCompensation(role),
      benefits: role.sourceMeta.benefits?.length
        ? role.sourceMeta.benefits.join(" · ")
        : "Not recorded",
    };
  };
  const comparison = roles.map(cells);
  const rows: Array<{ label: string; field: keyof ReturnType<typeof cells> }> = [
    { label: "Candidate view", field: "record" },
    { label: "Role source", field: "source" },
    { label: "Location", field: "location" },
    { label: "Application", field: "tracking" },
    { label: "Evidence fit", field: "fit" },
    { label: "Coverage", field: "coverage" },
    { label: "Explicit blockers", field: "blockers" },
    { label: "Needs evidence", field: "unmet" },
    { label: "Posted compensation", field: "compensation" },
    { label: "Stated benefits", field: "benefits" },
  ];
  return (
    <section className="role-comparison" aria-labelledby="role-comparison-title">
      <div className="panel-heading">
        <div>
          <span>Comparison folio · current stored values</span>
          <h2 ref={heading} id="role-comparison-title" tabIndex={-1}>
            Read two roles on the same lines
          </h2>
          <p>
            Latest explanations are shown literally. This does not rank roles or predict a hiring
            outcome.
          </p>
        </div>
        <button className="button mini quiet" type="button" onClick={onClear}>
          Clear comparison
        </button>
      </div>
      {roles.length === 1 ? (
        <div className="comparison-awaiting" role="status">
          <div>
            <strong>{roles[0]!.title}</strong>
            <span>{roles[0]!.company}</span>
          </div>
          <span>Choose one more role below to open the side-by-side folio.</span>
        </div>
      ) : (
        <div
          ref={scrollRegion.ref}
          className="role-comparison-scroll"
          role="region"
          tabIndex={0}
          aria-label="Role comparison table"
          data-overflowing={scrollRegion.overflowing ? "true" : "false"}
          aria-describedby={scrollRegion.overflowing ? "role-comparison-scroll-note" : undefined}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Evidence field</th>
                {roles.map((role) => (
                  <th scope="col" key={role.id}>
                    <strong>{role.title}</strong>
                    <span>{role.company}</span>
                    <button
                      className="button mini quiet"
                      type="button"
                      onClick={() => onRemove(role.id)}
                      aria-label={`Remove ${role.title} at ${role.company} from comparison`}
                    >
                      <X size={14} /> Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.field}>
                  <th scope="row">{row.label}</th>
                  {comparison.map((entry, index) => (
                    <td key={roles[index]!.id}>{entry[row.field]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {roles.length === 2 && scrollRegion.overflowing && (
        <small className="field-note comparison-scroll-note" id="role-comparison-scroll-note">
          More comparison columns sit past the right edge. Scroll sideways, or focus the table and
          use the arrow keys.
        </small>
      )}
    </section>
  );
}

function EvidenceVault({
  dashboard,
  onAct,
  busy,
  draft,
  onDraftChange,
  onClaimCommitted,
  roleRequirement,
  onDismissRoleRequirement,
  filters,
  onFiltersChange,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
  draft: EvidenceDraft;
  onDraftChange: (draft: EvidenceDraft) => void;
  onClaimCommitted: (submitted: EvidenceDraft) => void;
  roleRequirement?: string | null;
  onDismissRoleRequirement?: () => void;
  filters: EvidenceFilters;
  onFiltersChange: (filters: EvidenceFilters) => void;
}) {
  const [importPreview, setImportPreview] = useState<EvidenceImportPreview | null>(null);
  const claimField = useRef<HTMLTextAreaElement>(null);
  const importField = useRef<HTMLInputElement>(null);
  const importPreviewSection = useRef<HTMLElement>(null);
  const saveVersionControl = useRef<HTMLButtonElement>(null);
  const confirmedClaimIds = dashboard.evidence
    .filter((claim) => claim.status === "confirmed")
    .map((claim) => claim.id);
  const profileChanged = profileInputChanged(
    dashboard.profile,
    draft.authorization,
    confirmedClaimIds,
  );
  const unscoredClaims = unscoredConfirmedClaims(dashboard.profile, confirmedClaimIds);
  const deferredEvidenceQuery = useDeferredValue(filters.query);
  const evidenceKinds = useMemo(
    () => [...new Set(dashboard.evidence.map((claim) => claim.kind))].toSorted(),
    [dashboard.evidence],
  );
  const evidenceSources = useMemo(
    () => [...new Set(dashboard.evidence.map((claim) => claim.sourceName))].toSorted(),
    [dashboard.evidence],
  );
  const visibleEvidence = useMemo(
    () =>
      filterEvidence(dashboard.evidence, {
        ...filters,
        query: deferredEvidenceQuery,
      }),
    [dashboard.evidence, deferredEvidenceQuery, filters.kind, filters.source, filters.status],
  );
  const evidenceFiltersActive = Boolean(
    filters.query || filters.kind !== "all" || filters.status !== "all" || filters.source !== "all",
  );

  /* Arriving from an unmet requirement focuses the candidate's existing draft,
   * but never edits it. Role wording is context, not candidate evidence. */
  useEffect(() => {
    if (!roleRequirement) return;
    const frame = window.requestAnimationFrame(() => {
      claimField.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [roleRequirement]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const submittedDraft = { ...draft };
    void onAct.run({
      request: () =>
        api("/v1/evidence", {
          method: "POST",
          body: JSON.stringify({ kind: draft.kind, value: draft.value }),
        }),
      success: "Claim added to the review queue.",
      transient: true,
      // Clear only the exact claim that completed. A slow response cannot
      // replace newer kind or authorization edits with its submit-time closure.
      commit: () => onClaimCommitted(submittedDraft),
    });
  };

  /* One request, two affordances. Saving a Profile Version stays a deliberate
   * candidate action wherever it is offered from — this is never called from an
   * effect, so confirming a claim still mints nothing on its own. */
  const saveProfileVersion = () =>
    void onAct.run({
      request: () =>
        api<ProfileVersionResponse>("/v1/profile/versions", {
          method: "POST",
          body: JSON.stringify({ authorizationWording: draft.authorization }),
        }),
      success: (result) =>
        result.created
          ? "A new profile version was saved."
          : "No profile changes were found; stored history is unchanged.",
    });
  return (
    <>
      <PageIntro
        eyebrow="Evidence vault"
        title="Confirm the record before using it."
        copy="Every imported claim starts pending. Source names and locators stay beside the claim throughout matching and packet generation."
      />
      <div className="workspace-columns wide-left">
        <section className="work-panel">
          <div className="panel-heading">
            <div>
              <span>All claims</span>
              <h2>{dashboard.evidence.length} evidence items</h2>
            </div>
            <label className="button mini quiet file-button">
              <Upload size={15} /> Import file
              <input
                ref={importField}
                type="file"
                accept=".txt,.md,.json,.docx,.pdf,.zip"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void onAct.run({
                    request: async () => {
                      const contentBase64 = await fileBase64(file);
                      const preview = await api<
                        Omit<EvidenceImportPreview, "filename" | "mimeType" | "contentBase64">
                      >("/v1/evidence/preview", {
                        method: "POST",
                        body: JSON.stringify({
                          filename: file.name,
                          mimeType: file.type,
                          contentBase64,
                        }),
                      });
                      return {
                        filename: file.name,
                        mimeType: file.type,
                        contentBase64,
                        ...preview,
                      } satisfies EvidenceImportPreview;
                    },
                    success: `${file.name} is ready for your import decision.`,
                    commit: setImportPreview,
                    focus: () => importPreviewSection.current?.focus(),
                  });
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {unscoredClaims > 0 && (
            <div className="unscored-claims" role="status">
              <div>
                <strong>
                  {countedNoun(unscoredClaims, "confirmed claim")}{" "}
                  {unscoredClaims === 1 ? "is" : "are"} not scored yet.
                </strong>
                <span>Matching uses your last saved profile version.</span>
              </div>
              {/* Takes the candidate to the wording rather than committing it. A
               * Profile Version freezes the authorization statement too, so a
               * claims-scoped control must not mint one from a textarea it never
               * showed — but leaving the candidate to find that panel unaided is
               * the gap this strip exists to close. Guide, do not submit. */}
              <button
                type="button"
                className="button mini primary"
                /* Mid-mutation the target is disabled, and focusing a disabled
                 * control is a silent no-op — so refuse the trip rather than
                 * appear to do nothing. */
                disabled={busy}
                onClick={() => {
                  saveVersionControl.current?.scrollIntoView({ block: "center" });
                  saveVersionControl.current?.focus({ preventScroll: true });
                }}
              >
                Review and save
              </button>
            </div>
          )}
          {importPreview && (
            <section
              ref={importPreviewSection}
              className="import-preview"
              aria-labelledby="import-preview-title"
              tabIndex={-1}
            >
              <div>
                <span>Import preview · nothing stored yet</span>
                <h3 id="import-preview-title">Review {importPreview.filename}</h3>
                <p>
                  {importPreview.claimCount} pending claim
                  {importPreview.claimCount === 1 ? "" : "s"} will enter your private review queue.
                  {/* Truncation was silent: the file parsed to more than an
                   * import stores, and nothing said which ones were dropped. */}
                  {importPreview.parsedCount > importPreview.claimCount && (
                    <>
                      {" "}
                      This file parsed to {importPreview.parsedCount}; only the first{" "}
                      {importPreview.claimCount} shown here are imported.
                    </>
                  )}
                </p>
              </div>
              {/* A count is not a preview. For anything but a LinkedIn archive
               * this asked the candidate to accept claims they could not read. */}
              {importPreview.claims.length > 0 && (
                <ul className="import-claims">
                  {importPreview.claims.map((claim, index) => (
                    <li key={`${claim.kind}-${index}`}>
                      <span className="evidence-kind">{human(claim.kind)}</span>
                      <strong>{claim.value}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {importPreview.preview && (
                <div className="import-preview-grid">
                  <div>
                    <strong>Accepted files and fields</strong>
                    <ul>
                      {importPreview.preview.acceptedFields.map((entry) => (
                        <li key={entry.file}>
                          <code>{entry.file}</code>
                          <small>{entry.fields.join(" · ") || "No approved fields found"}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong>Ignored files</strong>
                    {importPreview.preview.ignoredFiles.length ? (
                      <ul>
                        {importPreview.preview.ignoredFiles.map((file) => (
                          <li key={file}>
                            <code>{file}</code>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <small>None</small>
                    )}
                  </div>
                </div>
              )}
              {importPreview.warnings.map((warning) => (
                <p className="field-note" key={warning}>
                  {warning}
                </p>
              ))}
              <div className="form-actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={busy || importPreview.claimCount === 0}
                  onClick={() => {
                    void onAct.run({
                      request: () =>
                        api("/v1/evidence/import", {
                          method: "POST",
                          body: JSON.stringify({
                            filename: importPreview.filename,
                            mimeType: importPreview.mimeType,
                            contentBase64: importPreview.contentBase64,
                            confirmedPreviewHash: importPreview.previewHash,
                          }),
                        }),
                      success: `${importPreview.filename} was imported as pending evidence.`,
                      commit: () => setImportPreview(null),
                      focus: () => importField.current?.focus(),
                    });
                  }}
                >
                  <Check size={16} /> Confirm import
                </button>
                <button
                  className="button quiet"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setImportPreview(null);
                    window.requestAnimationFrame(() => importField.current?.focus());
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
          {dashboard.evidence.length > 0 && (
            <section
              className="role-filter evidence-filter"
              aria-labelledby="evidence-filter-title"
            >
              <div>
                <span>Private evidence lens</span>
                <h3 id="evidence-filter-title">Find a claim or its source</h3>
                <p>Search and filters stay in this tab. They change no evidence decision.</p>
              </div>
              <label className="role-search">
                Search evidence
                <input
                  type="search"
                  value={filters.query}
                  placeholder="Claim, source, or locator"
                  onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
                />
              </label>
              <label>
                Claim type
                <select
                  value={filters.kind}
                  onChange={(event) => onFiltersChange({ ...filters, kind: event.target.value })}
                >
                  <option value="all">All types</option>
                  {evidenceKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {human(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Decision
                <select
                  value={filters.status}
                  onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
                >
                  <option value="all">All decisions</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label>
                Source
                <select
                  value={filters.source}
                  onChange={(event) => onFiltersChange({ ...filters, source: event.target.value })}
                >
                  <option value="all">All sources</option>
                  {evidenceSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>
              <div className="role-filter-result" aria-live="polite">
                <strong>
                  {visibleEvidence.length} of {dashboard.evidence.length}
                </strong>
                <span>claims shown</span>
                {evidenceFiltersActive && (
                  <button
                    className="button mini quiet"
                    type="button"
                    onClick={() => onFiltersChange(emptyEvidenceFilters())}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </section>
          )}
          <div className="evidence-list">
            {visibleEvidence.map((claim) => (
              <article key={claim.id} className="evidence-item">
                <div className="evidence-kind">{human(claim.kind)}</div>
                <div>
                  <strong>{claim.value}</strong>
                  {/* Show the locator only when it says something the source
                   * name does not. Printing one token twice reads as a bug in
                   * the one place the record asks to be trusted. */}
                  <small>
                    {claim.locator && claim.locator !== claim.sourceName
                      ? `${claim.sourceName} · ${claim.locator}`
                      : claim.sourceName}
                  </small>
                </div>
                <div className="evidence-controls">
                  <span
                    className={`state ${claim.status === "confirmed" ? "supported" : claim.status === "pending" ? "warning" : "muted"}`}
                  >
                    {human(claim.status)}
                  </span>
                  {/* The decision the whole product is built around. It used to
                   * be two unlabeled grey glyphs of the same weight, stacked, at
                   * 32px — and the lower one was final, immediate, and had no way
                   * back, because both store methods only move a claim out of
                   * `pending`. Naming them, separating keep from discard, and
                   * asking once is the same rule the schedule cancel and the
                   * deletion phrase already apply. */}
                  {claim.status === "pending" && (
                    <>
                      <button
                        className="button mini positive"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void onAct.run({
                            request: () =>
                              api(`/v1/evidence/${claim.id}/confirm`, { method: "POST" }),
                            success: "Claim confirmed.",
                            transient: true,
                          });
                        }}
                        aria-label={`Confirm ${claim.value}`}
                      >
                        <Check size={14} /> Confirm
                      </button>
                      <ConfirmAction
                        className="button mini"
                        label={
                          <>
                            <X size={14} /> Reject
                          </>
                        }
                        triggerLabel={`Reject ${claim.value}`}
                        question="Rejecting is final."
                        confirmLabel="Reject claim"
                        cancelLabel="Keep it pending"
                        disabled={busy}
                        onConfirm={() => {
                          void onAct.run({
                            request: () =>
                              api(`/v1/evidence/${claim.id}/reject`, { method: "POST" }),
                            success: "Claim rejected.",
                            transient: true,
                          });
                        }}
                      />
                    </>
                  )}
                  {claim.status === "rejected" && (
                    <small className="field-note">Rejected — this decision is final.</small>
                  )}
                </div>
              </article>
            ))}
            {dashboard.evidence.length > 0 && visibleEvidence.length === 0 && (
              <Empty
                icon={FolderSearch2}
                title="No evidence matches this view"
                copy="Clear one or more private filters to bring claims back. No evidence changed."
              />
            )}
          </div>
        </section>
        <div className="stacked-panels">
          <form className="work-panel form-panel" onSubmit={submit}>
            <div className="panel-heading">
              <div>
                <span>Manual claim</span>
                <h2>Add evidence</h2>
              </div>
            </div>
            {roleRequirement && (
              <div className="evidence-context" role="note">
                <div>
                  <span>Role requirement to address</span>
                  <strong>{roleRequirement}</strong>
                  <small>
                    Describe your own experience and support it with your own source. Role wording
                    has not been added to your claim.
                  </small>
                </div>
                <button
                  className="button mini quiet"
                  type="button"
                  aria-label="Dismiss role requirement"
                  onClick={onDismissRoleRequirement}
                >
                  <X size={14} /> Dismiss
                </button>
              </div>
            )}
            <label>
              Evidence type
              <select
                value={draft.kind}
                onChange={(event) => onDraftChange({ ...draft, kind: event.target.value })}
              >
                <option value="skill">Skill</option>
                <option value="employment">Employment</option>
                <option value="project">Project</option>
                <option value="accomplishment">Accomplishment</option>
                <option value="education">Education</option>
                <option value="certification">Certification</option>
                <option value="preference">Preference</option>
              </select>
            </label>
            <label>
              Exact claim
              <textarea
                ref={claimField}
                required
                value={draft.value}
                onChange={(event) => onDraftChange({ ...draft, value: event.target.value })}
                placeholder="What can you support with a source?"
              />
            </label>
            <button className="button primary" disabled={busy || draft.value.trim().length < 3}>
              <Plus size={16} /> Add pending claim
            </button>
          </form>
          <form
            className="work-panel form-panel"
            onSubmit={(event) => {
              event.preventDefault();
              saveProfileVersion();
            }}
          >
            <div className="panel-heading">
              <div>
                <span>Locked wording</span>
                <h2>Work authorization</h2>
              </div>
            </div>
            <label>
              Candidate-approved statement
              <textarea
                value={draft.authorization}
                onChange={(event) => onDraftChange({ ...draft, authorization: event.target.value })}
                placeholder="Use your own exact wording."
              />
            </label>
            <p className="field-note">
              Packet assurance blocks any silent wording change. This is not legal advice.
            </p>
            <button
              ref={saveVersionControl}
              id="save-profile-version"
              className="button quiet"
              disabled={busy || !profileChanged}
            >
              {profileChanged ? "Save profile version" : "No changes to save"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function Jobs({
  dashboard,
  onAct,
  busy,
  draft,
  onDraftOpen,
  onDraftChange,
  onDraftClose,
  onDraftCommitted,
  filters,
  onFiltersChange,
  comparisonRoleIds,
  onComparisonRoleIdsChange,
  reviewedUrlEnabled,
  reviewedUrlTermsAt,
  reviewedUrlHosts,
  reviewedUrlDraft,
  onReviewedUrlDraftOpen,
  onReviewedUrlDraftChange,
  onReviewedUrlDraftClose,
  onReviewedUrlDraftCommitted,
  onAddEvidence,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
  draft: ManualRoleDraft | null;
  onDraftOpen: () => void;
  onDraftChange: (draft: ManualRoleDraft) => void;
  onDraftClose: () => void;
  onDraftCommitted: (submitted: ManualRoleDraft) => void;
  filters: RoleDiscoveryFilters;
  onFiltersChange: (filters: RoleDiscoveryFilters) => void;
  comparisonRoleIds: string[];
  onComparisonRoleIdsChange: (ids: string[]) => void;
  reviewedUrlEnabled: boolean;
  reviewedUrlTermsAt: string | null;
  reviewedUrlHosts: string[];
  reviewedUrlDraft: ReviewedUrlDraft | null;
  onReviewedUrlDraftOpen: () => void;
  onReviewedUrlDraftChange: (draft: ReviewedUrlDraft) => void;
  onReviewedUrlDraftClose: () => void;
  onReviewedUrlDraftCommitted: (submitted: ReviewedUrlDraft) => void;
  onAddEvidence: (requirement: string) => void;
}) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoveryDraft, setDiscoveryDraft] = useState<DiscoveryDraft>(() => ({
    roleFamilies: dashboard.discoveryProfile?.input.roleFamilies ?? ["ai_ml", "software_technical"],
    includeTitles: dashboard.discoveryProfile?.input.includeTitles.join("\n") ?? "",
    excludeTitles: dashboard.discoveryProfile?.input.excludeTitles.join("\n") ?? "",
    seniorityLevels: dashboard.discoveryProfile?.input.seniorityLevels.join("\n") ?? "",
    industries: dashboard.discoveryProfile?.input.industries.join("\n") ?? "",
    mustHaveSkills: dashboard.discoveryProfile?.input.mustHaveSkills.join("\n") ?? "",
    preferredSkills: dashboard.discoveryProfile?.input.preferredSkills.join("\n") ?? "",
    workModes: dashboard.discoveryProfile?.input.workModes ?? ["remote", "hybrid", "onsite"],
    acceptedPhysicalAreas:
      dashboard.discoveryProfile?.input.acceptedPhysicalAreas.map(structuredAreaDraft) ?? [],
    eligibleRemoteAreas:
      dashboard.discoveryProfile?.input.eligibleRemoteAreas.map(structuredAreaDraft) ?? [],
    commuteRadiusMiles: String(dashboard.discoveryProfile?.input.commuteRadiusMiles ?? ""),
    relocationPreference: dashboard.discoveryProfile?.input.relocationPreference ?? "consider",
    minimumCompensation: String(
      dashboard.discoveryProfile?.input.minimumCompensation?.amount ?? "",
    ),
    compensationCurrency: dashboard.discoveryProfile?.input.minimumCompensation?.currency ?? "USD",
    authorizationStatementExpiresOn: dateInputValue(
      dashboard.discoveryProfile?.input.authorizationStatementExpiresAt,
    ),
    sourceIds: dashboard.discoveryProfile?.input.sourceIds ?? [
      "manual",
      "allowlisted_url",
      ...dashboard.sourceRegistry
        .filter((source) => source.executionEnabled)
        .map((source) => source.id),
    ],
    freshnessDays: String((dashboard.discoveryProfile?.input.freshnessMaximumHours ?? 168) / 24),
  }));
  const confirmedClaimIds = dashboard.evidence
    .filter((claim) => claim.status === "confirmed")
    .map((claim) => claim.id);
  const hasAuthorizationStatement = Boolean(dashboard.profile?.authorizationWording.trim());
  const [compensationError, setCompensationError] = useState<string | null>(null);
  const [areaConfirmationError, setAreaConfirmationError] = useState<string | null>(null);
  const addRoleButton = useRef<HTMLButtonElement>(null);
  const roleTitleField = useRef<HTMLInputElement>(null);
  const compensationMaximumField = useRef<HTMLInputElement>(null);
  const roleFilterSummary = useRef<HTMLElement>(null);
  const deferredQuery = useDeferredValue(filters.query);
  const discoveryEvaluatedAt = useMemo(
    () => new Date(),
    [dashboard.applications, dashboard.discoveryProfile, dashboard.jobs, dashboard.matches],
  );
  const roleDiscovery = useMemo(
    () =>
      projectRoleDiscovery({
        roles: dashboard.jobs,
        matches: dashboard.matches,
        applications: dashboard.applications,
        profile: dashboard.discoveryProfile?.input ?? null,
        filters,
        effectiveQuery: deferredQuery,
        comparisonRoleIds,
        evaluatedAt: discoveryEvaluatedAt,
      }),
    [
      comparisonRoleIds,
      dashboard.applications,
      dashboard.discoveryProfile,
      dashboard.jobs,
      dashboard.matches,
      deferredQuery,
      discoveryEvaluatedAt,
      filters,
    ],
  );
  const {
    groups: displayedRoleGroups,
    comparisonRoles,
    suggestedQueries,
    sourceOptions,
    counts: roleDiscoveryCounts,
    filtersActive,
  } = roleDiscovery;
  const [roleFiltersOpen, setRoleFiltersOpen] = useState(() => filtersActive);
  const toggleComparisonRole = (id: string) => {
    if (comparisonRoleIds.includes(id)) {
      onComparisonRoleIdsChange(comparisonRoleIds.filter((selected) => selected !== id));
      return;
    }
    if (comparisonRoleIds.length < 2) onComparisonRoleIdsChange([...comparisonRoleIds, id]);
  };
  const numberOrNull = (value: string) => {
    const text = value.trim();
    return text ? Number(text) : null;
  };
  const compensationFailure = () =>
    failureMessage({ code: "INVALID_COMPENSATION" }) ?? "Check the posted compensation range.";
  const focusCompensationMaximum = () =>
    window.requestAnimationFrame(() => compensationMaximumField.current?.focus());
  const toggleDiscoveryValue = <T extends string>(values: T[], value: T): T[] =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  const saveDiscoveryProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lines = (value: string) =>
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    const areas = (values: StructuredAreaDraft[]): StructuredArea[] =>
      values.map((area) => ({
        displayLabel: area.displayLabel.trim(),
        countryCode: area.countryCode.trim().toUpperCase() || null,
        subdivisionCode: area.subdivisionCode.trim().toUpperCase() || null,
        metroId: area.metroId.trim() || null,
        timeZone: area.timeZone.trim() || null,
        resolution: area.resolution,
      }));
    const submitted = { ...discoveryDraft };
    const pendingCanonicalArea = [
      ...submitted.acceptedPhysicalAreas,
      ...submitted.eligibleRemoteAreas,
    ].some(
      (area) =>
        area.resolution === "unknown" &&
        [area.countryCode, area.subdivisionCode, area.metroId, area.timeZone].some((value) =>
          Boolean(value.trim()),
        ),
    );
    if (pendingCanonicalArea) {
      setAreaConfirmationError(
        "Confirm each edited structured area before saving, or clear its unconfirmed identifiers.",
      );
      return;
    }
    setAreaConfirmationError(null);
    const commuteRadiusMiles = numberOrNull(submitted.commuteRadiusMiles);
    const minimumCompensation = numberOrNull(submitted.minimumCompensation);
    void onAct.run({
      request: () =>
        api("/v1/discovery-profile", {
          method: "POST",
          body: JSON.stringify({
            profileVersionId: dashboard.profile?.id ?? null,
            roleFamilies: submitted.roleFamilies,
            includeTitles: lines(submitted.includeTitles),
            excludeTitles: lines(submitted.excludeTitles),
            seniorityLevels: lines(submitted.seniorityLevels),
            industries: lines(submitted.industries),
            mustHaveSkills: lines(submitted.mustHaveSkills),
            preferredSkills: lines(submitted.preferredSkills),
            acceptedPhysicalAreas: areas(submitted.acceptedPhysicalAreas),
            commuteRadiusMiles,
            relocationPreference: submitted.relocationPreference,
            workModes: submitted.workModes,
            eligibleRemoteAreas: areas(submitted.eligibleRemoteAreas),
            minimumCompensation:
              minimumCompensation === null
                ? null
                : {
                    amount: minimumCompensation,
                    currency: submitted.compensationCurrency.trim().toUpperCase(),
                  },
            currentPostingSponsorshipFilter: "show_all",
            authorizationStatementVersionId: hasAuthorizationStatement
              ? (dashboard.profile?.id ?? null)
              : null,
            authorizationStatementExpiresAt:
              hasAuthorizationStatement && submitted.authorizationStatementExpiresOn
                ? new Date(
                    `${submitted.authorizationStatementExpiresOn}T23:59:59.999Z`,
                  ).toISOString()
                : null,
            freshnessMaximumHours: Math.round(Number(submitted.freshnessDays) * 24),
            sourceIds: submitted.sourceIds,
          }),
        }),
      success: "Discovery profile approved and saved.",
      transient: true,
      commit: () => setDiscoveryOpen(false),
    });
  };
  const addJob = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const requirements = draft.requirements.split("\n").filter(Boolean);
    const benefits = draft.benefits
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    const compensationMin = numberOrNull(draft.compensationMin);
    const compensationMax = numberOrNull(draft.compensationMax);
    if (compensationMin !== null && compensationMax !== null && compensationMin > compensationMax) {
      setCompensationError(compensationFailure());
      focusCompensationMaximum();
      return;
    }
    const submittedDraft = { ...draft };
    void onAct.run({
      request: () =>
        api("/v1/jobs", {
          method: "POST",
          body: JSON.stringify({
            title: submittedDraft.title,
            company: submittedDraft.company,
            description: submittedDraft.description,
            location: submittedDraft.location,
            workMode: submittedDraft.workMode,
            compensationMin,
            compensationMax,
            benefits,
            interviewEvidence: submittedDraft.interviewEvidence,
            interviewSource: submittedDraft.interviewSource,
            url: submittedDraft.url,
            requirements,
          }),
        }),
      success: "Role added.",
      transient: true,
      commit: () => {
        setCompensationError(null);
        onDraftCommitted(submittedDraft);
      },
      focus: () => {
        if (document.getElementById("manual-role-draft")) roleTitleField.current?.focus();
        else addRoleButton.current?.focus();
      },
      recover: (error) => {
        if (!(error instanceof ApiError) || error.code !== "INVALID_COMPENSATION") return false;
        setCompensationError(compensationFailure());
        focusCompensationMaximum();
        return true;
      },
    });
  };
  const updateDraft = <K extends keyof ManualRoleDraft>(field: K, value: ManualRoleDraft[K]) => {
    if (draft) onDraftChange({ ...draft, [field]: value });
  };
  const updateCompensationDraft = (field: "compensationMin" | "compensationMax", value: string) => {
    if (!draft) return;
    const next = { ...draft, [field]: value };
    onDraftChange(next);
    const minimum = numberOrNull(next.compensationMin);
    const maximum = numberOrNull(next.compensationMax);
    if (minimum === null || maximum === null || minimum <= maximum) setCompensationError(null);
  };
  const importSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onAct.run({
      request: () =>
        api("/v1/jobs/import", {
          method: "POST",
          body: JSON.stringify({ provider: data.get("provider"), board: data.get("board") }),
        }),
      success: "Allowlisted source refreshed.",
      commit: () => setSourceOpen(false),
    });
  };
  const createSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onAct.run({
      request: () =>
        api("/v1/schedules", {
          method: "POST",
          body: JSON.stringify({
            provider: data.get("provider"),
            board: data.get("board"),
            cadenceMinutes: Number(data.get("cadenceMinutes")),
          }),
        }),
      success: "Discovery schedule started.",
      commit: () => setScheduleOpen(false),
    });
  };
  const importReviewedUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewedUrlDraft) return;
    const submitted = { ...reviewedUrlDraft };
    void onAct.run({
      request: () =>
        api("/v1/jobs/url-import", {
          method: "POST",
          body: JSON.stringify({
            ...submitted,
            requirements: submitted.requirements
              .split("\n")
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        }),
      success: "Reviewed URL saved as a current role.",
      transient: true,
      commit: () => onReviewedUrlDraftCommitted(submitted),
    });
  };
  const updateReviewedUrlDraft = <K extends keyof ReviewedUrlDraft>(
    field: K,
    value: ReviewedUrlDraft[K],
  ) => {
    if (reviewedUrlDraft) onReviewedUrlDraftChange({ ...reviewedUrlDraft, [field]: value });
  };
  return (
    <>
      <PageIntro
        eyebrow="Role discovery"
        title="Compare roles to evidence—not identity."
        copy="Nimanto explains required qualifications, accomplishments, role-level alignment, skills overlap, coverage, and explicit sponsorship blockers."
        action={
          <div className="button-group">
            <button
              className="button quiet"
              type="button"
              aria-expanded={discoveryOpen}
              onClick={() => setDiscoveryOpen((value) => !value)}
            >
              <SlidersHorizontal size={16} /> Discovery profile
            </button>
            {reviewedUrlEnabled ? (
              <button
                className="button quiet"
                type="button"
                aria-expanded={reviewedUrlDraft !== null}
                onClick={onReviewedUrlDraftOpen}
              >
                <Link2 size={16} /> {reviewedUrlDraft ? "Resume URL intake" : "Import reviewed URL"}
              </button>
            ) : (
              <span className="field-note">
                Reviewed URL intake is off until an operator configures reviewed hosts.
              </span>
            )}
            <button
              className="button quiet"
              type="button"
              onClick={() => setScheduleOpen((value) => !value)}
            >
              <CalendarClock size={16} /> Schedule source
            </button>
            <button
              className="button quiet"
              type="button"
              onClick={() => setSourceOpen((value) => !value)}
            >
              <RefreshCw size={16} /> Import source
            </button>
            <button
              ref={addRoleButton}
              className="button primary"
              type="button"
              aria-expanded={draft !== null}
              aria-controls={draft !== null ? "manual-role-draft" : undefined}
              onClick={() => {
                onDraftOpen();
                window.requestAnimationFrame(() => roleTitleField.current?.focus());
              }}
            >
              <Plus size={16} /> {draft ? "Resume role draft" : "Add role"}
            </button>
          </div>
        }
      />
      <section className="role-results-heading" aria-labelledby="current-roles-title">
        <div>
          <span>Candidate-owned shortlist</span>
          <h2 id="current-roles-title">Current roles</h2>
        </div>
        <p aria-live="polite">
          <strong>{roleDiscoveryCounts.visibleRoles}</strong>
          <span>
            of {roleDiscoveryCounts.totalRoles} role
            {roleDiscoveryCounts.totalRoles === 1 ? "" : "s"} ·{" "}
            {roleDiscoveryCounts.explanationGroups} explanation group
            {roleDiscoveryCounts.explanationGroups === 1 ? "" : "s"}
          </span>
        </p>
      </section>
      <section className="marketplace-controls" aria-label="Personal discovery and source registry">
        {discoveryOpen && (
          <form className="work-panel discovery-profile" onSubmit={saveDiscoveryProfile}>
            <div className="panel-heading">
              <div>
                <span>Candidate-approved inputs</span>
                <h2>Your discovery profile</h2>
              </div>
              {dashboard.discoveryProfile && (
                <small>Approved {localDateTime(dashboard.discoveryProfile.approvedAt)}</small>
              )}
            </div>
            <p className="field-note">
              Your selected role families, titles, area, work modes, and saved evidence-profile
              version drive discovery. Nimanto does not silently infer or save new preferences from
              a résumé.
            </p>
            <fieldset>
              <legend>Role families</legend>
              <div className="choice-row">
                {(
                  [
                    ["ai_ml", "AI / ML"],
                    ["software_technical", "Software / technical"],
                    ["data_analytics", "Data / analytics"],
                    ["product", "Product"],
                    ["business_strategy_operations_solutions", "Business / strategy / ops"],
                    ["other", "Other"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={discoveryDraft.roleFamilies.includes(value)}
                      onChange={() =>
                        setDiscoveryDraft((current) => ({
                          ...current,
                          roleFamilies: toggleDiscoveryValue(current.roleFamilies, value),
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field-grid">
              <label>
                Include titles, one per line
                <textarea
                  value={discoveryDraft.includeTitles}
                  onChange={(event) =>
                    setDiscoveryDraft((current) => ({
                      ...current,
                      includeTitles: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Exclude titles, one per line
                <textarea
                  value={discoveryDraft.excludeTitles}
                  onChange={(event) =>
                    setDiscoveryDraft((current) => ({
                      ...current,
                      excludeTitles: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <fieldset className="discovery-criteria">
              <legend>Literal role criteria</legend>
              <p className="field-note">
                These terms are matched only against stored posting text. Nimanto does not infer a
                seniority, industry, or skill that the posting does not state.
              </p>
              <div className="field-grid">
                <label>
                  Seniority terms, one per line
                  <textarea
                    value={discoveryDraft.seniorityLevels}
                    placeholder={"Senior\nLead"}
                    onChange={(event) =>
                      setDiscoveryDraft((current) => ({
                        ...current,
                        seniorityLevels: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Industry terms, one per line
                  <textarea
                    value={discoveryDraft.industries}
                    placeholder={"Healthcare\nDeveloper tools"}
                    onChange={(event) =>
                      setDiscoveryDraft((current) => ({
                        ...current,
                        industries: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Required skill terms, one per line
                  <textarea
                    value={discoveryDraft.mustHaveSkills}
                    placeholder={"TypeScript\nPostgreSQL"}
                    onChange={(event) =>
                      setDiscoveryDraft((current) => ({
                        ...current,
                        mustHaveSkills: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Preferred skill terms, one per line
                  <textarea
                    value={discoveryDraft.preferredSkills}
                    placeholder={"Rust\nKubernetes"}
                    onChange={(event) =>
                      setDiscoveryDraft((current) => ({
                        ...current,
                        preferredSkills: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>Work modes</legend>
              <div className="choice-row">
                {(
                  [
                    ["remote", "Remote"],
                    ["hybrid", "Hybrid"],
                    ["onsite", "On-site"],
                    ["unknown", "Include unknown"],
                    ["conflicting", "Include conflicting evidence"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={discoveryDraft.workModes.includes(value)}
                      onChange={() =>
                        setDiscoveryDraft((current) => ({
                          ...current,
                          workModes: toggleDiscoveryValue(current.workModes, value),
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <StructuredAreaEditor
              kind="Physical"
              areas={discoveryDraft.acceptedPhysicalAreas}
              onChange={(acceptedPhysicalAreas) => {
                setAreaConfirmationError(null);
                setDiscoveryDraft((current) => ({ ...current, acceptedPhysicalAreas }));
              }}
            />
            <StructuredAreaEditor
              kind="Remote"
              areas={discoveryDraft.eligibleRemoteAreas}
              onChange={(eligibleRemoteAreas) => {
                setAreaConfirmationError(null);
                setDiscoveryDraft((current) => ({ ...current, eligibleRemoteAreas }));
              }}
            />
            {areaConfirmationError && (
              <p className="field-error" role="alert">
                {areaConfirmationError}
              </p>
            )}
            <div className="field-grid">
              <label>
                Commute radius in miles
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  value={discoveryDraft.commuteRadiusMiles}
                  onChange={(event) =>
                    setDiscoveryDraft((current) => ({
                      ...current,
                      commuteRadiusMiles: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Willingness to move
                <select
                  value={discoveryDraft.relocationPreference}
                  onChange={(event) =>
                    setDiscoveryDraft((current) => ({
                      ...current,
                      relocationPreference: event.target
                        .value as DiscoveryDraft["relocationPreference"],
                    }))
                  }
                >
                  <option value="no">Stay in current area</option>
                  <option value="consider">Consider moving</option>
                  <option value="yes">Open to moving</option>
                </select>
              </label>
              <label>
                Minimum posted compensation
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={discoveryDraft.minimumCompensation}
                  onChange={(event) =>
                    setDiscoveryDraft((current) => ({
                      ...current,
                      minimumCompensation: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Compensation currency
                <input
                  value={discoveryDraft.compensationCurrency}
                  required={Boolean(discoveryDraft.minimumCompensation.trim())}
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  placeholder="USD"
                  onChange={(event) =>
                    setDiscoveryDraft((current) => ({
                      ...current,
                      compensationCurrency: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Reconfirm authorization statement by
                <input
                  type="date"
                  disabled={!hasAuthorizationStatement}
                  value={discoveryDraft.authorizationStatementExpiresOn}
                  onChange={(event) =>
                    setDiscoveryDraft((current) => ({
                      ...current,
                      authorizationStatementExpiresOn: event.target.value,
                    }))
                  }
                />
                <small>
                  {hasAuthorizationStatement
                    ? `Linked to authorization statement ${dashboard.profile!.id}.`
                    : "Save nonempty candidate-approved authorization wording before setting a review date."}
                </small>
              </label>
              <label>
                Maximum observation age
                <select
                  value={discoveryDraft.freshnessDays}
                  onChange={(event) =>
                    setDiscoveryDraft((current) => ({
                      ...current,
                      freshnessDays: event.target.value,
                    }))
                  }
                >
                  <option value="1">24 hours</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </select>
              </label>
              <p className="field-note">
                <strong>Current-posting sponsorship text</strong>
                <br />
                Roles remain visible with the exact wording, locator, and observation time. Nimanto
                does not infer an immigration outcome or hide a role automatically.
              </p>
            </div>
            <fieldset>
              <legend>Approved sources</legend>
              <div className="choice-row">
                {[
                  { id: "manual", label: "Candidate-saved roles" },
                  { id: "allowlisted_url", label: "Reviewed URLs" },
                  ...dashboard.sourceRegistry.filter((source) => source.executionEnabled),
                ].map((source) => (
                  <label key={source.id}>
                    <input
                      type="checkbox"
                      checked={discoveryDraft.sourceIds.includes(source.id)}
                      onChange={() =>
                        setDiscoveryDraft((current) => ({
                          ...current,
                          sourceIds: toggleDiscoveryValue(current.sourceIds, source.id),
                        }))
                      }
                    />
                    {source.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="button-group">
              <button className="button primary" disabled={busy}>
                Approve discovery profile
              </button>
              <span className="field-note">
                {dashboard.profile
                  ? `Linked to saved evidence profile ${dashboard.profile.id.slice(0, 8)}.`
                  : "Save an evidence profile to link résumé evidence into matching."}
              </span>
            </div>
          </form>
        )}
        {dashboard.discoveryProfile && !discoveryOpen && (
          <details className="secondary-controls discovery-contract-disclosure">
            <summary>
              <span>
                <ShieldCheck size={16} aria-hidden="true" /> Active discovery contract
              </span>
              <small>
                Profile hash {dashboard.discoveryProfile.inputHash.slice(0, 12)}… ·{" "}
                {dashboard.discoveryProfile.input.sourceIds.length} approved source
                {dashboard.discoveryProfile.input.sourceIds.length === 1 ? "" : "s"}
              </small>
            </summary>
            <section className="discovery-contract" aria-labelledby="active-discovery-title">
              <div className="panel-heading">
                <div>
                  <span>Candidate-approved search inputs</span>
                  <h2 id="active-discovery-title">Active discovery contract</h2>
                </div>
              </div>
              <div className="discovery-provenance">
                <span>Exact profile hash</span>
                <code aria-label="Exact discovery profile hash">
                  {dashboard.discoveryProfile.inputHash}
                </code>
                <small>
                  {dashboard.discoveryProfile.input.matcherVersion} ·{" "}
                  {dashboard.discoveryProfile.input.normalizerVersion}
                </small>
              </div>
              <div className="discovery-contract-grid">
                <p>
                  <strong>{dashboard.discoveryProfile.input.roleFamilies.length}</strong>
                  <span>role families</span>
                </p>
                <p>
                  <strong>
                    {dashboard.discoveryProfile.input.seniorityLevels.length +
                      dashboard.discoveryProfile.input.industries.length}
                  </strong>
                  <span>role terms</span>
                </p>
                <p>
                  <strong>
                    {dashboard.discoveryProfile.input.mustHaveSkills.length +
                      dashboard.discoveryProfile.input.preferredSkills.length}
                  </strong>
                  <span>skill terms</span>
                </p>
                <p>
                  <strong>{dashboard.discoveryProfile.input.sourceIds.length}</strong>
                  <span>approved sources</span>
                </p>
              </div>
              <p className="field-note">
                Literal constraints filter locally. Missing compensation, coordinates, or an expired
                authorization review stays visible as unresolved; Nimanto does not invent the
                answer.
              </p>
              {suggestedQueries.length > 0 && (
                <div className="discovery-suggestions" aria-label="Suggested local searches">
                  <span>Try a saved term</span>
                  {suggestedQueries.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="button mini quiet"
                      onClick={() => onFiltersChange({ ...filters, query: suggestion })}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </details>
        )}
        <details className="source-registry">
          <summary>
            Source registry ·{" "}
            {dashboard.sourceRegistry.filter((source) => source.executionEnabled).length} enabled ·{" "}
            {dashboard.sourceRegistry.filter((source) => !source.executionEnabled).length} gated
          </summary>
          <p>
            Adapters and commercial feeds stay off until access, display, retention, deletion, and
            canonical-link rights are approved. Prohibited aggregators are never scraped.
          </p>
          <div className="source-registry-grid">
            {dashboard.sourceRegistry.map((source) => (
              <article key={source.id}>
                <div>
                  <strong>{source.label}</strong>
                  <span className={`state ${source.executionEnabled ? "supported" : "muted"}`}>
                    {source.executionEnabled ? "Enabled" : "Gated"}
                  </span>
                </div>
                <small>
                  {human(source.accessClass)} · complete snapshot{" "}
                  {source.supportsCompleteSnapshot ? "supported" : "not established"}
                </small>
                <p>{source.limitation}</p>
                <a href={source.termsUrl} target="_blank" rel="noreferrer">
                  Review source terms
                </a>
              </article>
            ))}
          </div>
        </details>
      </section>
      {(draft || reviewedUrlDraft || sourceOpen || scheduleOpen) && (
        <div className="inline-form-row">
          {draft && (
            <form id="manual-role-draft" className="work-panel form-panel" onSubmit={addJob}>
              <div className="panel-heading">
                <div>
                  <span>Manual intake</span>
                  <h2>Add a role</h2>
                </div>
              </div>
              <p className="field-note">
                Kept only in this tab while this workspace remains signed in; reload or sign-out
                clears it.
              </p>
              <div className="field-grid">
                <label>
                  Role title
                  <input
                    ref={roleTitleField}
                    name="title"
                    required
                    value={draft.title}
                    onChange={(event) => updateDraft("title", event.target.value)}
                  />
                </label>
                <label>
                  Company
                  <input
                    name="company"
                    required
                    value={draft.company}
                    onChange={(event) => updateDraft("company", event.target.value)}
                  />
                </label>
                <label>
                  Location
                  <input
                    name="location"
                    value={draft.location}
                    onChange={(event) => updateDraft("location", event.target.value)}
                  />
                </label>
                <label>
                  Work mode
                  <select
                    name="workMode"
                    value={draft.workMode}
                    onChange={(event) => updateDraft("workMode", event.target.value)}
                  >
                    <option value="unspecified">Not specified</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                </label>
                <label>
                  Posting URL
                  <input
                    name="url"
                    type="url"
                    value={draft.url}
                    onChange={(event) => updateDraft("url", event.target.value)}
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  name="description"
                  required
                  value={draft.description}
                  onChange={(event) => updateDraft("description", event.target.value)}
                />
              </label>
              <label>
                Requirements, one per line
                <textarea
                  name="requirements"
                  required
                  value={draft.requirements}
                  onChange={(event) => updateDraft("requirements", event.target.value)}
                />
              </label>
              <div className="field-grid">
                <label>
                  Posted annual minimum (USD)
                  <input
                    name="compensationMin"
                    type="number"
                    min="0"
                    step="1000"
                    value={draft.compensationMin}
                    aria-invalid={compensationError ? true : undefined}
                    aria-describedby={
                      compensationError ? "manual-role-compensation-error" : undefined
                    }
                    onChange={(event) =>
                      updateCompensationDraft("compensationMin", event.target.value)
                    }
                  />
                </label>
                <label>
                  Posted annual maximum (USD)
                  <input
                    ref={compensationMaximumField}
                    name="compensationMax"
                    type="number"
                    min="0"
                    step="1000"
                    value={draft.compensationMax}
                    aria-invalid={compensationError ? true : undefined}
                    aria-describedby={
                      compensationError ? "manual-role-compensation-error" : undefined
                    }
                    onChange={(event) =>
                      updateCompensationDraft("compensationMax", event.target.value)
                    }
                  />
                </label>
              </div>
              {compensationError && (
                <p id="manual-role-compensation-error" className="field-error">
                  {compensationError}
                </p>
              )}
              <label>
                Stated benefits, one per line
                <textarea
                  name="benefits"
                  value={draft.benefits}
                  onChange={(event) => updateDraft("benefits", event.target.value)}
                />
              </label>
              <label>
                Interview-process evidence
                <textarea
                  name="interviewEvidence"
                  placeholder="Only sourced or user-provided stages."
                  value={draft.interviewEvidence}
                  onChange={(event) => updateDraft("interviewEvidence", event.target.value)}
                />
              </label>
              <label>
                Interview source
                <input
                  name="interviewSource"
                  placeholder="Official page or user-provided note"
                  value={draft.interviewSource}
                  onChange={(event) => updateDraft("interviewSource", event.target.value)}
                />
              </label>
              <div className="button-group">
                <button className="button primary" disabled={busy}>
                  Save role
                </button>
                <ConfirmAction
                  className="button quiet"
                  label="Discard draft"
                  question="Discard this unsaved role draft?"
                  confirmLabel="Discard it"
                  cancelLabel="Keep editing"
                  disabled={busy}
                  onConfirm={() => {
                    onDraftClose();
                    window.requestAnimationFrame(() => addRoleButton.current?.focus());
                  }}
                />
              </div>
            </form>
          )}
          {reviewedUrlDraft && (
            <form className="work-panel form-panel compact-form" onSubmit={importReviewedUrl}>
              <div className="panel-heading">
                <div>
                  <span>Reviewed allowlist</span>
                  <h2>Import one public posting</h2>
                </div>
              </div>
              <label>
                Allowlisted HTTPS URL
                <input
                  type="url"
                  required
                  value={reviewedUrlDraft.url}
                  onChange={(event) => updateReviewedUrlDraft("url", event.target.value)}
                />
              </label>
              <div className="field-grid">
                <label>
                  Role title
                  <input
                    required
                    value={reviewedUrlDraft.title}
                    onChange={(event) => updateReviewedUrlDraft("title", event.target.value)}
                  />
                </label>
                <label>
                  Company
                  <input
                    required
                    value={reviewedUrlDraft.company}
                    onChange={(event) => updateReviewedUrlDraft("company", event.target.value)}
                  />
                </label>
                <label>
                  Location
                  <input
                    value={reviewedUrlDraft.location}
                    onChange={(event) => updateReviewedUrlDraft("location", event.target.value)}
                  />
                </label>
                <label>
                  Work mode
                  <select
                    value={reviewedUrlDraft.workMode}
                    onChange={(event) => updateReviewedUrlDraft("workMode", event.target.value)}
                  >
                    <option value="unspecified">Not specified</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                </label>
              </div>
              <label>
                Requirements, one per line
                <textarea
                  required
                  value={reviewedUrlDraft.requirements}
                  onChange={(event) => updateReviewedUrlDraft("requirements", event.target.value)}
                />
              </label>
              <p className="field-note">
                Available only for hosts whose terms were reviewed
                {reviewedUrlTermsAt ? ` on ${reviewedUrlTermsAt}` : ""}:{" "}
                {reviewedUrlHosts.join(", ")}. Redirects are rejected; the fetched body is
                normalized into this private workspace and not retained raw.
              </p>
              <div className="button-group">
                <button className="button primary" disabled={busy}>
                  Import posting
                </button>
                <ConfirmAction
                  className="button quiet"
                  label="Discard draft"
                  question="Discard this unsaved URL intake draft?"
                  confirmLabel="Discard it"
                  cancelLabel="Keep editing"
                  disabled={busy}
                  onConfirm={onReviewedUrlDraftClose}
                />
              </div>
            </form>
          )}
          {sourceOpen && (
            <form className="work-panel form-panel compact-form" onSubmit={importSource}>
              <div className="panel-heading">
                <div>
                  <span>Allowlisted ATS</span>
                  <h2>Refresh a public board</h2>
                </div>
              </div>
              <label>
                Provider
                <select name="provider">
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="ashby">Ashby</option>
                </select>
              </label>
              <label>
                Public board identifier
                <input
                  name="board"
                  required
                  pattern="(?:[A-Za-z0-9_]|-){1,80}"
                  placeholder="company-slug"
                />
              </label>
              <p className="field-note">
                Nimanto contacts only the selected provider API and rejects redirects.
              </p>
              <button className="button quiet" disabled={busy}>
                Import current roles
              </button>
            </form>
          )}
          {scheduleOpen && (
            <form className="work-panel form-panel compact-form" onSubmit={createSchedule}>
              <div className="panel-heading">
                <div>
                  <span>Candidate-controlled rhythm</span>
                  <h2>Schedule a public board</h2>
                </div>
              </div>
              <label>
                Scheduled provider
                <select name="provider">
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="ashby">Ashby</option>
                </select>
              </label>
              <label>
                Scheduled board identifier
                <input
                  name="board"
                  required
                  pattern="(?:[A-Za-z0-9_]|-){1,80}"
                  placeholder="company-slug"
                />
              </label>
              <label>
                Refresh cadence
                <select name="cadenceMinutes" defaultValue="1440">
                  <option value="60">Every hour</option>
                  <option value="360">Every 6 hours</option>
                  <option value="1440">Every day</option>
                  <option value="10080">Every week</option>
                </select>
              </label>
              <p className="field-note">
                Imports, deduplicates, and explains roles. It never applies or sends messages.
              </p>
              <button className="button primary" disabled={busy}>
                <CalendarClock size={16} /> Start schedule
              </button>
            </form>
          )}
        </div>
      )}
      {dashboard.schedules.length > 0 && (
        <section className="schedule-board" aria-labelledby="schedule-board-title">
          <div className="schedule-heading">
            <div>
              <span>Source cadence</span>
              <h2 id="schedule-board-title">Discovery rhythm</h2>
              <p>Durable source refreshes with visible pauses, retries, and limits.</p>
            </div>
            <CalendarClock aria-hidden="true" />
          </div>
          <div className="schedule-list">
            {dashboard.schedules.map((schedule) => {
              const tone =
                schedule.state === "dead_letter"
                  ? "danger"
                  : schedule.state === "retry_wait"
                    ? "warning"
                    : schedule.state === "queued" || schedule.state === "running"
                      ? "supported"
                      : "muted";
              return (
                <article className="schedule-row" key={schedule.id}>
                  <span className="schedule-knot" aria-hidden="true">
                    <i />
                  </span>
                  <div className="schedule-source">
                    <span>{human(schedule.provider)}</span>
                    <code>{schedule.board}</code>
                    <small>
                      {schedule.lastResult
                        ? `${schedule.lastResult.imported} imported · ${schedule.lastResult.matched} explained`
                        : "No completed run yet"}
                    </small>
                  </div>
                  <div className="schedule-cadence">
                    <Clock3 size={15} aria-hidden="true" />
                    <span>
                      <strong>{cadenceLabel(schedule.cadenceMinutes)}</strong>
                      <small>
                        {schedule.state === "paused" || schedule.state === "cancelled"
                          ? "No run is queued"
                          : `Next ${localDateTime(schedule.notBefore)}`}
                      </small>
                    </span>
                  </div>
                  <div className="schedule-state">
                    <span className={`state ${tone}`}>{human(schedule.state)}</span>
                    {schedule.lastErrorCode && <small>{human(schedule.lastErrorCode)}</small>}
                  </div>
                  <div className="schedule-actions">
                    {(schedule.state === "queued" || schedule.state === "retry_wait") && (
                      <>
                        <button
                          className="button mini quiet"
                          type="button"
                          aria-label="Run schedule now"
                          disabled={busy}
                          onClick={() => {
                            void onAct.run({
                              request: () =>
                                api(`/v1/schedules/${schedule.id}/run-now`, { method: "POST" }),
                              success: `${schedule.board} is queued now.`,
                            });
                          }}
                        >
                          <Play size={14} /> Run now
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label="Pause schedule"
                          disabled={busy}
                          onClick={() => {
                            void onAct.run({
                              request: () =>
                                api(`/v1/schedules/${schedule.id}/pause`, { method: "POST" }),
                              success: `${schedule.board} is paused.`,
                            });
                          }}
                        >
                          <Pause size={15} />
                        </button>
                      </>
                    )}
                    {(schedule.state === "paused" || schedule.state === "dead_letter") && (
                      <button
                        className="button mini quiet"
                        type="button"
                        aria-label="Resume schedule"
                        disabled={busy}
                        onClick={() => {
                          void onAct.run({
                            request: () =>
                              api(`/v1/schedules/${schedule.id}/resume`, { method: "POST" }),
                            success: `${schedule.board} is queued again.`,
                          });
                        }}
                      >
                        <RotateCcw size={14} /> Resume
                      </button>
                    )}
                    {schedule.state !== "cancelled" && (
                      /* Cancelling is one-way: the row survives as `cancelled`,
                       * but resume only accepts paused or dead_letter, so there
                       * is no path back short of recreating the schedule.
                       * Client-side friction on a terminal action — the route
                       * takes no confirmation flag and none is sent. */
                      <ConfirmAction
                        className="icon-button"
                        label={<Trash2 size={15} />}
                        triggerLabel="Cancel schedule"
                        question={`Cancel the ${schedule.board} schedule? This cannot be undone — you would have to create a new schedule.`}
                        confirmLabel="Cancel schedule"
                        cancelLabel="Keep it running"
                        disabled={busy}
                        onConfirm={() => {
                          void onAct.run({
                            request: () =>
                              api(`/v1/schedules/${schedule.id}`, { method: "DELETE" }),
                            success: `${schedule.board} schedule was cancelled.`,
                          });
                        }}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <details
        className="secondary-controls role-filter-disclosure"
        open={roleFiltersOpen}
        onToggle={(event) => setRoleFiltersOpen(event.currentTarget.open)}
      >
        <summary ref={roleFilterSummary}>
          <span>
            <SlidersHorizontal size={16} aria-hidden="true" /> Filter roles
          </span>
          <small>
            {roleDiscoveryCounts.visibleRoles} of {roleDiscoveryCounts.totalRoles} current role
            {roleDiscoveryCounts.totalRoles === 1 ? "" : "s"} shown
          </small>
        </summary>
        <section className="role-filter" aria-labelledby="role-filter-title">
          <div>
            <span>Private shortlist</span>
            <h2 id="role-filter-title">Narrow this view</h2>
            <p>Filters stay in this tab until reload or sign-out. They are not saved or sent.</p>
          </div>
          <label className="role-search">
            Search roles
            <input
              type="search"
              value={filters.query}
              onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
              placeholder="Title, company, location, or posting term"
            />
          </label>
          <label>
            Discovery contract view
            <select
              value={filters.discovery}
              disabled={!dashboard.discoveryProfile}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  discovery: event.target.value as RoleDiscoveryFilters["discovery"],
                })
              }
            >
              <option value="recommended">Recommended by profile</option>
              <option value="excluded">Outside recommendations</option>
              <option value="all">All searchable roles</option>
            </select>
          </label>
          <label>
            Source
            <select
              value={filters.source}
              onChange={(event) => onFiltersChange({ ...filters, source: event.target.value })}
            >
              <option value="all">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {human(source)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Remote / workplace
            <select
              value={filters.workMode}
              onChange={(event) => onFiltersChange({ ...filters, workMode: event.target.value })}
            >
              <option value="all">All arrangements</option>
              <option value="remote">Remote</option>
              <option value="non_remote">Non-remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
              <option value="unknown">Not established</option>
              <option value="conflicting">Conflicting evidence</option>
            </select>
          </label>
          <label>
            Role family
            <select
              value={filters.roleFamily}
              onChange={(event) => onFiltersChange({ ...filters, roleFamily: event.target.value })}
            >
              <option value="all">All role families</option>
              <option value="ai_ml">AI / ML</option>
              <option value="software_technical">Software / technical</option>
              <option value="data_analytics">Data / analytics</option>
              <option value="product">Product</option>
              <option value="business_strategy_operations_solutions">
                Business / strategy / ops
              </option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Posting state
            <select
              value={filters.publication}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  publication: event.target.value as RoleDiscoveryFilters["publication"],
                })
              }
            >
              <option value="current">Current only</option>
              <option value="possibly_closed">Possibly closed</option>
              <option value="closed">Closed or expired</option>
              <option value="all">All posting states</option>
            </select>
          </label>
          <label>
            Verification
            <select
              value={filters.verification}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  verification: event.target.value as RoleDiscoveryFilters["verification"],
                })
              }
            >
              <option value="all">Any verification</option>
              <option value="verified">Verified by source</option>
              <option value="needs_review">Needs review</option>
            </select>
          </label>
          <label>
            Evidence fit
            <select
              value={filters.fit}
              onChange={(event) => onFiltersChange({ ...filters, fit: event.target.value })}
            >
              <option value="all">All explanations</option>
              <option value="strong_evidence">Strong evidence</option>
              <option value="promising_evidence">Promising evidence</option>
              <option value="partial_evidence">Partial evidence</option>
              <option value="weak_evidence">Weak evidence</option>
              <option value="blocked">Has explicit blocker</option>
              <option value="unmatched">Not explained</option>
            </select>
          </label>
          <label>
            Tracking
            <select
              value={filters.tracking}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  tracking: event.target.value as RoleDiscoveryFilters["tracking"],
                })
              }
            >
              <option value="all">All roles</option>
              <option value="tracked">Tracked</option>
              <option value="untracked">Not tracked</option>
            </select>
          </label>
          <label>
            Candidate view
            <select
              value={filters.visibility}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  visibility: event.target.value as RoleDiscoveryFilters["visibility"],
                })
              }
            >
              <option value="active">Current shortlist</option>
              <option value="archived">Archived roles</option>
              <option value="all">Current and archived</option>
            </select>
          </label>
          <div className="role-filter-result" aria-live="polite">
            <strong>
              {roleDiscoveryCounts.visibleRoles} of {roleDiscoveryCounts.totalRoles}
            </strong>
            <span>
              {roleDiscoveryCounts.explanationGroups} explanation group
              {roleDiscoveryCounts.explanationGroups === 1 ? "" : "s"} shown
            </span>
            {filtersActive && (
              <button
                className="button mini quiet"
                type="button"
                onClick={() => {
                  setRoleFiltersOpen(false);
                  onFiltersChange(emptyRoleDiscoveryFilters());
                  window.requestAnimationFrame(() => roleFilterSummary.current?.focus());
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </section>
      </details>
      {comparisonRoles.length > 0 && (
        <RoleComparison
          roles={comparisonRoles}
          onRemove={toggleComparisonRole}
          onClear={() => onComparisonRoleIdsChange([])}
        />
      )}
      <div className="job-list">
        {displayedRoleGroups.map(({ members: clusterMembers, representative: job, assessment }) => {
          const match = job.match;
          const companySignals = dashboard.h1bSignals.filter(
            (signal) =>
              normalizeEmployerName(signal.company) === normalizeEmployerName(job.company),
          );
          const supportedRequirementCount =
            match?.result.requirements.filter((item) => item.state === "supported").length ?? 0;
          const sourcePolicy =
            dashboard.sourceRegistry.find((source) => source.id === job.source) ?? null;
          return (
            <article key={job.id} className="job-row">
              <div className="job-main">
                <div className="company-initial">{job.company.charAt(0)}</div>
                <div>
                  <span className="source-label">{job.source}</span>
                  <h2>{job.title}</h2>
                  <p>
                    {job.company} · {job.location || "Location not specified"}
                  </p>
                  <div className="job-facts" aria-label="Posting facts">
                    <span className="state muted">{human(job.workMode)}</span>
                    <span className="state muted">{human(job.roleFamily)}</span>
                    <span
                      className={`state ${
                        job.availability.publicationState === "active"
                          ? "supported"
                          : job.availability.publicationState === "possibly_closed"
                            ? "warning"
                            : "danger"
                      }`}
                    >
                      {human(job.availability.publicationState)}
                    </span>
                    <span
                      className={`state ${
                        job.availability.verificationHealth === "verified" ||
                        job.availability.verificationHealth === "provider_reported"
                          ? "supported"
                          : "warning"
                      }`}
                    >
                      {human(job.availability.verificationHealth)}
                    </span>
                  </div>
                  <small className="posting-verification">{postingVerificationLabel(job)}</small>
                  {job.atsRoute.state === "gated" && (
                    <small className="posting-verification">{atsRouteGateLabel(job)}</small>
                  )}
                  <RoleProvenanceCard
                    source={job.source}
                    sourceJobId={job.sourceJobId}
                    boardId={job.sourceMeta.board ?? null}
                    contentHash={job.contentHash}
                    localUpdatedAt={job.updatedAt}
                    availability={job.availability}
                    provenance={job.provenance}
                    sourcePolicy={sourcePolicy}
                  />
                  {dashboard.discoveryProfile && (
                    <details className="discovery-rationale">
                      <summary>
                        {assessment.included
                          ? "Why this role is shown"
                          : "Why this role is outside recommendations"}
                      </summary>
                      <p>
                        <span>Replayed from approved profile </span>
                        <code>{dashboard.discoveryProfile.inputHash}</code>
                        <span>
                          {" "}
                          with {dashboard.discoveryProfile.input.matcherVersion} and{" "}
                          {dashboard.discoveryProfile.input.normalizerVersion}
                        </span>
                        <span>. Unresolved facts never become inferred matches.</span>
                      </p>
                      <ul>
                        {assessment.reasons.map((reason, index) => (
                          <li key={`${reason.code}-${index}`}>
                            <span className={`status-dot ${reason.state}`} aria-hidden="true" />
                            <span>
                              <strong>
                                {discoveryReasonLabels[reason.code]} · {human(reason.state)}
                              </strong>
                              <small>{reason.detail}</small>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {clusterMembers.length > 1 && (
                    <details className="source-variants">
                      <summary>{clusterMembers.length} possible source variants</summary>
                      <small>
                        Grouped because every variant has the same complete discovery reason ledger;
                        source records and links remain separate.
                      </small>
                      <ul>
                        {clusterMembers.map((variant) => (
                          <li key={variant.id}>
                            {variant.atsRoute.state === "ready" && variant.atsRoute.targetUrl ? (
                              <a href={variant.atsRoute.targetUrl} target="_blank" rel="noreferrer">
                                {human(variant.source)} · {postingVerificationLabel(variant)}
                              </a>
                            ) : (
                              <span>
                                {human(variant.source)} · {postingVerificationLabel(variant)}
                                {variant.atsRoute.state === "gated" ? " · ATS route gated" : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <H1bEvidencePanel
                    jobTitle={job.title}
                    jobContentHash={job.contentHash}
                    match={match}
                    signals={companySignals}
                    reviews={dashboard.roleWordingReviews.filter(
                      (review) => review.jobId === job.id,
                    )}
                    busy={busy}
                    onSetReviewed={({ matchRunId, blockerCode, reviewed }) => {
                      void onAct.run({
                        request: () =>
                          api(`/v1/jobs/${job.id}/role-wording-review`, {
                            method: "PUT",
                            body: JSON.stringify({ matchRunId, blockerCode, reviewed }),
                          }),
                        success: reviewed
                          ? "Exact role wording acknowledged. Fit and recommendations are unchanged."
                          : "Role-wording acknowledgement cleared.",
                        transient: true,
                      });
                    }}
                  />
                </div>
              </div>
              <div className="job-match">
                {match ? (
                  <>
                    <span
                      className={`state ${match.result.blockers.length ? "warning" : "supported"}`}
                    >
                      {human(match.result.band)}
                    </span>
                    <small>
                      {supportedRequirementCount}/{match.result.requirements.length} requirements
                      supported
                    </small>
                  </>
                ) : (
                  <span className="state muted">Not matched</span>
                )}
              </div>
              <div className="job-actions">
                {job.atsRoute.state === "ready" && job.atsRoute.verificationState === "ready" && (
                  <button
                    className="button mini quiet"
                    type="button"
                    disabled={busy}
                    title={`Candidate-requested ${human(job.atsRoute.verificationMethod ?? "ATS")} · no redirects or applications`}
                    onClick={() => {
                      void onAct.run({
                        request: () =>
                          api<{ attempt: { result: string } }>(`/v1/jobs/${job.id}/verify-route`, {
                            method: "POST",
                          }),
                        success: ({ attempt }) =>
                          attempt.result === "present"
                            ? `Employer ATS recheck confirmed ${job.title} is published.`
                            : attempt.result === "not_found"
                              ? `Employer ATS recheck confirmed ${job.title} is no longer published.`
                              : attempt.result === "absent_from_complete_list"
                                ? `${job.title} was absent from this complete employer-board check. A second check after six hours is required before closure.`
                                : `Employer ATS recheck was blocked. The last known publication state was preserved.`,
                        noticeKind: ({ attempt }) =>
                          attempt.result === "blocked" ? "error" : "ok",
                        transient: true,
                      });
                    }}
                  >
                    <RefreshCw size={15} /> Recheck employer ATS
                  </button>
                )}
                {job.atsRoute.state === "ready" && job.atsRoute.targetUrl && (
                  <a
                    className="button mini quiet"
                    href={job.atsRoute.targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={`${human(job.atsRoute.provider ?? "ATS")} route · ${job.atsRoute.ruleVersion}`}
                  >
                    <Link2 size={15} /> Open employer posting
                  </a>
                )}
                <button
                  className="button mini quiet"
                  type="button"
                  aria-pressed={comparisonRoleIds.includes(job.id)}
                  disabled={comparisonRoleIds.length === 2 && !comparisonRoleIds.includes(job.id)}
                  title={
                    comparisonRoleIds.length === 2 && !comparisonRoleIds.includes(job.id)
                      ? "Remove one compared role before choosing another"
                      : "Use current stored values in the comparison folio"
                  }
                  onClick={() => toggleComparisonRole(job.id)}
                >
                  {comparisonRoleIds.includes(job.id) ? <Check size={15} /> : null}
                  {comparisonRoleIds.includes(job.id) ? "Comparing" : "Compare"}
                </button>
                <button
                  className="button mini quiet"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void onAct.run({
                      request: () => api(`/v1/jobs/${job.id}/match`, { method: "POST" }),
                      success: `Explanation ready for ${job.title}.`,
                    });
                  }}
                >
                  <SlidersHorizontal size={15} /> Explain fit
                </button>
                <button
                  className="button mini primary"
                  type="button"
                  disabled={busy || dashboard.applications.some((item) => item.jobId === job.id)}
                  onClick={() => {
                    void onAct.run({
                      request: () =>
                        api("/v1/applications", {
                          method: "POST",
                          body: JSON.stringify({ jobId: job.id }),
                        }),
                      success: `${job.title} is now tracked.`,
                    });
                  }}
                >
                  <Plus size={15} />{" "}
                  {dashboard.applications.some((item) => item.jobId === job.id)
                    ? "Tracked"
                    : "Track"}
                </button>
                <button
                  className="button mini quiet"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const archived = job.candidateDisposition.state !== "archived";
                    void onAct.run({
                      request: () =>
                        api(`/v1/jobs/${job.id}/disposition`, {
                          method: "PUT",
                          body: JSON.stringify({ archived }),
                        }),
                      success: archived
                        ? "Role archived from discovery. Its application record is unchanged."
                        : "Role restored to the current shortlist.",
                      transient: true,
                    });
                  }}
                >
                  {job.candidateDisposition.state === "archived" ? (
                    <>
                      <ArchiveRestore size={15} /> Restore
                    </>
                  ) : (
                    <>
                      <Archive size={15} /> Archive
                    </>
                  )}
                </button>
              </div>
              {match && (
                <details className="match-detail">
                  <summary>View match anatomy</summary>
                  <div>
                    <div className="match-anatomy-heading">
                      <div>
                        <span>Deterministic result</span>
                        <strong>{human(match.result.coverage)}</strong>
                      </div>
                      <code>{match.result.ruleVersion}</code>
                    </div>
                    <p className="coverage-explanation">
                      Coverage: {supportedRequirementCount} of {match.result.requirements.length}{" "}
                      known requirements supported. At least 0.60 is required for a scored band.
                      {match.result.coverage === "coverage_low"
                        ? " This result is not scored."
                        : " This result meets the coverage floor."}
                    </p>
                    {/* Two different things go stale here and they need opposite
                     * actions, so both are reported. Explaining again fixes an old
                     * version; it does nothing at all when the confirmed evidence is
                     * in no version yet — that returns an identical result, which is
                     * the failure this whole loop was built to explain. */}
                    {(() => {
                      const freshness = explanationFreshness(
                        match,
                        dashboard.profile,
                        confirmedClaimIds,
                      );
                      if (freshness === "current") return null;
                      return (
                        <p className="explanation-freshness" role="status">
                          {freshness === "confirmed_evidence_unsaved"
                            ? "Confirmed evidence is not in any saved profile version yet, so explaining again returns the same result. Save a profile version in the evidence vault first."
                            : "This explanation was scored against an earlier profile version. Explain again to use your current confirmed evidence."}
                        </p>
                      );
                    })()}
                    <div className="dimension-grid" aria-label="Weighted match dimensions">
                      {match.result.dimensions.map((dimension) => (
                        <article key={dimension.name}>
                          <span className={`status-dot ${dimension.state}`} aria-hidden="true" />
                          <div>
                            <strong>{human(dimension.name)}</strong>
                            <small>
                              {human(dimension.state)} · {dimension.weightUnits} weight units ·{" "}
                              {dimension.evidenceIds.length} evidence link
                              {dimension.evidenceIds.length === 1 ? "" : "s"}
                            </small>
                          </div>
                        </article>
                      ))}
                    </div>
                    <p className="boundary-note match-boundary">
                      Coverage below 0.60, including roles without known requirements, remains not
                      scored. At or above that floor, the four weighted dimensions determine the
                      scored band; explicit blockers remain separate and are never averaged away.
                      Evidence Strength is intentionally excluded from this view; this is not a
                      hiring probability.
                    </p>
                    {match.result.blockers.map((blocker) => (
                      <p className="blocker" key={blocker.code}>
                        <CircleAlert size={15} />
                        <span>
                          <strong>{human(blocker.code)}</strong>
                          {/* Without a separator the label ran straight into the
                           * quoted source: "No sponsorship of any kindNo sponsor". */}
                          <span className="blocker-source">{blocker.sourceText}</span>
                          {(blocker.sourceLocator || blocker.observedAt) && (
                            <small className="blocker-provenance">
                              {blocker.sourceLocator ?? "Posting description"}
                              {blocker.observedAt
                                ? ` · observed ${localDateTime(blocker.observedAt)}`
                                : ""}
                              {blocker.candidateConfirmed === false
                                ? " · exact wording not candidate-confirmed as a personal conflict"
                                : ""}
                            </small>
                          )}
                        </span>
                      </p>
                    ))}
                    {match.result.requirements.map((requirement) => (
                      <div className="requirement" key={requirement.requirement}>
                        <span className={`status-dot ${requirement.state}`} />
                        <div>
                          <strong>{requirement.requirement}</strong>
                          <small>{requirement.reason}</small>
                        </div>
                        <code>
                          {requirement.evidenceIds.length} link
                          {requirement.evidenceIds.length === 1 ? "" : "s"}
                        </code>
                        {/* The loop the product is built on. Stating that a
                         * requirement is unmet and stopping made the candidate
                         * memorise the wording and retype it in another section. */}
                        {requirement.state !== "supported" && (
                          <button
                            type="button"
                            className="button mini quiet"
                            disabled={busy}
                            aria-label={`Add evidence for ${requirement.requirement}`}
                            onClick={() => onAddEvidence(requirement.requirement)}
                          >
                            <Plus size={14} /> Add evidence
                          </button>
                        )}
                      </div>
                    ))}
                    {match.result.exclusions.length > 0 && (
                      <div className="match-exclusions">
                        <strong>Excluded inputs</strong>
                        <span>{match.result.exclusions.join(" · ")}</span>
                      </div>
                    )}
                  </div>
                </details>
              )}
              {(job.sourceMeta.compensation ||
                job.sourceMeta.benefits?.length ||
                job.sourceMeta.interviewEvidence) && (
                <div className="job-context">
                  {job.sourceMeta.compensation && (
                    <p>
                      <strong>Posted compensation</strong>{" "}
                      {job.sourceMeta.compensation.minimum?.toLocaleString() ?? "unknown"}–
                      {job.sourceMeta.compensation.maximum?.toLocaleString() ?? "unknown"}{" "}
                      {job.sourceMeta.compensation.currency ?? "USD"} · user-supplied posting
                    </p>
                  )}
                  {Boolean(job.sourceMeta.benefits?.length) && (
                    <p>
                      <strong>Stated benefits</strong> {job.sourceMeta.benefits?.join(" · ")}
                    </p>
                  )}
                  {job.sourceMeta.interviewEvidence && (
                    <p>
                      <strong>Interview context</strong> {job.sourceMeta.interviewEvidence.text} ·{" "}
                      {job.sourceMeta.interviewEvidence.sourceLocator}
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {roleDiscoveryCounts.totalRoles > 0 && roleDiscoveryCounts.visibleRoles === 0 && (
        <Empty
          icon={FolderSearch2}
          title="No roles match this view"
          copy="Clear one or more private filters to bring roles back. No records were changed."
        />
      )}
      <Signals dashboard={dashboard} onAct={onAct} busy={busy} />
    </>
  );
}

function Signals({
  dashboard,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    void onAct.run({
      request: () =>
        api("/v1/h1b-signals", {
          method: "POST",
          body: JSON.stringify({
            ...data,
            confidence: "low",
            observedAt: new Date().toISOString(),
          }),
        }),
      success: "Historical sponsorship evidence added.",
      commit: () => setOpen(false),
    });
  };
  return (
    <section className="signals">
      <div className="panel-heading">
        <div>
          <span>Historical context</span>
          <h2>H-1B evidence signals</h2>
          <p>Signals never override role wording and never promise current support.</p>
        </div>
        <button
          className="button mini quiet"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <Plus size={15} /> Add sourced signal
        </button>
      </div>
      {open && (
        <form className="signal-form" onSubmit={submit}>
          <label>
            Company
            <input name="company" required />
          </label>
          <label>
            Signal
            <select name="label">
              <option value="uncertain">Uncertain</option>
              <option value="possible">Possible</option>
              <option value="recent_positive_history">Recent positive history</option>
              <option value="current_role_transfer_support">
                Current role says transfer support
              </option>
              <option value="no_sponsorship_of_any_kind">No sponsorship of any kind</option>
            </select>
          </label>
          <label>
            Source type
            <input name="sourceType" required placeholder="USCIS disclosure, role text…" />
          </label>
          <label>
            Source period
            <input name="sourcePeriod" required placeholder="FY 2025" />
          </label>
          <label className="wide-field">
            Source locator
            <input name="sourceLocator" required placeholder="Public URL or document locator" />
          </label>
          <label className="wide-field">
            Limitations
            <textarea name="limitations" required placeholder="What this source cannot establish" />
          </label>
          <button className="button primary" disabled={busy}>
            Save evidence signal
          </button>
        </form>
      )}
      <div className="signal-list">
        {dashboard.h1bSignals.map((signal) => (
          <article key={signal.id}>
            <div>
              <strong>{signal.company}</strong>
              <span className="state warning">{human(signal.label)}</span>
            </div>
            <p>
              {signal.sourceType} · {signal.sourcePeriod}
            </p>
            <span className={`state ${signal.freshness === "current" ? "supported" : "warning"}`}>
              {human(signal.freshness)} source
            </span>
            <details className="signal-provenance">
              <summary>Source and freshness</summary>
              <dl>
                <div>
                  <dt>Observed</dt>
                  <dd>{localDateTime(signal.observedAt)}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{human(signal.confidence)}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>
                    {signal.sourceType} · {signal.sourcePeriod}
                  </dd>
                </div>
                <div>
                  <dt>Locator</dt>
                  <dd>
                    <code>{signal.sourceLocator}</code>
                  </dd>
                </div>
                {signal.originalLabel !== signal.label && (
                  <div>
                    <dt>Freshness adjustment</dt>
                    <dd>
                      {human(signal.originalLabel)} → {human(signal.label)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Limits</dt>
                  <dd>{signal.limitations}</dd>
                </div>
              </dl>
              <p className="boundary-note">
                Historical evidence cannot establish current eligibility, company policy, or legal
                advice. Current role wording remains controlling.
              </p>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

function StoredHistory() {
  const [profiles, setProfiles] = useState<HistoryPage<ProfileVersion> | null>(null);
  const [matchOverview, setMatchOverview] = useState<HistoryPage<MatchHistoryRun> | null>(null);
  const [jobRuns, setJobRuns] = useState<HistoryPage<MatchHistoryRun> | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [profileBefore, setProfileBefore] = useState("");
  const [profileAfter, setProfileAfter] = useState("");
  const [matchBefore, setMatchBefore] = useState("");
  const [matchAfter, setMatchAfter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api<HistoryPage<ProfileVersion>>("/v1/history/profile-versions?limit=20"),
      api<HistoryPage<MatchHistoryRun>>("/v1/history/match-runs?limit=20"),
    ])
      .then(([profilePage, matchPage]) => {
        if (cancelled) return;
        setProfiles(profilePage);
        setMatchOverview(matchPage);
        setProfileAfter(profilePage.items[0]?.id ?? "");
        setProfileBefore(profilePage.items[1]?.id ?? "");
        setSelectedJobId(matchPage.items[0]?.jobId ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Stored history could not be loaded from the local service.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setJobRuns(null);
      return;
    }
    let cancelled = false;
    setJobRuns(null);
    void api<HistoryPage<MatchHistoryRun>>(
      `/v1/history/match-runs?jobId=${encodeURIComponent(selectedJobId)}&limit=20`,
    )
      .then((page) => {
        if (cancelled) return;
        setJobRuns(page);
        setMatchAfter(page.items[0]?.id ?? "");
        setMatchBefore(page.items[1]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Match-run history could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  const profileVersions = profiles?.items ?? [];
  const beforeProfile = profileVersions.find((item) => item.id === profileBefore);
  const afterProfile = profileVersions.find((item) => item.id === profileAfter);
  const profileDiff =
    beforeProfile && afterProfile ? profileVersionDiff(beforeProfile, afterProfile) : null;
  const jobs = [
    ...new Map(
      (matchOverview?.items ?? [])
        .filter((run) => run.currentJob)
        .map((run) => [run.jobId, run.currentJob!]),
    ).values(),
  ];
  const beforeRun = jobRuns?.items.find((run) => run.id === matchBefore);
  const afterRun = jobRuns?.items.find((run) => run.id === matchAfter);

  const appendProfiles = async () => {
    if (!profiles?.nextCursor) return;
    const page = await api<HistoryPage<ProfileVersion>>(
      `/v1/history/profile-versions?limit=20&cursor=${encodeURIComponent(profiles.nextCursor)}`,
    );
    setProfiles({ items: [...profiles.items, ...page.items], nextCursor: page.nextCursor });
  };
  const appendMatchOverview = async () => {
    if (!matchOverview?.nextCursor) return;
    const page = await api<HistoryPage<MatchHistoryRun>>(
      `/v1/history/match-runs?limit=20&cursor=${encodeURIComponent(matchOverview.nextCursor)}`,
    );
    setMatchOverview({
      items: [...matchOverview.items, ...page.items],
      nextCursor: page.nextCursor,
    });
  };
  const appendJobRuns = async () => {
    if (!jobRuns?.nextCursor || !selectedJobId) return;
    const page = await api<HistoryPage<MatchHistoryRun>>(
      `/v1/history/match-runs?jobId=${encodeURIComponent(selectedJobId)}&limit=20&cursor=${encodeURIComponent(jobRuns.nextCursor)}`,
    );
    setJobRuns({ items: [...jobRuns.items, ...page.items], nextCursor: page.nextCursor });
  };

  return (
    <>
      <PageIntro
        eyebrow="Stored history"
        title="Inspect what changed—without inventing why."
        copy="Profile versions and deterministic match runs are retained as stored records. Comparisons are literal; they do not reconstruct mutable job history or prove causality."
      />
      {error && (
        <div className="notice error" role="alert">
          <CircleAlert size={17} /> {error}
        </div>
      )}
      {loading ? (
        <Empty
          icon={FileClock}
          title="Loading stored history"
          copy="Reading this workspace only."
        />
      ) : (
        <div className="history-grid">
          <section className="work-panel history-panel" aria-labelledby="profile-history-title">
            <div className="panel-heading">
              <div>
                <span>Exact profile records</span>
                <h2 id="profile-history-title">Profile version diff</h2>
                <p>Claim identifiers and authorization wording only.</p>
              </div>
              <strong>{profileVersions.length} loaded</strong>
            </div>
            {profileVersions.length >= 2 ? (
              <>
                <div className="history-selectors">
                  <label>
                    Version A
                    <select
                      aria-label="Profile version A"
                      value={profileBefore}
                      onChange={(event) => setProfileBefore(event.target.value)}
                    >
                      {profileVersions.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {localDateTime(profile.createdAt)} · {profile.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Version B
                    <select
                      aria-label="Profile version B"
                      value={profileAfter}
                      onChange={(event) => setProfileAfter(event.target.value)}
                    >
                      {profileVersions.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {localDateTime(profile.createdAt)} · {profile.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {profileDiff && (
                  <div className="literal-diff">
                    <div>
                      <span>Added claim IDs</span>
                      {profileDiff.addedClaimIds.length ? (
                        profileDiff.addedClaimIds.map((id) => <code key={id}>{id}</code>)
                      ) : (
                        <small>None</small>
                      )}
                    </div>
                    <div>
                      <span>Removed claim IDs</span>
                      {profileDiff.removedClaimIds.length ? (
                        profileDiff.removedClaimIds.map((id) => <code key={id}>{id}</code>)
                      ) : (
                        <small>None</small>
                      )}
                    </div>
                    <div className="history-wording">
                      <span>Version A exact wording</span>
                      <p>{profileDiff.beforeAuthorizationWording || "No wording stored."}</p>
                    </div>
                    <div className="history-wording">
                      <span>Version B exact wording</span>
                      <p>{profileDiff.afterAuthorizationWording || "No wording stored."}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Empty
                icon={FileClock}
                title="One profile version stored"
                copy="Save another version to enable a literal diff."
              />
            )}
            {profiles?.nextCursor && (
              <button
                className="button mini quiet"
                type="button"
                onClick={() => void appendProfiles()}
              >
                Load older profile versions
              </button>
            )}
          </section>

          <section className="work-panel history-panel" aria-labelledby="match-history-title">
            <div className="panel-heading">
              <div>
                <span>Deterministic stored outputs</span>
                <h2 id="match-history-title">Same-role match comparison</h2>
                <p>Current role fields are shown as a mutable snapshot.</p>
              </div>
              <strong>{matchOverview?.items.length ?? 0} loaded</strong>
            </div>
            {jobs.length ? (
              <>
                <label>
                  Role with stored runs
                  <select
                    value={selectedJobId}
                    onChange={(event) => setSelectedJobId(event.target.value)}
                  >
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} · {job.company}
                      </option>
                    ))}
                  </select>
                </label>
                {jobRuns?.items.length && jobRuns.items.length >= 2 ? (
                  <>
                    <div className="history-selectors">
                      <label>
                        Run A
                        <select
                          aria-label="Stored match run A"
                          value={matchBefore}
                          onChange={(event) => setMatchBefore(event.target.value)}
                        >
                          {jobRuns.items.map((run) => (
                            <option key={run.id} value={run.id}>
                              {localDateTime(run.createdAt)} · {run.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Run B
                        <select
                          aria-label="Stored match run B"
                          value={matchAfter}
                          onChange={(event) => setMatchAfter(event.target.value)}
                        >
                          {jobRuns.items.map((run) => (
                            <option key={run.id} value={run.id}>
                              {localDateTime(run.createdAt)} · {run.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {beforeRun && afterRun && (
                      <div className="run-comparison">
                        {[beforeRun, afterRun].map((run, index) => (
                          <article key={run.id + "-" + index}>
                            <span>{index === 0 ? "Stored run A" : "Stored run B"}</span>
                            <h3>{human(run.result.band)}</h3>
                            <time dateTime={run.createdAt}>{localDateTime(run.createdAt)}</time>
                            <dl>
                              <div>
                                <dt>Run ID</dt>
                                <dd>
                                  <code>{run.id}</code>
                                </dd>
                              </div>
                              <div>
                                <dt>Profile version</dt>
                                <dd>
                                  <code>{run.profileVersionId ?? "none"}</code>
                                </dd>
                              </div>
                              <div>
                                <dt>Stored input hash</dt>
                                <dd>
                                  <code>{run.inputHash}</code>
                                </dd>
                              </div>
                              <div>
                                <dt>Stored result hash</dt>
                                <dd>
                                  <code>{run.artifactHash}</code>
                                </dd>
                              </div>
                              <div>
                                <dt>Rule version</dt>
                                <dd>
                                  <code>{run.ruleVersion}</code>
                                </dd>
                              </div>
                              <div>
                                <dt>Blockers</dt>
                                <dd>
                                  {run.result.blockers.length ? (
                                    <ul className="literal-values">
                                      {run.result.blockers.map((blocker) => (
                                        <li key={blocker.code + ":" + blocker.sourceText}>
                                          <code>{blocker.code}</code> · {blocker.sourceText}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    "None"
                                  )}
                                </dd>
                              </div>
                            </dl>
                          </article>
                        ))}
                      </div>
                    )}
                    <p className="boundary-note">
                      The input hash identifies the stored job and profile-version references; it is
                      not a content hash. A changed result is not attributed to any cause.
                    </p>
                  </>
                ) : (
                  <Empty
                    icon={FileClock}
                    title="One run stored for this role"
                    copy="Run the same deterministic match again to enable comparison."
                  />
                )}
                {jobRuns?.nextCursor && (
                  <button
                    className="button mini quiet"
                    type="button"
                    onClick={() => void appendJobRuns()}
                  >
                    Load older runs for this role
                  </button>
                )}
              </>
            ) : (
              <Empty
                icon={Sparkles}
                title="No match history yet"
                copy="Run a role explanation to create the first stored match record."
              />
            )}
            {matchOverview?.nextCursor && (
              <button
                className="button mini quiet"
                type="button"
                onClick={() => void appendMatchOverview()}
              >
                Load older roles and runs
              </button>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function ApplicationFilterDisclosure({
  view,
  dispatch,
  cohortSources,
  visibleCount,
  totalCount,
  filtersActive,
}: {
  view: ApplicationViewState;
  dispatch: ApplicationsWorkbench["dispatch"];
  cohortSources: string[];
  visibleCount: number;
  totalCount: number;
  filtersActive: boolean;
}) {
  return (
    <details className="secondary-controls application-filter-disclosure">
      <summary>
        <span>
          <SlidersHorizontal size={16} aria-hidden="true" /> Filter and sort
        </span>
        <small>
          {visibleCount} of {totalCount} records shown
        </small>
      </summary>
      <section
        className="role-filter application-filter"
        aria-labelledby="application-filter-title"
      >
        <div>
          <span>Private decision lens</span>
          <h2 id="application-filter-title">Find an application record</h2>
          <p>Search, filters, and sort stay in this tab. They change no record or funnel count.</p>
        </div>
        <label className="role-search">
          Search applications
          <input
            type="search"
            value={view.query}
            placeholder="Role, company, note, or outcome"
            onChange={(event) =>
              dispatch({
                type: "view_changed",
                view: { ...view, query: event.target.value },
              })
            }
          />
        </label>
        <label>
          Status
          <select
            value={view.status}
            onChange={(event) =>
              dispatch({
                type: "view_changed",
                view: {
                  ...view,
                  status: event.target.value as ApplicationViewState["status"],
                },
              })
            }
          >
            <option value="all">All statuses</option>
            {BOARD_COLUMNS.map((column) => (
              <option key={column.id} value={column.id}>
                {column.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select
            value={view.source}
            onChange={(event) =>
              dispatch({
                type: "view_changed",
                view: { ...view, source: event.target.value },
              })
            }
          >
            <option value="all">All sources</option>
            {cohortSources.map((source) => (
              <option key={source} value={source}>
                {human(source)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Follow-up
          <select
            value={view.followUp}
            onChange={(event) =>
              dispatch({
                type: "view_changed",
                view: {
                  ...view,
                  followUp: event.target.value as ApplicationViewState["followUp"],
                },
              })
            }
          >
            <option value="all">All reminder states</option>
            <option value="due">Due</option>
            <option value="scheduled">Scheduled</option>
            <option value="none">No reminder</option>
            <option value="inactive">Inactive reminder</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={view.sort}
            onChange={(event) =>
              dispatch({
                type: "view_changed",
                view: {
                  ...view,
                  sort: event.target.value as ApplicationViewState["sort"],
                },
              })
            }
          >
            <option value="stored">Stored order</option>
            <option value="newest">Newest tracked</option>
            <option value="follow_up">Follow-up date</option>
            <option value="role">Role A–Z</option>
          </select>
        </label>
        <div className="role-filter-result" aria-live="polite">
          <strong>
            {visibleCount} of {totalCount}
          </strong>
          <span>records shown</span>
          {filtersActive && (
            <button
              className="button mini quiet"
              type="button"
              onClick={() =>
                dispatch({
                  type: "view_changed",
                  view: {
                    ...view,
                    query: "",
                    status: "all",
                    source: "all",
                    followUp: "all",
                  },
                })
              }
            >
              Clear filters
            </button>
          )}
        </div>
      </section>
    </details>
  );
}

function Applications({
  dashboard,
  onAct,
  busy,
  onGo,
  workbench,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
  onGo: (section: Section) => void;
  workbench: ApplicationsWorkbench;
}) {
  const { state, dispatch } = workbench;
  const view = state.display;
  const workingView = state.view;
  const outcomeFor = state.outcomes.activeApplicationId;
  const outcomeDraft = outcomeFor ? (state.outcomes.byApplication[outcomeFor] ?? null) : null;
  const reminderFor = state.reminders.activeApplicationId;
  const reminderDraft = reminderFor ? (state.reminders.byApplication[reminderFor] ?? null) : null;
  const noteFor = state.notes.activeApplicationId;
  const noteDraft = noteFor ? (state.notes.byApplication[noteFor] ?? null) : null;
  const [pendingMove, setPendingMove] = useState<{ id: string; to: ApplicationStatus } | null>(
    null,
  );
  const pendingMoveOrigin = useRef<HTMLSelectElement | null>(null);
  const returnPendingMoveFocus = useRef(false);
  const board = useOverflowFlag<HTMLElement>();
  const now = new Date();
  const reviewQueue = recordReviewQueue(dashboard.applications, now);
  const scheduledReviewCount = reviewQueue.filter(
    (item) => item.basis === "candidate_reminder",
  ).length;
  const derivedReviewCount = reviewQueue.length - scheduledReviewCount;
  const deferredApplicationQuery = useDeferredValue(workingView.query);
  const reviewApplications = workingView.reviewOnly
    ? reviewQueue.map((item) => item.application)
    : dashboard.applications;
  const visibleApplications = sortApplications(
    filterApplications(
      reviewApplications,
      dashboard.jobs,
      { ...workingView, query: deferredApplicationQuery },
      now,
    ),
    workingView.sort,
  );
  const cohort = applicationCohortCounts({
    applications: dashboard.applications,
    jobs: dashboard.jobs,
    matches: dashboard.matches,
    startAt: localDayInstant(workingView.cohortStart),
    endAtExclusive: localDayInstant(workingView.cohortEnd, 1),
    source: workingView.cohortSource,
    matchBucket: workingView.cohortBucket,
  });
  const cohortTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cohortSources = [...new Set(dashboard.jobs.map((job) => job.source))].toSorted();
  const applicationFiltersActive = Boolean(
    workingView.query ||
    workingView.status !== "all" ||
    workingView.source !== "all" ||
    workingView.followUp !== "all",
  );
  const openOutcome = (id: string) => {
    if (outcomeFor === id) {
      document.getElementById(`outcome-editor-${id}-type`)?.focus();
      return;
    }
    // Capture the live controlled fields at the switching boundary too. A
    // second trigger can be pressed in the same render turn as the last input
    // event; the candidate's visible value is authoritative and must not wait
    // for React's parent update before it is retained.
    const activeDraft = outcomeFor ? state.outcomes.byApplication[outcomeFor] : null;
    const liveActiveDraft = activeDraft
      ? {
          ...activeDraft,
          type:
            (
              document.getElementById(
                `outcome-editor-${outcomeFor}-type`,
              ) as HTMLSelectElement | null
            )?.value ?? activeDraft.type,
          note:
            (
              document.getElementById(
                `outcome-editor-${outcomeFor}-note`,
              ) as HTMLInputElement | null
            )?.value ?? activeDraft.note,
        }
      : null;
    dispatch({
      type: "outcome_opened",
      applicationId: id,
      activeDraft: liveActiveDraft,
    });
  };
  const focusOutcomeTrigger = (id: string) => {
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document.getElementById(`outcome-trigger-${view}-${id}`)?.focus(),
      ),
    );
  };
  const closeOutcome = (id: string) => {
    dispatch({ type: "outcome_closed", applicationId: id });
    focusOutcomeTrigger(id);
  };
  const changeOutcomeDraft = (draft: OutcomeDraft) => {
    dispatch({ type: "outcome_changed", draft });
  };
  const openReminder = (application: Application) => {
    if (reminderFor === application.id) {
      document.getElementById(`reminder-editor-${application.id}-date`)?.focus();
      return;
    }
    const activeDraft = reminderFor ? state.reminders.byApplication[reminderFor] : null;
    const liveActiveDraft = activeDraft
      ? {
          ...activeDraft,
          followUpOn:
            (
              document.getElementById(
                `reminder-editor-${reminderFor}-date`,
              ) as HTMLInputElement | null
            )?.value ?? activeDraft.followUpOn,
        }
      : null;
    dispatch({
      type: "reminder_opened",
      applicationId: application.id,
      persistedDate: application.followUpOn ?? "",
      activeDraft: liveActiveDraft,
    });
  };
  const focusReminderOrigin = (id: string) => {
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        const trigger = document.getElementById(`reminder-trigger-${view}-${id}`);
        if (trigger) {
          trigger.focus();
          return;
        }
        document
          .getElementById(view === "board" ? `board-card-${id}` : `application-row-${id}`)
          ?.focus();
      }),
    );
  };
  const closeReminder = (id: string) => {
    dispatch({ type: "reminder_closed", applicationId: id });
    focusReminderOrigin(id);
  };
  const changeReminderDraft = (draft: ReminderDraft) => {
    dispatch({ type: "reminder_changed", draft });
  };
  const openNote = (id: string) => {
    if (noteFor === id) {
      document.getElementById(`note-editor-${id}-text`)?.focus();
      return;
    }
    const activeDraft = noteFor ? state.notes.byApplication[noteFor] : null;
    const liveActiveDraft = activeDraft
      ? {
          ...activeDraft,
          text:
            (document.getElementById(`note-editor-${noteFor}-text`) as HTMLTextAreaElement | null)
              ?.value ?? activeDraft.text,
        }
      : null;
    dispatch({ type: "note_opened", applicationId: id, activeDraft: liveActiveDraft });
  };
  const focusNoteTrigger = (id: string) => {
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document.getElementById(`note-trigger-${view}-${id}`)?.focus(),
      ),
    );
  };
  const closeNote = (id: string) => {
    dispatch({ type: "note_closed", applicationId: id });
    focusNoteTrigger(id);
  };
  const changeNoteDraft = (draft: ApplicationNoteDraft) => {
    dispatch({ type: "note_changed", draft });
  };
  const exportCalendar = () => {
    const calendar = buildFollowUpCalendar(dashboard.applications);
    if (calendar.eventCount === 0) return;
    downloadTextFile(calendar.content, "text/calendar;charset=utf-8", calendar.filename);
  };
  const exportCsv = () => {
    const csv = buildApplicationCsv(visibleApplications, dashboard.jobs);
    if (csv.rowCount === 0) return;
    downloadTextFile(csv.content, "text/csv;charset=utf-8", csv.filename);
  };
  const calendarEventCount = buildFollowUpCalendar(dashboard.applications, now).eventCount;
  useEffect(() => {
    if (pendingMove || !returnPendingMoveFocus.current) return;
    returnPendingMoveFocus.current = false;
    pendingMoveOrigin.current?.focus();
  }, [pendingMove]);

  const cancelPendingMove = () => {
    returnPendingMoveFocus.current = true;
    setPendingMove(null);
  };

  /* Moving a card is a claim about what the candidate did in the world, so the
   * consequential columns ask first. The server enforces legality independently
   * — this only decides which moves to offer.
   *
   * Every status control routes through here. It used to guard the board only,
   * while the row list wrote the same endpoint through a bare <select> with no
   * legality filter and no confirmation, so the strongest gate in the product
   * could be walked around without leaving the screen. */
  const move = (application: Application, to: ApplicationStatus) => {
    if (to === application.status || !canMove(application.status, to)) return;
    const tableOrigin = pendingMove?.id === application.id ? pendingMoveOrigin.current : null;
    setPendingMove(null);
    const confirmed = needsConfirmation(application.status, to);
    void onAct.run({
      request: () =>
        api(`/v1/applications/${application.id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: to, confirmed }),
        }),
      success: "Application status updated.",
      transient: true,
      focus: () => {
        if (tableOrigin?.isConnected) {
          tableOrigin.focus();
          return;
        }
        const card = document.getElementById(`board-card-${application.id}`);
        card?.focus();
        /* The board is wider than the content column on every laptop width, so
         * the destination stage is routinely outside the viewport. Focusing a
         * card the candidate cannot see is worse than not moving at all. */
        card?.scrollIntoView({ block: "nearest", inline: "nearest" });
      },
    });
  };

  /* The table's control is a <select>, which cannot arm itself, so the pending
   * consequential target waits here until the strip beneath it is answered. */
  const requestMove = (
    application: Application,
    to: ApplicationStatus,
    origin?: HTMLSelectElement,
  ) => {
    if (to === application.status || !canMove(application.status, to)) return;
    if (needsConfirmation(application.status, to)) {
      pendingMoveOrigin.current = origin ?? null;
      setPendingMove({ id: application.id, to });
      return;
    }
    move(application, to);
  };

  return (
    <>
      <PageIntro
        eyebrow="Applications"
        title="Track the real process."
        copy="Keep preparation, external submission, and candidate-reported outcomes separate. Nimanto never infers an outcome from silence."
        action={
          <div className="button-group">
            <button
              className="button quiet mini"
              type="button"
              disabled={visibleApplications.length === 0}
              onClick={exportCsv}
              title="Exports the records shown below; private note and outcome text are excluded"
            >
              <Download size={15} /> Export shown (.csv)
            </button>
            <button
              className="button quiet mini"
              type="button"
              disabled={calendarEventCount === 0}
              onClick={exportCalendar}
              title="Downloads a local calendar file; Nimanto creates no notification"
            >
              <CalendarPlus size={15} /> Export reminders (.ics)
            </button>
            <button
              className="button quiet mini"
              type="button"
              onClick={() => {
                dispatch({
                  type: "display_changed",
                  display: view === "board" ? "table" : "board",
                });
              }}
            >
              {view === "board" ? "Table view" : "Board view"}
            </button>
            <button
              className="button quiet mini"
              type="button"
              aria-pressed={workingView.reviewOnly}
              onClick={() =>
                dispatch({
                  type: "view_changed",
                  view: { ...workingView, reviewOnly: !workingView.reviewOnly },
                })
              }
            >
              <Clock3 size={15} />{" "}
              {workingView.reviewOnly ? "Show all" : `Review due · ${reviewQueue.length}`}
            </button>
            {/* "another" is a claim about the record, so it has to read it.
             * The empty state below already says "Track a role"; the header
             * offering to track another one contradicted it on first run. */}
            <button className="button quiet" type="button" onClick={() => onGo("jobs")}>
              <Plus size={16} />{" "}
              {dashboard.applications.length > 0 ? "Track another role" : "Track a role"}
            </button>
          </div>
        }
      />
      {view === "board" && visibleApplications.length > 0 && (
        <section
          className="board"
          ref={board.ref}
          role="region"
          tabIndex={0}
          data-overflowing={board.overflowing ? "true" : "false"}
          aria-label="Application pipeline"
          aria-describedby={board.overflowing ? "board-scroll-note" : undefined}
        >
          {boardColumns(visibleApplications).map((column) => (
            <div className="board-column" key={column.id}>
              <header>
                <h3>{column.label}</h3>
                <span>{column.items.length}</span>
              </header>
              {column.items.map((application) => {
                const note = followUpNote(application, now);
                const role = application.job
                  ? `${application.job.title} at ${application.job.company}`
                  : "this application";
                return (
                  <article
                    className="board-card"
                    key={application.id}
                    id={`board-card-${application.id}`}
                    tabIndex={-1}
                  >
                    <strong>{application.job?.title ?? "Unknown role"}</strong>
                    <span>{application.job?.company}</span>
                    {note && (
                      <span className="follow-up">
                        <Clock3 size={12} aria-hidden="true" />
                        <span>{note}</span>
                      </span>
                    )}
                    <RecordedTimeline application={application} />
                    <button
                      id={`outcome-trigger-board-${application.id}`}
                      className="button mini quiet"
                      type="button"
                      disabled={busy}
                      aria-expanded={outcomeFor === application.id}
                      aria-controls={
                        outcomeFor === application.id
                          ? `outcome-editor-${application.id}`
                          : undefined
                      }
                      onClick={() => openOutcome(application.id)}
                    >
                      <Plus size={15} /> Record outcome
                    </button>
                    {outcomeFor === application.id && (
                      <OutcomeEditor
                        application={application}
                        onAct={onAct}
                        busy={busy}
                        draft={outcomeDraft!}
                        onDraftChange={changeOutcomeDraft}
                        onRecorded={(submitted) =>
                          dispatch({ type: "outcome_committed", submitted })
                        }
                        onFocusTrigger={() => focusOutcomeTrigger(application.id)}
                        onClose={() => closeOutcome(application.id)}
                      />
                    )}
                    {(application.status !== "withdrawn" || application.followUpOn) && (
                      <>
                        <button
                          id={`reminder-trigger-board-${application.id}`}
                          className="button mini quiet"
                          type="button"
                          disabled={busy}
                          aria-expanded={reminderFor === application.id}
                          aria-controls={
                            reminderFor === application.id
                              ? `reminder-editor-${application.id}`
                              : undefined
                          }
                          onClick={() => openReminder(application)}
                        >
                          <CalendarClock size={15} aria-hidden="true" />
                          {application.status === "withdrawn"
                            ? "Review follow-up"
                            : application.followUpOn
                              ? "Change follow-up"
                              : "Set follow-up"}
                        </button>
                        {reminderFor === application.id && (
                          <ReminderEditor
                            application={application}
                            onAct={onAct}
                            busy={busy}
                            draft={reminderDraft!}
                            onDraftChange={changeReminderDraft}
                            onCommitted={(submitted) =>
                              dispatch({ type: "reminder_committed", submitted })
                            }
                            onFocusTrigger={() => focusReminderOrigin(application.id)}
                            onClose={() => closeReminder(application.id)}
                          />
                        )}
                      </>
                    )}
                    <button
                      id={`note-trigger-board-${application.id}`}
                      className="button mini quiet"
                      type="button"
                      disabled={busy}
                      aria-expanded={noteFor === application.id}
                      aria-controls={
                        noteFor === application.id ? `note-editor-${application.id}` : undefined
                      }
                      onClick={() => openNote(application.id)}
                    >
                      <NotebookPen size={15} /> Add private note
                    </button>
                    {noteFor === application.id && (
                      <ApplicationNoteEditor
                        application={application}
                        onAct={onAct}
                        busy={busy}
                        draft={noteDraft!}
                        onDraftChange={changeNoteDraft}
                        onRecorded={(submitted) => dispatch({ type: "note_committed", submitted })}
                        onFocusTrigger={() => focusNoteTrigger(application.id)}
                        onClose={() => closeNote(application.id)}
                      />
                    )}
                    {/* Keyboard-operable by construction: buttons, not drag. */}
                    <div className="board-move">
                      <span className="board-move-label">Move to</span>
                      {/* Same source as the row list's options, so the two
                       * controls cannot drift into offering different moves. */}
                      {legalTargets(application.status)
                        .filter((id) => id !== application.status)
                        .map((id) => BOARD_COLUMNS.find((column) => column.id === id)!)
                        .map((target) =>
                          needsConfirmation(application.status, target.id) ? (
                            <ConfirmAction
                              key={target.id}
                              className=""
                              label={target.label}
                              // Visually the column name is enough; heard on its
                              // own in a list of twenty cards, "Prepared" is not.
                              triggerLabel={`Move ${role} to ${target.label}`}
                              question={confirmationPrompt(target.id, application)}
                              confirmLabel={`Mark ${target.label.toLocaleLowerCase("en-US")}`}
                              cancelLabel="Cancel"
                              disabled={busy}
                              onConfirm={() => move(application, target.id)}
                            />
                          ) : (
                            <button
                              key={target.id}
                              type="button"
                              disabled={busy}
                              aria-label={`Move ${role} to ${target.label}`}
                              onClick={() => move(application, target.id)}
                            >
                              {target.label}
                            </button>
                          ),
                        )}
                    </div>
                  </article>
                );
              })}
              {column.items.length === 0 && <small className="field-note">Nothing here yet</small>}
            </div>
          ))}
        </section>
      )}
      {view === "board" && visibleApplications.length > 0 && board.overflowing && (
        <small className="field-note board-scroll-note" id="board-scroll-note">
          More stages sit past the right edge. Scroll the pipeline sideways, or focus it and use the
          arrow keys.
        </small>
      )}

      {view === "table" && visibleApplications.length > 0 && (
        <section className="application-table" aria-label="Tracked applications">
          <div className="table-head" aria-hidden="true">
            <span>Role</span>
            <span>Status</span>
            <span>Outcomes</span>
            <span>Next step</span>
          </div>
          {visibleApplications.map((application) => {
            const note = followUpNote(application, now);
            return (
              <article
                key={application.id}
                id={`application-row-${application.id}`}
                className="table-row"
                tabIndex={-1}
              >
                <div className="application-identity">
                  <strong>{application.job?.title ?? "Unknown role"}</strong>
                  <small>{application.job?.company}</small>
                  {note && (
                    <span className="follow-up">
                      <Clock3 size={12} aria-hidden="true" />
                      <span>{note}</span>
                    </span>
                  )}
                </div>
                <label>
                  <span className="sr-only">Status for {application.job?.title}</span>
                  {/* Same guard as the board, and only the moves the domain allows.
                   * Listing all five taught the candidate about illegal transitions
                   * by way of a rejected request. On a declined confirmation the
                   * value prop restores itself on the next render. */}
                  <select
                    value={application.status}
                    disabled={busy}
                    onChange={(event) =>
                      requestMove(
                        application,
                        event.currentTarget.value as ApplicationStatus,
                        event.currentTarget,
                      )
                    }
                  >
                    {legalTargets(application.status).map((target) => (
                      <option key={target} value={target}>
                        {BOARD_COLUMNS.find((column) => column.id === target)!.label}
                      </option>
                    ))}
                  </select>
                </label>
                {pendingMove?.id === application.id && (
                  <ConfirmationStrip
                    question={confirmationPrompt(pendingMove.to, application)}
                    confirmLabel={`Mark ${BOARD_COLUMNS.find((column) => column.id === pendingMove.to)!.label.toLocaleLowerCase("en-US")}`}
                    cancelLabel="Cancel"
                    disabled={busy}
                    onConfirm={() => move(application, pendingMove.to)}
                    onCancel={cancelPendingMove}
                  />
                )}
                <div className="outcome-chips">
                  {application.outcomes?.length ? (
                    application.outcomes.map((outcome) => (
                      <span key={outcome.id}>{human(outcome.type)}</span>
                    ))
                  ) : (
                    <small>No outcome recorded</small>
                  )}
                  <RecordedTimeline application={application} />
                </div>
                <button
                  id={`outcome-trigger-table-${application.id}`}
                  className="button mini quiet"
                  type="button"
                  disabled={busy}
                  aria-expanded={outcomeFor === application.id}
                  aria-controls={
                    outcomeFor === application.id ? `outcome-editor-${application.id}` : undefined
                  }
                  onClick={() => openOutcome(application.id)}
                >
                  <Plus size={15} /> Record outcome
                </button>
                {outcomeFor === application.id && (
                  <OutcomeEditor
                    application={application}
                    onAct={onAct}
                    busy={busy}
                    draft={outcomeDraft!}
                    onDraftChange={changeOutcomeDraft}
                    onRecorded={(submitted) => dispatch({ type: "outcome_committed", submitted })}
                    onFocusTrigger={() => focusOutcomeTrigger(application.id)}
                    onClose={() => closeOutcome(application.id)}
                  />
                )}
                {(application.status !== "withdrawn" || application.followUpOn) && (
                  <>
                    <button
                      id={`reminder-trigger-table-${application.id}`}
                      className="button mini quiet"
                      type="button"
                      disabled={busy}
                      aria-expanded={reminderFor === application.id}
                      aria-controls={
                        reminderFor === application.id
                          ? `reminder-editor-${application.id}`
                          : undefined
                      }
                      onClick={() => openReminder(application)}
                    >
                      <CalendarClock size={15} aria-hidden="true" />
                      {application.status === "withdrawn"
                        ? "Review follow-up"
                        : application.followUpOn
                          ? "Change follow-up"
                          : "Set follow-up"}
                    </button>
                    {reminderFor === application.id && (
                      <ReminderEditor
                        application={application}
                        onAct={onAct}
                        busy={busy}
                        draft={reminderDraft!}
                        onDraftChange={changeReminderDraft}
                        onCommitted={(submitted) =>
                          dispatch({ type: "reminder_committed", submitted })
                        }
                        onFocusTrigger={() => focusReminderOrigin(application.id)}
                        onClose={() => closeReminder(application.id)}
                      />
                    )}
                  </>
                )}
                <button
                  id={`note-trigger-table-${application.id}`}
                  className="button mini quiet"
                  type="button"
                  disabled={busy}
                  aria-expanded={noteFor === application.id}
                  aria-controls={
                    noteFor === application.id ? `note-editor-${application.id}` : undefined
                  }
                  onClick={() => openNote(application.id)}
                >
                  <NotebookPen size={15} /> Add private note
                </button>
                {noteFor === application.id && (
                  <ApplicationNoteEditor
                    application={application}
                    onAct={onAct}
                    busy={busy}
                    draft={noteDraft!}
                    onDraftChange={changeNoteDraft}
                    onRecorded={(submitted) => dispatch({ type: "note_committed", submitted })}
                    onFocusTrigger={() => focusNoteTrigger(application.id)}
                    onClose={() => closeNote(application.id)}
                  />
                )}
              </article>
            );
          })}
        </section>
      )}
      {dashboard.applications.length === 0 && (
        <Empty
          icon={BriefcaseBusiness}
          title="No applications tracked"
          copy="Choose Track from Role discovery when a position is worth pursuing."
          action={
            <button className="button primary" type="button" onClick={() => onGo("jobs")}>
              <Plus size={16} /> Track a role
            </button>
          }
        />
      )}
      {dashboard.applications.length > 0 && visibleApplications.length === 0 && (
        <Empty
          icon={applicationFiltersActive ? FolderSearch2 : Clock3}
          title={
            applicationFiltersActive
              ? "No applications match this view"
              : "No records are due for review"
          }
          copy={
            applicationFiltersActive
              ? "Clear one or more private filters to bring records back. No application changed."
              : "No candidate-set reminder is due, and no unscheduled active record has crossed 336 elapsed hours since its latest recorded activity."
          }
        />
      )}
      {dashboard.applications.length > 0 && (
        <ApplicationFilterDisclosure
          view={workingView}
          dispatch={dispatch}
          cohortSources={cohortSources}
          visibleCount={visibleApplications.length}
          totalCount={reviewApplications.length}
          filtersActive={applicationFiltersActive}
        />
      )}
      <Funnel funnel={dashboard.personalFunnel} />

      <section className="record-review-strip" aria-labelledby="record-review-title">
        <div>
          <span>Candidate-set dates · derived fallback</span>
          <h2 id="record-review-title">Record-review queue</h2>
          <p>
            {reviewQueue.length
              ? `${reviewQueue.length} application record${reviewQueue.length === 1 ? " is" : "s are"} due: ${scheduledReviewCount} from candidate-set dates and ${derivedReviewCount} from the 336-hour activity fallback.`
              : "No candidate-set date is due, and no unscheduled application has reached the 336-hour activity fallback."}
          </p>
        </div>
        {reviewQueue.length ? (
          <ol className="record-review-list">
            {reviewQueue.map((item) => (
              <li key={item.application.id}>
                <strong>
                  {item.application.job?.title ?? "Unknown role"} ·{" "}
                  {item.application.job?.company ?? "Unknown company"}
                </strong>
                {item.basis === "candidate_reminder" ? (
                  <small>Candidate-set reminder due {item.dueOn}</small>
                ) : (
                  <small>
                    Latest candidate record {localDateTime(item.lastRecordedAt!)} · review due{" "}
                    {localDateTime(item.dueAt)}
                  </small>
                )}
              </li>
            ))}
          </ol>
        ) : null}
        <small>
          Candidate-set dates are stored; the 336-hour fallback is derived. Neither infers an
          employer outcome or contacts anyone.
        </small>
      </section>

      <section className="cohort-panel" aria-labelledby="cohort-title">
        <div className="panel-heading">
          <div>
            <span>Application cohort counts · current snapshot</span>
            <h2 id="cohort-title">Count records in an explicit creation window</h2>
            <p>
              Dates use {cohortTimezone}. Role source and match classification reflect their current
              stored values, not reconstructed values at application time.
            </p>
          </div>
        </div>
        <div className="cohort-controls">
          <label>
            Created from
            <input
              type="date"
              value={workingView.cohortStart}
              max={workingView.cohortEnd}
              onChange={(event) => {
                if (event.target.value) {
                  dispatch({
                    type: "view_changed",
                    view: { ...workingView, cohortStart: event.target.value },
                  });
                }
              }}
            />
          </label>
          <label>
            Created through
            <input
              type="date"
              value={workingView.cohortEnd}
              min={workingView.cohortStart}
              onChange={(event) => {
                if (event.target.value) {
                  dispatch({
                    type: "view_changed",
                    view: { ...workingView, cohortEnd: event.target.value },
                  });
                }
              }}
            />
          </label>
          <label>
            Current role source
            <select
              value={workingView.cohortSource}
              onChange={(event) =>
                dispatch({
                  type: "view_changed",
                  view: { ...workingView, cohortSource: event.target.value },
                })
              }
            >
              <option value="all">All sources</option>
              {cohortSources.map((source) => (
                <option key={source} value={source}>
                  {human(source)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Current match classification
            <select
              value={workingView.cohortBucket}
              onChange={(event) =>
                dispatch({
                  type: "view_changed",
                  view: {
                    ...workingView,
                    cohortBucket: event.target.value as ApplicationViewState["cohortBucket"],
                  },
                })
              }
            >
              <option value="all">All classifications</option>
              {APPLICATION_MATCH_BUCKETS.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {human(bucket)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="cohort-counts" aria-live="polite">
          <Metric
            value={cohort.sampleSize}
            label="Applications"
            detail="Creation-time denominator"
          />
          <Metric value={cohort.outcomes.replies} label="Replies recorded" detail="Raw count" />
          <Metric value={cohort.outcomes.screens} label="Screens recorded" detail="Raw count" />
          <Metric
            value={cohort.outcomes.interviews}
            label="Interviews recorded"
            detail="Raw count"
          />
          <Metric value={cohort.outcomes.offers} label="Offers recorded" detail="Raw count" />
        </div>
        <div className="cohort-bands">
          {APPLICATION_MATCH_BUCKETS.map((bucket) => (
            <span key={bucket}>
              <strong>{cohort.byMatchBucket[bucket]}</strong> {human(bucket)}
            </span>
          ))}
        </div>
        <p className="boundary-note">
          Counts only. They are not conversion rates, hiring probabilities, or causal evidence.
        </p>
      </section>
    </>
  );
}

function ReminderEditor({
  application,
  onAct,
  busy,
  draft,
  onDraftChange,
  onCommitted,
  onFocusTrigger,
  onClose,
}: {
  application: Application;
  onAct: ActionRunner;
  busy: boolean;
  draft: ReminderDraft;
  onDraftChange: (draft: ReminderDraft) => void;
  onCommitted: (submitted: ReminderDraft) => void;
  onFocusTrigger: () => void;
  onClose: () => void;
}) {
  const dateField = useRef<HTMLInputElement>(null);
  const [dateTouched, setDateTouched] = useState(false);
  const inactive = application.status === "withdrawn";
  const persistedDate = application.followUpOn ?? "";
  const editorId = `reminder-editor-${application.id}`;
  const dateId = `${editorId}-date`;
  const noteId = `${editorId}-note`;
  const missingDate = !inactive && draft.followUpOn.length === 0;
  const invalidDate = missingDate && dateTouched;

  useEffect(() => setDateTouched(false), [application.id]);

  useEffect(() => {
    if (!inactive) {
      dateField.current?.focus();
      return;
    }
    if (draft.followUpOn !== persistedDate) {
      onDraftChange({ applicationId: application.id, followUpOn: persistedDate });
    }
  }, [application.id, inactive, persistedDate]);

  return (
    <form
      id={editorId}
      className="outcome-form reminder-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (inactive || missingDate) return;
        const submittedDraft = { ...draft };
        void onAct.run({
          request: () =>
            api(`/v1/applications/${application.id}/follow-up`, {
              method: "PUT",
              body: JSON.stringify({ followUpOn: draft.followUpOn }),
            }),
          success: "Follow-up reminder saved.",
          transient: true,
          commit: () => onCommitted(submittedDraft),
          focus: onFocusTrigger,
        });
      }}
    >
      <label htmlFor={dateId}>
        Candidate follow-up date
        {!inactive && (
          <span
            className={`field-state ${invalidDate ? "is-required" : missingDate ? "is-pending" : "is-ready"}`}
            role="status"
          >
            {invalidDate
              ? "Required · no date selected"
              : missingDate
                ? "Choose a date · required"
                : "Ready to save"}
          </span>
        )}
      </label>
      <input
        ref={dateField}
        id={dateId}
        type="date"
        value={draft.followUpOn}
        required={!inactive}
        disabled={inactive}
        aria-invalid={invalidDate || undefined}
        aria-describedby={noteId}
        onBlur={() => setDateTouched(true)}
        onInvalid={() => setDateTouched(true)}
        onChange={(event) => {
          setDateTouched(true);
          onDraftChange({ ...draft, followUpOn: event.target.value });
        }}
      />
      <small className="field-note" id={noteId}>
        {inactive
          ? "This saved date is retained but inactive while this application is withdrawn. Clear it, or move the application back to Tracked to make it active again. Nimanto contacts no one and infers no employer response."
          : missingDate
            ? "Choose a date to save this reminder. Nimanto will not contact you or infer an employer response."
            : "Stored on this application only. Nimanto will show it in Review due; it will not contact you or infer an employer response."}
      </small>
      <div className="button-group">
        {!inactive && (
          <button className="button mini primary" disabled={busy || missingDate}>
            Save reminder
          </button>
        )}
        {application.followUpOn && (
          <ConfirmAction
            className="button mini quiet"
            label="Clear reminder"
            question="Clear this candidate-set follow-up reminder?"
            confirmLabel="Clear it"
            cancelLabel="Keep reminder"
            disabled={busy}
            onConfirm={() => {
              void onAct.run({
                request: () =>
                  api(`/v1/applications/${application.id}/follow-up`, {
                    method: "PUT",
                    body: JSON.stringify({ followUpOn: null }),
                  }),
                success: "Follow-up reminder cleared.",
                transient: true,
                commit: onClose,
                focus: onFocusTrigger,
              });
            }}
          />
        )}
        {inactive ? (
          <button className="button mini quiet" type="button" disabled={busy} onClick={onClose}>
            Close
          </button>
        ) : (
          <ConfirmAction
            className="button mini quiet"
            label="Discard draft"
            question="Discard this follow-up date draft?"
            confirmLabel="Discard it"
            cancelLabel="Keep editing"
            disabled={busy}
            onConfirm={onClose}
          />
        )}
      </div>
    </form>
  );
}

function OutcomeEditor({
  application,
  onAct,
  busy,
  draft,
  onDraftChange,
  onRecorded,
  onFocusTrigger,
  onClose,
}: {
  application: Application;
  onAct: ActionRunner;
  busy: boolean;
  draft: OutcomeDraft;
  onDraftChange: (draft: OutcomeDraft) => void;
  onRecorded: (submitted: OutcomeDraft) => void;
  onFocusTrigger: () => void;
  onClose: () => void;
}) {
  const typeField = useRef<HTMLSelectElement>(null);
  const editorId = `outcome-editor-${application.id}`;
  const typeId = `${editorId}-type`;
  const noteId = `${editorId}-note`;

  useEffect(() => {
    typeField.current?.focus();
  }, []);

  return (
    <form
      id={editorId}
      className="outcome-form"
      onSubmit={(event) => {
        event.preventDefault();
        const submittedDraft = { ...draft };
        void onAct.run({
          request: () =>
            api(`/v1/applications/${application.id}/outcomes`, {
              method: "POST",
              body: JSON.stringify({ type: draft.type, note: draft.note }),
            }),
          success: "Candidate-reported outcome recorded.",
          transient: true,
          commit: () => onRecorded(submittedDraft),
          focus: () => {
            const retainedEditor = document.getElementById(typeId);
            if (retainedEditor) retainedEditor.focus();
            else onFocusTrigger();
          },
        });
      }}
    >
      <label htmlFor={typeId}>Candidate-reported outcome</label>
      <select
        ref={typeField}
        id={typeId}
        value={draft.type}
        onChange={(event) => onDraftChange({ ...draft, type: event.target.value })}
      >
        <option value="reply">Reply</option>
        <option value="screen">Screen</option>
        <option value="interview">Interview</option>
        <option value="offer">Offer</option>
        <option value="rejection">Rejection</option>
        <option value="withdrawal">Withdrawal</option>
      </select>
      <label htmlFor={noteId}>Optional note</label>
      <input
        id={noteId}
        value={draft.note}
        onChange={(event) => onDraftChange({ ...draft, note: event.target.value })}
      />
      <small className="field-note">Kept only in this tab until recorded or discarded.</small>
      <div className="button-group">
        <button className="button mini primary" disabled={busy}>
          Record outcome
        </button>
        <ConfirmAction
          className="button mini quiet"
          label="Discard draft"
          question="Discard this candidate-reported outcome draft?"
          confirmLabel="Discard it"
          cancelLabel="Keep editing"
          disabled={busy}
          onConfirm={onClose}
        />
      </div>
    </form>
  );
}

function ApplicationNoteEditor({
  application,
  onAct,
  busy,
  draft,
  onDraftChange,
  onRecorded,
  onFocusTrigger,
  onClose,
}: {
  application: Application;
  onAct: ActionRunner;
  busy: boolean;
  draft: ApplicationNoteDraft;
  onDraftChange: (draft: ApplicationNoteDraft) => void;
  onRecorded: (submitted: ApplicationNoteDraft) => void;
  onFocusTrigger: () => void;
  onClose: () => void;
}) {
  const textField = useRef<HTMLTextAreaElement>(null);
  const editorId = `note-editor-${application.id}`;
  const textId = `${editorId}-text`;

  useEffect(() => {
    textField.current?.focus();
  }, []);

  return (
    <form
      id={editorId}
      className="outcome-form note-form"
      onSubmit={(event) => {
        event.preventDefault();
        const submitted = { ...draft };
        if (!submitted.text.trim()) return;
        void onAct.run({
          request: () =>
            api(`/v1/applications/${application.id}/notes`, {
              method: "POST",
              body: JSON.stringify({ text: submitted.text }),
            }),
          success: "Private note added to the literal timeline.",
          transient: true,
          commit: () => onRecorded(submitted),
          focus: onFocusTrigger,
        });
      }}
    >
      <label htmlFor={textId}>Private application note</label>
      <textarea
        ref={textField}
        id={textId}
        required
        maxLength={2_000}
        value={draft.text}
        onChange={(event) => onDraftChange({ ...draft, text: event.target.value })}
      />
      <small className="field-note">
        Stored after Unicode normalization and trimming at the edges. It changes no status, outcome,
        match, review clock, or funnel count.
      </small>
      <div className="button-group">
        <button className="button mini primary" disabled={busy || draft.text.trim().length === 0}>
          Add note
        </button>
        <ConfirmAction
          className="button mini quiet"
          label="Discard draft"
          question="Discard this private note draft?"
          confirmLabel="Discard it"
          cancelLabel="Keep editing"
          disabled={busy}
          onConfirm={onClose}
        />
      </div>
    </form>
  );
}

function RecordedTimeline({ application }: { application: Application }) {
  const timeline = recordedApplicationTimeline(application);
  if (timeline.length === 0) return null;
  return (
    <details className="recorded-timeline">
      <summary>Recorded timeline</summary>
      <ol>
        {timeline.map((entry) => (
          <li key={entry.id}>
            <span aria-hidden="true" />
            <div>
              <strong>{human(entry.type)}</strong>
              <time dateTime={entry.occurredAt}>{localDateTime(entry.occurredAt)}</time>
              {entry.note && <p>{entry.note}</p>}
            </div>
          </li>
        ))}
      </ol>
      <p className="boundary-note">
        Only stored application creation, candidate-recorded outcomes, and private notes appear
        here. Gaps infer nothing; notes change no status or metric.
      </p>
    </details>
  );
}

function LocalDraftPanel({ dashboard }: { dashboard: Dashboard }) {
  const confirmedEvidence = dashboard.evidence.filter((claim) => claim.status === "confirmed");
  const confirmedEvidenceKey = confirmedEvidence.map((claim) => claim.id).join("\u0000");
  const [status, setStatus] = useState<{ available: boolean; models: string[] } | null>(null);
  const [model, setModel] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [result, setResult] = useState<{
    text: string;
    model: string;
    label: "unverified_local_draft";
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void api<{ available: boolean; models: string[] }>("/v1/models/status")
      .then((value) => {
        if (cancelled) return;
        setStatus(value);
        setModel((current) => current || value.models[0] || "");
      })
      .catch(() => {
        if (!cancelled) setStatus({ available: false, models: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const currentIds = new Set(confirmedEvidenceKey.split("\u0000").filter(Boolean));
    setEvidenceIds((selected) => {
      const retained = selected.filter((id) => currentIds.has(id));
      if (retained.length !== selected.length) draftRequest.current += 1;
      return retained;
    });
    setResult(null);
    setError(null);
  }, [confirmedEvidenceKey]);

  const toggleEvidence = (id: string) => {
    draftRequest.current += 1;
    setResult(null);
    setError(null);
    setEvidenceIds((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : current.length < 12
          ? [...current, id]
          : current,
    );
  };
  const selectedApplication = dashboard.applications.find(
    (application) => application.id === applicationId,
  );

  return (
    <section className="work-panel local-draft-panel" aria-labelledby="local-draft-title">
      <div className="panel-heading">
        <div>
          <span>Optional local assist</span>
          <h2 id="local-draft-title">Draft from selected evidence</h2>
        </div>
        <Sparkles aria-hidden="true" />
      </div>
      <p className="boundary-note">
        The selected role title and company, plus only the confirmed claims you check, are sent to
        Ollama at 127.0.0.1:11434. The result is unverified, copy-only, and is never saved or
        inserted into a packet.
      </p>
      {status === null ? (
        <p className="field-note">Checking for local Ollama models…</p>
      ) : !status.available || status.models.length === 0 ? (
        <p className="field-note">
          Local Ollama is not available. Packet generation remains deterministic.
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedApplication || !model || evidenceIds.length === 0) return;
            const requestId = ++draftRequest.current;
            setGenerating(true);
            setError(null);
            setResult(null);
            void api<{ text: string; model: string; label: "unverified_local_draft" }>(
              "/v1/models/draft-summary",
              {
                method: "POST",
                body: JSON.stringify({
                  model,
                  jobId: selectedApplication.jobId,
                  evidenceIds,
                }),
              },
            )
              .then((value) => {
                if (draftRequest.current === requestId) setResult(value);
              })
              .catch((raised: unknown) => {
                if (draftRequest.current !== requestId) return;
                setError(
                  raised instanceof ApiError && raised.code === "EVIDENCE_SELECTION_CHANGED"
                    ? "One selected claim is no longer confirmed. Review your evidence selection and try again."
                    : raised instanceof ApiError && raised.code === "LOCAL_DRAFT_INPUT_TOO_LARGE"
                      ? "The selected role and claims exceed the local-draft size limit. Choose shorter claims; nothing was sent to Ollama."
                      : "The local model could not produce a safe draft. Nothing was saved.",
                );
              })
              .finally(() => setGenerating(false));
          }}
        >
          <div className="field-grid">
            <label>
              Application
              <select
                required
                disabled={generating}
                value={applicationId}
                onChange={(event) => {
                  draftRequest.current += 1;
                  setApplicationId(event.target.value);
                  setResult(null);
                  setError(null);
                }}
              >
                <option value="">Choose an application</option>
                {dashboard.applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.job?.title ?? "Unknown role"} ·{" "}
                    {application.job?.company ?? "Unknown company"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Local model
              <select
                disabled={generating}
                value={model}
                onChange={(event) => {
                  draftRequest.current += 1;
                  setModel(event.target.value);
                  setResult(null);
                  setError(null);
                }}
              >
                {status.models.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="evidence-selector">
            <legend>Confirmed evidence to share locally · {evidenceIds.length}/12 selected</legend>
            {confirmedEvidence.length === 0 ? (
              <p className="field-note">Confirm evidence in the vault before drafting.</p>
            ) : (
              confirmedEvidence.map((claim) => (
                <label key={claim.id}>
                  <input
                    type="checkbox"
                    checked={evidenceIds.includes(claim.id)}
                    disabled={
                      generating || (!evidenceIds.includes(claim.id) && evidenceIds.length >= 12)
                    }
                    onChange={() => toggleEvidence(claim.id)}
                  />
                  <span>{claim.value}</span>
                </label>
              ))
            )}
          </fieldset>
          <button
            className="button primary"
            disabled={generating || !applicationId || !model || evidenceIds.length === 0}
          >
            <Sparkles size={16} /> {generating ? "Drafting locally…" : "Create unverified draft"}
          </button>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className="local-draft-result">
              <span>Unverified local draft · {result.model}</span>
              <textarea readOnly value={result.text} aria-label="Unverified local draft" />
              <CopyLine command={result.text} showCommand={false} />
            </div>
          )}
        </form>
      )}
    </section>
  );
}

function LocalDraftDisclosure({ dashboard }: { dashboard: Dashboard }) {
  const [openedOnce, setOpenedOnce] = useState(false);
  return (
    <details
      className="secondary-controls local-draft-disclosure"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpenedOnce(true);
      }}
    >
      <summary>
        <span>
          <Sparkles size={16} aria-hidden="true" /> Optional local assist
        </span>
        <small>
          Uses the selected role title and company plus only confirmed claims you select. Nothing is
          saved to a packet.
        </small>
      </summary>
      {openedOnce && <LocalDraftPanel dashboard={dashboard} />}
    </details>
  );
}

function Packets({
  dashboard,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const packetByApplication = new Map(
    dashboard.packets.map((packet) => [packet.applicationId, packet]),
  );
  return (
    <>
      <PageIntro
        eyebrow="Review packets"
        title="Generate once. Inspect every format."
        copy="Packets are assembled from confirmed evidence and locked authorization wording. Assurance runs before candidate approval."
      />
      <div className="packet-list">
        {dashboard.applications.map((application) => {
          const packet = packetByApplication.get(application.id);
          const approvalNeedsAssurance =
            packet !== undefined &&
            packet.status !== "assurance_passed" &&
            packet.status !== "approved";
          return (
            <article key={application.id} className="packet-row">
              <div className="packet-icon">
                <FileCheck2 />
              </div>
              <div>
                <span>{application.job?.company}</span>
                <h2>{application.job?.title}</h2>
                <small>{packet ? `Packet ${packet.id.slice(0, 8)}` : "No packet generated"}</small>
              </div>
              <div>
                {packet ? (
                  <span
                    className={`state ${packet.status === "approved" ? "supported" : packet.status === "assurance_blocked" ? "danger" : "warning"}`}
                  >
                    {human(packet.status)}
                  </span>
                ) : (
                  <span className="state muted">Not prepared</span>
                )}
              </div>
              <div className="packet-actions">
                {!packet ? (
                  <button
                    className="button mini primary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void onAct.run({
                        request: () =>
                          api<Packet>("/v1/packets", {
                            method: "POST",
                            body: JSON.stringify({ applicationId: application.id }),
                          }),
                        success: (result) => packetInventoryNotice(result.artifactManifest),
                      });
                    }}
                  >
                    <FileOutput size={15} /> Generate
                  </button>
                ) : (
                  <>
                    <button
                      className="button mini quiet"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void onAct.run({
                          request: () =>
                            api<Packet>("/v1/packets", {
                              method: "POST",
                              body: JSON.stringify({ applicationId: application.id }),
                            }),
                          success: (result) => packetInventoryNotice(result.artifactManifest),
                        });
                      }}
                    >
                      <FileOutput size={15} /> Generate new
                    </button>
                    <button
                      className={`button mini ${approvalNeedsAssurance ? "primary" : "quiet"}`}
                      type="button"
                      disabled={busy || packet.status === "approved"}
                      onClick={() => {
                        void onAct.run({
                          request: () => api(`/v1/packets/${packet.id}/assure`, { method: "POST" }),
                          success: "Assurance check complete.",
                        });
                      }}
                    >
                      <ShieldCheck size={15} /> Assure
                    </button>
                    <ConfirmAction
                      className={`button mini ${packet.status === "assurance_passed" ? "primary" : "quiet"}`}
                      label={
                        <>
                          <Check size={15} /> Approve
                        </>
                      }
                      question={`Approve packet ${packet.id.slice(0, 8)} for export?`}
                      supportingContent={<PacketApprovalContext packet={packet} />}
                      confirmLabel="Approve this packet"
                      cancelLabel="Cancel"
                      disabled={busy || packet.status !== "assurance_passed"}
                      {...(approvalNeedsAssurance
                        ? { descriptionId: `approve-gate-${packet.id}` }
                        : {})}
                      onConfirm={() => {
                        void onAct.run({
                          request: () =>
                            api(`/v1/packets/${packet.id}/approve`, { method: "POST" }),
                          success: "Packet approved for export.",
                        });
                      }}
                    />
                    <button
                      className="button mini quiet"
                      type="button"
                      disabled={busy}
                      aria-expanded={historyFor === application.id}
                      onClick={() =>
                        setHistoryFor((current) =>
                          current === application.id ? null : application.id,
                        )
                      }
                    >
                      <FileClock size={15} /> History
                    </button>
                  </>
                )}
              </div>
              {approvalNeedsAssurance && packet && (
                <small className="field-note" id={`approve-gate-${packet.id}`}>
                  Approval opens once assurance passes on this exact packet.
                </small>
              )}
              {packet?.artifactManifest.artifacts && (
                <div className="artifact-links">
                  {packet.artifactManifest.artifacts.map((artifact) => (
                    <a
                      key={artifact.format}
                      href={`${API}/v1/packets/${packet.id}/artifacts/${artifact.format}`}
                      title={`SHA-256 ${artifact.sha256}`}
                    >
                      <Download size={14} /> {artifact.format.toUpperCase()}
                      <small>{artifact.sha256.slice(0, 12)}…</small>
                    </a>
                  ))}
                </div>
              )}
              {packet && (
                <details className="packet-review">
                  <summary>Inspect content, formats, and assurance</summary>
                  <div className="packet-review-grid">
                    <section>
                      <span>Canonical content</span>
                      <h3>{packet.canonicalContent.candidateName ?? "Candidate packet"}</h3>
                      <p>{packet.canonicalContent.summary ?? "No summary stored."}</p>
                      <dl>
                        <div>
                          <dt>Destination</dt>
                          <dd>
                            {packet.canonicalContent.destination?.role ?? "Role not recorded"} ·{" "}
                            {packet.canonicalContent.destination?.company ?? "Company not recorded"}
                          </dd>
                        </div>
                        <div>
                          <dt>Authorization wording</dt>
                          <dd>
                            {packet.canonicalContent.authorizationWording ?? "No wording stored."}
                          </dd>
                        </div>
                        {packet.canonicalContent.generatedAt && (
                          <div>
                            <dt>Generated</dt>
                            <dd>{localDateTime(packet.canonicalContent.generatedAt)}</dd>
                          </div>
                        )}
                      </dl>
                      {Boolean(packet.canonicalContent.claims?.length) && (
                        <ul className="packet-claims">
                          {packet.canonicalContent.claims?.map((claim, index) => (
                            <li key={`${index}-${claim.text}`}>
                              <span>{claim.text}</span>
                              <small>
                                {claim.evidenceIds.length} evidence link
                                {claim.evidenceIds.length === 1 ? "" : "s"}
                              </small>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                    <section>
                      <span>Document inspection</span>
                      {packet.artifactManifest.documentInspection ? (
                        <>
                          <div className="inspection-status">
                            <strong>
                              {human(packet.artifactManifest.documentInspection.status)}
                            </strong>
                            <code>{packet.artifactManifest.documentInspection.ruleVersion}</code>
                          </div>
                          <ul className="inspection-checks">
                            {packet.artifactManifest.documentInspection.checks.map((check) => (
                              <li key={`${check.format ?? "all"}-${check.code}`}>
                                <span className={`status-dot ${check.status}`} aria-hidden="true" />
                                <div>
                                  <strong>{human(check.code)}</strong>
                                  <small>
                                    {check.format ? `${check.format.toUpperCase()} · ` : ""}
                                    {check.detail}
                                  </small>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p>No document inspection is stored for this packet.</p>
                      )}
                    </section>
                    <section>
                      <span>Latest assurance</span>
                      {packet.latestAssurance ? (
                        <>
                          <div className="inspection-status">
                            <strong>{human(packet.latestAssurance.status)}</strong>
                            <time dateTime={packet.latestAssurance.createdAt}>
                              {localDateTime(packet.latestAssurance.createdAt)}
                            </time>
                          </div>
                          <code className="rule-code">{packet.latestAssurance.ruleVersion}</code>
                          {packet.latestAssurance.findings.length > 0 ? (
                            <ul className="assurance-findings">
                              {packet.latestAssurance.findings.map((finding, index) => (
                                <li key={`${finding.code ?? "finding"}-${index}`}>
                                  <strong>{human(finding.code ?? "Stored finding")}</strong>
                                  <span>
                                    {finding.detail ?? finding.message ?? finding.severity}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>No assurance findings were recorded.</p>
                          )}
                        </>
                      ) : (
                        <p>Run assurance to create a review record.</p>
                      )}
                    </section>
                  </div>
                  <div className="packet-hashes">
                    <span>Canonical packet hash</span>
                    <CopyLine command={packet.artifactHash} />
                  </div>
                  <p className="boundary-note">
                    Inspection checks structure, format integrity, and configured rules. It does not
                    verify claim truth, writing quality, employer acceptance, or external delivery.
                  </p>
                </details>
              )}
              {packet && historyFor === application.id && (
                <PacketHistoryPanel applicationId={application.id} />
              )}
            </article>
          );
        })}
      </div>
      {dashboard.applications.length === 0 && (
        <Empty
          icon={FileOutput}
          title="Nothing to prepare yet"
          copy="Track an application first, then Nimanto can build its review packet."
        />
      )}
      <LocalDraftDisclosure dashboard={dashboard} />
    </>
  );
}

function PacketHistoryPanel({ applicationId }: { applicationId: string }) {
  const [page, setPage] = useState<HistoryPage<PacketHistoryRecord> | null>(null);
  const [assuranceFor, setAssuranceFor] = useState<string | null>(null);
  const [assurances, setAssurances] = useState<HistoryPage<AssuranceHistoryRun> | null>(null);
  const [loadingOlderPackets, setLoadingOlderPackets] = useState(false);
  const [loadingOlderAssurances, setLoadingOlderAssurances] = useState(false);
  const [error, setError] = useState("");
  const packetRequests = useRef(createScopedRequestGate<string>()).current;
  const assuranceRequests = useRef(createScopedRequestGate<string>()).current;

  useEffect(() => {
    let cancelled = false;
    packetRequests.select(applicationId);
    setLoadingOlderPackets(false);
    setPage(null);
    setError("");
    void api<HistoryPage<PacketHistoryRecord>>(
      `/v1/applications/${encodeURIComponent(applicationId)}/packets?limit=20`,
    )
      .then((value) => {
        if (!cancelled) setPage(value);
      })
      .catch(() => {
        if (!cancelled) setError("Packet history could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, packetRequests]);

  useEffect(() => {
    assuranceRequests.select(assuranceFor);
    setLoadingOlderAssurances(false);
    setAssurances(null);
    if (!assuranceFor) {
      return;
    }
    let cancelled = false;
    void api<HistoryPage<AssuranceHistoryRun>>(
      `/v1/packets/${encodeURIComponent(assuranceFor)}/assurance-runs?limit=20`,
    )
      .then((value) => {
        if (!cancelled) setAssurances(value);
      })
      .catch(() => {
        if (!cancelled) setError("Assurance history could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [assuranceFor, assuranceRequests]);

  const packets = page?.items ?? [];
  const latest = packets[0];
  const previous = packets[1];
  const canonicalDelta = latest && previous ? packetCanonicalDelta(previous, latest) : [];
  const manifestDelta = latest && previous ? packetManifestDelta(previous, latest) : [];
  const loadOlderPackets = async () => {
    if (!page?.nextCursor) return;
    const cursor = page.nextCursor;
    const request = packetRequests.begin(applicationId);
    if (!request) return;
    setLoadingOlderPackets(true);
    try {
      const older = await api<HistoryPage<PacketHistoryRecord>>(
        `/v1/applications/${encodeURIComponent(applicationId)}/packets?limit=20&cursor=${encodeURIComponent(cursor)}`,
      );
      if (!packetRequests.isCurrent(request)) return;
      setPage((current) =>
        current?.nextCursor === cursor
          ? { items: [...current.items, ...older.items], nextCursor: older.nextCursor }
          : current,
      );
    } catch {
      if (packetRequests.isCurrent(request)) {
        setError("Older packet history could not be loaded.");
      }
    } finally {
      if (packetRequests.finish(request)) setLoadingOlderPackets(false);
    }
  };
  const loadOlderAssurances = async () => {
    if (!assurances?.nextCursor || !assuranceFor) return;
    const packetId = assuranceFor;
    const cursor = assurances.nextCursor;
    const request = assuranceRequests.begin(packetId);
    if (!request) return;
    setLoadingOlderAssurances(true);
    try {
      const older = await api<HistoryPage<AssuranceHistoryRun>>(
        `/v1/packets/${encodeURIComponent(packetId)}/assurance-runs?limit=20&cursor=${encodeURIComponent(cursor)}`,
      );
      if (!assuranceRequests.isCurrent(request)) return;
      setAssurances((current) =>
        current?.nextCursor === cursor
          ? { items: [...current.items, ...older.items], nextCursor: older.nextCursor }
          : current,
      );
    } catch {
      if (assuranceRequests.isCurrent(request)) {
        setError("Older assurance history could not be loaded.");
      }
    } finally {
      if (assuranceRequests.finish(request)) setLoadingOlderAssurances(false);
    }
  };
  const toggleAssuranceHistory = (packetId: string) => {
    const nextPacketId = assuranceFor === packetId ? null : packetId;
    // Invalidate the old selection synchronously; an older response cannot win
    // the interval before React runs the effect for the new selection.
    assuranceRequests.select(nextPacketId);
    setLoadingOlderAssurances(false);
    setAssurances(null);
    setAssuranceFor(nextPacketId);
  };

  return (
    <section className="packet-history" aria-label="Stored packet history">
      <div className="panel-heading">
        <div>
          <span>Stored generations · newest first</span>
          <h3>Packet history and comparison</h3>
          <p>These are sibling records for one application, not a proven causal lineage.</p>
        </div>
        <strong>{packets.length} loaded</strong>
      </div>
      {error && <p className="field-note error-text">{error}</p>}
      {!page && !error && <small>Loading packet history…</small>}
      {latest && previous && (
        <div className="packet-comparison">
          <div>
            <span>Canonical content</span>
            <strong>
              {latest.artifactHash === previous.artifactHash
                ? "Same stored hash"
                : "Changed stored hash"}
            </strong>
            <small>
              {canonicalDelta.length
                ? "Changed fields: " + canonicalDelta.join(", ")
                : "No literal field changes"}
            </small>
          </div>
          <div>
            <span>Claim count</span>
            <strong>
              {previous.canonicalContent.claims?.length ?? 0} →{" "}
              {latest.canonicalContent.claims?.length ?? 0}
            </strong>
          </div>
          <div>
            <span>Authorization wording</span>
            <strong>
              {previous.canonicalContent.authorizationWording ===
              latest.canonicalContent.authorizationWording
                ? "Unchanged"
                : "Changed exactly"}
            </strong>
          </div>
          <div>
            <span>Artifact manifest</span>
            <strong>
              {manifestDelta.length ? manifestDelta.length + " change(s)" : "Unchanged"}
            </strong>
            <small>{manifestDelta.length ? manifestDelta.join("; ") : "No literal changes"}</small>
          </div>
          <div>
            <span>Generated</span>
            <strong>
              {localDateTime(previous.createdAt)} → {localDateTime(latest.createdAt)}
            </strong>
          </div>
        </div>
      )}
      <div className="packet-version-list">
        {packets.map((packet, index) => (
          <article key={packet.id}>
            <div>
              <span>{index === 0 ? "Latest generation" : `Earlier generation ${index}`}</span>
              <strong>Packet {packet.id.slice(0, 8)}</strong>
              <time dateTime={packet.createdAt}>{localDateTime(packet.createdAt)}</time>
            </div>
            <span className={`state ${packet.status === "approved" ? "supported" : "muted"}`}>
              {human(packet.status)}
            </span>
            <dl>
              <div>
                <dt>Profile version</dt>
                <dd>
                  <code>{packet.profileVersionId ?? "none"}</code>
                </dd>
              </div>
              <div>
                <dt>Canonical hash</dt>
                <dd>
                  <code>{packet.artifactHash}</code>
                </dd>
              </div>
              <div>
                <dt>Current manifest files</dt>
                <dd>{packet.artifactManifest.artifacts?.length ?? 0}</dd>
              </div>
            </dl>
            <button
              className="button mini quiet"
              type="button"
              aria-expanded={assuranceFor === packet.id}
              onClick={() => toggleAssuranceHistory(packet.id)}
            >
              <ShieldCheck size={14} /> Assurance history
            </button>
          </article>
        ))}
      </div>
      {page?.nextCursor && (
        <button
          className="button mini quiet"
          type="button"
          disabled={loadingOlderPackets}
          onClick={() => void loadOlderPackets()}
        >
          {loadingOlderPackets ? "Loading older packets…" : "Load older packets"}
        </button>
      )}
      {assuranceFor && (
        <div className="assurance-history">
          <span>Assurance runs for packet {assuranceFor.slice(0, 8)}</span>
          <p>Packet ordinals are scoped to this packet; no workspace-global sequence is exposed.</p>
          {assurances ? (
            assurances.items.length ? (
              <ol>
                {assurances.items.map((run) => (
                  <li key={run.id}>
                    <strong>
                      Run {run.packetOrdinal} · {human(run.status)}
                    </strong>
                    <time dateTime={run.createdAt}>{localDateTime(run.createdAt)}</time>
                    <small>
                      {run.ruleVersion} · {run.findings.length} stored finding
                      {run.findings.length === 1 ? "" : "s"}
                    </small>
                  </li>
                ))}
              </ol>
            ) : (
              <small>No assurance run is stored for this packet.</small>
            )
          ) : (
            <small>Loading assurance history…</small>
          )}
          {assurances?.nextCursor && (
            <button
              className="button mini quiet"
              type="button"
              disabled={loadingOlderAssurances}
              onClick={() => void loadOlderAssurances()}
            >
              {loadingOlderAssurances
                ? "Loading older assurance runs…"
                : "Load older assurance runs"}
            </button>
          )}
        </div>
      )}
      <p className="boundary-note">
        Packet status and artifact manifests are current mutable fields. The canonical hash covers
        stored canonical content, including its generated timestamp; it is not a hash of generated
        files.
      </p>
    </section>
  );
}

function Actions({
  dashboard,
  onAct,
  busy,
  draft,
  onDraftChange,
  onDraftCommitted,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
  draft: ActionDraft | null;
  onDraftChange: Dispatch<SetStateAction<ActionDraft | null>>;
  onDraftCommitted: (submitted: ActionDraft) => void;
}) {
  const packetLabels = [
    ...new Map(
      [...dashboard.packets, ...dashboard.actionPackets].map((packet) => [packet.id, packet]),
    ).values(),
  ];
  /* actionPackets exists only so historical actions retain a human-readable
   * label. A packet retired by a newer generation must never remain eligible
   * for a new action merely because an earlier action references it. */
  const approvedPackets = dashboard.packets.filter((packet) => packet.status === "approved");
  /* This control decides what leaves the machine. Naming it "a9c20e42" asked
   * the candidate to map opaque hex to a role at the most consequential step in
   * the product; the identifier stays, as secondary detail. */
  const packetLabel = (packetId: string) => {
    const packet = packetLabels.find((item) => item.id === packetId);
    const job = dashboard.applications.find((item) => item.id === packet?.applicationId)?.job;
    return job ? `${job.title} · ${job.company}` : `Packet ${packetId.slice(0, 8)}`;
  };
  const prepareActionButton = useRef<HTMLButtonElement>(null);
  const packetField = useRef<HTMLSelectElement>(null);
  const packetSelectionValid = Boolean(
    draft && approvedPackets.some((packet) => packet.id === draft.packetId),
  );
  const updateDraft = <K extends keyof ActionDraft>(field: K, value: ActionDraft[K]) => {
    onDraftChange((current) => (current ? { ...current, [field]: value } : current));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !packetSelectionValid) {
      packetField.current?.focus();
      return;
    }
    const submittedDraft = { ...draft };
    void onAct.run({
      request: () => api("/v1/actions", { method: "POST", body: JSON.stringify(submittedDraft) }),
      success: "Action created and waiting for approval.",
      commit: () => onDraftCommitted(submittedDraft),
      focus: () => {
        if (document.getElementById("action-draft")) packetField.current?.focus();
        else prepareActionButton.current?.focus();
      },
    });
  };
  return (
    <>
      <PageIntro
        eyebrow="Approved actions"
        title="Nothing leaves without two keys."
        copy="Approve the exact action, then turn on the reset-on-restart execution switch. This beta offers only a user-opened mail link and a private local test outbox; connected accounts are not enabled."
        action={
          <span>
            <button
              ref={prepareActionButton}
              className="button primary"
              type="button"
              disabled={approvedPackets.length === 0 && !draft}
              aria-expanded={draft !== null}
              aria-controls={draft ? "action-draft" : undefined}
              aria-describedby={
                draft && !packetSelectionValid
                  ? "action-draft-packet-error"
                  : approvedPackets.length === 0
                    ? "prepare-action-gate"
                    : undefined
              }
              onClick={() => {
                if (!draft && approvedPackets[0]) {
                  onDraftChange(emptyActionDraft(approvedPackets[0].id));
                }
                window.requestAnimationFrame(() => packetField.current?.focus());
              }}
            >
              <Plus size={16} /> {draft ? "Resume action draft" : "Prepare action"}
            </button>
            {approvedPackets.length === 0 && (
              <span className="sr-only" id="prepare-action-gate">
                Approve a reviewed packet before preparing an action.
              </span>
            )}
          </span>
        }
      />
      <div className="runtime-gate">
        <div>
          <span
            className={
              dashboard.runtime.externalActionsEnabled ? "runtime-light on" : "runtime-light"
            }
          />
          <div>
            <strong id="execution-runtime-status">
              Execution runtime is {dashboard.runtime.externalActionsEnabled ? "on" : "off"}
            </strong>
            <p>It always starts off after the service restarts.</p>
          </div>
        </div>
        <button
          className={
            dashboard.runtime.externalActionsEnabled
              ? "button mini danger-button"
              : "button mini inverted"
          }
          type="button"
          disabled={busy}
          onClick={() => {
            void onAct.run({
              request: () =>
                api("/v1/actions/runtime", {
                  method: "PUT",
                  body: JSON.stringify({ enabled: !dashboard.runtime.externalActionsEnabled }),
                }),
              success: dashboard.runtime.externalActionsEnabled
                ? "Execution switch turned off."
                : "Execution switch turned on for this runtime.",
            });
          }}
        >
          {dashboard.runtime.externalActionsEnabled ? (
            <>
              <X size={15} /> Turn off
            </>
          ) : (
            <>
              <Play size={15} /> Turn on
            </>
          )}
        </button>
      </div>
      {draft && (
        <form id="action-draft" className="work-panel form-panel action-form" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <span>Exact handoff</span>
              <h2>Prepare an action</h2>
              <p className="field-note">
                Kept only in this tab while signed in; reload, sign-out, or discard clears it.
              </p>
            </div>
          </div>
          <div className="field-grid">
            <label>
              Approved packet
              <select
                ref={packetField}
                name="packetId"
                required
                value={packetSelectionValid ? draft.packetId : ""}
                aria-invalid={!packetSelectionValid}
                aria-describedby={!packetSelectionValid ? "action-draft-packet-error" : undefined}
                onChange={(event) => updateDraft("packetId", event.target.value)}
              >
                <option value="" disabled>
                  Select an approved packet
                </option>
                {approvedPackets.map((packet) => (
                  <option key={packet.id} value={packet.id}>
                    {packetLabel(packet.id)} ({packet.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </label>
            {!packetSelectionValid && (
              <p className="field-error action-packet-error" id="action-draft-packet-error">
                A newer packet replaced the one previously reviewed. Review and approve the current
                packet, then select it; your recipient and message are still kept.
              </p>
            )}
            <label>
              Provider
              <select
                name="provider"
                value={draft.provider}
                onChange={(event) =>
                  updateDraft("provider", event.target.value as ActionDraft["provider"])
                }
              >
                <option value="deep_link">Email deep link</option>
                <option value="test_outbox">Local test outbox</option>
              </select>
            </label>
            <label>
              Recipient
              <input
                name="to"
                type="email"
                required
                maxLength={254}
                value={draft.to}
                onChange={(event) => updateDraft("to", event.target.value)}
              />
            </label>
            <label>
              Subject
              <input
                name="subject"
                required
                maxLength={200}
                value={draft.subject}
                onChange={(event) => updateDraft("subject", event.target.value)}
              />
            </label>
          </div>
          <label>
            Message
            <textarea
              name="body"
              required
              maxLength={20000}
              value={draft.body}
              onChange={(event) => updateDraft("body", event.target.value)}
            />
          </label>
          <div className="button-group">
            <button className="button primary" disabled={busy || !packetSelectionValid}>
              Create approval request
            </button>
            <ConfirmAction
              className="button quiet"
              label="Discard draft"
              question="Discard this exact unsaved action draft?"
              confirmLabel="Discard it"
              cancelLabel="Keep editing"
              disabled={busy}
              onConfirm={() => {
                onDraftChange(null);
                window.requestAnimationFrame(() =>
                  window.requestAnimationFrame(() => prepareActionButton.current?.focus()),
                );
              }}
            />
          </div>
        </form>
      )}
      <div className="action-list">
        {dashboard.externalActions.map((action) => (
          <article key={action.id} className="action-row">
            <div className="provider-mark">
              <MailCheck />
            </div>
            <div>
              <span>{human(action.provider)}</span>
              <strong>{action.payload.subject}</strong>
              <small>
                To: {action.target.to} · {packetLabel(action.packetId)}
              </small>
              <p className="action-message">{action.payload.body}</p>
            </div>
            <span
              className={`state ${action.state === "succeeded" ? "supported" : action.state === "failed" ? "danger" : "warning"}`}
            >
              {human(action.state)}
            </span>
            <div className="action-buttons">
              {action.state === "pending_approval" && (
                <>
                  <button
                    className="button mini primary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void onAct.run({
                        request: () => api(`/v1/actions/${action.id}/approve`, { method: "POST" }),
                        success: "Action approved. Execution is still separate.",
                      });
                    }}
                  >
                    <Check size={15} /> Approve
                  </button>
                  <button
                    className="button mini quiet"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void onAct.run({
                        request: () => api(`/v1/actions/${action.id}/cancel`, { method: "POST" }),
                        success: "Action cancelled.",
                      });
                    }}
                  >
                    <X size={15} /> Cancel
                  </button>
                </>
              )}
              {action.state === "approved" && (
                <button
                  className="button mini primary"
                  type="button"
                  disabled={busy || !dashboard.runtime.externalActionsEnabled}
                  aria-describedby={
                    dashboard.runtime.externalActionsEnabled
                      ? undefined
                      : "execution-runtime-status"
                  }
                  onClick={() => {
                    void onAct.run({
                      request: () => api(`/v1/actions/${action.id}/execute`, { method: "POST" }),
                      success:
                        action.provider === "deep_link"
                          ? "Email deep link prepared."
                          : "Approved action executed.",
                    });
                  }}
                >
                  <Send size={15} /> Execute
                </button>
              )}
            </div>
            {action.result?.providerReference && (
              /* The last step of the two-key gate handed back 130 characters of
               * percent-encoded URL as inert text. Copy, deliberately not an
               * anchor: opening the mail client on one click would blur the
               * "prepared" versus "sent" line the provider layer maintains. */
              <div className="action-reference">
                <CopyLine command={action.result.providerReference} />
                {action.provider === "deep_link" && (
                  <small className="field-note">
                    Copy this into your own mail client. Nimanto prepared it; it has not been sent.
                  </small>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {dashboard.externalActions.length === 0 && (
        <Empty
          icon={MailCheck}
          title="No actions prepared"
          copy="Approve a packet before creating a local test-outbox message or a user-opened email deep link. Connected-account sending remains outside this release."
        />
      )}
    </>
  );
}

function ActivityLedger({ dashboard }: { dashboard: Dashboard }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const types = useMemo(
    () => [...new Set(dashboard.receipts.map((receipt) => receipt.type))].toSorted(),
    [dashboard.receipts],
  );
  const visibleReceipts =
    typeFilter === "all"
      ? dashboard.receipts
      : dashboard.receipts.filter((receipt) => receipt.type === typeFilter);
  return (
    <>
      <PageIntro
        eyebrow="Local activity"
        title="Follow the evidence thread."
        copy="Nimanto checks each stored receipt against its internal hash before showing it. The ledger is tamper-evident local history—not a signature, an employer receipt, or proof of external delivery."
        action={
          types.length > 1 ? (
            <label className="activity-filter">
              Receipt type
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All receipt types</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {human(type)}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />
      <div className="activity-ledger">
        {visibleReceipts.map((receipt) => (
          <article className="receipt-row" key={receipt.id}>
            <span className="receipt-knot" aria-hidden="true" />
            <div className="receipt-heading">
              <span>Internal hash checked</span>
              <h2>{human(receipt.type)}</h2>
              <time dateTime={receipt.occurredAt}>{localDateTime(receipt.occurredAt)}</time>
            </div>
            <dl className="receipt-hashes">
              <div>
                <dt>Input hash</dt>
                <dd>
                  <CopyLine command={receipt.inputHash} />
                </dd>
              </div>
              <div>
                <dt>Artifact hash</dt>
                <dd>
                  <CopyLine command={receipt.artifactHash} />
                </dd>
              </div>
              <div>
                <dt>Receipt hash</dt>
                <dd>
                  <CopyLine command={receipt.receiptHash} />
                </dd>
              </div>
            </dl>
            <code className="receipt-id">{receipt.id}</code>
          </article>
        ))}
      </div>
      {dashboard.receipts.length === 0 && (
        <Empty
          icon={FileClock}
          title="No local receipts yet"
          copy="Match runs, packet generation and review, packet approval, and executed external actions add tamper-evident receipts as they occur."
        />
      )}
      {dashboard.receipts.length > 0 && visibleReceipts.length === 0 && (
        <Empty
          icon={FileClock}
          title="No receipts of this type"
          copy="Choose another receipt type to return to the local activity history."
        />
      )}
    </>
  );
}

function DataControls({
  dashboard,
  onAct,
  busy,
  onDeleted,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
  onDeleted: (receipt: DeletionReceipt) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [exportConfirmed, setExportConfirmed] = useState(false);
  const download = async () => {
    const response = await fetch(`${API}/v1/export`, { credentials: "include" });
    if (!response.ok) throw new Error("Export failed.");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nimanto-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageIntro
        eyebrow="Data controls"
        title="Take the record. Or erase it."
        copy="Export your workspace record and artifact manifests as JSON. Local deletion cascades through evidence, roles, packets, actions, sessions, and receipts."
      />
      <div className="data-grid">
        <section className="work-panel data-panel">
          <Download />
          <div>
            <span>Portable export</span>
            <h2>Download the workspace record</h2>
            <p>
              Includes {countedNoun(dashboard.evidence.length, "evidence item")},{" "}
              {countedNoun(dashboard.applications.length, "application")}, retained profile
              versions, match runs, assurance runs, the local receipt trail, and packet manifests.
              Generated packet files remain available as individual downloads.
            </p>
          </div>
          <label className="sensitive-confirmation">
            <input
              type="checkbox"
              checked={exportConfirmed}
              onChange={(event) => setExportConfirmed(event.target.checked)}
            />
            <span>
              I understand this JSON contains sensitive candidate records and should be stored
              privately.
            </span>
          </label>
          <button
            className="button primary"
            type="button"
            disabled={busy || !exportConfirmed}
            onClick={() => {
              void onAct.run({ request: download, success: "Export downloaded." });
            }}
          >
            <Download size={16} /> Download JSON
          </button>
          <p className="field-note">
            This is an inspection export, not a restore archive, immutable role history, or replay
            proof. Sessions, invitation secrets, deletion internals, and generated packet files are
            excluded.
          </p>
        </section>
        <section className="work-panel data-panel danger-zone">
          <Trash2 />
          <div>
            <span>Immediate deletion</span>
            <h2>Delete this workspace</h2>
            <p>
              This cannot be undone. Packet files and local outbox files should also be removed from
              the data directory.
            </p>
          </div>
          <label>
            Type <code>DELETE MY NIMANTO DATA</code>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          <button
            className="button danger-button"
            type="button"
            disabled={busy || confirmation !== "DELETE MY NIMANTO DATA"}
            onClick={() => {
              void onAct.run({
                request: () =>
                  api<DeletionReceipt>("/v1/data", {
                    method: "DELETE",
                    body: JSON.stringify({ confirmation }),
                  }),
                // Outcome-neutral on purpose: the server decides whether file
                // cleanup finished, and the receipt below states which. A fixed
                // "deleted" here would contradict a cleanup_pending receipt
                // sitting directly beside it.
                success: "Deletion recorded. Keep the status token.",
                // Deletion clears the session, so this panel unmounts moments
                // later. The receipt is handed upward to outlive it.
                commit: onDeleted,
              });
            }}
          >
            <Trash2 size={16} /> Delete all data
          </button>
        </section>
      </div>
      <section className="boundary-note">
        <ShieldCheck />
        <div>
          <h2>Beta boundary</h2>
          <p>
            The current beta is a local candidate tool. It is not an attorney, an employer screening
            system, or a guarantee that a company supports H-1B transfers today.
          </p>
        </div>
      </section>
    </>
  );
}
