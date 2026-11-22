import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { executeProviderAction, fetchAllowlistedJobPage, fetchProviderJobs } from "../src/index.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const input = { url: "https://careers.example.test/role", allowedHosts: ["careers.example.test"] };

it.each([
  "192.0.2.1",
  "192.88.99.2",
  "2001:db8::1",
  "2001:2::1",
  "2001:10::1",
  "3fff::1",
  "2001:100::1",
  "2001:0:7f00:1:0:0:a247:27dd",
])("rejects a non-global DNS answer %s before requesting content", async (address) => {
  const request = vi.fn(async () => ({
    status: 200,
    contentType: "text/plain",
    body: new TextEncoder().encode("Synthetic role for a candidate-controlled workspace."),
  }));
  await expect(
    fetchAllowlistedJobPage(input, {
      resolve: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
      request,
    }),
  ).rejects.toThrow("SOURCE_URL_UNSAFE_ADDRESS");
  expect(request).not.toHaveBeenCalled();
});

it("does not interpret provider-declared plain text as HTML", async () => {
  const description = "Build <tools> &amp; preserve literal candidate text.";
  const jobs = await fetchProviderJobs(
    { provider: "lever", board: "synthetic" },
    async () =>
      new Response(
        JSON.stringify([
          {
            id: "7",
            text: "Engineer",
            descriptionPlain: description,
            hostedUrl: "https://careers.example.test/role",
            categories: { location: "Remote" },
          },
        ]),
        { headers: { "content-type": "application/json" } },
      ),
  );
  expect(jobs[0]?.description).toBe(description);
  const page = await fetchAllowlistedJobPage(input, {
    resolve: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async () => ({
      status: 200,
      contentType: "text/plain",
      body: new TextEncoder().encode(description),
    }),
  });
  expect(page.text).toBe(description);
});

it.each([
  {
    source: '<p title="a > b">Build &amp;lt;tools&amp;gt; &amp;nbsp; carefully.</p>',
    expected: "Build &lt;tools&gt; &nbsp; carefully.",
  },
  {
    source:
      "<p>Build candidate tools with care.</p><script>hidden()</script ><style>hidden{}</style >",
    expected: "Build candidate tools with care.",
  },
  {
    source: "<p>Build &#x3C;tools&#x3E; &quot;carefully&quot; for candidates.</p>",
    expected: 'Build <tools> "carefully" for candidates.',
  },
])("preserves visible text through both intake paths: $expected", async ({ source, expected }) => {
  const page = await fetchAllowlistedJobPage(input, {
    resolve: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async () => ({
      status: 200,
      contentType: "text/html",
      body: new TextEncoder().encode(source),
    }),
  });
  expect(page.text).toBe(expected);
  const jobs = await fetchProviderJobs(
    { provider: "greenhouse", board: "synthetic" },
    async () =>
      new Response(
        JSON.stringify({
          jobs: [
            {
              id: 7,
              title: "Engineer",
              content: source,
              absolute_url: "https://careers.example.test/role",
              location: { name: "Remote" },
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  expect(jobs[0]?.description).toBe(expected);
});

it.each(["../escaped", "nested/action", "nested\\action", "", ".", "a".repeat(121)])(
  "rejects an unsafe outbox identity without creating files: %s",
  async (actionId) => {
    const root = await mkdtemp(path.join(tmpdir(), "nimanto-outbox-boundary-"));
    roots.push(root);
    await expect(
      executeProviderAction(
        {
          actionId,
          provider: "test_outbox",
          to: "jobs@example.test",
          subject: "Synthetic application",
          body: "Disposable content",
        },
        { outboxDirectory: path.join(root, "outbox") },
      ),
    ).rejects.toThrow("INVALID_ACTION_ID");
    expect(await readdir(root)).toEqual([]);
  },
);
