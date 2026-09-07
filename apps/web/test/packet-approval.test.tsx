import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PacketApprovalConfirmation } from "../components/workspace.js";

let root: Root | undefined;
let host: HTMLDivElement | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
});

it("requires a fresh confirmation when the reviewed assurance changes and submits its exact identity", async () => {
  const packet: ComponentProps<typeof PacketApprovalConfirmation>["packet"] = {
    id: "packet-a",
    applicationId: "application-a",
    profileVersionId: "profile-a",
    status: "assurance_passed",
    approvedAt: null,
    createdAt: "",
    updatedAt: "",
    artifactHash: "a".repeat(64),
    manifestHash: "b".repeat(64),
    canonicalContent: {},
    artifactManifest: { artifacts: [] },
    latestAssurance: {
      id: "run-a",
      status: "passed",
      ruleVersion: "synthetic",
      findings: [],
      createdAt: "",
    },
  };
  const onApprove = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const render = async (value: typeof packet) => {
    await act(async () =>
      root?.render(
        <>
          <button data-outside>Elsewhere</button>
          <PacketApprovalConfirmation packet={value} onApprove={onApprove} disabled={false} />
        </>,
      ),
    );
  };
  const click = async (label: string) => {
    const button = [...host!.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label,
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
  };
  await render(packet);
  await click("Approve");
  expect(host.textContent).toContain("run-a");
  const oldConfirm = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Approve this packet",
  )!;
  oldConfirm.focus();
  expect(document.activeElement).toBe(oldConfirm);
  const replacement = { ...packet, latestAssurance: { ...packet.latestAssurance!, id: "run-b" } };
  await render(replacement);
  expect(host.textContent).not.toContain("Approve this packet");
  expect(onApprove).not.toHaveBeenCalled();
  expect(document.activeElement?.textContent?.trim()).toBe("Approve");
  await click("Approve");
  expect(host.textContent).toContain("run-b");
  expect(host.textContent).toContain(packet.manifestHash);
  await click("Approve this packet");
  expect(onApprove).toHaveBeenCalledExactlyOnceWith({
    reviewedAssuranceId: "run-b",
    reviewedArtifactHash: packet.artifactHash,
    reviewedManifestHash: packet.manifestHash,
  });
  await click("Approve");
  const outside = host.querySelector<HTMLButtonElement>("[data-outside]")!;
  outside.focus();
  await render({ ...replacement, manifestHash: "c".repeat(64) });
  expect(document.activeElement).toBe(outside);
  expect(host.textContent).not.toContain("Approve this packet");
  expect(onApprove).toHaveBeenCalledTimes(1);
});
