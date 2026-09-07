import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AnswerHistoryDetails } from "../components/career-ledger.js";

let root: Root;
let host: HTMLDivElement;
type Pending = { resolve: (response: Response) => void; reject: (error: Error) => void };
let pending: Pending[];
const at = (currentRevision: number, id = "answer-a") => ({
  id,
  currentRevision,
  topic: "why_role" as const,
  prompt: "Synthetic prompt",
  latest: { answerText: "Synthetic answer", evidenceIds: [], createdAt: "2026-01-01T12:00:00Z" },
  createdAt: "2026-01-01T12:00:00Z",
  updatedAt: "2026-01-01T12:00:00Z",
});
const page = (
  currentRevision: number,
  nextCursor: string | null = null,
  revision = currentRevision,
) => ({
  currentRevision,
  nextCursor,
  revisions: [
    {
      id: `revision-${revision}`,
      revision,
      topic: "why_role",
      prompt: "Synthetic prompt",
      answerText: `Retained answer ${revision}`,
      evidenceIds: [],
      createdAt: "2026-01-01T12:00:00Z",
    },
  ],
});
async function render(revision: number, id?: string) {
  await act(async () =>
    root.render(<AnswerHistoryDetails answer={at(revision, id)} onCopyEvidence={() => {}} />),
  );
}
async function toggle(open: boolean) {
  await act(async () => {
    const details = host.querySelector("details")!;
    details.open = open;
  });
}
async function resolve(index: number, record: ReturnType<typeof page>) {
  await act(async () =>
    pending[index]!.resolve(
      new Response(JSON.stringify(record), { headers: { "content-type": "application/json" } }),
    ),
  );
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((item) =>
    item.textContent?.includes(text),
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
beforeEach(() => {
  pending = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () => new Promise<Response>((resolve, reject) => pending.push({ resolve, reject })),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it.each(["success", "failure"])(
  "retains new history after an older initial %s",
  async (outcome) => {
    await render(1);
    await toggle(true);
    expect(pending).toHaveLength(1);
    await render(2);
    expect(pending).toHaveLength(2);
    await resolve(1, page(2));
    expect(host.textContent).toContain("Retained answer 2");
    if (outcome === "success") await resolve(0, page(1));
    else await act(async () => pending[0]!.reject(new Error("Old request failed")));
    expect(host.textContent).toContain("Retained answer 2");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  },
);

it("provides retry when the returned revision differs from the visible Answer", async () => {
  await render(2);
  await toggle(true);
  await resolve(0, page(1));
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await click("Try again");
  await resolve(1, page(2));
  expect(host.textContent).toContain("Retained answer 2");
});

it("fences older pagination failures across a revision refresh", async () => {
  await render(2);
  await toggle(true);
  await resolve(0, page(2, "older"));
  await click("Load older revisions");
  await render(3);
  await resolve(2, page(3));
  await act(async () => pending[1]!.reject(new Error("Old page failed")));
  expect(host.textContent).toContain("Retained answer 3");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it("ignores an old page while the newer revision is loading its own older page", async () => {
  await render(2);
  await toggle(true);
  await resolve(0, page(2, "old-cursor"));
  await click("Load older revisions");
  await render(3);
  await resolve(2, page(3, "new-cursor"));
  await click("Load older revisions");
  await resolve(1, page(2, null, 1));
  expect(host.textContent).toContain("Loading older revisions");
  expect(host.textContent).not.toContain("Retained answer 1");
  await resolve(3, page(3, null, 2));
  expect(host.textContent).toContain("Retained answer 3");
  expect(host.textContent).toContain("Retained answer 2");
  expect(host.querySelector('[role="status"]')).toBeNull();
});

it("restarts history from the first page after a pagination revision mismatch", async () => {
  await render(2);
  await toggle(true);
  await resolve(0, page(2, "older"));
  await click("Load older revisions");
  await resolve(1, page(3, null, 1));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "differs from the visible Answer",
  );
  await click("Try again");
  expect(vi.mocked(fetch).mock.calls[2]![0]).not.toContain("cursor");
  await resolve(2, page(2));
  expect(host.textContent).toContain("Retained answer 2");
});

it("discards a pending response after identity unmount and starts a fresh panel", async () => {
  await render(1);
  await toggle(true);
  await act(async () => root.render(null));
  await render(1);
  expect(host.querySelector("details")!.open).toBe(false);
  await resolve(0, page(1));
  expect(host.textContent).not.toContain("Retained answer 1");
  await toggle(true);
  expect(pending).toHaveLength(2);
  await resolve(1, page(1));
  expect(host.textContent).toContain("Retained answer 1");
});

it("loads the new Answer identity even when its revision number is unchanged", async () => {
  await render(1);
  await toggle(true);
  await render(1, "answer-b");
  expect(pending).toHaveLength(2);
  await resolve(1, {
    ...page(1),
    revisions: [{ ...page(1).revisions[0]!, answerText: "Answer B" }],
  });
  await resolve(0, page(1));
  expect(host.textContent).toContain("Answer B");
  expect(host.textContent).not.toContain("Retained answer 1");
});

it("keeps pagination usable after close/reopen and a failed page", async () => {
  await render(2);
  await toggle(true);
  await resolve(0, page(2, "older"));
  await toggle(false);
  await toggle(true);
  expect(pending).toHaveLength(1);
  await click("Load older revisions");
  await act(async () => pending[1]!.reject(new Error("Retry page")));
  expect(host.textContent).toContain("Older revisions could not be loaded");
  await click("Load older revisions");
  await resolve(2, page(2, null, 1));
  expect(host.textContent).toContain("Retained answer 2");
  expect(host.textContent).toContain("Retained answer 1");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});
