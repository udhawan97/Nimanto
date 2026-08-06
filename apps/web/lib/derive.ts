/* Pure derived logic for the workbench.
 *
 * Nothing here imports React or the workspace component: the parameter types are
 * structural, so the richer types in workspace.tsx satisfy them and this module
 * stays testable without a DOM. It is also the only place the product's
 * "never infer an outcome from silence" rule is enforced in code rather than in
 * copy — see followUpNote below. */

export type ApplicationStatus =
  "tracked" | "prepared" | "approved_for_export" | "submitted_externally" | "withdrawn";

export type Section =
  "overview" | "evidence" | "jobs" | "applications" | "packets" | "actions" | "data";

type EvidenceLike = { status: string };
type JobLike = { id: string };
type MatchLike = { job: { id: string }; result: { blockers: unknown[] } };
type OutcomeLike = { occurredAt: string };
type ApplicationLike = {
  id: string;
  jobId?: string;
  status: ApplicationStatus;
  createdAt?: string;
  outcomes?: OutcomeLike[];
  job?: { title: string; company: string };
};
type PacketLike = { status: string; applicationId?: string };
type ActionLike = { state: string };

/* ── F2 · next-step rail ─────────────────────────────────────────────────── */

export type NextStep = {
  id: string;
  title: string;
  detail: string;
  section: Section;
  tone: "live" | "idle";
};

/* Ordered by where the candidate is blocked earliest in the flow, not by how
 * many items each bucket holds. Confirming evidence unblocks matching, which
 * unblocks packets, which unblocks actions — so a single pending claim
 * outranks ten packets awaiting assurance. */
export function nextSteps(input: {
  evidence: EvidenceLike[];
  jobs: JobLike[];
  matches: MatchLike[];
  applications: ApplicationLike[];
  packets: PacketLike[];
  externalActions: ActionLike[];
}): NextStep[] {
  const steps: NextStep[] = [];
  const pending = input.evidence.filter((item) => item.status === "pending").length;
  if (pending > 0) {
    steps.push({
      id: "confirm-evidence",
      title: `Confirm ${pending} imported claim${pending === 1 ? "" : "s"}`,
      detail: "Imported claims stay pending until you decide. Nothing scores until then.",
      section: "evidence",
      tone: "live",
    });
  }

  const matched = new Set(input.matches.map((match) => match.job.id));
  const unmatched = input.jobs.filter((job) => !matched.has(job.id)).length;
  if (unmatched > 0) {
    steps.push({
      id: "run-matches",
      title: `Explain ${unmatched} role${unmatched === 1 ? "" : "s"}`,
      detail: "Deterministic scoring against confirmed evidence only. No model is used.",
      section: "jobs",
      tone: "idle",
    });
  }

  const blocked = input.matches.filter((match) => match.result.blockers.length > 0).length;
  if (blocked > 0) {
    steps.push({
      id: "review-blockers",
      title: `Review ${blocked} role${blocked === 1 ? "" : "s"} with blockers`,
      detail: "Sponsorship, citizenship, clearance, or location constraints are visible.",
      section: "jobs",
      tone: "idle",
    });
  }

  /* The two steps below close the gap between "the app explained a role" and
   * "the app has something to prepare". Without them the rail rendered its
   * all-clear at exactly the points where the candidate's next move is obvious
   * to them and unprompted by us. Both read from applications, which is why
   * nextSteps takes them at all. */
  // Withdrawn counts as decided: the candidate already answered this role, and
  // re-suggesting it would be the rail arguing with them.
  const applied = new Set(input.applications.map((application) => application.jobId));
  const untracked = input.matches.filter((match) => !applied.has(match.job.id)).length;
  if (untracked > 0) {
    steps.push({
      id: "track-roles",
      title: `Track ${untracked} explained role${untracked === 1 ? "" : "s"}`,
      detail: "Tracking a role starts the application record. It sends nothing to the employer.",
      section: "jobs",
      tone: "idle",
    });
  }

  const packeted = new Set(input.packets.map((packet) => packet.applicationId));
  const unprepared = input.applications.filter(
    (application) =>
      (application.status === "tracked" || application.status === "prepared") &&
      !packeted.has(application.id),
  ).length;
  if (unprepared > 0) {
    steps.push({
      id: "prepare-packets",
      title: `Prepare ${unprepared} packet${unprepared === 1 ? "" : "s"}`,
      detail:
        "Packets are assembled from confirmed evidence and your locked authorization wording.",
      section: "packets",
      tone: "idle",
    });
  }

  const draftPackets = input.packets.filter((packet) => packet.status === "draft").length;
  if (draftPackets > 0) {
    steps.push({
      id: "assure-packets",
      title: `Run assurance on ${draftPackets} packet${draftPackets === 1 ? "" : "s"}`,
      detail: "Assurance must pass before a packet can be approved.",
      section: "packets",
      tone: "idle",
    });
  }

  const awaiting = input.externalActions.filter(
    (action) => action.state === "pending_approval",
  ).length;
  if (awaiting > 0) {
    steps.push({
      id: "approve-actions",
      title: `Approve ${awaiting} action${awaiting === 1 ? "" : "s"}`,
      detail: "You approve the exact recipient and payload. Nothing sends on its own.",
      section: "actions",
      tone: "live",
    });
  }

  return steps;
}

/* ── F6 · follow-up observation ──────────────────────────────────────────── */

export const FOLLOW_UP_DAYS = 14;

/** Baseline is the newest thing the candidate actually recorded. `updated_at` is
 *  bumped by a status write but NOT by addOutcome, so it is not an activity
 *  timestamp and is deliberately not used here. */
export function lastRecordedAt(application: ApplicationLike): string | null {
  const stamps = [
    application.createdAt,
    ...(application.outcomes ?? []).map((outcome) => outcome.occurredAt),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (stamps.length === 0) return null;
  return stamps.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
}

export function daysSinceLastRecord(application: ApplicationLike, now: Date): number | null {
  const at = lastRecordedAt(application);
  if (!at) return null;
  const parsed = Date.parse(at);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((now.getTime() - parsed) / 86_400_000);
}

/* Deliberately an observation about the candidate's own record-keeping, never a
 * status. The product promises "Nimanto never infers an outcome from silence" —
 * so this may not say stale, cold, ignored, or likely-rejected. Terminal states
 * are exempt: nothing is pending on a withdrawn application. */
export function followUpNote(application: ApplicationLike, now: Date): string | null {
  if (application.status === "withdrawn") return null;
  const days = daysSinceLastRecord(application, now);
  if (days === null || days < FOLLOW_UP_DAYS) return null;
  const at = lastRecordedAt(application)!;
  const on = new Date(Date.parse(at)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `Nothing recorded since ${on}`;
}

/* ── F1 · pipeline board ─────────────────────────────────────────────────── */

export const BOARD_COLUMNS: readonly { id: ApplicationStatus; label: string }[] = [
  { id: "tracked", label: "Tracked" },
  { id: "prepared", label: "Prepared" },
  { id: "approved_for_export", label: "Approved for export" },
  { id: "submitted_externally", label: "Submitted" },
  { id: "withdrawn", label: "Withdrawn" },
];

export function boardColumns<T extends ApplicationLike>(
  applications: T[],
): { id: ApplicationStatus; label: string; items: T[] }[] {
  return BOARD_COLUMNS.map((column) => ({
    ...column,
    items: applications.filter((application) => application.status === column.id),
  }));
}

/* Mirrors packages/domain/src/applications.ts. Duplicated rather than imported
 * because apps/web is a static export with no server bundle — the server-side
 * guard in the API is the enforcement point, and this copy only decides which
 * drop targets to offer. The test asserts the two stay in step. */
const legalMoves: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  tracked: ["prepared", "withdrawn"],
  prepared: ["tracked", "approved_for_export", "withdrawn"],
  approved_for_export: ["prepared", "submitted_externally", "withdrawn"],
  submitted_externally: ["approved_for_export", "withdrawn"],
  withdrawn: ["tracked"],
};

const consequential: readonly ApplicationStatus[] = [
  "approved_for_export",
  "submitted_externally",
  "withdrawn",
];

export function canMove(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return true;
  return (legalMoves[from] ?? []).includes(to);
}

export function needsConfirmation(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return false;
  return consequential.includes(to);
}

/* Every status control offers this list and nothing else. Derived from the same
 * table `canMove` reads, so a control cannot drift into proposing a move the
 * domain forbids — the candidate should never learn about an illegal transition
 * from a rejected request. The status already held is included so a `<select>`
 * can render its own current value. */
export function legalTargets(from: ApplicationStatus): ApplicationStatus[] {
  return BOARD_COLUMNS.map((column) => column.id).filter((to) => canMove(from, to));
}

export function confirmationPrompt(to: ApplicationStatus, application: ApplicationLike): string {
  const role = application.job
    ? `${application.job.title} at ${application.job.company}`
    : "this application";
  if (to === "submitted_externally") {
    return `Record that you submitted ${role} externally? Nimanto does not submit anything for you — this only records that you did.`;
  }
  if (to === "withdrawn") return `Mark ${role} as withdrawn?`;
  return `Mark ${role} as approved for export?`;
}

/* ── Failure copy ────────────────────────────────────────────────────────── */

/* The API returns a specific `code` alongside a deliberately generic message,
 * because one sentence has to serve every validation failure it has. The client
 * holds the code and is the only place that knows which screen the candidate is
 * looking at, so this is where a rejection becomes something to act on. */
const FAILURE_COPY: Record<string, string> = {
  INVALID_APPLICATION_TRANSITION:
    "An application moves Tracked → Prepared → Approved for export → Submitted externally. Move it to the next stage first, or withdraw it.",
  INVALID_CONFIRMATION: "Type the confirmation phrase exactly as shown, including capitals.",
  EVIDENCE_PREVIEW_CHANGED: "The file changed since you previewed it. Review the preview again.",
  PROHIBITED_DOCUMENT_CONTENT:
    "That file looks like an immigration or identity document. Nimanto refuses those — remove it and import career evidence only.",
  UNSUPPORTED_FILE_TYPE:
    "Nimanto reads TXT, Markdown, JSON, DOCX, a text-layer PDF, or an approved LinkedIn archive.",
  FILE_TOO_LARGE: "That file is above the import size limit. Split it or import a smaller export.",
  EXTERNAL_ACTIONS_DISABLED:
    "Turn on the execution runtime switch first. It always starts off after the service restarts.",
};

/** `null` means "say nothing" — the caller already has a better surface for it.
 *  A transport failure is exactly that case: the connection banner names which
 *  half is down and how to restart it, so repeating the browser's own
 *  "Failed to fetch" underneath adds noise and no information. */
export function failureMessage(input: {
  code?: string | null;
  message?: string | null;
  transport?: boolean;
}): string | null {
  if (input.transport) return null;
  const improved = input.code ? FAILURE_COPY[input.code] : undefined;
  return improved || input.message || "Nimanto could not complete that request.";
}

/* ── Section routing ─────────────────────────────────────────────────────── */

export const SECTIONS: readonly Section[] = [
  "overview",
  "evidence",
  "jobs",
  "applications",
  "packets",
  "actions",
  "data",
];

export function sectionHash(section: Section): string {
  return `#${section}`;
}

/* The hash is already load-bearing: `#bootstrap=` and `#invite=` carry a
 * credential that the workbench scrubs out of the address bar on arrival. This
 * reads a section only from a bare, known name — so a credential hash can never
 * be mistaken for a route, and a section can never be written on top of one. No
 * application, role, packet or action id belongs here: the URL is history, and
 * this product's identifiers are employer-shaped. */
export function sectionFromHash(hash: string): Section | null {
  const value = hash.replace(/^#/, "");
  if (!value || value.includes("=")) return null;
  return (SECTIONS as readonly string[]).includes(value) ? (value as Section) : null;
}

/* ── F5 · funnel ─────────────────────────────────────────────────────────── */

/* Counts only. The API ships the caveat "not a hiring probability" and the source
 * ledger states no hiring-probability claim is supportable, so a conversion rate
 * off a sample of one or two would manufacture exactly that claim. */
export function funnelStages(funnel: {
  sampleSize: number;
  replies: number;
  screens: number;
  interviews: number;
  offers: number;
}): { id: string; label: string; count: number }[] {
  return [
    { id: "tracked", label: "Tracked", count: funnel.sampleSize },
    { id: "replies", label: "Replies", count: funnel.replies },
    { id: "screens", label: "Screens", count: funnel.screens },
    { id: "interviews", label: "Interviews", count: funnel.interviews },
    { id: "offers", label: "Offers", count: funnel.offers },
  ];
}
