import { describe, expect, it } from "vitest";
import { normalizeCandidateSubmission } from "../src/submissions.js";

const now = new Date("2026-08-30T12:00:00.000Z");

describe("candidate submission policy", () => {
  it("normalizes one materials-captured record without changing format order", () => {
    expect(
      normalizeCandidateSubmission(
        {
          materialsCaptured: true,
          packetId: " packet-1 ",
          artifactFormats: ["ats_docx", "modern_pdf"],
          channel: "employer_portal",
          destination: "  careers.example.test/apply  ",
          submittedAt: "2026-08-30T11:45:00-00:00",
        },
        now,
      ),
    ).toEqual({
      materialsCaptured: true,
      packetId: "packet-1",
      artifactFormats: ["ats_docx", "modern_pdf"],
      channel: "employer_portal",
      destination: "careers.example.test/apply",
      submittedAt: "2026-08-30T11:45:00.000Z",
    });
  });

  it("supports an explicit materials-not-captured record", () => {
    expect(
      normalizeCandidateSubmission(
        {
          materialsCaptured: false,
          packetId: null,
          artifactFormats: [],
          channel: "referral",
          destination: "Candidate-known referral",
          submittedAt: "2026-08-29T10:00:00.000Z",
        },
        now,
      ).materialsCaptured,
    ).toBe(false);
  });

  it("fails closed for missing, conflicting, duplicate, or future material facts", () => {
    const valid = {
      materialsCaptured: true,
      packetId: "packet-1",
      artifactFormats: ["ats_pdf" as const],
      channel: "email" as const,
      destination: "Recruiter email",
      submittedAt: "2026-08-30T11:00:00.000Z",
    };
    expect(() => normalizeCandidateSubmission({ ...valid, packetId: null }, now)).toThrow(
      "SUBMISSION_PACKET_REQUIRED",
    );
    expect(() =>
      normalizeCandidateSubmission(
        { ...valid, materialsCaptured: false, artifactFormats: [] },
        now,
      ),
    ).toThrow("SUBMISSION_MATERIALS_CONFLICT");
    expect(() =>
      normalizeCandidateSubmission({ ...valid, artifactFormats: ["ats_pdf", "ats_pdf"] }, now),
    ).toThrow("INVALID_SUBMISSION_FORMATS");
    expect(() =>
      normalizeCandidateSubmission({ ...valid, submittedAt: "2026-08-30T12:06:00.000Z" }, now),
    ).toThrow("INVALID_SUBMISSION_TIME");
  });
});
