import { candidateLocalDate, type ApplicationStatus } from "@nimanto/domain";

type CsvApplication = {
  id: string;
  jobId?: string;
  status: ApplicationStatus;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string | null;
  followUpOn?: string | null;
  job?: { title: string; company: string };
  outcomes?: readonly unknown[];
  notes?: readonly unknown[];
};

type CsvJob = { id: string; source: string };

const HEADERS = [
  "application_id",
  "role_title",
  "company",
  "role_source",
  "status",
  "created_at",
  "updated_at",
  "submitted_at",
  "follow_up_on",
  "outcome_count",
  "private_note_count",
] as const;

/** Quoting alone does not stop spreadsheet software from evaluating a leading
 * formula marker. The apostrophe is the conventional visible-data escape and
 * keeps candidate/source-controlled cells inert when the file is opened. */
function spreadsheetSafe(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | null | undefined): string {
  const safe = spreadsheetSafe(value == null ? "" : String(value));
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Builds a focused, spreadsheet-safe summary of the selected Application
 * records. Private note and outcome bodies are intentionally excluded; the
 * full workspace JSON export remains the complete candidate-owned archive. */
export function buildApplicationCsv(
  applications: readonly CsvApplication[],
  jobs: readonly CsvJob[],
  generatedAt = new Date(),
): { content: string; rowCount: number; filename: string } {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const rows = applications.map((application) => [
    application.id,
    application.job?.title ?? "",
    application.job?.company ?? "",
    application.jobId ? (jobsById.get(application.jobId)?.source ?? "") : "",
    application.status,
    application.createdAt ?? "",
    application.updatedAt ?? "",
    application.submittedAt ?? "",
    application.followUpOn ?? "",
    application.outcomes?.length ?? 0,
    application.notes?.length ?? 0,
  ]);
  const content = `\uFEFF${[HEADERS, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\r\n")}\r\n`;
  return {
    content,
    rowCount: rows.length,
    filename: `nimanto-applications-${candidateLocalDate(generatedAt)}.csv`,
  };
}
