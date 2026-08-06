/* Pure derived logic for the workbench.
 *
 * Nothing here imports React or the workspace component: the parameter types are
 * structural, so the richer types in workspace.tsx satisfy them and this module
 * stays testable without a DOM. It is also the only place the product's
 * "never infer an outcome from silence" rule is enforced in code rather than in
 * copy — see followUpNote below. */

export type ApplicationStatus =
  | "tracked"
  | "prepared"
  | "approved_for_export"
  | "submitted_externally"
  | "withdrawn";

export type Section =
  | "overview"
  | "evidence"
  | "jobs"
  | "applications"
  | "packets"
  | "actions"
  | "data";

type EvidenceLike = { status: string };
type JobLike = { id: string };
type MatchLike = { job: { id: string }; result: { blockers: unknown[] } };
type OutcomeLike = { occurredAt: string };
type ApplicationLike = {
  id: string;
  status: ApplicationStatus;
  createdAt?: string;
  outcomes?: OutcomeLike[];
  job?: { title: string; company: string };
};
type PacketLike = { status: string };
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
