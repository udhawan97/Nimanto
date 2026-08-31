import { FileCheck2, FileQuestion, Send } from "lucide-react";
import { useState } from "react";

export type SubmissionDraft = {
  materialsCaptured: boolean;
  packetId: string | null;
  artifactFormats: string[];
  channel: "employer_portal" | "email" | "referral" | "other";
  destination: string;
  submittedAt: string;
};

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

export function ApplicationSubmissionRecorder({
  packet,
  busy,
  onConfirm,
  onCancel,
}: {
  packet: Packet | null;
  busy: boolean;
  onConfirm: (draft: SubmissionDraft) => void;
  onCancel: () => void;
}) {
  const usablePacket =
    packet?.status === "approved" && packet.canonicalContent.schemaVersion === "packet_v2"
      ? packet
      : null;
  const [materialsCaptured, setMaterialsCaptured] = useState(Boolean(usablePacket));
  const [formats, setFormats] = useState<string[]>([]);
  const [channel, setChannel] = useState<SubmissionDraft["channel"]>("employer_portal");
  const [destination, setDestination] = useState("");
  const [submittedAt, setSubmittedAt] = useState(localInputValue);
  const artifacts = usablePacket?.artifactManifest.artifacts ?? [];
  const submittedAtMs = Date.parse(submittedAt);
  const valid =
    destination.trim().length > 0 &&
    Number.isFinite(submittedAtMs) &&
    submittedAtMs <= Date.now() + 5 * 60_000 &&
    (!materialsCaptured || (Boolean(usablePacket) && formats.length > 0));

  return (
    <form
      className="submission-recorder"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onConfirm({
          materialsCaptured,
          packetId: materialsCaptured ? usablePacket!.id : null,
          artifactFormats: materialsCaptured ? formats : [],
          channel,
          destination,
          submittedAt: new Date(submittedAt).toISOString(),
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
            checked={materialsCaptured}
            disabled={!usablePacket}
            onChange={() => setMaterialsCaptured(true)}
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
            checked={!materialsCaptured}
            onChange={() => {
              setMaterialsCaptured(false);
              setFormats([]);
            }}
          />
          <FileQuestion size={16} />
          <span>
            <strong>Materials were not captured</strong>
            <small>Preserve the gap explicitly without guessing which files were used.</small>
          </span>
        </label>
      </fieldset>
      {materialsCaptured && usablePacket && (
        <fieldset className="submission-formats">
          <legend>Formats used</legend>
          {artifacts.map((artifact) => (
            <label key={artifact.format}>
              <input
                type="checkbox"
                checked={formats.includes(artifact.format)}
                onChange={(event) =>
                  setFormats((current) =>
                    event.currentTarget.checked
                      ? [...current, artifact.format]
                      : current.filter((format) => format !== artifact.format),
                  )
                }
              />
              <span>{artifact.format.toUpperCase()}</span>
              <code>{artifact.sha256.slice(0, 10)}…</code>
            </label>
          ))}
        </fieldset>
      )}
      <div className="submission-fields">
        <label>
          Channel
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as SubmissionDraft["channel"])}
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
            value={submittedAt}
            onChange={(event) => setSubmittedAt(event.target.value)}
          />
        </label>
        <label className="submission-destination">
          Destination
          <input
            required
            maxLength={500}
            value={destination}
            placeholder="Portal URL, recruiter address, or literal destination"
            onChange={(event) => setDestination(event.target.value)}
          />
        </label>
      </div>
      <div className="submission-recorder-actions">
        <button type="button" className="button mini quiet" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button mini primary" disabled={busy || !valid}>
          <Send size={15} /> Record external submission
        </button>
      </div>
    </form>
  );
}
