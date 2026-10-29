import { ArrowDown, ArrowUp, Check, FileOutput, RefreshCw } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

/** The one recovery for an Application pinned to a superseded Profile Version.
 * Shared by the composer gate, the packet row and the submission recorder so
 * the candidate meets the same control wherever the binding stops them. */
export function RebindProfileVersionButton({
  busy,
  onRebind,
}: {
  busy: boolean;
  onRebind: () => void;
}) {
  return (
    <button
      type="button"
      className="button mini quiet profile-rebind"
      disabled={busy}
      onClick={onRebind}
    >
      <RefreshCw size={15} aria-hidden="true" /> Use current Profile Version
    </button>
  );
}

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
  onRebind,
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
  onRebind?: () => void;
}) {
  const projection = useMemo(
    () => projectPacketComposer({ application, profile, job, match, evidence }),
    [application, evidence, job, match, profile],
  );
  const optionKey = projection.options.map((option) => option.id).join("\u0000");
  const [selected, setSelected] = useState<string[]>([]);
  const composer = useRef<HTMLDetailsElement>(null);
  const returnFocus = useRef<{ id: string; control: string } | null>(null);

  useLayoutEffect(() => {
    const target = returnFocus.current;
    returnFocus.current = null;
    if (!target) return;
    const controls = [
      ...(composer.current?.querySelectorAll<HTMLButtonElement>("[data-evidence-id]") ?? []),
    ].filter((button) => button.dataset.evidenceId === target.id);
    // A toggle changes parents; a move can disable its own edge control.
    const next =
      controls.find(
        (button) => button.dataset.evidenceControl === target.control && !button.disabled,
      ) ?? controls.find((button) => button.dataset.evidenceControl === "toggle");
    next?.focus();
  }, [selected]);

  const retainFocus = (button: HTMLButtonElement, id: string, control: string) => {
    if (document.activeElement === button) returnFocus.current = { id, control };
  };

  useEffect(() => {
    setSelected((current) => {
      const available = new Set(projection.options.map((option) => option.id));
      return current.filter((id) => available.has(id)).slice(0, 8);
    });
  }, [optionKey, projection.options]);

  if (!projection.ready) {
    return (
      <div className="packet-composer-gate">
        <small className="field-note">{projection.reason}</small>
        {projection.rebindAvailable && onRebind && (
          <RebindProfileVersionButton busy={busy} onRebind={onRebind} />
        )}
      </div>
    );
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
    <details ref={composer} className={`packet-composer ${compact ? "compact" : ""}`}>
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
                data-evidence-id={option.id}
                data-evidence-control="toggle"
                onClick={(event) => {
                  retainFocus(event.currentTarget, option.id, "toggle");
                  toggle(option.id);
                }}
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
                  data-evidence-id={option.id}
                  data-evidence-control="up"
                  onClick={(event) => {
                    retainFocus(event.currentTarget, option.id, "up");
                    setSelected((current) => movePacketEvidence(current, option.id, -1));
                  }}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${option.value} down`}
                  disabled={index === selectedOptions.length - 1}
                  data-evidence-id={option.id}
                  data-evidence-control="down"
                  onClick={(event) => {
                    retainFocus(event.currentTarget, option.id, "down");
                    setSelected((current) => movePacketEvidence(current, option.id, 1));
                  }}
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
        {selectedOptions.length === 0 && (
          <p className="field-note">
            Nothing is selected. Choose each claim you want in this packet; Nimanto does not choose
            evidence on your behalf.
          </p>
        )}
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
                data-evidence-id={option.id}
                data-evidence-control="toggle"
                onClick={(event) => {
                  retainFocus(event.currentTarget, option.id, "toggle");
                  toggle(option.id);
                }}
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
            onClick={(event) => {
              // The enabled summary survives while generation disables this control.
              if (document.activeElement === event.currentTarget) {
                composer.current?.querySelector("summary")?.focus();
              }
              onGenerate(selected);
            }}
          >
            <FileOutput size={15} /> Generate selected packet
          </button>
        </div>
      </div>
    </details>
  );
}
