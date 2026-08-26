import {
  applicationFollowUpPolicy,
  candidateLocalDate,
  type ApplicationStatus,
} from "@nimanto/domain";

type FollowUpApplication = {
  id: string;
  status: ApplicationStatus;
  followUpOn?: string | null;
  job?: { title: string; company: string };
};

function escapeCalendarText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(/\r?\n/gu, "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function utcStamp(value: Date): string {
  return value
    .toISOString()
    .replaceAll(/[-:]/gu, "")
    .replace(/\.\d{3}Z$/u, "Z");
}

function calendarDate(value: string): string {
  return value.replaceAll("-", "");
}

const encoder = new TextEncoder();

/** RFC 5545 content lines are at most 75 UTF-8 octets. A continuation begins
 * with one space, leaving 74 octets for its content. Iterating code points keeps
 * a multi-byte character intact at every fold. */
function foldCalendarLine(line: string): string {
  const chunks: string[] = [];
  let current = "";
  let limit = 75;
  for (const character of line) {
    if (current && encoder.encode(current + character).byteLength > limit) {
      chunks.push(current);
      current = character;
      limit = 74;
    } else {
      current += character;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}

/** Produces a local, explicit calendar file. It schedules only candidate-set
 * follow-up dates and creates no notification or background action in Nimanto. */
export function buildFollowUpCalendar(
  applications: readonly FollowUpApplication[],
  generatedAt = new Date(),
): { content: string; eventCount: number; filename: string } {
  const today = candidateLocalDate(generatedAt);
  const events = applications
    .flatMap((application) => {
      const observation = applicationFollowUpPolicy.observe(application, today);
      if (observation.kind === "none" || observation.kind === "inactive") return [];
      const title = application.job?.title ?? "application";
      const company = application.job?.company ?? "company";
      return [
        [
          "BEGIN:VEVENT",
          `UID:${escapeCalendarText(`${application.id}@nimanto.local`)}`,
          `DTSTAMP:${utcStamp(generatedAt)}`,
          `DTSTART;VALUE=DATE:${calendarDate(observation.date)}`,
          `SUMMARY:${escapeCalendarText(`Review ${title} at ${company}`)}`,
          "DESCRIPTION:Candidate-set follow-up reminder exported from Nimanto. No outcome is inferred.",
          "TRANSP:TRANSPARENT",
          "END:VEVENT",
        ],
      ];
    })
    .toSorted((left, right) => left.join("\n").localeCompare(right.join("\n")));
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nimanto//Candidate Follow-ups//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flat(),
    "END:VCALENDAR",
    "",
  ]
    .map(foldCalendarLine)
    .join("\r\n");
  return {
    content,
    eventCount: events.length,
    filename: `nimanto-follow-ups-${candidateLocalDate(generatedAt)}.ics`,
  };
}
