import { describe, expect, it } from "vitest";
import { projectMatchEvidenceLens } from "../lib/match-evidence-lens.js";

describe("Match Evidence Lens", () => {
  it("projects the exact stored source-linkage basis without turning it into a score", () => {
    const lens = projectMatchEvidenceLens({
      ruleVersion: "scoring_rules_v1",
      band: "promising_evidence",
      coverage: "coverage_sufficient",
      evidenceStrength: "source_mixed",
      evidenceStrengthBasis: {
        ruleVersion: "evidence_strength_unweighted_v1",
        calculation: "unweighted_supported_requirements",
        supportedRequirementCount: 3,
        sourceLinkedRequirementCount: 2,
        candidateAttestedOnlyRequirementCount: 1,
        thresholdPerThousand: { sourceStrong: 800, sourceMixed: 500 },
      },
      requirements: [
        { state: "supported" },
        { state: "supported" },
        { state: "supported" },
        { state: "missing" },
      ],
    });

    expect(lens).toMatchObject({
      supportedRequirementCount: 3,
      requirementCount: 4,
      sourceLinkedRequirementCount: 2,
      candidateAttestedOnlyRequirementCount: 1,
      strength: "source_mixed",
      strengthRuleVersion: "evidence_strength_unweighted_v1",
    });
    expect(lens.sourceLinkageSummary).toContain("2 of 3 supported requirements");
    expect(lens.calculationLimit).toContain("unweighted");
  });

  it("keeps a historical ordinal visible without inventing its missing basis", () => {
    const lens = projectMatchEvidenceLens({
      ruleVersion: "scoring_rules_v1",
      band: "partial_evidence",
      coverage: "coverage_sufficient",
      evidenceStrength: "source_limited",
      requirements: [{ state: "supported" }, { state: "missing" }],
    });

    expect(lens.sourceLinkedRequirementCount).toBeNull();
    expect(lens.strengthRuleVersion).toBeNull();
    expect(lens.sourceLinkageSummary).toContain("historical Match Publication");
  });

  it("reports an empty source basis literally", () => {
    const lens = projectMatchEvidenceLens({
      ruleVersion: "scoring_rules_v1",
      band: "not_scored",
      coverage: "coverage_low",
      evidenceStrength: "source_limited",
      evidenceStrengthBasis: {
        ruleVersion: "evidence_strength_unweighted_v1",
        calculation: "unweighted_supported_requirements",
        supportedRequirementCount: 0,
        sourceLinkedRequirementCount: 0,
        candidateAttestedOnlyRequirementCount: 0,
        thresholdPerThousand: { sourceStrong: 800, sourceMixed: 500 },
      },
      requirements: [{ state: "missing" }],
    });

    expect(lens.sourceLinkageSummary).toContain("No supported requirements");
  });
});
