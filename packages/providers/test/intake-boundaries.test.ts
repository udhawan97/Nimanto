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

it("rejects a mixed public/private DNS result without selecting the public answer", async () => {
  const request = vi.fn();
  await expect(
    fetchAllowlistedJobPage(input, {
      resolve: async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ],
      request,
    }),
  ).rejects.toThrow("SOURCE_URL_UNSAFE_ADDRESS");
  expect(request).not.toHaveBeenCalled();
});

it.each(["2001:3::1", "2001:4:112::1", "2001:20::1", "2001:1::1", "3fff:1000::1"])(
  "preserves allowed global IPv6 allocations: %s",
  async (address) => {
    await expect(
      fetchAllowlistedJobPage(input, {
        resolve: async () => [{ address, family: 6 }],
        request: async () => ({
          status: 200,
          contentType: "text/plain",
          body: new TextEncoder().encode("Synthetic role for a candidate-controlled workspace."),
        }),
      }),
    ).resolves.toHaveProperty("canonicalUrl", input.url);
  },
);

it.each([
  [302, "text/plain", new TextEncoder().encode("Redirect"), "SOURCE_URL_REDIRECT_BLOCKED"],
  [500, "text/plain", new TextEncoder().encode("Error"), "SOURCE_URL_HTTP_500"],
  [200, "application/json", new TextEncoder().encode("{}"), "URL_CONTENT_TYPE"],
  [200, "text/html", new Uint8Array(1_000_001), "URL_BODY_TOO_LARGE"],
  [200, "text/plain", Uint8Array.of(0xff), "URL_TEXT_ENCODING"],
] as const)(
  "fails closed for response status %i and type %s",
  async (status, contentType, body, error) => {
    await expect(
      fetchAllowlistedJobPage(input, {
        resolve: async () => [{ address: "93.184.216.34", family: 4 }],
        request: async () => ({ status, contentType, body, location: "https://127.0.0.1/" }),
      }),
    ).rejects.toThrow(error);
  },
);

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

it.each([true, false])("uses Ashby plain text when present, otherwise HTML: %s", async (plain) => {
  const description = "Build <tools> &amp; preserve literal candidate text.";
  const jobs = await fetchProviderJobs(
    { provider: "ashby", board: "synthetic" },
    async () =>
      new Response(
        JSON.stringify({
          jobs: [
            {
              id: "7",
              title: "Engineer",
              descriptionPlain: plain ? description : "",
              descriptionHtml:
                "<p>Build &lt;tools&gt; &amp;amp; preserve literal candidate text.</p>",
              jobUrl: "https://careers.example.test/role",
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  expect(jobs[0]?.description).toBe(description);
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
  {
    source:
      "<p>Build candidate tools with care.</p><template><div><template>hidden</template>also hidden</div></template>",
    expected: "Build candidate tools with care.",
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
