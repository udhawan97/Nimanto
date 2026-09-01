import type { ApplicationStatus } from "@nimanto/domain";
import type { ApplicationViewState } from "./applications-workbench.js";
import {
  filterApplications,
  recordReviewQueue,
  sortApplications,
  type ApplicationLike,
} from "./derive.js";

export function filtersFromSavedView(
  filters: Record<string, unknown>,
): Partial<ApplicationViewState> {
  const status =
    typeof filters.status === "string" &&
    [
      "all",
      "tracked",
      "prepared",
      "approved_for_export",
      "submitted_externally",
      "withdrawn",
    ].includes(filters.status)
      ? (filters.status as ApplicationViewState["status"])
      : "all";
  const followUp =
    typeof filters.followUp === "string" &&
    ["all", "due", "scheduled", "none", "inactive"].includes(filters.followUp)
      ? (filters.followUp as ApplicationViewState["followUp"])
      : "all";
  const sort =
    typeof filters.sort === "string" &&
    ["stored", "newest", "follow_up", "role"].includes(filters.sort)
      ? (filters.sort as ApplicationViewState["sort"])
      : "stored";
  return {
    reviewOnly: filters.reviewOnly === true,
    query: typeof filters.query === "string" ? filters.query : "",
    status,
    source: typeof filters.source === "string" ? filters.source : "all",
    followUp,
    sort,
  };
}

export function careerLedgerInsightCounts(input: {
  activities: ReadonlyArray<{ state: "planned" | "completed" | "cancelled" }>;
  interviews: ReadonlyArray<{ state: "scheduled" | "completed" | "cancelled" }>;
}): {
  plannedActivities: number;
  completedActivities: number;
  nonCancelledInterviews: number;
  completedInterviews: number;
} {
  return {
    plannedActivities: input.activities.filter((activity) => activity.state === "planned").length,
    completedActivities: input.activities.filter((activity) => activity.state === "completed")
      .length,
    nonCancelledInterviews: input.interviews.filter((interview) => interview.state !== "cancelled")
      .length,
    completedInterviews: input.interviews.filter((interview) => interview.state === "completed")
      .length,
  };
}

type ApplicationViewProjection = Pick<
  ApplicationViewState,
  "reviewOnly" | "query" | "status" | "source" | "followUp" | "sort"
>;

/** The live Applications surface and saved review views share this exact
 * membership projection. A saved view therefore cannot count a record that
 * opening the same literal filters would hide, or hide one the live view shows. */
export function projectApplicationView<T extends ApplicationLike>(input: {
  applications: readonly T[];
  jobs: ReadonlyArray<{ id: string; source: string }>;
  view: ApplicationViewProjection;
  now?: Date;
}): { applications: T[]; scopeCount: number } {
  const now = input.now ?? new Date();
  const scope = input.view.reviewOnly
    ? recordReviewQueue(input.applications, now).map((item) => item.application)
    : [...input.applications];
  return {
    applications: sortApplications(
      filterApplications(scope, input.jobs, input.view, now),
      input.view.sort,
    ),
    scopeCount: scope.length,
  };
}

/** A change inbox is a timestamp comparison over a candidate-named view. It
 * does not mutate the review watermark or infer what happened at an employer. */
export function changedApplicationsForView(input: {
  applications: ReadonlyArray<{
    id: string;
    jobId: string;
    status: ApplicationStatus;
    updatedAt?: string;
    createdAt?: string;
    followUpOn?: string | null;
    job?: { title: string; company: string };
    outcomes?: Array<{ occurredAt: string }>;
    notes?: Array<{ text: string; recordedAt: string }>;
    statusEvents?: Array<{
      id: string;
      fromStatus: ApplicationStatus | null;
      toStatus: ApplicationStatus;
      source: "candidate" | "packet" | "migration";
      occurredAt: string;
    }>;
    activities?: Array<{
      id: string;
      kind: string;
      state: "planned" | "completed" | "cancelled";
      title: string;
      note: string;
      occurredAt: string | null;
    }>;
    submissions?: Array<{ submittedAt: string; createdAt?: string }>;
  }>;
  jobs: ReadonlyArray<{ id: string; source: string; updatedAt: string }>;
  careerOperations?: {
    activities: ReadonlyArray<{
      applicationId: string;
      occurredAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    contacts: ReadonlyArray<{
      applicationLinks: ReadonlyArray<{ applicationId: string }>;
      createdAt: string;
      updatedAt: string;
    }>;
    interviews: ReadonlyArray<{
      applicationId: string;
      createdAt: string;
      updatedAt: string;
    }>;
    offers: ReadonlyArray<{
      applicationId: string;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  filters: Record<string, unknown>;
  lastReviewedAt: string | null;
  now?: Date;
}): string[] {
  const view: ApplicationViewProjection = {
    reviewOnly: false,
    query: "",
    status: "all",
    source: "all",
    followUp: "all",
    sort: "stored",
    ...filtersFromSavedView(input.filters),
  };
  const reviewedAt = input.lastReviewedAt
    ? Date.parse(input.lastReviewedAt)
    : Number.NEGATIVE_INFINITY;
  const now = input.now ?? new Date();
  const jobs = new Map(input.jobs.map((job) => [job.id, job]));
  return projectApplicationView<(typeof input.applications)[number]>({
    applications: input.applications,
    jobs: input.jobs,
    view,
    now,
  }).applications.flatMap((application) => {
    const job = jobs.get(application.jobId);
    const operations = input.careerOperations;
    const candidateVisibleStamps = [
      application.updatedAt,
      application.createdAt,
      job?.updatedAt,
      ...(application.outcomes ?? []).map((outcome) => outcome.occurredAt),
      ...(application.notes ?? []).map((note) => note.recordedAt),
      ...(application.statusEvents ?? []).map((event) => event.occurredAt),
      ...(application.activities ?? []).map((activity) => activity.occurredAt),
      ...(application.submissions ?? []).flatMap((submission) => [
        submission.createdAt,
        submission.submittedAt,
      ]),
      ...(operations?.activities ?? [])
        .filter((activity) => activity.applicationId === application.id)
        .flatMap((activity) => [activity.createdAt, activity.updatedAt, activity.occurredAt]),
      ...(operations?.contacts ?? [])
        .filter((contact) =>
          contact.applicationLinks.some((link) => link.applicationId === application.id),
        )
        .flatMap((contact) => [contact.createdAt, contact.updatedAt]),
      ...(operations?.interviews ?? [])
        .filter((interview) => interview.applicationId === application.id)
        .flatMap((interview) => [interview.createdAt, interview.updatedAt]),
      ...(operations?.offers ?? [])
        .filter((offer) => offer.applicationId === application.id)
        .flatMap((offer) => [offer.createdAt, offer.updatedAt]),
    ]
      .filter((value): value is string => typeof value === "string")
      .map(Date.parse)
      .filter(Number.isFinite);
    const changedAt = candidateVisibleStamps.length
      ? Math.max(...candidateVisibleStamps)
      : Number.NEGATIVE_INFINITY;
    return Number.isFinite(changedAt) && changedAt > reviewedAt ? [application.id] : [];
  });
}
