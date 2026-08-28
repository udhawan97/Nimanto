import { Check, CircleAlert, RotateCcw } from "lucide-react";

export type RoleWordingBlocker = {
  code: string;
  sourceText: string;
  sourceLocator?: string;
  observedAt?: string;
};

export type RoleWordingReview = {
  id: string;
  jobId: string;
  matchRunId: string;
  blockerCode: string;
  evidenceHash: string;
  sourceText: string;
  sourceLocator: string | null;
  observedAt: string | null;
  reviewedAt: string;
};

export type RoleH1bSignal = {
  id: string;
  label: string;
  originalLabel: string;
  sourceType: string;
  sourceLocator: string;
  sourcePeriod: string;
  observedAt: string;
  confidence: string;
  freshness: "current" | "stale";
  limitations: string;
};

type RoleMatchSnapshot = {
  id: string;
  jobContentHash: string;
  result: { ruleVersion: string; blockers: RoleWordingBlocker[] };
};

const REVIEWABLE_CODES = new Set(["no_sponsorship_of_any_kind", "citizenship_required"]);
const GOVERNMENT_SOURCE_TYPES = new Set(["dol_oflc_bulk", "uscis_h1b_employer_data"]);

function human(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/u, (letter) => letter.toUpperCase());
}

function dateTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

export function H1bEvidencePanel({
  jobTitle,
  jobContentHash,
  match,
  signals,
  reviews,
  busy,
  onSetReviewed,
}: {
  jobTitle: string;
  jobContentHash: string;
  match: RoleMatchSnapshot | null;
  signals: RoleH1bSignal[];
  reviews: RoleWordingReview[];
  busy: boolean;
  onSetReviewed: (input: { matchRunId: string; blockerCode: string; reviewed: boolean }) => void;
}) {
  const currentWording =
    match?.result.blockers.filter((blocker) => REVIEWABLE_CODES.has(blocker.code)) ?? [];
  const currentEmployerPolicy = signals.filter(
    (signal) => signal.originalLabel === "current_company_policy_support",
  );
  const historicalGovernment = signals.filter((signal) =>
    GOVERNMENT_SOURCE_TYPES.has(signal.sourceType),
  );
  const staleMatch = Boolean(match && match.jobContentHash !== jobContentHash);

  return (
    <details className="h1b-evidence">
      <summary>
        <span>Review H-1B evidence</span>
        <small>Role wording · employer policy · historical records</small>
      </summary>
      <div className="h1b-evidence-ledger">
        <section
          className="h1b-evidence-layer"
          aria-labelledby={`role-wording-${match?.id ?? "none"}`}
        >
          <div className="h1b-evidence-layer-label">
            <span>Nearest to this role</span>
            <h3 id={`role-wording-${match?.id ?? "none"}`}>Current role wording</h3>
          </div>
          <div className="h1b-evidence-layer-body">
            {!match && (
              <p>
                Explain fit to inspect this posting with the deterministic wording rule. Until then,
                current sponsorship wording is unknown.
              </p>
            )}
            {match && staleMatch && (
              <p className="h1b-evidence-warning" role="status">
                <CircleAlert size={15} /> The role changed after this explanation. Explain fit again
                before reviewing its wording.
              </p>
            )}
            {match && !staleMatch && currentWording.length === 0 && (
              <p>
                No reviewable restriction was found by {match.result.ruleVersion}. Absence is
                unknown, not evidence of sponsorship or transfer support.
              </p>
            )}
            {match &&
              !staleMatch &&
              currentWording.map((blocker) => {
                const review = reviews.find(
                  (candidate) =>
                    candidate.matchRunId === match.id && candidate.blockerCode === blocker.code,
                );
                return (
                  <article className="role-wording-evidence" key={blocker.code}>
                    <div className="role-wording-evidence-heading">
                      <span className="state warning">Explicit posting restriction</span>
                      {review && <span className="state supported">Candidate reviewed</span>}
                    </div>
                    <blockquote>“{blocker.sourceText}”</blockquote>
                    <dl>
                      <div>
                        <dt>Locator</dt>
                        <dd>{blocker.sourceLocator ?? "Posting description"}</dd>
                      </div>
                      <div>
                        <dt>Observed</dt>
                        <dd>
                          {blocker.observedAt ? dateTime(blocker.observedAt) : "Not recorded"}
                        </dd>
                      </div>
                      <div>
                        <dt>Snapshot</dt>
                        <dd title={match.jobContentHash}>{match.jobContentHash.slice(0, 12)}</dd>
                      </div>
                    </dl>
                    <p className="h1b-review-boundary">
                      {review
                        ? `You acknowledged this exact quote ${dateTime(review.reviewedAt)}.`
                        : "Acknowledgement records that you reviewed this exact quote."}{" "}
                      It does not determine eligibility, change fit, or hide {jobTitle}.
                    </p>
                    <button
                      className="button mini quiet"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onSetReviewed({
                          matchRunId: match.id,
                          blockerCode: blocker.code,
                          reviewed: !review,
                        })
                      }
                    >
                      {review ? <RotateCcw size={14} /> : <Check size={14} />}
                      {review ? "Clear acknowledgement" : "Acknowledge exact quote"}
                    </button>
                  </article>
                );
              })}
          </div>
        </section>

        <section className="h1b-evidence-layer">
          <div className="h1b-evidence-layer-label">
            <span>Employer-authored</span>
            <h3>Current employer policy</h3>
          </div>
          <div className="h1b-evidence-layer-body">
            {currentEmployerPolicy.length === 0 ? (
              <p>No current employer-authored policy is stored for this company.</p>
            ) : (
              currentEmployerPolicy.map((signal) => (
                <article className="h1b-signal-evidence" key={signal.id}>
                  <strong>{human(signal.label)}</strong>
                  <span>
                    {signal.sourcePeriod} · observed {dateTime(signal.observedAt)} ·{" "}
                    {signal.freshness}
                  </span>
                  <small>
                    {signal.sourceType} · {signal.sourceLocator}
                  </small>
                  <p>{signal.limitations}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="h1b-evidence-layer">
          <div className="h1b-evidence-layer-label">
            <span>Farthest from this role</span>
            <h3>Historical government evidence</h3>
          </div>
          <div className="h1b-evidence-layer-body">
            {historicalGovernment.length === 0 ? (
              <p>No historical government evidence is stored for this company.</p>
            ) : (
              historicalGovernment.map((signal) => (
                <article className="h1b-signal-evidence" key={signal.id}>
                  <strong>{human(signal.label)}</strong>
                  <span>
                    {signal.sourcePeriod} · observed {dateTime(signal.observedAt)} ·{" "}
                    {signal.freshness}
                  </span>
                  <small>
                    {signal.sourceType} · {signal.sourceLocator}
                  </small>
                  <p>{signal.limitations}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      <p className="boundary-note h1b-evidence-boundary">
        Historical records never prove current-role support, absence is never negative evidence, and
        no H-1B evidence changes fit rank. Nimanto organizes sourced context; it does not give legal
        advice.
      </p>
    </details>
  );
}
