"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
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
  MailCheck,
  Menu,
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
  type FormEvent,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Brand } from "./brand.js";
import { CommandPalette, type PaletteEntry } from "./command-palette.js";
import { ConnectionBanner, ConnectionIndicator, useConnection } from "./connection.js";
import { CopyLine } from "./copy-line.js";
import {
  BOARD_COLUMNS,
  APPLICATION_MATCH_BUCKETS,
  applicationCohortCounts,
  boardColumns,
  canMove,
  countedNoun,
  confirmationPrompt,
  failureMessage,
  filterRoles,
  followUpNote,
  funnelStages,
  legalTargets,
  needsConfirmation,
  nextSteps,
  packetInventoryNotice,
  profileInputChanged,
  profileVersionDiff,
  recordReviewQueue,
  recordedOutcomeTimeline,
  sectionFromHash,
  sectionHash,
  type ApplicationStatus,
  type Section,
} from "../lib/derive.js";

const API = process.env.NEXT_PUBLIC_NIMANTO_API_ORIGIN ?? "http://127.0.0.1:4310";

/* Often enough that a candidate staring at the workbench learns the API died
 * before they try to use it; rarely enough to stay invisible on a laptop
 * battery. The probe writes `apiReachable` and nothing else. */
const HEALTH_PROBE_MS = 15_000;

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
  title: string;
  company: string;
  description: string;
  location: string;
  requirements: string[];
  url: string;
  sourceMeta: {
    compensation?: { minimum?: number | null; maximum?: number | null; currency?: string } | null;
    benefits?: string[];
    interviewEvidence?: { text?: string; sourceLocator?: string; observedAt?: string } | null;
  };
};
type Match = {
  id: string;
  jobId: string;
  profileVersionId: string | null;
  ruleVersion: string;
  inputHash: string;
  artifactHash: string;
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
    blockers: Array<{ code: string; sourceText: string }>;
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
type Outcome = { id: string; type: string; note: string; occurredAt: string };
type Application = {
  id: string;
  jobId: string;
  // Narrowed from string: the board maps status to a column and the API rejects
  // anything outside the union, so a widened type here just hides the mismatch.
  status: ApplicationStatus;
  // The API has always returned these; the type simply never declared them, and
  // the follow-up observation needs createdAt as its baseline.
  createdAt?: string;
  updatedAt?: string;
  job?: { title: string; company: string };
  outcomes?: Outcome[];
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
type Dashboard = {
  identity: { displayName: string; email: string };
  profile: ProfileVersion | null;
  evidence: Evidence[];
  jobs: Job[];
  matches: Match[];
  h1bSignals: Signal[];
  applications: Application[];
  packets: Packet[];
  actionPackets: Packet[];
  externalActions: Action[];
  receipts: Receipt[];
  schedules: SourceSchedule[];
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
type ActionRunner = (
  work: () => Promise<unknown>,
  success: string | ((result: unknown) => string),
  onSuccess?: (result: unknown) => void,
  afterSuccessSettles?: (result: unknown) => void,
  onFailure?: (error: unknown) => boolean | void,
) => Promise<void>;
/* `state` is "completed" or "cleanup_pending"; the token is a bearer capability
 * that reaches the deletion status and resume routes without a session. */
type DeletionReceipt = {
  token: string;
  state: "completed" | "cleanup_pending";
  message: string;
};
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
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

function dateInputValue(value: Date, offsetDays = 0): string {
  const local = new Date(value);
  local.setDate(local.getDate() + offsetDays);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [authRequired, setAuthRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
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
  // Carries only the requirement wording from a blocked match to the claim
  // form. Never a source name or locator — see the note in EvidenceVault.
  const [draftClaim, setDraftClaim] = useState<string | null>(null);
  const clearDraftClaim = useCallback(() => setDraftClaim(null), []);
  // A manual role can be long. Keep it above the section boundary so navigation
  // cannot erase it, but never persist it or carry it into another identity.
  const [manualRoleDraft, setManualRoleDraft] = useState<ManualRoleDraft | null>(null);
  // Held here, not in Data controls: deleting the workspace clears the session,
  // so that panel unmounts before the candidate could copy the token.
  const [deletionReceipt, setDeletionReceipt] = useState<DeletionReceipt | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigationPanel = useRef<HTMLElement>(null);
  const closeNavigationButton = useRef<HTMLButtonElement>(null);
  const firstNavigationButton = useRef<HTMLButtonElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const workspaceHeader = useRef<HTMLElement>(null);
  const workspaceMain = useRef<HTMLElement>(null);
  const noticeRegion = useRef<HTMLDivElement>(null);
  const focusNoticeOnRender = useRef(false);
  const contentHeading = useRef<HTMLDivElement>(null);

  const focusSectionContent = useCallback(() => {
    const target = contentHeading.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    const header = workspaceHeader.current?.getBoundingClientRect();
    const targetTop = window.scrollY + target.getBoundingClientRect().top;
    // `scrollIntoView` can legally keep the viewport inside a tall target. The
    // workbench content is exactly such a target, so use its document offset
    // and the measured header height to make the destination deterministic.
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.max(0, targetTop - (header?.height ?? 0) - 8));
    window.requestAnimationFrame(() => {
      const heading = target.querySelector("h1") ?? target;
      const headerBottom = workspaceHeader.current?.getBoundingClientRect().bottom ?? 0;
      const headingTop = heading.getBoundingClientRect().top;
      const clearance = 8;
      if (headingTop < headerBottom + clearance) {
        window.scrollBy(0, headingTop - headerBottom - clearance);
      }
      root.style.scrollBehavior = previousScrollBehavior;
    });
  }, []);

  /* Consume the hash, then scrub it — in that order, and never one without the
   * other. A credential can arrive on load or long after it, by pasting an
   * invitation link into a tab that already has the workbench open, so both
   * entry points run this. Scrubbing without consuming would wipe the token out
   * of the address bar and the back stack before anything read it, leaving the
   * candidate with an invitation they can no longer accept. */
  const readHash = useCallback(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const invitation = fragment.get("invite") ?? "";
    const value = fragment.get("bootstrap") ?? "";
    const scrub = () =>
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

    if (invitation) {
      setInviteToken(invitation);
      scrub();
      return;
    }
    if (value) {
      window.sessionStorage.setItem("nimanto_bootstrap", value);
      setBootstrapSecret(value);
      scrub();
      return;
    }
    // Any other hash carrying "=" is not ours; drop it rather than display it.
    if (window.location.hash.includes("=")) {
      scrub();
      return;
    }
    // Only a bare, known section name is honoured.
    const opened = sectionFromHash(window.location.hash);
    if (opened) setSection(opened);
  }, []);

  useEffect(() => {
    setBootstrapSecret(window.sessionStorage.getItem("nimanto_bootstrap") ?? "");
    readHash();
    setRouteReady(true);
  }, [readHash]);

  /* Back, forward and a pasted link all arrive here. Without it the section
   * lived only in React state, so Back left the workbench entirely and a reload
   * always dropped the candidate back on Overview. */
  useEffect(() => {
    if (!routeReady) return;
    const onHashChange = () => {
      const wasCredential = window.location.hash.includes("=");
      readHash();
      // A scrubbed credential is not a route change; leave the section alone.
      if (wasCredential) return;
      setSection(sectionFromHash(window.location.hash) ?? "overview");
      setNotice(null);
      window.requestAnimationFrame(focusSectionContent);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [focusSectionContent, readHash, routeReady]);

  const clearBootstrapSecret = useCallback(() => {
    window.sessionStorage.removeItem("nimanto_bootstrap");
    setBootstrapSecret("");
    setInviteToken("");
  }, []);

  /* Opening a workspace retires a *finished* deletion receipt. Signing out does
   * not reload the page, so without this the next visit to the sign-in screen
   * would re-announce "Workspace deleted" and a spent token over a workspace
   * that now exists. A cleanup_pending receipt is kept: its token is the only
   * handle on an unfinished cleanup, and nothing else in the app holds it. */
  const startFresh = useCallback(() => {
    clearBootstrapSecret();
    setManualRoleDraft(null);
    setDraftClaim(null);
    setDeletionReceipt((receipt) => (receipt?.state === "completed" ? null : receipt));
  }, [clearBootstrapSecret]);

  const closeMobileNavigation = useCallback(() => {
    setMobileNav(false);
    window.requestAnimationFrame(() => menuButton.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileNav) return;
    closeNavigationButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileNavigation();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(navigationPanel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ].filter((element) => !element.hidden && element.getClientRects().length > 0);
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !navigationPanel.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !navigationPanel.current?.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMobileNavigation, mobileNav]);

  useEffect(() => {
    const narrowViewport = window.matchMedia("(max-width: 880px)");
    const closeAtDesktopWidth = () => {
      if (!narrowViewport.matches) setMobileNav(false);
    };
    narrowViewport.addEventListener("change", closeAtDesktopWidth);
    return () => narrowViewport.removeEventListener("change", closeAtDesktopWidth);
  }, []);

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
    noticeRegion.current?.focus({ preventScroll: true });
  }, [notice]);

  /* The API returns a precise `code` behind a deliberately generic message.
   * Only the client knows which screen the candidate is on, so this is where a
   * rejection becomes something to act on — and where a raw `TypeError` is
   * swallowed, because the connection banner already explains that failure
   * better than "Failed to fetch" ever could. */
  const describeFailure = (error: unknown): string | null =>
    failureMessage({
      code: error instanceof ApiError ? error.code : null,
      message: error instanceof Error ? error.message : null,
      transport: error instanceof TypeError,
    });

  const enterSignedOutState = useCallback(() => {
    // An expired or revoked session is an identity transition even when it is
    // discovered by an action rather than a dashboard refresh. Nothing drafted
    // for the previous candidate may survive into the next session.
    setManualRoleDraft(null);
    setDraftClaim(null);
    setMobileNav(false);
    setDashboard(null);
    setAuthRequired(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const status = await api<{ authenticated: boolean }>("/v1/auth/status");
      setApiReachable(true);
      if (!status.authenticated) {
        enterSignedOutState();
        return;
      }
      const value = await api<Dashboard>("/v1/dashboard");
      setDashboard(value);
      setAuthRequired(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTHENTICATION_REQUIRED") {
        // The API answered, it just refused. That is a reachable service.
        setApiReachable(true);
        enterSignedOutState();
      } else {
        // A transport failure means the local half is not answering at all.
        setApiReachable(!(error instanceof TypeError));
        const text = describeFailure(error);
        if (text) setNotice({ kind: "error", text });
      }
    }
  }, [enterSignedOutState]);

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

  const act: ActionRunner = async (work, success, onSuccess, afterSuccessSettles, onFailure) => {
    setBusy(true);
    setNotice(null);
    focusNoticeOnRender.current = false;
    let completed: unknown;
    let succeeded = false;
    try {
      const result = await work();
      completed = result;
      succeeded = true;
      onSuccess?.(result);
      await refresh();
      setNotice({ kind: "ok", text: typeof success === "function" ? success(result) : success });
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTHENTICATION_REQUIRED") {
        setApiReachable(true);
        enterSignedOutState();
        return;
      }
      // A transport failure has no notice of its own — the connection banner
      // says it better. But the banner only appears once `apiReachable` knows,
      // so record it here rather than leaving the candidate with no feedback at
      // all until the next health probe.
      if (error instanceof TypeError) setApiReachable(false);
      const text = describeFailure(error);
      const fieldOwnsRecovery = onFailure?.(error) === true;
      if (text) {
        focusNoticeOnRender.current = !fieldOwnsRecovery;
        setNotice({ kind: "error", text });
      }
    } finally {
      setBusy(false);
      if (succeeded) {
        window.requestAnimationFrame(() => afterSuccessSettles?.(completed));
      }
    }
  };

  if (authRequired || (!dashboard && !notice)) {
    return (
      <WorkspaceStart
        unavailable={!authRequired}
        onStart={(identity) =>
          act(
            () =>
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
            "Your private beta workspace is ready.",
            startFresh,
          )
        }
        onDemo={() =>
          act(
            () =>
              api("/v1/auth/demo", {
                method: "POST",
                body: "{}",
                headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
              }),
            "The synthetic Priya Shah workspace is ready.",
            startFresh,
          )
        }
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
    const next = id as Section;
    setSection(next);
    setNotice(null);
    setMobileNav(false);
    if (routeReady && sectionFromHash(window.location.hash) !== next) {
      window.location.hash = sectionHash(next);
    }
    window.requestAnimationFrame(focusSectionContent);
  };
  // Sections plus whatever the candidate is actually working on. Every entry is
  // a destination; none can carry an action.
  const paletteEntries: PaletteEntry[] = [
    ...navigation.map((item) => ({
      label: item.label,
      detail: "Section",
      section: item.id,
    })),
    ...dashboard.jobs.slice(0, 20).map((job) => ({
      label: `${job.title} · ${job.company}`,
      detail: "Role",
      section: "jobs",
    })),
    ...dashboard.applications.slice(0, 20).map((application) => ({
      label: application.job
        ? `${application.job.title} · ${application.job.company}`
        : application.id,
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
                ref={item.id === "overview" ? firstNavigationButton : undefined}
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
              void act(
                () => api("/v1/session", { method: "DELETE" }),
                "Signed out.",
                () => {
                  clearBootstrapSecret();
                  enterSignedOutState();
                },
              );
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
            onClick={() => setMobileNav(true)}
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
        {notice && (
          // A failure announced politely waits behind whatever the screen
          // reader is already saying. The sign-in screen already made this
          // distinction; the workbench did not.
          <div
            ref={noticeRegion}
            className={`notice ${notice.kind}`}
            role={notice.kind === "error" ? "alert" : "status"}
            aria-live={notice.kind === "error" ? "assertive" : "polite"}
            tabIndex={-1}
          >
            {notice.kind === "ok" ? <Check size={17} /> : <CircleAlert size={17} />}
            <span>{notice.text}</span>
            <button
              className="icon-button"
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </div>
        )}
        {/* Focus target for every section change. Without it, choosing a
         * destination — from the sidebar or from quick navigation — dropped
         * focus to <body> and a keyboard user restarted from the top. */}
        <div
          className="workspace-content"
          ref={contentHeading}
          tabIndex={-1}
          aria-labelledby="workspace-section-name"
        >
          {section === "overview" && (
            <Overview dashboard={dashboard} onGo={goToSection} onAct={act} busy={busy} />
          )}
          {section === "evidence" && (
            <EvidenceVault
              dashboard={dashboard}
              onAct={act}
              busy={busy}
              draftClaim={draftClaim}
              onDraftUsed={clearDraftClaim}
            />
          )}
          {section === "jobs" && (
            <Jobs
              dashboard={dashboard}
              onAct={act}
              busy={busy}
              draft={manualRoleDraft}
              onDraftOpen={() => setManualRoleDraft((value) => value ?? emptyManualRoleDraft())}
              onDraftChange={setManualRoleDraft}
              onDraftClose={() => setManualRoleDraft(null)}
              onAddEvidence={(requirement) => {
                setDraftClaim(requirement);
                goToSection("evidence");
              }}
            />
          )}
          {section === "applications" && (
            <Applications dashboard={dashboard} onAct={act} busy={busy} onGo={goToSection} />
          )}
          {section === "packets" && <Packets dashboard={dashboard} onAct={act} busy={busy} />}
          {section === "history" && <StoredHistory />}
          {section === "actions" && <Actions dashboard={dashboard} onAct={act} busy={busy} />}
          {section === "activity" && <ActivityLedger dashboard={dashboard} />}
          {section === "data" && (
            <DataControls
              dashboard={dashboard}
              onAct={act}
              busy={busy}
              onDeleted={(receipt) => {
                setManualRoleDraft(null);
                setDeletionReceipt(receipt);
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
  notice: { kind: "ok" | "error"; text: string } | null;
  bootstrapSecret: string;
  inviteMode: boolean;
  onBootstrapSecret: (value: string) => void;
  deletionReceipt?: DeletionReceipt | null;
}) {
  const receiptHeading = useRef<HTMLHeadingElement>(null);
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
              Start the Nimanto backend at <code>127.0.0.1:4310</code>, then try again.
            </>
          ) : inviteMode ? (
            "Accept this single-use invitation to create an empty, tenant-isolated candidate workspace."
          ) : (
            "Open the synthetic starter workspace, inspect every source link, and replace examples with your own confirmed evidence."
          )}
        </p>
        {!unavailable && !inviteMode && !bootstrapSecret && (
          <label className="launch-secret-field">
            Private launch key
            <input
              type="password"
              autoComplete="off"
              value={bootstrapSecret}
              onChange={(event) => onBootstrapSecret(event.target.value)}
              placeholder="Paste the key shown by the local launcher"
            />
            <small>The launcher normally supplies this key automatically.</small>
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
          disabled={busy || (!unavailable && !inviteMode && !bootstrapSecret)}
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
  const blockers = dashboard.matches.reduce(
    (count, match) => count + match.result.blockers.length,
    0,
  );
  const latestMatches = dashboard.matches.slice(0, 3);
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
      <div className="metric-row">
        <Metric
          value={dashboard.evidence.filter((item) => item.status === "confirmed").length}
          label="Confirmed evidence"
          detail={`${pending} awaiting review`}
        />
        <Metric
          value={dashboard.matches.length}
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
      {dashboard.jobs.length > 0 && dashboard.matches.length === 0 && (
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
            onClick={() =>
              onAct(async () => {
                for (const job of dashboard.jobs)
                  await api(`/v1/jobs/${job.id}/match`, { method: "POST" });
              }, "Role explanations are ready.")
            }
          >
            Run starter matches
          </button>
        </div>
      )}
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

function EvidenceVault({
  dashboard,
  onAct,
  busy,
  draftClaim,
  onDraftUsed,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
  draftClaim?: string | null;
  onDraftUsed?: () => void;
}) {
  const [kind, setKind] = useState("skill");
  const [value, setValue] = useState("");
  const [authorization, setAuthorization] = useState(dashboard.profile?.authorizationWording ?? "");
  const [importPreview, setImportPreview] = useState<EvidenceImportPreview | null>(null);
  const claimField = useRef<HTMLTextAreaElement>(null);
  const profileChanged = profileInputChanged(
    dashboard.profile,
    authorization,
    dashboard.evidence.filter((claim) => claim.status === "confirmed").map((claim) => claim.id),
  );

  /* Arrived here from an unmet requirement. Only the wording the candidate has
   * to answer is carried across — never the posting's source name or locator,
   * which would attribute a candidate's own claim to an employer's ad. The API
   * files it as pending and user-attested regardless. */
  useEffect(() => {
    if (!draftClaim) return;
    setValue(draftClaim);
    onDraftUsed?.();
    window.requestAnimationFrame(() => {
      claimField.current?.focus();
      claimField.current?.setSelectionRange(draftClaim.length, draftClaim.length);
    });
  }, [draftClaim, onDraftUsed]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onAct(
      () => api("/v1/evidence", { method: "POST", body: JSON.stringify({ kind, value }) }),
      "Claim added to the review queue.",
    ).then(() => setValue(""));
  };
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
                type="file"
                accept=".txt,.md,.json,.docx,.pdf,.zip"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void onAct(
                    async () => {
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
                    `${file.name} is ready for your import decision.`,
                    (result) => setImportPreview(result as EvidenceImportPreview),
                  );
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {importPreview && (
            <section className="import-preview" aria-labelledby="import-preview-title">
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
                  onClick={() =>
                    onAct(
                      () =>
                        api("/v1/evidence/import", {
                          method: "POST",
                          body: JSON.stringify({
                            filename: importPreview.filename,
                            mimeType: importPreview.mimeType,
                            contentBase64: importPreview.contentBase64,
                            confirmedPreviewHash: importPreview.previewHash,
                          }),
                        }),
                      `${importPreview.filename} was imported as pending evidence.`,
                      () => setImportPreview(null),
                    )
                  }
                >
                  <Check size={16} /> Confirm import
                </button>
                <button
                  className="button quiet"
                  type="button"
                  disabled={busy}
                  onClick={() => setImportPreview(null)}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
          <div className="evidence-list">
            {dashboard.evidence.map((claim) => (
              <article key={claim.id} className="evidence-item">
                <div className="evidence-kind">{human(claim.kind)}</div>
                <div>
                  <strong>{claim.value}</strong>
                  <small>
                    {claim.sourceName} · {claim.locator}
                  </small>
                </div>
                <div className="evidence-controls">
                  <span
                    className={`state ${claim.status === "confirmed" ? "supported" : claim.status === "pending" ? "warning" : "muted"}`}
                  >
                    {human(claim.status)}
                  </span>
                  {claim.status === "pending" && (
                    <>
                      <button
                        className="icon-button positive"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onAct(
                            () => api(`/v1/evidence/${claim.id}/confirm`, { method: "POST" }),
                            "Claim confirmed.",
                          )
                        }
                        aria-label={`Confirm ${claim.value}`}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onAct(
                            () => api(`/v1/evidence/${claim.id}/reject`, { method: "POST" }),
                            "Claim rejected.",
                          )
                        }
                        aria-label={`Reject ${claim.value}`}
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
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
            <label>
              Evidence type
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
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
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="What can you support with a source?"
              />
            </label>
            <button className="button primary" disabled={busy || value.trim().length < 3}>
              <Plus size={16} /> Add pending claim
            </button>
          </form>
          <form
            className="work-panel form-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void onAct(
                () =>
                  api<ProfileVersionResponse>("/v1/profile/versions", {
                    method: "POST",
                    body: JSON.stringify({ authorizationWording: authorization }),
                  }),
                (result) =>
                  (result as ProfileVersionResponse).created
                    ? "A new profile version was saved."
                    : "No profile changes were found; stored history is unchanged.",
              );
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
                value={authorization}
                onChange={(event) => setAuthorization(event.target.value)}
                placeholder="Use your own exact wording."
              />
            </label>
            <p className="field-note">
              Packet assurance blocks any silent wording change. This is not legal advice.
            </p>
            <button className="button quiet" disabled={busy || !profileChanged}>
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
  onAddEvidence,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
  draft: ManualRoleDraft | null;
  onDraftOpen: () => void;
  onDraftChange: (draft: ManualRoleDraft) => void;
  onDraftClose: () => void;
  onAddEvidence: (requirement: string) => void;
}) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [fitFilter, setFitFilter] = useState("all");
  const [trackingFilter, setTrackingFilter] = useState<"all" | "tracked" | "untracked">("all");
  const [compensationError, setCompensationError] = useState<string | null>(null);
  const addRoleButton = useRef<HTMLButtonElement>(null);
  const roleTitleField = useRef<HTMLInputElement>(null);
  const compensationMaximumField = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);
  const latest = useMemo(
    () => new Map(dashboard.matches.map((match) => [match.jobId, match])),
    [dashboard.matches],
  );
  const roleInputs = useMemo(
    () =>
      dashboard.jobs.map((job) => ({
        ...job,
        match: latest.get(job.id) ?? null,
        tracked: dashboard.applications.some((application) => application.jobId === job.id),
      })),
    [dashboard.applications, dashboard.jobs, latest],
  );
  const sourceOptions = useMemo(
    () => [...new Set(dashboard.jobs.map((job) => job.source))].toSorted(),
    [dashboard.jobs],
  );
  const visibleRoles = useMemo(
    () =>
      filterRoles(roleInputs, {
        query: deferredQuery,
        source: sourceFilter,
        fit: fitFilter,
        tracking: trackingFilter,
      }),
    [deferredQuery, fitFilter, roleInputs, sourceFilter, trackingFilter],
  );
  const filtersActive = Boolean(
    query || sourceFilter !== "all" || fitFilter !== "all" || trackingFilter !== "all",
  );
  const numberOrNull = (value: string) => {
    const text = value.trim();
    return text ? Number(text) : null;
  };
  const compensationFailure = () =>
    failureMessage({ code: "INVALID_COMPENSATION" }) ?? "Check the posted compensation range.";
  const focusCompensationMaximum = () =>
    window.requestAnimationFrame(() => compensationMaximumField.current?.focus());
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
    void onAct(
      () =>
        api("/v1/jobs", {
          method: "POST",
          body: JSON.stringify({
            title: draft.title,
            company: draft.company,
            description: draft.description,
            location: draft.location,
            workMode: draft.workMode,
            compensationMin,
            compensationMax,
            benefits,
            interviewEvidence: draft.interviewEvidence,
            interviewSource: draft.interviewSource,
            url: draft.url,
            requirements,
          }),
        }),
      "Role added.",
      () => {
        setCompensationError(null);
        onDraftClose();
        window.requestAnimationFrame(() => addRoleButton.current?.focus());
      },
      undefined,
      (error) => {
        if (!(error instanceof ApiError) || error.code !== "INVALID_COMPENSATION") return false;
        setCompensationError(compensationFailure());
        focusCompensationMaximum();
        return true;
      },
    );
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
    void onAct(
      () =>
        api("/v1/jobs/import", {
          method: "POST",
          body: JSON.stringify({ provider: data.get("provider"), board: data.get("board") }),
        }),
      "Allowlisted source refreshed.",
    ).then(() => setSourceOpen(false));
  };
  const createSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onAct(
      () =>
        api("/v1/schedules", {
          method: "POST",
          body: JSON.stringify({
            provider: data.get("provider"),
            board: data.get("board"),
            cadenceMinutes: Number(data.get("cadenceMinutes")),
          }),
        }),
      "Discovery schedule started.",
    ).then(() => setScheduleOpen(false));
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
              aria-controls="manual-role-draft"
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
      {(draft || sourceOpen || scheduleOpen) && (
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
                <button
                  className="button quiet"
                  type="button"
                  disabled={busy}
                  onClick={(event) => {
                    if (!window.confirm("Discard this unsaved role draft?")) {
                      const trigger = event.currentTarget;
                      window.requestAnimationFrame(() => trigger.focus());
                      return;
                    }
                    onDraftClose();
                    window.requestAnimationFrame(() => addRoleButton.current?.focus());
                  }}
                >
                  Discard draft
                </button>
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
                          onClick={() =>
                            onAct(
                              () => api(`/v1/schedules/${schedule.id}/run-now`, { method: "POST" }),
                              `${schedule.board} is queued now.`,
                            )
                          }
                        >
                          <Play size={14} /> Run now
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label="Pause schedule"
                          disabled={busy}
                          onClick={() =>
                            onAct(
                              () => api(`/v1/schedules/${schedule.id}/pause`, { method: "POST" }),
                              `${schedule.board} is paused.`,
                            )
                          }
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
                        onClick={() =>
                          onAct(
                            () => api(`/v1/schedules/${schedule.id}/resume`, { method: "POST" }),
                            `${schedule.board} is queued again.`,
                          )
                        }
                      >
                        <RotateCcw size={14} /> Resume
                      </button>
                    )}
                    {schedule.state !== "cancelled" && (
                      <button
                        className="icon-button"
                        type="button"
                        aria-label="Cancel schedule"
                        disabled={busy}
                        onClick={() =>
                          onAct(
                            () => api(`/v1/schedules/${schedule.id}`, { method: "DELETE" }),
                            `${schedule.board} schedule was cancelled.`,
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <section className="role-filter" aria-labelledby="role-filter-title">
        <div>
          <span>Private shortlist</span>
          <h2 id="role-filter-title">Narrow this view</h2>
          <p>Filters stay in this open view. They are not saved or sent anywhere.</p>
        </div>
        <label className="role-search">
          Search roles
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, company, or location"
          />
        </label>
        <label>
          Source
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
            <option value="all">All sources</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {human(source)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Evidence fit
          <select value={fitFilter} onChange={(event) => setFitFilter(event.target.value)}>
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
            value={trackingFilter}
            onChange={(event) =>
              setTrackingFilter(event.target.value as "all" | "tracked" | "untracked")
            }
          >
            <option value="all">All roles</option>
            <option value="tracked">Tracked</option>
            <option value="untracked">Not tracked</option>
          </select>
        </label>
        <div className="role-filter-result" aria-live="polite">
          <strong>
            {visibleRoles.length} of {dashboard.jobs.length}
          </strong>
          <span>roles shown</span>
          {filtersActive && (
            <button
              className="button mini quiet"
              type="button"
              onClick={() => {
                setQuery("");
                setSourceFilter("all");
                setFitFilter("all");
                setTrackingFilter("all");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>
      <div className="job-list">
        {visibleRoles.map((job) => {
          const match = job.match;
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
                      {
                        match.result.requirements.filter((item) => item.state === "supported")
                          .length
                      }
                      /{match.result.requirements.length} requirements supported
                    </small>
                  </>
                ) : (
                  <span className="state muted">Not matched</span>
                )}
              </div>
              <div className="job-actions">
                <button
                  className="button mini quiet"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onAct(
                      () => api(`/v1/jobs/${job.id}/match`, { method: "POST" }),
                      `Explanation ready for ${job.title}.`,
                    )
                  }
                >
                  <SlidersHorizontal size={15} /> Explain fit
                </button>
                <button
                  className="button mini primary"
                  type="button"
                  disabled={busy || dashboard.applications.some((item) => item.jobId === job.id)}
                  onClick={() =>
                    onAct(
                      () =>
                        api("/v1/applications", {
                          method: "POST",
                          body: JSON.stringify({ jobId: job.id }),
                        }),
                      `${job.title} is now tracked.`,
                    )
                  }
                >
                  <Plus size={15} />{" "}
                  {dashboard.applications.some((item) => item.jobId === job.id)
                    ? "Tracked"
                    : "Track"}
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
                      Roles without requirements remain not scored. Otherwise, the four weighted
                      dimensions determine the scored band; explicit blockers remain separate and
                      are never averaged away. Evidence Strength is intentionally excluded from this
                      view; this is not a hiring probability.
                    </p>
                    {match.result.blockers.map((blocker) => (
                      <p className="blocker" key={blocker.code}>
                        <CircleAlert size={15} />
                        <span>
                          <strong>{human(blocker.code)}</strong>
                          {/* Without a separator the label ran straight into the
                           * quoted source: "No sponsorship of any kindNo sponsor". */}
                          <span className="blocker-source">{blocker.sourceText}</span>
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
      {dashboard.jobs.length > 0 && visibleRoles.length === 0 && (
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
    void onAct(
      () =>
        api("/v1/h1b-signals", {
          method: "POST",
          body: JSON.stringify({
            ...data,
            confidence: "low",
            observedAt: new Date().toISOString(),
          }),
        }),
      "Historical sponsorship evidence added.",
    ).then(() => setOpen(false));
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

function Applications({
  dashboard,
  onAct,
  busy,
  onGo,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
  onGo: (section: Section) => void;
}) {
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const outcomeTrigger = useRef<HTMLButtonElement | null>(null);
  const [view, setView] = useState<"board" | "table">("board");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [cohortStart, setCohortStart] = useState(() => dateInputValue(new Date(), -30));
  const [cohortEnd, setCohortEnd] = useState(() => dateInputValue(new Date()));
  const [cohortSource, setCohortSource] = useState("all");
  const [cohortBucket, setCohortBucket] = useState<
    "all" | (typeof APPLICATION_MATCH_BUCKETS)[number]
  >("all");
  const now = new Date();
  const reviewQueue = recordReviewQueue(dashboard.applications, now);
  const visibleApplications = reviewOnly
    ? reviewQueue.map((item) => item.application)
    : dashboard.applications;
  const cohort = applicationCohortCounts({
    applications: dashboard.applications,
    jobs: dashboard.jobs,
    matches: dashboard.matches,
    startAt: localDayInstant(cohortStart),
    endAtExclusive: localDayInstant(cohortEnd, 1),
    source: cohortSource,
    matchBucket: cohortBucket,
  });
  const cohortTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cohortSources = [...new Set(dashboard.jobs.map((job) => job.source))].toSorted();
  const openOutcome = (id: string, trigger: HTMLButtonElement) => {
    outcomeTrigger.current = trigger;
    setOutcomeFor((current) => (current === id ? null : id));
  };
  const closeOutcome = () => {
    setOutcomeFor(null);
    window.requestAnimationFrame(() => outcomeTrigger.current?.focus());
  };
  const completeOutcome = () => setOutcomeFor(null);

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
    if (
      needsConfirmation(application.status, to) &&
      !window.confirm(confirmationPrompt(to, application))
    )
      return;
    /* The card unmounts into another column, so focus has to be put back on it
     * where it landed rather than left to fall to the top of the document.
     * Both signals are needed: `onSuccess` fires only when the move was
     * accepted but runs before the dashboard reloads, and the settled promise
     * runs after the reload but also resolves on failure — where stealing
     * focus would pull the candidate off the error they need to read. */
    let moved = false;
    void onAct(
      () =>
        api(`/v1/applications/${application.id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: to }),
        }),
      "Application status updated.",
      () => {
        moved = true;
      },
    ).then(() => {
      if (!moved) return;
      window.requestAnimationFrame(() =>
        document.getElementById(`board-card-${application.id}`)?.focus(),
      );
    });
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
              onClick={() => {
                setOutcomeFor(null);
                setView(view === "board" ? "table" : "board");
              }}
            >
              {view === "board" ? "Table view" : "Board view"}
            </button>
            <button
              className="button quiet mini"
              type="button"
              aria-pressed={reviewOnly}
              onClick={() => setReviewOnly((value) => !value)}
            >
              <Clock3 size={15} /> {reviewOnly ? "Show all" : `Review due · ${reviewQueue.length}`}
            </button>
            <button className="button quiet" type="button" onClick={() => onGo("jobs")}>
              <Plus size={16} /> Track another role
            </button>
          </div>
        }
      />
      {view === "board" && visibleApplications.length > 0 && (
        <section className="board" aria-label="Application pipeline">
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
                        <Clock3 size={12} aria-hidden="true" /> {note}
                      </span>
                    )}
                    <RecordedTimeline application={application} />
                    <button
                      className="button mini quiet"
                      type="button"
                      disabled={busy}
                      aria-expanded={outcomeFor === application.id}
                      aria-controls={`outcome-editor-${application.id}`}
                      onClick={(event) => openOutcome(application.id, event.currentTarget)}
                    >
                      <Plus size={15} /> Record outcome
                    </button>
                    {outcomeFor === application.id && (
                      <OutcomeEditor
                        application={application}
                        onAct={onAct}
                        busy={busy}
                        onRecorded={completeOutcome}
                        onClose={closeOutcome}
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
                        .map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            disabled={busy}
                            // Visually the column name is enough; heard on its own
                            // in a list of twenty cards, "Prepared" is not.
                            aria-label={`Move ${role} to ${target.label}`}
                            onClick={() => move(application, target.id)}
                          >
                            {target.label}
                          </button>
                        ))}
                    </div>
                  </article>
                );
              })}
              {column.items.length === 0 && <small className="field-note">Nothing here yet</small>}
            </div>
          ))}
        </section>
      )}

      {visibleApplications.length > 0 && (
        <section
          className="application-table"
          aria-label="Tracked applications"
          hidden={view === "board"}
        >
          <div className="table-head" aria-hidden="true">
            <span>Role</span>
            <span>Status</span>
            <span>Outcomes</span>
            <span>Next step</span>
          </div>
          {visibleApplications.map((application) => (
            <article key={application.id} className="table-row">
              <div className="application-identity">
                <strong>{application.job?.title ?? "Unknown role"}</strong>
                <small>{application.job?.company}</small>
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
                  onChange={(event) => move(application, event.target.value as ApplicationStatus)}
                >
                  {legalTargets(application.status).map((target) => (
                    <option key={target} value={target}>
                      {BOARD_COLUMNS.find((column) => column.id === target)!.label}
                    </option>
                  ))}
                </select>
              </label>
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
                className="button mini quiet"
                type="button"
                disabled={busy}
                aria-expanded={outcomeFor === application.id}
                aria-controls={`outcome-editor-${application.id}`}
                onClick={(event) => openOutcome(application.id, event.currentTarget)}
              >
                <Plus size={15} /> Record outcome
              </button>
              {outcomeFor === application.id && (
                <OutcomeEditor
                  application={application}
                  onAct={onAct}
                  busy={busy}
                  onRecorded={completeOutcome}
                  onClose={closeOutcome}
                />
              )}
            </article>
          ))}
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
          icon={Clock3}
          title="No records are due for review"
          copy="Every active record has candidate-recorded activity within the last 336 elapsed hours."
        />
      )}
      <Funnel funnel={dashboard.personalFunnel} />

      <section className="record-review-strip" aria-labelledby="record-review-title">
        <div>
          <span>Derived current view</span>
          <h2 id="record-review-title">Record-review queue</h2>
          <p>
            {reviewQueue.length
              ? `${reviewQueue.length} application record${reviewQueue.length === 1 ? " has" : "s have"} no candidate-recorded activity in at least 336 elapsed hours.`
              : "No application record has reached 336 elapsed hours since its latest candidate-recorded activity."}
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
                <small>
                  Latest candidate record {localDateTime(item.lastRecordedAt)} · review due{" "}
                  {localDateTime(item.dueAt)}
                </small>
              </li>
            ))}
          </ol>
        ) : null}
        <small>No reminder is stored and no employer outcome is inferred.</small>
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
              value={cohortStart}
              max={cohortEnd}
              onChange={(event) => {
                if (event.target.value) setCohortStart(event.target.value);
              }}
            />
          </label>
          <label>
            Created through
            <input
              type="date"
              value={cohortEnd}
              min={cohortStart}
              onChange={(event) => {
                if (event.target.value) setCohortEnd(event.target.value);
              }}
            />
          </label>
          <label>
            Current role source
            <select value={cohortSource} onChange={(event) => setCohortSource(event.target.value)}>
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
              value={cohortBucket}
              onChange={(event) => setCohortBucket(event.target.value as typeof cohortBucket)}
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

function OutcomeEditor({
  application,
  onAct,
  busy,
  onRecorded,
  onClose,
}: {
  application: Application;
  onAct: ActionRunner;
  busy: boolean;
  onRecorded: () => void;
  onClose: () => void;
}) {
  const [type, setType] = useState("reply");
  const [note, setNote] = useState("");
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
        void onAct(
          () =>
            api(`/v1/applications/${application.id}/outcomes`, {
              method: "POST",
              body: JSON.stringify({ type, note }),
            }),
          "Candidate-reported outcome recorded.",
          onRecorded,
          onClose,
        );
      }}
    >
      <label htmlFor={typeId}>Candidate-reported outcome</label>
      <select
        ref={typeField}
        id={typeId}
        value={type}
        onChange={(event) => setType(event.target.value)}
      >
        <option value="reply">Reply</option>
        <option value="screen">Screen</option>
        <option value="interview">Interview</option>
        <option value="offer">Offer</option>
        <option value="rejection">Rejection</option>
        <option value="withdrawal">Withdrawal</option>
      </select>
      <label htmlFor={noteId}>Optional note</label>
      <input id={noteId} value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="button-group">
        <button className="button mini primary" disabled={busy}>
          Record outcome
        </button>
        <button className="button mini quiet" type="button" disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RecordedTimeline({ application }: { application: Application }) {
  const timeline = recordedOutcomeTimeline(application);
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
        Only stored application creation and candidate-recorded outcomes appear here. Gaps infer
        nothing.
      </p>
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
                    onClick={() =>
                      onAct(
                        () =>
                          api<Packet>("/v1/packets", {
                            method: "POST",
                            body: JSON.stringify({ applicationId: application.id }),
                          }),
                        (result) => packetInventoryNotice((result as Packet).artifactManifest),
                      )
                    }
                  >
                    <FileOutput size={15} /> Generate
                  </button>
                ) : (
                  <>
                    <button
                      className="button mini quiet"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onAct(
                          () =>
                            api<Packet>("/v1/packets", {
                              method: "POST",
                              body: JSON.stringify({ applicationId: application.id }),
                            }),
                          (result) => packetInventoryNotice((result as Packet).artifactManifest),
                        )
                      }
                    >
                      <FileOutput size={15} /> Generate new
                    </button>
                    <button
                      className="button mini quiet"
                      type="button"
                      disabled={busy || packet.status === "approved"}
                      onClick={() =>
                        onAct(
                          () => api(`/v1/packets/${packet.id}/assure`, { method: "POST" }),
                          "Assurance check complete.",
                        )
                      }
                    >
                      <ShieldCheck size={15} /> Assure
                    </button>
                    <button
                      className="button mini primary"
                      type="button"
                      disabled={busy || packet.status !== "assurance_passed"}
                      onClick={() =>
                        onAct(
                          () => api(`/v1/packets/${packet.id}/approve`, { method: "POST" }),
                          "Packet approved for export.",
                        )
                      }
                    >
                      <Check size={15} /> Approve
                    </button>
                    <button
                      className="button mini quiet"
                      type="button"
                      aria-expanded={historyFor === application.id}
                      onClick={() =>
                        setHistoryFor(historyFor === application.id ? null : application.id)
                      }
                    >
                      <FileClock size={15} /> History
                    </button>
                  </>
                )}
              </div>
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
    </>
  );
}

function PacketHistoryPanel({ applicationId }: { applicationId: string }) {
  const [page, setPage] = useState<HistoryPage<PacketHistoryRecord> | null>(null);
  const [assuranceFor, setAssuranceFor] = useState<string | null>(null);
  const [assurances, setAssurances] = useState<HistoryPage<AssuranceHistoryRun> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
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
  }, [applicationId]);

  useEffect(() => {
    if (!assuranceFor) {
      setAssurances(null);
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
  }, [assuranceFor]);

  const packets = page?.items ?? [];
  const latest = packets[0];
  const previous = packets[1];
  const canonicalDelta = latest && previous ? packetCanonicalDelta(previous, latest) : [];
  const manifestDelta = latest && previous ? packetManifestDelta(previous, latest) : [];
  const loadOlderPackets = async () => {
    if (!page?.nextCursor) return;
    const older = await api<HistoryPage<PacketHistoryRecord>>(
      `/v1/applications/${encodeURIComponent(applicationId)}/packets?limit=20&cursor=${encodeURIComponent(page.nextCursor)}`,
    );
    setPage({ items: [...page.items, ...older.items], nextCursor: older.nextCursor });
  };
  const loadOlderAssurances = async () => {
    if (!assurances?.nextCursor || !assuranceFor) return;
    const older = await api<HistoryPage<AssuranceHistoryRun>>(
      `/v1/packets/${encodeURIComponent(assuranceFor)}/assurance-runs?limit=20&cursor=${encodeURIComponent(assurances.nextCursor)}`,
    );
    setAssurances({ items: [...assurances.items, ...older.items], nextCursor: older.nextCursor });
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
              onClick={() => setAssuranceFor(assuranceFor === packet.id ? null : packet.id)}
            >
              <ShieldCheck size={14} /> Assurance history
            </button>
          </article>
        ))}
      </div>
      {page?.nextCursor && (
        <button className="button mini quiet" type="button" onClick={() => void loadOlderPackets()}>
          Load older packets
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
              onClick={() => void loadOlderAssurances()}
            >
              Load older assurance runs
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
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const availablePackets = [
    ...new Map(
      [...dashboard.packets, ...dashboard.actionPackets].map((packet) => [packet.id, packet]),
    ).values(),
  ];
  const approvedPackets = availablePackets.filter((packet) => packet.status === "approved");
  /* This control decides what leaves the machine. Naming it "a9c20e42" asked
   * the candidate to map opaque hex to a role at the most consequential step in
   * the product; the identifier stays, as secondary detail. */
  const packetLabel = (packetId: string) => {
    const packet = availablePackets.find((item) => item.id === packetId);
    const job = dashboard.applications.find((item) => item.id === packet?.applicationId)?.job;
    return job ? `${job.title} · ${job.company}` : `Packet ${packetId.slice(0, 8)}`;
  };
  const [open, setOpen] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    void onAct(
      () => api("/v1/actions", { method: "POST", body: JSON.stringify(data) }),
      "Action created and waiting for approval.",
    ).then(() => setOpen(false));
  };
  return (
    <>
      <PageIntro
        eyebrow="Approved actions"
        title="Nothing leaves without two keys."
        copy="Approve the exact action, then turn on the reset-on-restart execution switch. This beta offers only a user-opened mail link and a private local test outbox; connected accounts are not enabled."
        action={
          <button
            className="button primary"
            type="button"
            disabled={approvedPackets.length === 0}
            onClick={() => setOpen((value) => !value)}
          >
            <Plus size={16} /> Prepare action
          </button>
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
            <strong>
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
          onClick={() =>
            onAct(
              () =>
                api("/v1/actions/runtime", {
                  method: "PUT",
                  body: JSON.stringify({ enabled: !dashboard.runtime.externalActionsEnabled }),
                }),
              dashboard.runtime.externalActionsEnabled
                ? "Execution switch turned off."
                : "Execution switch turned on for this runtime.",
            )
          }
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
      {open && (
        <form className="work-panel form-panel action-form" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <span>Exact handoff</span>
              <h2>Prepare an action</h2>
            </div>
          </div>
          <div className="field-grid">
            <label>
              Approved packet
              <select name="packetId">
                {approvedPackets.map((packet) => (
                  <option key={packet.id} value={packet.id}>
                    {packetLabel(packet.id)} ({packet.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Provider
              <select name="provider">
                <option value="deep_link">Email deep link</option>
                <option value="test_outbox">Local test outbox</option>
              </select>
            </label>
            <label>
              Recipient
              <input name="to" type="email" required maxLength={254} />
            </label>
            <label>
              Subject
              <input name="subject" required maxLength={200} defaultValue="Application materials" />
            </label>
          </div>
          <label>
            Message
            <textarea
              name="body"
              required
              maxLength={20000}
              defaultValue="Please find my reviewed application materials attached separately."
            />
          </label>
          <button className="button primary" disabled={busy}>
            Create approval request
          </button>
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
                    onClick={() =>
                      onAct(
                        () => api(`/v1/actions/${action.id}/approve`, { method: "POST" }),
                        "Action approved. Execution is still separate.",
                      )
                    }
                  >
                    <Check size={15} /> Approve
                  </button>
                  <button
                    className="button mini quiet"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onAct(
                        () => api(`/v1/actions/${action.id}/cancel`, { method: "POST" }),
                        "Action cancelled.",
                      )
                    }
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
                  onClick={() =>
                    onAct(
                      () => api(`/v1/actions/${action.id}/execute`, { method: "POST" }),
                      action.provider === "deep_link"
                        ? "Email deep link prepared."
                        : "Approved action executed.",
                    )
                  }
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
            onClick={() => onAct(download, "Export downloaded.")}
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
            onClick={() =>
              onAct(
                () => api("/v1/data", { method: "DELETE", body: JSON.stringify({ confirmation }) }),
                // Outcome-neutral on purpose: the server decides whether file
                // cleanup finished, and the receipt below states which. A fixed
                // "deleted" here would contradict a cleanup_pending receipt
                // sitting directly beside it.
                "Deletion recorded. Keep the status token.",
                // Deletion clears the session, so this panel unmounts moments
                // later. The receipt is handed upward to outlive it.
                (result) => onDeleted(result as DeletionReceipt),
              )
            }
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
