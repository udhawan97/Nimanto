import type { ApplicationStatus } from "./types.js";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/u;

function isLiteralDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_ONLY.exec(value);
  if (!match || match[1] === "0000") return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The browser supplies this calendar boundary. Follow-up policy compares
 * literal candidate-local days and never converts a date-only record through
 * UTC before deciding whether it is due. */
export function candidateLocalDate(now: Date): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type ApplicationFollowUpObservation =
  | { kind: "none" }
  | { kind: "inactive"; date: string }
  | { kind: "scheduled"; date: string }
  | { kind: "due"; date: string };

/** Pure Application follow-up policy. It owns literal-date meaning and
 * active/due semantics only. Persistence still owns tenant locks and
 * timestamps; callers must not attach notification, provider, worker, status,
 * or employer-outcome authority to this record. */
export const applicationFollowUpPolicy = {
  parse(value: unknown): string | null {
    if (value === null) return null;
    if (!isLiteralDate(value)) throw new Error("INVALID_FOLLOW_UP_DATE");
    return value;
  },

  change(status: ApplicationStatus, next: string | null): { kind: "allowed" } {
    if (next !== null && !isLiteralDate(next)) throw new Error("INVALID_FOLLOW_UP_DATE");
    if (next !== null && status === "withdrawn") throw new Error("FOLLOW_UP_UNAVAILABLE");
    return { kind: "allowed" };
  },

  observe(
    input: { status: ApplicationStatus; followUpOn?: string | null },
    candidateToday: string,
  ): ApplicationFollowUpObservation {
    if (!isLiteralDate(input.followUpOn) || !isLiteralDate(candidateToday)) {
      return { kind: "none" };
    }
    if (input.status === "withdrawn") return { kind: "inactive", date: input.followUpOn };
    return input.followUpOn <= candidateToday
      ? { kind: "due", date: input.followUpOn }
      : { kind: "scheduled", date: input.followUpOn };
  },
};
