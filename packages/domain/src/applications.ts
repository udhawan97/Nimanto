import type { ApplicationStatus } from "./types.js";

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "tracked",
  "prepared",
  "approved_for_export",
  "submitted_externally",
  "withdrawn",
];

/* An application board is a tracking surface, not an approval surface. Before
 * this guard existed the API validated union membership only, so any status
 * could be written from any other — and the store stamps submitted_at on entry
 * to submitted_externally without ever clearing it. One mis-drop therefore wrote
 * a permanent, false submission record into a product whose entire thesis is
 * provenance.
 *
 * Whitelist, not blacklist: a status pair absent from this table is illegal. */
const legal: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  tracked: ["prepared", "withdrawn"],
  prepared: ["tracked", "approved_for_export", "withdrawn"],
  approved_for_export: ["prepared", "submitted_externally", "withdrawn"],
  // Correcting a mistaken submission is allowed; it clears the timestamp below.
  submitted_externally: ["approved_for_export", "withdrawn"],
  withdrawn: ["tracked"],
};

/* Statuses that record an external or hard-to-reverse fact about the candidate.
 * Gated on the TARGET rather than the edge, so a future edge added to `legal`
 * inherits the gate instead of quietly bypassing it. */
const consequential: readonly ApplicationStatus[] = [
  "approved_for_export",
  "submitted_externally",
  "withdrawn",
];

function known(status: ApplicationStatus): boolean {
  return APPLICATION_STATUSES.includes(status);
}

export function isApplicationTransitionLegal(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  if (!known(from) || !known(to)) return false;
  if (from === to) return true;
  return legal[from].includes(to);
}

/** True when a board must ask before committing. Never true for a no-op. */
export function applicationTransitionNeedsConfirmation(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  if (from === to) return false;
  return consequential.includes(to);
}

export function transitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus,
): { status: ApplicationStatus; clearSubmittedAt: boolean } {
  if (!known(from) || !known(to)) {
    throw new Error(`Unknown application status: ${from} -> ${to}.`);
  }
  if (!isApplicationTransitionLegal(from, to)) {
    throw new Error(`Invalid application transition: ${from} -> ${to}.`);
  }
  return {
    status: to,
    clearSubmittedAt: from === "submitted_externally" && to !== "submitted_externally",
  };
}
