import { chmod, mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDeepLink,
  draftLocalSummary,
  executeProviderAction,
  fetchAllowlistedJobPage,
  fetchProviderJobs,
  localModelStatus,
  localModelInventory,
  reviewLocalPacket,
} from "../src/index.js";

describe("job providers", () => {
  it("maps Greenhouse data through an injected fetch boundary", async () => {
    const fetcher = async (url: string | URL | Request) => {
      expect(String(url)).toContain("boards-api.greenhouse.io");
      return new Response(
        JSON.stringify({
          jobs: [
            {
              id: 7,
              title: "Engineer",
              content: "<p>TypeScript</p>",
              absolute_url: "https://example.test/7",
              location: { name: "Remote" },
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const jobs = await fetchProviderJobs(
      { provider: "greenhouse", board: "northwind" },
      fetcher as typeof fetch,
    );
    expect(jobs[0]).toMatchObject({
      sourceJobId: "7",
      title: "Engineer",
      description: "TypeScript",
    });
  });

  it("retrieves only an exact allowlisted HTTPS host pinned to a public DNS answer", async () => {
    const result = await fetchAllowlistedJobPage(
      { url: "https://careers.example.test/jobs/7", allowedHosts: ["careers.example.test"] },
      {
        resolve: async () => [{ address: "93.184.216.34", family: 4 }],
        request: async (_url, address) => {
          expect(address.address).toBe("93.184.216.34");
          return {
            status: 200,
            contentType: "text/html; charset=utf-8",
            body: new TextEncoder().encode(
              "<html><script>ignore()</script><body><h1>Platform Engineer</h1><p>Build typed services for candidates.</p></body></html>",
            ),
          };
        },
      },
    );
    expect(result.text).toBe("Platform Engineer Build typed services for candidates.");
  });

  it("blocks private DNS, redirects, credentials, ports, and unreviewed hosts", async () => {
    const values = [
      "http://careers.example.test/jobs/7",
      "https://user:pass@careers.example.test/jobs/7",
      "https://careers.example.test:8443/jobs/7",
      "https://unreviewed.example.test/jobs/7",
    ];
    for (const url of values) {
      await expect(
        fetchAllowlistedJobPage(
          { url, allowedHosts: ["careers.example.test"] },
          { resolve: async () => [{ address: "127.0.0.1", family: 4 }] },
        ),
      ).rejects.toThrow();
    }
    await expect(
      fetchAllowlistedJobPage(
        { url: "https://careers.example.test/jobs/7", allowedHosts: ["careers.example.test"] },
        { resolve: async () => [{ address: "127.0.0.1", family: 4 }] },
      ),
    ).rejects.toThrow("SOURCE_URL_UNSAFE_ADDRESS");
  });

  it("rejects identifiers that could escape the provider allowlist", async () => {
    await expect(fetchProviderJobs({ provider: "lever", board: "../../internal" })).rejects.toThrow(
      "INVALID_BOARD_IDENTIFIER",
    );
  });

  it("caps provider responses before parsing or retaining oversized JSON", async () => {
    const fetcher = async () =>
      new Response(new Uint8Array(1024 * 1024 + 1), {
        headers: { "content-type": "application/json" },
      });
    await expect(
      fetchProviderJobs({ provider: "greenhouse", board: "northwind" }, fetcher as typeof fetch),
    ).rejects.toThrow("PROVIDER_RESPONSE_TOO_LARGE");
  });
});

describe("local model boundary", () => {
  it("reports Ollama models without sending candidate data elsewhere", async () => {
    const status = await localModelStatus((async (url: string | URL | Request) => {
      expect(String(url)).toBe("http://127.0.0.1:11434/api/tags");
      return new Response(
        JSON.stringify({ models: [{ name: "qwen3:4b", digest: "a".repeat(64), size: 42 }] }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch);
    expect(status).toEqual({ available: true, models: ["qwen3:4b"] });
  });

  it("pins a configured reviewer to its installed digest and validates structured output", async () => {
    const model = (
      await localModelInventory(
        (async () =>
          new Response(
            JSON.stringify({
              models: [{ name: "gemma4:12b", digest: "b".repeat(64), size: 7_600_000_000 }],
            }),
          )) as typeof fetch,
      )
    )[0]!;
    const review = await reviewLocalPacket(
      {
        model,
        packet: {
          destination: { company: "Northwind", role: "Engineer" },
          summary: "Evidence-backed engineer.",
          claims: [{ text: "Built typed APIs", evidenceIds: ["e1"] }],
          authorizationWording: "Requires H-1B transfer support.",
        },
      },
      (async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { prompt: string; tools?: unknown };
        expect(body.prompt).toContain("<UNTRUSTED_PACKET_JSON>");
        expect(body.tools).toBeUndefined();
        return new Response(JSON.stringify({ response: '{"verdict":"pass","findings":[]}' }));
      }) as typeof fetch,
    );
    expect(review).toMatchObject({
      verdict: "pass",
      model: "gemma4:12b",
      digest: "b".repeat(64),
      reviewerVersion: "ollama_packet_review_v1",
    });
  });

  it("labels generated text as an unverified local draft", async () => {
    const draft = await draftLocalSummary(
      { model: "qwen3:4b", role: "Engineer", company: "Northwind", evidence: ["Built typed APIs"] },
      (async () =>
        new Response(
          JSON.stringify({
            response:
              "Built typed APIs and shipped reliable services. Brings evidence-backed delivery experience.",
          }),
          {
            headers: { "content-type": "application/json" },
          },
        )) as typeof fetch,
    );
    expect(draft.label).toBe("unverified_local_draft");
  });
});

describe("external action providers", () => {
  it("creates a deep link without sending", () => {
    const value = buildDeepLink({
      actionId: "a1",
      provider: "deep_link",
      to: "jobs@example.test",
      subject: "Hello",
      body: "Body",
    });
    expect(value).toContain("mailto:jobs%40example.test");
  });

  it("writes only to the local test outbox", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nimanto-outbox-"));
    await chmod(directory, 0o755);
    const result = await executeProviderAction(
      {
        actionId: "a1",
        provider: "test_outbox",
        to: "jobs@example.test",
        subject: "Application",
        body: "Attached separately.",
      },
      { outboxDirectory: directory },
    );
    const saved = await readFile(result.providerReference, "utf8");
    expect(saved).toContain("jobs@example.test");
    expect(result.status).toBe("sent");
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(result.providerReference)).mode & 0o777).toBe(0o600);
  });

  it("rejects header injection and unbounded payloads before preparing any action", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nimanto-outbox-"));
    await expect(
      executeProviderAction(
        {
          actionId: "a-injection",
          provider: "test_outbox",
          to: "jobs@example.test",
          subject: "Application\r\nBcc: attacker@example.test",
          body: "Reviewed body",
        },
        { outboxDirectory: directory },
      ),
    ).rejects.toThrow("INVALID_EMAIL_SUBJECT");
    await expect(
      executeProviderAction(
        {
          actionId: "a-long",
          provider: "deep_link",
          to: "jobs@example.test",
          subject: "Application",
          body: "x".repeat(20_001),
        },
        { outboxDirectory: directory },
      ),
    ).rejects.toThrow("INVALID_EMAIL_BODY");
  });
});
