import type { ApplicationStatus, OutcomeType } from "./types.js";

export const ACTIVITY_KINDS = [
  "research",
  "follow_up",
  "networking",
  "interview",
  "thank_you",
  "custom",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_STATES = ["planned", "completed", "cancelled"] as const;
export type ActivityState = (typeof ACTIVITY_STATES)[number];

export const CONTACT_KINDS = [
  "recruiter",
  "hiring_manager",
  "interviewer",
  "referral",
  "colleague",
  "other",
] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const INTERVIEW_ROUND_KINDS = [
  "recruiter_screen",
  "hiring_manager",
  "technical",
  "case_study",
  "panel",
  "onsite",
  "final",
  "other",
] as const;
export type InterviewRoundKind = (typeof INTERVIEW_ROUND_KINDS)[number];

export const INTERVIEW_ROUND_STATES = ["scheduled", "completed", "cancelled"] as const;
export type InterviewRoundState = (typeof INTERVIEW_ROUND_STATES)[number];

export const ANSWER_TOPICS = [
  "why_company",
  "why_role",
  "tell_me_about_yourself",
  "accomplishment",
  "challenge",
  "leadership",
  "technical",
  "custom",
] as const;
export type AnswerTopic = (typeof ANSWER_TOPICS)[number];

export const OFFER_STATES = ["reviewing", "accepted", "declined", "withdrawn"] as const;
export type OfferState = (typeof OFFER_STATES)[number];

export type ApplicationStatusEvent = {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  source: "candidate" | "packet" | "migration";
  occurredAt: string;
};

export type DescriptiveApplication = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  submittedAt?: string | null;
  outcomes?: Array<{ type: OutcomeType; occurredAt: string }>;
  statusEvents?: ApplicationStatusEvent[];
};

export type DurationObservation = {
  id:
    | "tracked_to_prepared"
    | "prepared_to_approved"
    | "approved_to_submitted"
    | "submitted_to_outcome";
  label: string;
  medianDays: number | null;
  sampleSize: number;
};

function firstTimestamp(
  application: DescriptiveApplication,
  status: ApplicationStatus,
): number | null {
  const timestamps = (application.statusEvents ?? [])
    .filter((event) => event.source !== "migration" && event.toStatus === status)
    .map((event) => Date.parse(event.occurredAt))
    .filter(Number.isFinite);
  if (status === "submitted_externally" && application.submittedAt) {
    const submittedAt = Date.parse(application.submittedAt);
    if (Number.isFinite(submittedAt)) timestamps.push(submittedAt);
  }
  timestamps.sort((left, right) => left - right);
  return timestamps[0] ?? null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
  return Math.round((value / 86_400_000) * 10) / 10;
}

/** Candidate-history description only. It reports elapsed time and sample size;
 * it never produces a rate, benchmark, causal explanation, or hiring forecast. */
export function describeApplicationDurations(
  applications: readonly DescriptiveApplication[],
): DurationObservation[] {
  const between = (from: ApplicationStatus, to: ApplicationStatus): number[] =>
    applications.flatMap((application) => {
      const start = firstTimestamp(application, from);
      const end = firstTimestamp(application, to);
      return start !== null && end !== null && end >= start ? [end - start] : [];
    });
  const responseTimes = applications.flatMap((application) => {
    const submitted = firstTimestamp(application, "submitted_externally");
    if (submitted === null) return [];
    const firstOutcome = (application.outcomes ?? [])
      .map((outcome) => Date.parse(outcome.occurredAt))
      .filter((value) => Number.isFinite(value) && value >= submitted)
      .toSorted((left, right) => left - right)[0];
    return firstOutcome === undefined ? [] : [firstOutcome - submitted];
  });
  const observations: Array<[DurationObservation["id"], string, number[]]> = [
    ["tracked_to_prepared", "Tracked to prepared", between("tracked", "prepared")],
    [
      "prepared_to_approved",
      "Prepared to approved for export",
      between("prepared", "approved_for_export"),
    ],
    [
      "approved_to_submitted",
      "Approved to submitted externally",
      between("approved_for_export", "submitted_externally"),
    ],
    ["submitted_to_outcome", "Submitted to first recorded outcome", responseTimes],
  ];
  return observations.map(([id, label, values]) => ({
    id,
    label,
    medianDays: median(values),
    sampleSize: values.length,
  }));
}
