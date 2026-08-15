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
