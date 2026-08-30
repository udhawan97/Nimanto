import { candidateLocalDate, type ApplicationStatus } from "@nimanto/domain";
import type { ApplicationViewState } from "./applications-workbench.js";

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
    statusEvents?: Array<{
      source: "candidate" | "packet" | "migration";
      occurredAt: string;
    }>;
    activities?: Array<{
      state: "planned" | "completed" | "cancelled";
      occurredAt: string | null;
    }>;
  }>;
  jobs: ReadonlyArray<{ id: string; source: string; updatedAt: string }>;
  filters: Record<string, unknown>;
  lastReviewedAt: string | null;
  now?: Date;
}): string[] {
  const view = filtersFromSavedView(input.filters);
  const reviewedAt = input.lastReviewedAt
    ? Date.parse(input.lastReviewedAt)
    : Number.NEGATIVE_INFINITY;
  const now = input.now ?? new Date();
  const today = candidateLocalDate(now);
  const jobs = new Map(input.jobs.map((job) => [job.id, job]));
  const query = (view.query ?? "").trim().toLocaleLowerCase("en-US");
  return input.applications.flatMap((application) => {
    const job = jobs.get(application.jobId);
    if (view.status !== "all" && application.status !== view.status) return [];
    if (view.source !== "all" && job?.source !== view.source) return [];
    if (
      query &&
      !`${application.job?.title ?? ""} ${application.job?.company ?? ""}`
        .toLocaleLowerCase("en-US")
        .includes(query)
    ) {
      return [];
    }
    if (view.followUp === "due" && (!application.followUpOn || application.followUpOn > today)) {
      return [];
    }
    if (view.followUp === "scheduled" && !application.followUpOn) return [];
    if (view.followUp === "none" && application.followUpOn) return [];
    if (view.followUp === "inactive" && application.status !== "withdrawn") return [];
    if (view.reviewOnly) {
      if (application.status === "withdrawn") return [];
      if (application.followUpOn) {
        if (application.followUpOn > today) return [];
      } else {
        const literalRecords = [
          application.createdAt,
          ...(application.outcomes ?? []).map((outcome) => outcome.occurredAt),
          ...(application.statusEvents ?? [])
            .filter((event) => event.source !== "migration")
            .map((event) => event.occurredAt),
          ...(application.activities ?? [])
            .filter((activity) => activity.state === "completed")
            .map((activity) => activity.occurredAt),
        ]
          .filter((value): value is string => Boolean(value))
          .map(Date.parse)
          .filter(Number.isFinite);
        const latest = literalRecords.length ? Math.max(...literalRecords) : null;
        if (latest === null || now.getTime() - latest < 336 * 60 * 60 * 1_000) return [];
      }
    }
    const changedAt = Math.max(
      Date.parse(application.updatedAt ?? application.createdAt ?? ""),
      Date.parse(job?.updatedAt ?? ""),
    );
    return Number.isFinite(changedAt) && changedAt > reviewedAt ? [application.id] : [];
  });
}
