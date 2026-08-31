import { describe, expect, it } from "vitest";
import { matchJob, normalizedCandidateProjection } from "../src/matching.js";
import type { EvidenceClaim } from "../src/types.js";

const confirmedEvidence: EvidenceClaim[] = [
  {
    id: "ev-python",
    kind: "skill",
    value: "Python and TypeScript",
    status: "confirmed" as const,
    confidence: "high" as const,
    sourceName: "Synthetic resume",
    locator: "Skills, line 1",
  },
  {
    id: "ev-ml",
    kind: "accomplishment",
    value: "Built production machine learning pipelines on AWS",
    status: "confirmed" as const,
    confidence: "high" as const,
    sourceName: "Synthetic resume",
    locator: "Experience, line 3",
  },
  {
    id: "ev-level",
    kind: "employment",
    value: "Senior software engineer leading API reliability work",
    status: "confirmed" as const,
    confidence: "medium" as const,
    sourceName: "Synthetic resume",
    locator: "Experience, line 1",
  },
];

describe("evidence-to-match public seam", () => {
  it("publishes an ordinal band with source-linked requirement explanations", () => {
    const result = matchJob({
      evidence: confirmedEvidence,
      job: {
        id: "job-1",
        title: "Senior AI Platform Engineer",
        company: "Northwind Labs",
        description: "Build reliable machine learning APIs on AWS.",
        requirements: ["Python", "machine learning pipelines", "AWS", "API reliability"],
      },
    });

    expect(result.band).toBe("strong_evidence");
    expect(result.coverage).toBe("coverage_sufficient");
    expect(result.requirements.every((item) => item.state === "supported")).toBe(true);
    expect(result.requirements.flatMap((item) => item.evidenceIds)).toContain("ev-python");
    expect("internalValue" in result).toBe(false);
  });

  it("does not score when the posting has too little known requirement evidence", () => {
    const result = matchJob({
      evidence: confirmedEvidence,
      job: {
        id: "job-2",
        title: "Engineer",
        company: "Northwind Labs",
        description: "Details shared later.",
        requirements: [],
      },
    });

    expect(result.band).toBe("not_scored");
    expect(result.coverage).toBe("coverage_low");
  });

  it.each([
    {
      label: "below the reviewed floor",
      evidenceValue: "Python",
      requirements: ["Python", "Kubernetes", "Rust"],
      expectedSupported: 1,
      expectedBand: "not_scored",
      expectedCoverage: "coverage_low",
    },
    {
      label: "at the reviewed floor",
      evidenceValue: "Python TypeScript Kubernetes",
      requirements: ["Python", "TypeScript", "Kubernetes", "Rust", "Go"],
      expectedSupported: 3,
      expectedBand: "weak_evidence",
      expectedCoverage: "coverage_sufficient",
    },
    {
      label: "above the reviewed floor",
      evidenceValue: "Python TypeScript",
      requirements: ["Python", "TypeScript", "Kubernetes"],
      expectedSupported: 2,
      expectedBand: "weak_evidence",
      expectedCoverage: "coverage_sufficient",
    },
  ])(
    "uses supported known requirements for coverage $label",
    ({ evidenceValue, requirements, expectedSupported, expectedBand, expectedCoverage }) => {
      const result = matchJob({
        evidence: [
          {
            ...confirmedEvidence[0]!,
            value: evidenceValue,
          },
        ],
        job: {
          id: "job-coverage",
          title: "Engineer",
          company: "Northwind Labs",
          description: "Build reliable systems.",
          requirements,
        },
      });

      expect(result.requirements.filter((item) => item.state === "supported")).toHaveLength(
        expectedSupported,
      );
      expect(result.band).toBe(expectedBand);
      expect(result.coverage).toBe(expectedCoverage);
    },
  );

  it("detects explicit no-sponsorship blockers without converting them into a probability", () => {
    const result = matchJob({
      evidence: confirmedEvidence,
      job: {
        id: "job-3",
        title: "Platform Engineer",
        company: "Northwind Labs",
        description: "We cannot sponsor or transfer employment visas for this role.",
        descriptionLocator: "https://jobs.example.test/job-3",
        observedAt: "2026-08-26T12:00:00.000Z",
        requirements: ["Python"],
      },
    });

    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "no_sponsorship_of_any_kind",
          consequence: "visible_warning",
          candidateConfirmed: false,
          sourceLocator: "https://jobs.example.test/job-3",
          observedAt: "2026-08-26T12:00:00.000Z",
        }),
      ]),
    );
  });

  it("keeps an explicit candidate location preference outside the weighted band", () => {
    const result = matchJob({
      evidence: [
        ...confirmedEvidence,
        {
          ...confirmedEvidence[0]!,
          id: "ev-location",
          kind: "preference",
          value: "Work mode: remote-only",
        },
      ],
      job: {
        id: "job-location",
        title: "Platform Engineer",
        company: "Northwind Labs",
        description: "Build Python services from our office.",
        requirements: ["Python"],
        location: "New York",
        workMode: "onsite",
      },
    });

    expect(result.blockers).toContainEqual(
      expect.objectContaining({ code: "location_conflict", consequence: "visible_warning" }),
    );
  });

  it("removes identity-only cues from the normalized scoring projection", () => {
    const first = normalizedCandidateProjection({
      ...confirmedEvidence[0]!,
      value: "Priya Shah — Python and TypeScript — graduated 2012",
    });
    const second = normalizedCandidateProjection({
      ...confirmedEvidence[0]!,
      value: "Miguel Rivera — Python and TypeScript — graduated 2020",
    });

    expect(first).toBe(second);

    const score = (value: string) =>
      matchJob({
        evidence: [{ ...confirmedEvidence[0]!, value }],
        job: {
          id: "job-projection",
          title: "Platform Engineer",
          company: "Northwind Labs",
          description: "Build Python and TypeScript platform services.",
          requirements: ["Python", "TypeScript"],
        },
      });
    const priya = score("Priya Shah — She built Python and TypeScript services in 2012");
    const miguel = score("Miguel Rivera — He built Python and TypeScript services in 2020");

    expect(priya).toEqual(miguel);
  });
});

describe("evidence strength distinguishes attestation from source", () => {
  /* The contract defines Evidence Strength as the share of requirements
   * supported by source-linked evidence "rather than only user_attested
   * evidence". Before this, the denominator and numerator were the same set —
   * every supported requirement has evidence ids by construction — so the
   * measure could only ever return source_strong, and source_mixed was
   * unreachable. */
  const claim = (over: Partial<EvidenceClaim>): EvidenceClaim => ({
    id: "ev",
    kind: "skill",
    value: "TypeScript",
    status: "confirmed",
    confidence: "high",
    sourceName: "Synthetic resume",
    locator: "Skills, line 1",
    ...over,
  });
  const job = (requirements: string[]) => ({
    id: "job-1",
    title: "Engineer",
    company: "Northwind",
    description: "Engineering role.",
    requirements,
  });

  it("does not call a self-attested claim source-linked", () => {
    const result = matchJob({
      evidence: [claim({ id: "a", value: "TypeScript", userAttested: true })],
      job: job(["TypeScript"]),
    });
    expect(result.requirements[0]?.state).toBe("supported");
    expect(result.evidenceStrength).toBe("source_limited");
    expect(result.evidenceStrengthBasis).toEqual({
      ruleVersion: "evidence_strength_unweighted_v1",
      calculation: "unweighted_supported_requirements",
      supportedRequirementCount: 1,
      sourceLinkedRequirementCount: 0,
      candidateAttestedOnlyRequirementCount: 1,
      thresholdPerThousand: { sourceStrong: 800, sourceMixed: 500 },
    });
  });

  it("still reports source_strong when the support is sourced", () => {
    const result = matchJob({
      evidence: [claim({ id: "a", value: "TypeScript" })],
      job: job(["TypeScript"]),
    });
    expect(result.evidenceStrength).toBe("source_strong");
  });

  it("can reach the middle band it previously could not", () => {
    const result = matchJob({
      evidence: [
        claim({ id: "a", value: "TypeScript" }),
        claim({ id: "b", value: "Kubernetes", userAttested: true }),
      ],
      job: job(["TypeScript", "Kubernetes"]),
    });
    expect(result.requirements.every((item) => item.state === "supported")).toBe(true);
    expect(result.evidenceStrength).toBe("source_mixed");
    expect(result.evidenceStrengthBasis).toMatchObject({
      supportedRequirementCount: 2,
      sourceLinkedRequirementCount: 1,
      candidateAttestedOnlyRequirementCount: 1,
    });
  });

  it("records an explicit empty basis when no requirements are supported", () => {
    const result = matchJob({ evidence: [], job: job(["TypeScript"]) });

    expect(result.evidenceStrength).toBe("source_limited");
    expect(result.evidenceStrengthBasis).toMatchObject({
      supportedRequirementCount: 0,
      sourceLinkedRequirementCount: 0,
      candidateAttestedOnlyRequirementCount: 0,
    });
  });
});
