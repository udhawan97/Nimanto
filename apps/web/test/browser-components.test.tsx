import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../components/command-palette.js";
import { CopyLine } from "../components/copy-line.js";
import { ErrorBoundary } from "../components/error-boundary.js";
import { isLoopbackHost, serviceWorkerScriptUrl } from "../components/service-worker.js";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render(node: ReactNode): Promise<HTMLDivElement> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(node));
  return host;
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  Reflect.deleteProperty(navigator, "clipboard");
  root = null;
  host = null;
  vi.restoreAllMocks();
});

describe("recovery boundary", () => {
  it("does not tell the candidate that an interrupted action definitely failed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Broken(): ReactNode {
      throw new Error("render failed");
    }

    const view = await render(createElement(ErrorBoundary, null, createElement(Broken)));

    expect(view.textContent).toContain("does not establish whether the last action completed");
    expect(view.textContent).toContain("review the current record before retrying");
    expect(view.textContent).not.toContain("Nothing was sent");
    expect(view.querySelector("details")?.open).toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("copy feedback", () => {
  it("confirms a successful clipboard write", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const view = await render(createElement(CopyLine, { command: "pnpm dev" }));

    await act(async () => view.querySelector("button")?.click());

    expect(writeText).toHaveBeenCalledWith("pnpm dev");
    expect(view.querySelector("button")?.textContent).toContain("Copied");
  });

  it("reports a rejected clipboard write instead of failing silently", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const view = await render(createElement(CopyLine, { command: "pnpm dev" }));

    await act(async () => view.querySelector("button")?.click());

    expect(view.querySelector("button")?.textContent).toContain("Copy failed");
    expect(view.querySelector("button")?.dataset.state).toBe("failed");
  });
});

describe("quick navigation", () => {
  it("keeps a repeated shortcut focused in the open dialog", async () => {
    const view = await render(createElement(CommandPalette));
    const dialog = view.querySelector("dialog")!;
    const showModal = vi.spyOn(dialog, "showModal");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
    expect(view.querySelector('input[aria-label="Search Nimanto"]')).toBe(document.activeElement);
  });

  /* The palette used to cap the list *before* filtering, so a record past the
   * cap could not be found by typing its exact title — in a product whose
   * stated case is "one application among forty". The cap belongs on what
   * reaches the DOM, never on what is searchable. */
  it("searches every entry while capping what it renders", async () => {
    const entries = Array.from({ length: 52 }, (_, index) => ({
      label: `Role ${index + 1}`,
      detail: `Company ${index + 1}`,
      section: "jobs",
    }));
    const view = await render(createElement(CommandPalette, { entries }));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    expect(view.querySelectorAll('[role="option"]')).toHaveLength(40);
    expect(view.textContent).toContain("Showing 40 of 52");

    const input = view.querySelector('input[aria-label="Search Nimanto"]') as HTMLInputElement;
    /* A controlled input ignores a plain `value` write, so go through the native
     * setter React's onChange actually observes. */
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setValue.call(input, "Role 47");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const results = [...view.querySelectorAll('[role="option"]')];
    expect(results).toHaveLength(1);
    expect(results[0]?.textContent).toContain("Role 47");
  });

  /* Arrow keys move a visual highlight and `aria-selected`, but focus never
   * leaves the input. Without the identifier wiring nothing carries the active
   * option to assistive technology, so the highlight is silent. */
  it("announces the active destination while the highlight moves", async () => {
    const view = await render(
      createElement(CommandPalette, {
        entries: [
          { label: "Overview", detail: "Section", section: "overview" },
          { label: "Evidence vault", detail: "Section", section: "evidence" },
        ],
        onNavigate: () => undefined,
      }),
    );
    const trigger = view.querySelector("button.command-trigger") as HTMLButtonElement;
    await act(async () => trigger.click());

    const input = view.querySelector("dialog input") as HTMLInputElement;
    const listbox = view.querySelector('[role="listbox"]') as HTMLElement;
    const options = [...view.querySelectorAll('[role="option"]')] as HTMLElement[];

    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(listbox.id).toBeTruthy();
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(options[0]?.id).toBeTruthy();
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id);

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    const moved = [...view.querySelectorAll('[role="option"]')] as HTMLElement[];
    expect(moved[1]?.getAttribute("aria-selected")).toBe("true");
    expect(
      (view.querySelector("dialog input") as HTMLInputElement).getAttribute(
        "aria-activedescendant",
      ),
    ).toBe(moved[1]?.id);
  });
});

describe("service worker registration policy", () => {
  it.each(["localhost", "localhost.", "app.localhost", "127.0.0.1", "127.20.4.9", "::1", "[::1]"])(
    "treats %s as loopback",
    (hostname) => expect(isLoopbackHost(hostname)).toBe(true),
  );

  it("keeps public hosts eligible and builds base-path-correct script URLs", () => {
    expect(isLoopbackHost("example.github.io")).toBe(false);
    expect(serviceWorkerScriptUrl("")).toBe("/sw.js");
    expect(serviceWorkerScriptUrl("/Nimanto/")).toBe("/Nimanto/sw.js");
  });
});
