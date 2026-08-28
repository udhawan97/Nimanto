export type RoleProvenanceData = Readonly<{
  observation: Readonly<{
    id: string;
    sourceRunId: string | null;
    observedAt: string;
    contentHash: string;
    sourcePayloadHash: string;
    normalizerVersion: string;
  }> | null;
  verificationAttempt: Readonly<{
    id: string;
    sourceRunId: string | null;
    attemptedAt: string;
    authority: string;
    method: string;
    result: string;
    responseFingerprint: string | null;
    policyVersion: string | null;
    failureCode: string | null;
  }> | null;
  sourceRun: Readonly<{
    id: string;
    source: string;
    boardId: string | null;
    startedAt: string;
    completedAt: string;
    complete: boolean;
    pagesRead: number;
    sourceItemCount: number;
    responseFingerprint: string;
    retryAfterObserved: boolean;
    sourcePolicyVersion: string;
  }> | null;
  verificationSourceRun: Readonly<{
    id: string;
    source: string;
    boardId: string | null;
    startedAt: string;
    completedAt: string;
    complete: boolean;
    pagesRead: number;
    sourceItemCount: number;
    responseFingerprint: string;
    retryAfterObserved: boolean;
    sourcePolicyVersion: string;
  }> | null;
}>;

export type RoleSourcePolicy = Readonly<{
  label: string;
  accessClass: string;
  termsUrl: string;
  termsReviewedAt: string | null;
  commercialUseDecision: string;
  rawBodyTtlHours: number;
  normalizedRetentionDays: number;
  deletionUpdateSlaHours: number;
  attribution: Readonly<{ label: string; linkRequired: boolean }> | null;
  limitation: string;
}>;

type RoleAvailability = Readonly<{
  lastSeenAt: string;
  lastVerifiedAt: string | null;
  sourcePostedAt: string | null;
  sourceUpdatedAt: string | null;
  verificationHealth: string;
  verificationAuthority: string;
  verificationMethod: string;
}>;

function human(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase())
    .replace(/\bAts\b/gu, "ATS")
    .replace(/\bApi\b/gu, "API")
    .replace(/\bHttps\b/gu, "HTTPS");
}

function localDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function reviewedDate(value: string | null): string {
  if (!value) return "Not reviewed";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function dateOrUnknown(value: string | null): string {
  return value ? localDateTime(value) : "Not supplied by source";
}

function Digest({ value }: { value: string | null | undefined }) {
  if (!value) return <span>Not recorded</span>;
  return <code title={value}>{value.slice(0, 12)}</code>;
}

function SourceRunEvidence({
  label,
  run,
}: {
  label: string;
  run: NonNullable<RoleProvenanceData["sourceRun"]>;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <strong>{run.complete ? "Complete snapshot" : "Partial snapshot"}</strong> ·{" "}
        {localDateTime(run.completedAt)}
      </dd>
      <dd>
        {run.sourceItemCount} source records · {run.pagesRead} page
        {run.pagesRead === 1 ? "" : "s"}
        {run.retryAfterObserved ? " · retry-after observed" : ""}
      </dd>
      <dd>Policy · {run.sourcePolicyVersion}</dd>
      <dd>
        Run fingerprint · <Digest value={run.responseFingerprint} />
      </dd>
    </div>
  );
}

export function RoleProvenanceCard({
  source,
  sourceJobId,
  boardId,
  contentHash,
  localUpdatedAt,
  availability,
  provenance,
  sourcePolicy,
}: {
  source: string;
  sourceJobId: string;
  boardId: string | null;
  contentHash: string;
  localUpdatedAt: string;
  availability: RoleAvailability;
  provenance: RoleProvenanceData;
  sourcePolicy: RoleSourcePolicy | null;
}) {
  const observation = provenance.observation;
  const attempt = provenance.verificationAttempt;
  const run = provenance.sourceRun;
  const verificationRun = provenance.verificationSourceRun;
  const sourceLabel =
    sourcePolicy?.label ?? (source === "manual" ? "Candidate-entered role" : human(source));

  return (
    <details className="role-provenance">
      <summary>Source provenance</summary>
      <div className="role-provenance-note">
        Normalized, candidate-visible evidence only. Nimanto does not expose a retained raw provider
        body here.
      </div>
      <dl className="role-provenance-grid">
        <div>
          <dt>Source record</dt>
          <dd>
            <strong>{sourceLabel}</strong>
          </dd>
          <dd>
            {boardId ? `Board ${boardId} · ` : ""}Record {sourceJobId}
          </dd>
          {sourcePolicy?.attribution && (
            <dd>
              Attribution: {sourcePolicy.attribution.label}
              {sourcePolicy.attribution.linkRequired ? " · link required" : ""}
            </dd>
          )}
        </div>
        <div>
          <dt>Distinct timestamps</dt>
          <dd>Source posted · {dateOrUnknown(availability.sourcePostedAt)}</dd>
          <dd>Source updated · {dateOrUnknown(availability.sourceUpdatedAt)}</dd>
          <dd>Observed · {localDateTime(observation?.observedAt ?? availability.lastSeenAt)}</dd>
          <dd>Local record updated · {localDateTime(localUpdatedAt)}</dd>
        </div>
        <div>
          <dt>Latest verification</dt>
          <dd>
            <strong>{human(attempt?.result ?? availability.verificationHealth)}</strong> ·{" "}
            {human(attempt?.authority ?? availability.verificationAuthority)} ·{" "}
            {human(attempt?.method ?? availability.verificationMethod)}
          </dd>
          <dd>
            {attempt
              ? `Attempted ${localDateTime(attempt.attemptedAt)}`
              : availability.lastVerifiedAt
                ? `Verified ${localDateTime(availability.lastVerifiedAt)}; immutable attempt not linked`
                : "No immutable verification attempt recorded"}
          </dd>
          {attempt?.policyVersion && <dd>Policy · {attempt.policyVersion}</dd>}
          {attempt?.failureCode && <dd>Blocked reason · {attempt.failureCode}</dd>}
          {attempt?.responseFingerprint && (
            <dd>
              Response fingerprint · <Digest value={attempt.responseFingerprint} />
            </dd>
          )}
        </div>
        {run ? (
          <SourceRunEvidence label="Observation source run" run={run} />
        ) : (
          <div>
            <dt>Observation source run</dt>
            <dd>No provider source run is linked to this normalized observation.</dd>
          </div>
        )}
        {verificationRun && verificationRun.id !== run?.id && (
          <SourceRunEvidence label="Verification source run" run={verificationRun} />
        )}
        <div>
          <dt>Integrity</dt>
          <dd>
            Current role content · <Digest value={contentHash} />
          </dd>
          <dd>
            Normalized observation · <Digest value={observation?.contentHash} />
          </dd>
          <dd>
            Source payload · <Digest value={observation?.sourcePayloadHash} />
          </dd>
          <dd>Normalizer · {observation?.normalizerVersion ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Source policy</dt>
          {sourcePolicy ? (
            <>
              <dd>
                Raw body ·{" "}
                {sourcePolicy.rawBodyTtlHours === 0
                  ? "not retained"
                  : `${sourcePolicy.rawBodyTtlHours} hour retention`}
              </dd>
              <dd>
                Normalized record · {sourcePolicy.normalizedRetentionDays} days · deletion updates{" "}
                {sourcePolicy.deletionUpdateSlaHours}h
              </dd>
              <dd>
                Terms reviewed · {reviewedDate(sourcePolicy.termsReviewedAt)} · commercial use{" "}
                {human(sourcePolicy.commercialUseDecision)}
              </dd>
              <dd>{sourcePolicy.limitation}</dd>
              <dd>
                <a href={sourcePolicy.termsUrl} target="_blank" rel="noreferrer">
                  Review source terms
                </a>
              </dd>
            </>
          ) : (
            <dd>No provider registry policy applies to this candidate-entered record.</dd>
          )}
        </div>
      </dl>
    </details>
  );
}
