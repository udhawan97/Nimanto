import { ArrowDown, ArrowUp, Check, FileOutput } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { movePacketEvidence, projectPacketComposer } from "../lib/packet-composer.js";

type Evidence = {
  id: string;
  status: string;
  value: string;
  kind: string;
  sourceName: string;
  locator: string;
};

type Application = { id: string; jobId: string; profileVersionId: string | null };
type Profile = { id: string; claimIds: string[] };
type Job = { id: string; contentHash: string };
type Match = {
  id: string;
  jobId: string;
  profileVersionId: string | null;
  jobContentHash: string;
  result: { requirements: Array<{ requirement: string; state: string; evidenceIds: string[] }> };
};

export function PacketComposer({
  application,
  profile,
  job,
  match,
  evidence,
  busy,
  compact = false,
  primary = true,
  onGenerate,
}: {
  application: Application;
  profile: Profile | null;
  job: Job | null;
  match: Match | null;
  evidence: Evidence[];
  busy: boolean;
  compact?: boolean;
  primary?: boolean;
  onGenerate: (evidenceIds: string[]) => void;
}) {
  const projection = useMemo(
    () => projectPacketComposer({ application, profile, job, match, evidence }),
    [application, evidence, job, match, profile],
  );
  const optionKey = projection.options.map((option) => option.id).join("\u0000");
  const [selected, setSelected] = useState<string[]>(() =>
    projection.options.slice(0, 8).map((option) => option.id),
  );

  useEffect(() => {
    setSelected((current) => {
      const available = new Set(projection.options.map((option) => option.id));
      const retained = current.filter((id) => available.has(id)).slice(0, 8);
      return retained.length > 0
        ? retained
        : projection.options.slice(0, 8).map((option) => option.id);
    });
  }, [optionKey, projection.options]);

  if (!projection.ready) {
    return <small className="field-note packet-composer-gate">{projection.reason}</small>;
  }

  const selectedOptions = selected.flatMap((id) => {
    const option = projection.options.find((candidate) => candidate.id === id);
    return option ? [option] : [];
  });
  const unselectedOptions = projection.options.filter((option) => !selected.includes(option.id));
  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : current.length < 8
          ? [...current, id]
          : current,
    );
  };

  return (
    <details className={`packet-composer ${compact ? "compact" : ""}`}>
      <summary>
        <FileOutput size={15} aria-hidden="true" /> Compose packet
        <span>{selected.length}/8 selected</span>
      </summary>
      <div className="packet-composer-body">
        <header>
          <span>Frozen evidence order</span>
          <p>
            Choose only confirmed claims for this exact Profile and Match. The order below becomes
            the order in every generated format.
          </p>
        </header>
        <ol className="packet-evidence-order">
          {selectedOptions.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                className="packet-evidence-toggle selected"
                aria-pressed="true"
                onClick={() => toggle(option.id)}
              >
                <Check size={14} aria-hidden="true" />
                <span>
                  <strong>{option.value}</strong>
                  <small>
                    {option.kind} · {option.sourceName} · {option.locator}
                  </small>
                </span>
              </button>
              <div className="packet-order-controls" aria-label={`Order ${option.value}`}>
                <button
                  type="button"
                  aria-label={`Move ${option.value} up`}
                  disabled={index === 0}
                  onClick={() =>
                    setSelected((current) => movePacketEvidence(current, option.id, -1))
                  }
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${option.value} down`}
                  disabled={index === selectedOptions.length - 1}
                  onClick={() =>
                    setSelected((current) => movePacketEvidence(current, option.id, 1))
                  }
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <small className="packet-requirement-map">
                {option.requirements.length > 0
                  ? `Supports: ${option.requirements.join(" · ")}`
                  : "No current requirement link; retained as candidate-selected context."}
              </small>
            </li>
          ))}
        </ol>
        {unselectedOptions.length > 0 && (
          <div className="packet-evidence-pool">
            <span>Available confirmed evidence</span>
            {unselectedOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="packet-evidence-toggle"
                aria-pressed="false"
                disabled={selected.length >= 8}
                onClick={() => toggle(option.id)}
              >
                <span>
                  <strong>{option.value}</strong>
                  <small>{option.sourceName}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="packet-composer-footer">
          <small>
            Match {projection.matchId.slice(0, 8)} · identical frozen inputs reproduce the same
            canonical packet hash.
          </small>
          <button
            type="button"
            className={`button mini ${primary ? "primary" : "quiet"}`}
            disabled={busy || selected.length === 0}
            onClick={() => onGenerate(selected)}
          >
            <FileOutput size={15} /> Generate selected packet
          </button>
        </div>
      </div>
    </details>
  );
}
