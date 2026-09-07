import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DataControls } from "../components/workspace.js";
import { ApiError, fenceApiWritesToSession } from "../lib/api-client.js";
import {
  createWorkbenchMutations,
  type RefreshOutcome,
  type WorkbenchMutations,
} from "../lib/workbench-mutations.js";

type ExportDashboard = ComponentProps<typeof DataControls>["dashboard"];
const dashboard = (sessionId: string): ExportDashboard => ({
  identity: {
    userId: "synthetic-user",
    tenantId: "synthetic-tenant",
    sessionId,
    displayName: "Synthetic Candidate",
    email: "candidate@example.test",
  },
  evidence: [],
  applications: [],
});
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic-export");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  fenceApiWritesToSession(null);
  vi.restoreAllMocks();
});
async function clickDownload() {
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  const button = [...host.querySelectorAll("button")].find((item) =>
    item.textContent?.includes("Download JSON"),
  )!;
  await act(async () => button.click());
}
function mount(sessionId: string, onAct: WorkbenchMutations) {
  root.render(
    <DataControls
      key={sessionId}
      dashboard={dashboard(sessionId)}
      onAct={onAct}
      busy={false}
      onDeleted={() => {}}
    />,
  );
}

it("downloads only with the rendered session identity and retains the ordinary download lifecycle", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ identity: { email: "candidate@example.test" } })),
    );
  fenceApiWritesToSession("different-global-session");
  let completion: Promise<unknown> | undefined;
  const onAct: WorkbenchMutations = {
    run: (operation) => {
      const result = operation.request().then((value) => ({ kind: "committed" as const, value }));
      completion = result;
      return result;
    },
  };
  await act(async () => mount("displayed-session", onAct));
  await clickDownload();
  await completion;
  const [url, init] = fetch.mock.calls[0]!;
  expect(url).toContain("/v1/export");
  expect(init?.credentials).toBe("include");
  expect(new Headers(init?.headers).get("x-nimanto-expected-session-id")).toBe("displayed-session");
  expect(URL.createObjectURL).toHaveBeenCalledExactlyOnceWith(expect.any(Blob));
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0]).toMatchObject({
    download: "nimanto-export.json",
    href: "blob:synthetic-export",
  });
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:synthetic-export");
});

it.each<RefreshOutcome>(["ready", "unreachable", "failed"])(
  "reconciles an export identity refusal before any download, including %s refresh",
  async (outcome) => {
    const response = new Response(
      JSON.stringify({
        error: { code: "IDENTITY_CHANGED", message: "Review the replacement workspace." },
      }),
      { status: 409 },
    );
    const blob = vi.spyOn(response, "blob");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const events: string[] = [];
    const failures: unknown[] = [];
    let completion: Promise<unknown> | undefined;
    let runner: WorkbenchMutations;
    const coordinator = createWorkbenchMutations({
      setBusy: () => {},
      captureFocus: () => {},
      restoreFocus: () => {},
      clearNotice: () => {},
      setNoticeFocus: () => {},
      setReachable: () => {},
      enterSignedOutState: () => {
        events.push("clear-identity");
        root.render(<p>Signed out</p>);
      },
      refresh: async () => {
        events.push("refresh");
        if (outcome === "ready") mount("replacement-session", runner);
        return outcome;
      },
      describeFailure: (error) => {
        failures.push(error);
        return error instanceof Error ? error.message : null;
      },
      publishNotice: (kind) => events.push(kind),
      schedule: (work) => work(),
    });
    runner = {
      run: (operation) => {
        const result = coordinator.run(operation);
        completion = result;
        return result;
      },
    };
    await act(async () => mount("displayed-session", runner));
    await clickDownload();
    await act(async () => {
      await completion;
    });
    expect(events).toEqual(["clear-identity", "refresh", "error"]);
    expect(failures[0]).toBeInstanceOf(ApiError);
    expect(failures[0]).toMatchObject({ code: "IDENTITY_CHANGED" });
    expect(blob).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    if (outcome !== "ready") {
      expect(host.textContent).toBe("Signed out");
      await act(async () => mount("replacement-session", runner));
    }
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
    const button = [...host.querySelectorAll("button")].find((item) =>
      item.textContent?.includes("Download JSON"),
    )!;
    expect(button.disabled).toBe(true);
  },
);

it.each([
  [401, "AUTHENTICATION_REQUIRED"],
  [503, "EXPORT_TEMPORARILY_UNAVAILABLE"],
])("preserves structured export error %s for coordinator recovery", async (status, code) => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: { code, message: "Synthetic retry guidance." } }), {
      status,
    }),
  );
  let request: Promise<unknown> | undefined;
  const onAct: WorkbenchMutations = {
    run: async (operation) => {
      request = operation.request();
      await request.catch(() => undefined);
      return { kind: "failed" };
    },
  };
  await act(async () => mount("displayed-session", onAct));
  await clickDownload();
  await expect(request).rejects.toMatchObject({ code, message: "Synthetic retry guidance." });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});
