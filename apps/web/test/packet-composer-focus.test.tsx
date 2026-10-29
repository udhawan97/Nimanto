import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PacketComposer } from "../components/packet-composer.js";

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

it("keeps focus on the claim after selecting and deselecting it", async () => {
  await mount();
  const available = host.querySelector<HTMLButtonElement>(".packet-evidence-pool button")!;
  await activate(available);
  const selected = host.querySelector<HTMLButtonElement>(".packet-evidence-toggle.selected")!;
  expect(document.activeElement).toBe(selected);
  expect(selected.getAttribute("aria-pressed")).toBe("true");
  await activate(selected);
  const returned = host.querySelector<HTMLButtonElement>(".packet-evidence-pool button")!;
  expect(document.activeElement).toBe(returned);
  expect(returned.getAttribute("aria-pressed")).toBe("false");
});

it("keeps explicit order and gives focus to the claim when a move reaches an edge", async () => {
  const generate = await mount();
  generate.mockImplementation(() =>
    expect(document.activeElement).toBe(host.querySelector("summary")),
  );
  for (let index = 0; index < 8; index += 1) {
    await activate(host.querySelector<HTMLButtonElement>(".packet-evidence-pool button")!);
  }
  expect(host.querySelector<HTMLButtonElement>(".packet-evidence-pool button")!.disabled).toBe(
    true,
  );
  const up = host.querySelector<HTMLButtonElement>('[aria-label="Move Claim 2 up"]')!;
  await activate(up);
  expect(up.disabled).toBe(true);
  expect(document.activeElement).toBe(
    host.querySelector(".packet-evidence-order .packet-evidence-toggle"),
  );
  const down = host.querySelector<HTMLButtonElement>('[aria-label="Move Claim 7 down"]')!;
  await activate(down);
  expect(down.disabled).toBe(true);
  expect(document.activeElement?.textContent).toContain("Claim 7");
  await activate(
    [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Generate selected packet"),
    )!,
  );
  expect(generate).toHaveBeenCalledWith(["e2", "e1", "e3", "e4", "e5", "e6", "e8", "e7"]);
  expect(document.activeElement).toBe(host.querySelector("summary"));
});

it("preserves existing focus when a pointer activates generation without focusing its button", async () => {
  const generate = await mount();
  await activate(host.querySelector<HTMLButtonElement>(".packet-evidence-pool button")!);
  const selected = document.activeElement;
  const control = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.includes("Generate selected packet"),
  )!;
  await act(async () => control.click());
  expect(generate).toHaveBeenCalledWith(["e1"]);
  expect(document.activeElement).toBe(selected);
});

async function activate(button: HTMLButtonElement) {
  button.focus();
  await act(async () => button.click());
}
async function mount() {
  const onGenerate = vi.fn();
  const evidence = Array.from({ length: 9 }, (_, index) => ({
    id: `e${index + 1}`,
    status: "confirmed",
    value: `Claim ${index + 1}`,
    kind: "skill",
    sourceName: "Synthetic fixture",
    locator: `line ${index + 1}`,
  }));
  await act(async () =>
    root.render(
      <PacketComposer
        application={{ id: "application", jobId: "job", profileVersionId: "profile" }}
        profile={{ id: "profile", claimIds: evidence.map((claim) => claim.id) }}
        job={{ id: "job", contentHash: "role-hash" }}
        match={{
          id: "match",
          jobId: "job",
          profileVersionId: "profile",
          jobContentHash: "role-hash",
          result: { requirements: [] },
        }}
        evidence={evidence}
        busy={false}
        onGenerate={onGenerate}
      />,
    ),
  );
  return onGenerate;
}
