import { act, type ReactNode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  ApplicationSubmissionRecorder,
  createSubmissionDraft,
} from "../components/application-submission.js";

let root: Root;
let host: HTMLDivElement;
async function render(node: ReactNode) {
  if (!host) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => root.render(node));
}
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  host = undefined!;
});
const packet = (id: string) => ({
  id,
  status: "approved",
  canonicalContent: { schemaVersion: "packet_v2" },
  artifactManifest: { artifacts: [{ format: "pdf", sha256: id.repeat(64) }] },
});
const initial = () => ({
  ...createSubmissionDraft(packet("A"), new Date("2026-01-01T12:00:00Z")),
  destination: "Synthetic employer portal",
  artifactFormats: ["pdf"],
});

it("requires explicit replacement and fresh formats when the available Packet changes", async () => {
  const onConfirm = vi.fn();
  const onChange = vi.fn();
  function Recorder({ id }: { id: string }) {
    const [draft, setDraft] = useState(initial);
    return (
      <ApplicationSubmissionRecorder
        packet={packet(id)}
        draft={draft}
        busy={false}
        onDraftChange={(next) => {
          onChange(next);
          setDraft(next);
        }}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
  }
  await render(<Recorder id="A" />);
  await render(<Recorder id="B" />);
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(onConfirm).not.toHaveBeenCalled();
  expect(host.textContent).toContain("selected Packet A");
  expect(host.querySelector('input[type="checkbox"]')).toBeNull();
  const replace = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Use this approved Packet"),
  );
  expect(replace).toBeDefined();
  await act(async () => replace!.click());
  expect(onChange).toHaveBeenLastCalledWith({ ...initial(), packetId: "B", artifactFormats: [] });
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
  expect(onConfirm).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledWith({
    ...initial(),
    packetId: "B",
    submittedAt: new Date(initial().submittedAt).toISOString(),
  });
});

it("submits the unchanged retained selection and leaves a failed draft available for retry", async () => {
  const draft = initial();
  const onConfirm = vi.fn();
  const onDraftChange = vi.fn();
  await render(
    <ApplicationSubmissionRecorder
      packet={packet("A")}
      draft={draft}
      busy={false}
      onDraftChange={onDraftChange}
      onConfirm={onConfirm}
      onCancel={() => {}}
    />,
  );
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledWith({
    ...draft,
    submittedAt: new Date(draft.submittedAt).toISOString(),
  });
  expect(onDraftChange).not.toHaveBeenCalled();
  expect(host.querySelector<HTMLInputElement>('input[placeholder^="Portal URL"]')!.value).toBe(
    draft.destination,
  );
});

it("blocks unavailable selected materials but permits an explicit uncaptured-materials record", async () => {
  const onConfirm = vi.fn();
  function Recorder() {
    const [draft, setDraft] = useState(initial);
    return (
      <ApplicationSubmissionRecorder
        packet={null}
        draft={draft}
        busy={false}
        onDraftChange={setDraft}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
  }
  await render(<Recorder />);
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
  expect(onConfirm).not.toHaveBeenCalled();
  await act(async () => host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
  expect(onConfirm).toHaveBeenCalledWith(
    expect.objectContaining({
      materialsCaptured: false,
      packetId: null,
      artifactFormats: [],
      destination: initial().destination,
    }),
  );
});
