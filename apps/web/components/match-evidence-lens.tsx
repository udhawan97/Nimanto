import { projectMatchEvidenceLens, type MatchEvidenceResult } from "../lib/match-evidence-lens.js";

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

export function MatchEvidenceLens({
  result,
  compact = false,
}: {
  result: MatchEvidenceResult;
  compact?: boolean;
}) {
  const lens = projectMatchEvidenceLens(result);
  return (
    <section
      className={`match-evidence-lens${compact ? " is-compact" : ""}`}
      aria-label="Match evidence lens"
    >
      <header>
        <div>
          <span>Evidence lens</span>
          <strong>How this explanation is grounded</strong>
        </div>
        <span className="state muted">No probability</span>
      </header>
      <div className="match-evidence-grid">
        <article>
          <span>Fit coverage</span>
          <strong>{label(result.coverage)}</strong>
          <small>
            {lens.supportedRequirementCount}/{lens.requirementCount} known requirements supported ·
            0.60 floor
          </small>
        </article>
        <article>
          <span>Evidence source mix</span>
          <strong>{label(lens.strength)}</strong>
          <small>{lens.sourceLinkageSummary}</small>
        </article>
        <article>
          <span>Stored calculation</span>
          <strong>{result.ruleVersion}</strong>
          <small>{lens.strengthRuleVersion ?? "Historical basis not stored"}</small>
        </article>
      </div>
      <p>{lens.calculationLimit} It is not a hiring or immigration prediction.</p>
    </section>
  );
}
