import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "../components/workspace.js";
import { api, fenceApiWritesToSession } from "../lib/api-client.js";

type Pending = {
  path: string;
  init: RequestInit | undefined;
  done: boolean;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};
let root: Root, host: HTMLDivElement, requests: Pending[];
const dashboard = (sessionId = "session-a") => ({
  identity: {
    userId: "user",
    tenantId: "tenant",
    sessionId,
    displayName: "Synthetic Candidate",
    email: `${sessionId}@example.test`,
  },
  profile: null,
  evidence: [],
  jobs: [],
  matches: [],
  h1bSignals: [],
  roleWordingReviews: [],
  careerOperations: {
    activities: [],
    contacts: [],
    interviews: [],
    answerBlocks: [],
    savedViews: [],
    offers: [],
  },
  applications: [],
  packets: [],
  actionPackets: [],
  externalActions: [],
  receipts: [],
  schedules: [],
  discoveryProfile: null,
  sourceRuns: [],
  sourceRegistry: [],
  personalFunnel: {
    sampleSize: 0,
    replies: 0,
    screens: 0,
    interviews: 0,
    offers: 0,
    scope: "Candidate only",
  },
  runtime: { operatorEnabled: false, tenantReady: false, externalActionsEnabled: false },
});
const meta = {
  providers: { reviewedUrlIntake: false, reviewedUrlTermsAt: null, reviewedUrlHosts: [] },
};
function pending(path: string): Pending {
  const request = requests.find((item) => !item.done && item.path === path);
  expect(request, path).toBeDefined();
  return request!;
}
async function respond(request: Pending, value: unknown) {
  request.done = true;
  await act(async () =>
    request.resolve(
      new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } }),
    ),
  );
}
async function reject(request: Pending) {
  request.done = true;
  await act(async () => request.reject(new TypeError("Synthetic transport failure")));
}
function button(text: string) {
  const result = [...host.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  expect(result, text).toBeDefined();
  return result!;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
}
async function load(sessionId = "session-a") {
  await respond(pending("/v1/auth/status"), { authenticated: true });
  await respond(pending("/v1/dashboard"), dashboard(sessionId));
  await respond(pending("/v1/meta"), meta);
}
async function mount() {
  await act(async () => root.render(<Workspace />));
  await load();
}
async function holdRefresh(phase: "status" | "dashboard" | "meta") {
  await click("Refresh");
  if (phase === "status") return pending("/v1/auth/status");
  await respond(pending("/v1/auth/status"), { authenticated: true });
  if (phase === "dashboard") {
    await respond(pending("/v1/meta"), meta);
    return pending("/v1/dashboard");
  }
  await respond(pending("/v1/dashboard"), dashboard());
  return pending("/v1/meta");
}
async function assertSessionFence(sessionId: string) {
  const result = api("/v1/evidence", { method: "POST", body: "{}" });
  const request = pending("/v1/evidence");
  expect(new Headers(request.init?.headers).get("x-nimanto-expected-session-id")).toBe(sessionId);
  await respond(request, {});
  await result;
}
beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  requests = [];
  window.location.hash = "";
  window.sessionStorage.clear();
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (url, init) =>
      new Promise<Response>((resolve, reject) =>
        requests.push({
          path: new URL(String(url)).pathname + new URL(String(url)).search,
          init,
          done: false,
          resolve,
          reject,
        }),
      ),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  fenceApiWritesToSession(null);
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

describe("Workspace refresh lifecycle", () => {
  for (const boundary of ["sign out", "delete"] as const) {
    for (const phase of ["status", "dashboard", "meta"] as const) {
      it.each(["success", "failure"])(
        `ignores stale ${phase} %s after ${boundary}`,
        async (outcome) => {
          await mount();
          const old = await holdRefresh(phase);
          if (boundary === "sign out") {
            await click("Sign out");
            await respond(pending("/v1/session"), {});
          } else {
            await click("Data controls");
            await change(
              host.querySelector<HTMLInputElement>(".danger-zone input")!,
              "DELETE MY NIMANTO DATA",
            );
            await click("Delete all data");
            await respond(pending("/v1/data"), {
              token: "synthetic-deletion-token",
              state: "completed",
              message: "Deleted",
            });
          }
          const latestStatus = requests
            .filter((item) => !item.done && item.path === "/v1/auth/status")
            .at(-1)!;
          await respond(latestStatus, { authenticated: false });
          expect(host.querySelector(".workspace-shell")).toBeNull();
          const requestCount = requests.length;
          if (outcome === "failure") await reject(old);
          else
            await respond(
              old,
              phase === "status"
                ? { authenticated: true }
                : phase === "dashboard"
                  ? dashboard()
                  : meta,
            );
          expect(requests).toHaveLength(requestCount);
          expect(host.querySelector(".workspace-shell")).toBeNull();
          expect(host.textContent).not.toContain("session-a@example.test");
          expect(host.textContent).toContain(
            boundary === "sign out" ? "Signed out." : "synthetic-deletion-token",
          );
        },
      );
    }
  }
  it.each(["status", "dashboard", "meta"] as const)(
    "ignores stale %s success and failure after newer identity",
    async (phase) => {
      await mount();
      const old = await holdRefresh(phase);
      await click("Refresh");
      const status = requests
        .filter((item) => !item.done && item.path === "/v1/auth/status")
        .at(-1)!;
      await respond(status, { authenticated: true });
      await respond(
        requests.filter((item) => !item.done && item.path === "/v1/dashboard").at(-1)!,
        dashboard("session-b"),
      );
      await respond(
        requests.filter((item) => !item.done && item.path === "/v1/meta").at(-1)!,
        meta,
      );
      await respond(
        old,
        phase === "status" ? { authenticated: false } : phase === "dashboard" ? dashboard() : meta,
      );
      expect(host.querySelector(".workspace-header")?.textContent).toContain(
        "session-b@example.test",
      );
      await assertSessionFence("session-b");
      const failing = await holdRefresh(phase);
      await click("Refresh");
      const nextStatus = requests
        .filter((item) => !item.done && item.path === "/v1/auth/status")
        .at(-1)!;
      await respond(nextStatus, { authenticated: true });
      const nextDashboard = requests
        .filter((item) => !item.done && item.path === "/v1/dashboard")
        .at(-1)!;
      const nextMeta = requests.filter((item) => !item.done && item.path === "/v1/meta").at(-1)!;
      await respond(nextDashboard, dashboard("session-c"));
      await respond(nextMeta, meta);
      await reject(failing);
      expect(host.querySelector(".workspace-header")?.textContent).toContain(
        "session-c@example.test",
      );
      expect(host.querySelector(".connection-banner")).toBeNull();
      expect(button("Refresh").disabled).toBe(false);
      await assertSessionFence("session-c");
    },
  );
  it.each(["status", "dashboard", "meta"] as const)(
    "ignores stale authentication refusal during %s after a newer identity",
    async (phase) => {
      await mount();
      const old = await holdRefresh(phase);
      await click("Refresh");
      await respond(
        requests.filter((item) => !item.done && item.path === "/v1/auth/status").at(-1)!,
        { authenticated: true },
      );
      await respond(
        requests.filter((item) => !item.done && item.path === "/v1/dashboard").at(-1)!,
        dashboard("replacement"),
      );
      await respond(
        requests.filter((item) => !item.done && item.path === "/v1/meta").at(-1)!,
        meta,
      );
      old.done = true;
      await act(async () =>
        old.resolve(
          new Response(
            JSON.stringify({
              error: { code: "AUTHENTICATION_REQUIRED", message: "Session expired" },
            }),
            { status: 401, headers: { "content-type": "application/json" } },
          ),
        ),
      );
      expect(host.querySelector(".workspace-header")?.textContent).toContain(
        "replacement@example.test",
      );
      await assertSessionFence("replacement");
    },
  );
  it("late unauthenticated status cannot undo newer successful authentication", async () => {
    await mount();
    const old = await holdRefresh("status");
    await click("Refresh");
    await respond(
      requests.filter((item) => !item.done && item.path === "/v1/auth/status").at(-1)!,
      { authenticated: false },
    );
    await change(
      host.querySelector<HTMLInputElement>('input[type="password"]')!,
      "synthetic-launch-secret",
    );
    await click("Use clearly labeled synthetic demo");
    await respond(pending("/v1/auth/demo"), {});
    await respond(
      requests.filter((item) => !item.done && item.path === "/v1/auth/status").at(-1)!,
      { authenticated: true },
    );
    await respond(pending("/v1/dashboard"), dashboard("session-new"));
    await respond(pending("/v1/meta"), meta);
    await respond(old, { authenticated: false });
    expect(host.querySelector(".workspace-header")?.textContent).toContain(
      "session-new@example.test",
    );
    expect(host.textContent).toContain("The synthetic Priya Shah workspace is ready.");
    await assertSessionFence("session-new");
  });
});
const run = (job: string, id: string) => ({
  id,
  jobId: job,
  profileVersionId: "profile",
  inputHash: `input-${id}`,
  artifactHash: `artifact-${id}`,
  ruleVersion: "scoring_rules_v1",
  createdAt: "2026-09-10T12:00:00Z",
  currentJob: { id: job, title: `Role ${job}`, company: "Synthetic" },
  result: { band: "weak_evidence", blockers: [] },
});
const profile = (id: string) => ({
  id,
  createdAt: "2026-09-10T12:00:00Z",
  claimIds: [],
  authorizationWording: "",
});
const profilesPath = "/v1/history/profile-versions?limit=20",
  overviewPath = "/v1/history/match-runs?limit=20";
const rolePath = (id: string) => `/v1/history/match-runs?jobId=${id}&limit=20`;
async function history() {
  await mount();
  await click("Stored history");
  await respond(pending(profilesPath), { items: [profile("p2"), profile("p1")], nextCursor: "p1" });
  await respond(pending(overviewPath), {
    items: [run("A", "a2"), run("B", "b2")],
    nextCursor: "b2",
  });
  await respond(pending(rolePath("A")), {
    items: [run("A", "a2"), run("A", "a1")],
    nextCursor: "a1",
  });
}
function roleSelect() {
  return host.querySelector<HTMLSelectElement>(".history-panel:nth-child(2) > label select")!;
}
function runIds() {
  return [
    ...host.querySelectorAll<HTMLOptionElement>('select[aria-label="Stored match run A"] option'),
  ].map((item) => item.value);
}
async function selectRole(id: string) {
  await change(roleSelect(), id);
  await respond(pending(rolePath(id)), {
    items: [run(id, `${id.toLowerCase()}2`), run(id, `${id.toLowerCase()}1`)],
    nextCursor: `${id.toLowerCase()}1`,
  });
}
describe("Stored history pagination", () => {
  it.each(["success", "failure"])(
    "ignores old A pagination %s after selecting B and again A",
    async (outcome) => {
      await history();
      await click("Load older runs for this role");
      const old = pending(rolePath("A") + "&cursor=a1");
      await selectRole("B");
      await selectRole("A");
      await click("Load older runs for this role");
      const current = requests
        .filter((item) => !item.done && item.path === rolePath("A") + "&cursor=a1")
        .at(-1)!;
      if (outcome === "success")
        await respond(old, { items: [run("A", "old-a0")], nextCursor: null });
      else await reject(old);
      expect(runIds()).toEqual(["a2", "a1"]);
      expect(host.textContent).not.toContain("could not be loaded");
      await respond(current, { items: [run("A", "new-a0")], nextCursor: null });
      expect(runIds()).toEqual(["a2", "a1", "new-a0"]);
    },
  );
  it("keeps B's actual comparison after late A pagination", async () => {
    await history();
    await click("Load older runs for this role");
    const old = pending(rolePath("A") + "&cursor=a1");
    await selectRole("B");
    await respond(old, { items: [run("A", "a0")], nextCursor: null });
    expect(roleSelect().value).toBe("B");
    expect(runIds()).toEqual(["b2", "b1"]);
    expect(host.querySelector(".run-comparison")?.textContent).toContain("artifact-b2");
    expect(host.querySelector(".run-comparison")?.textContent).not.toContain("artifact-a");
  });
  for (const stream of [
    {
      label: "Load older profile versions",
      path: profilesPath,
      cursor: "p1",
      item: profile("p0"),
      selector: 'select[aria-label="Profile version A"] option',
    },
    {
      label: "Load older roles and runs",
      path: overviewPath,
      cursor: "b2",
      item: run("C", "c2"),
      selector: ".history-panel:nth-child(2) > label select option",
    },
    {
      label: "Load older runs for this role",
      path: rolePath("A"),
      cursor: "a1",
      item: run("A", "a0"),
      selector: 'select[aria-label="Stored match run A"] option',
    },
  ]) {
    it(`${stream.label}: duplicate activation, failure and retry preserve records`, async () => {
      await history();
      const control = button(stream.label);
      await act(async () => {
        control.click();
        control.click();
      });
      const path = stream.path + "&cursor=" + stream.cursor;
      expect(requests.filter((request) => request.path === path)).toHaveLength(1);
      expect(control.disabled).toBe(true);
      await reject(pending(path));
      expect(host.querySelector('.history-panel [role="alert"]')?.textContent).toContain(
        "could not be loaded",
      );
      expect(host.querySelectorAll(stream.selector)).toHaveLength(2);
      await click(stream.label);
      await respond(pending(path), { items: [stream.item], nextCursor: null });
      expect(host.querySelectorAll(stream.selector)).toHaveLength(3);
      expect(host.textContent).not.toContain("could not be loaded");
    });
  }
});
