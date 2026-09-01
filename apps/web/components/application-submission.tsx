import { FileCheck2, FileQuestion, Send } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { SubmissionDraft } from "../lib/applications-workbench.js";

type Packet = {
  id: string;
  status: string;
  canonicalContent: { schemaVersion?: string };
  artifactManifest: { artifacts?: Array<{ format: string; sha256: string }> };
};

function localInputValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function createSubmissionDraft(packet: Packet | null, date = new Date()): SubmissionDraft {
  const usablePacket =
    packet?.status === "approved" && packet.canonicalContent.schemaVersion === "packet_v2"
      ? packet
      : null;
  return {
    materialsCaptured: Boolean(usablePacket),
    packetId: usablePacket?.id ?? null,
    artifactFormats: [],
    channel: "employer_portal",
    destination: "",
    submittedAt: localInputValue(date),
  };
}

export function ApplicationSubmissionRecorder({
  packet,
  draft,
  busy,
  onDraftChange,
  onConfirm,
  onCancel,
}: {
  packet: Packet | null;
  draft: SubmissionDraft;
  busy: boolean;
  onDraftChange: (draft: SubmissionDraft) => void;
  onConfirm: (draft: SubmissionDraft) => void;
  onCancel: () => void;
}) {
  const usablePacket =
    packet?.status === "approved" && packet.canonicalContent.schemaVersion === "packet_v2"
      ? packet
      : null;
  const [formatAttempted, setFormatAttempted] = useState(false);
  const formatGroup = useRef<HTMLFieldSetElement>(null);
  const formatRequirementId = useId();
  const artifacts = usablePacket?.artifactManifest.artifacts ?? [];
  const submittedAtMs = Date.parse(draft.submittedAt);
  const recordFieldsValid =
    draft.destination.trim().length > 0 &&
    Number.isFinite(submittedAtMs) &&
    submittedAtMs <= Date.now() + 5 * 60_000;
  const formatMissing =
    draft.materialsCaptured && (!Boolean(usablePacket) || draft.artifactFormats.length === 0);
  const valid = recordFieldsValid && !formatMissing;

  return (
    <form
      className="submission-recorder"
      onSubmit={(event) => {
        event.preventDefault();
        if (formatMissing) {
          setFormatAttempted(true);
          formatGroup.current?.focus();
          return;
        }
        if (!valid) return;
        setFormatAttempted(false);
        onConfirm({
          materialsCaptured: draft.materialsCaptured,
          packetId: draft.materialsCaptured ? usablePacket!.id : null,
          artifactFormats: draft.materialsCaptured ? [...draft.artifactFormats] : [],
          channel: draft.channel,
          destination: draft.destination,
          submittedAt: new Date(draft.submittedAt).toISOString(),
        });
      }}
    >
      <header>
        <span className="submission-seal" aria-hidden="true">
          <Send size={17} />
        </span>
        <div>
          <strong>Record the submission you made</strong>
          <p>
            This is your record of an external action. It is not proof the employer received it.
          </p>
        </div>
      </header>
      <fieldset>
        <legend>Materials</legend>
        <label className="submission-material-choice">
          <input
            type="radio"
            name="materials"
            checked={draft.materialsCaptured}
            disabled={!usablePacket}
            onChange={() => {
              onDraftChange({
                ...draft,
                materialsCaptured: true,
                packetId: usablePacket!.id,
              });
              setFormatAttempted(false);
            }}
          />
          <FileCheck2 size={16} />
          <span>
            <strong>Bind the approved packet</strong>
            <small>
              {usablePacket
                ? `Packet ${usablePacket.id.slice(0, 8)}`
                : "Generate and approve a current Packet v2 to use this option."}
            </small>
          </span>
        </label>
        <label className="submission-material-choice">
          <input
            type="radio"
            name="materials"
            checked={!draft.materialsCaptured}
            onChange={() => {
              onDraftChange({
                ...draft,
                materialsCaptured: false,
                packetId: null,
                artifactFormats: [],
              });
              setFormatAttempted(false);
            }}
          />
          <FileQuestion size={16} />
          <span>
            <strong>Materials were not captured</strong>
            <small>Preserve the gap explicitly without guessing which files were used.</small>
          </span>
        </label>
      </fieldset>
      {draft.materialsCaptured && usablePacket && (
        <fieldset
          ref={formatGroup}
          className="submission-formats"
          aria-describedby={formatRequirementId}
          tabIndex={-1}
        >
          <legend>Formats used</legend>
          {artifacts.map((artifact) => (
            <label key={artifact.format}>
              <input
                type="checkbox"
                aria-describedby={formatRequirementId}
                checked={draft.artifactFormats.includes(artifact.format)}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  onDraftChange({
                    ...draft,
                    artifactFormats: checked
                      ? [...draft.artifactFormats, artifact.format]
                      : draft.artifactFormats.filter((format) => format !== artifact.format),
                  });
                  if (checked) setFormatAttempted(false);
                }}
              />
              <span>{artifact.format.toUpperCase()}</span>
              <code>{artifact.sha256.slice(0, 10)}…</code>
            </label>
          ))}
          <p
            id={formatRequirementId}
            className={formatAttempted && formatMissing ? "field-note field-error" : "field-note"}
            role={formatAttempted && formatMissing ? "alert" : undefined}
          >
            {formatAttempted && formatMissing
              ? "Choose at least one exact packet format before recording."
              : draft.artifactFormats.length > 0
                ? `${draft.artifactFormats.length} packet format${draft.artifactFormats.length === 1 ? "" : "s"} selected.`
                : "Select at least one exact packet format before recording this submission."}
          </p>
        </fieldset>
      )}
      <div className="submission-fields">
        <label>
          Channel
          <select
            value={draft.channel}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                channel: event.target.value as SubmissionDraft["channel"],
              })
            }
          >
            <option value="employer_portal">Employer portal</option>
            <option value="email">Email</option>
            <option value="referral">Referral</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Candidate-recorded time
          <input
            type="datetime-local"
            required
            max={localInputValue()}
            value={draft.submittedAt}
            onChange={(event) => onDraftChange({ ...draft, submittedAt: event.target.value })}
          />
        </label>
        <label className="submission-destination">
          Destination
          <input
            required
            maxLength={500}
            value={draft.destination}
            placeholder="Portal URL, recruiter address, or literal destination"
            onChange={(event) => onDraftChange({ ...draft, destination: event.target.value })}
          />
        </label>
      </div>
      <div className="submission-recorder-actions">
        <button type="button" className="button mini quiet" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="button mini primary"
          disabled={busy || !recordFieldsValid}
          aria-describedby={draft.materialsCaptured ? formatRequirementId : undefined}
        >
          <Send size={15} /> Record external submission
        </button>
      </div>
    </form>
  );
}
