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
  fetchProviderJobsResult,
  JOB_SOURCE_REGISTRY,
  localModelStatus,
  localModelInventory,
  reviewLocalPacket,
  routeAtsLink,
  verifyProviderJob,
} from "../src/index.js";

describe("job providers", () => {
  it("routes provider-owned and exact candidate-entered ATS links without fetching them", () => {
    expect(
      routeAtsLink({
        source: "greenhouse",
        sourceJobId: "17001",
        url: "https://careers.northwind.example/jobs/17001?source=nimanto#apply",
        sourceMeta: { board: "northwind" },
      }),
    ).toMatchObject({
      state: "ready",
      provider: "greenhouse",
      boardId: "northwind",
      sourceJobId: "17001",
      targetUrl: "https://careers.northwind.example/jobs/17001?source=nimanto",
      routeKind: "provider_source",
      verificationMethod: "detail_get",
      verificationState: "ready",
    });

    expect(
      routeAtsLink({
        source: "manual",
        sourceJobId: "candidate-copy",
        url: "https://jobs.lever.co/northwind/role-7/apply?lever-source=tracker#form",
      }),
    ).toMatchObject({
      state: "ready",
      provider: "lever",
      boardId: "northwind",
      sourceJobId: "role-7",
      targetUrl: "https://jobs.lever.co/northwind/role-7",
      routeKind: "recognized_url",
      verificationMethod: "detail_get",
    });

    expect(
      routeAtsLink({
        source: "allowlisted_url",
        sourceJobId: "candidate-copy",
        url: "https://jobs.ashbyhq.com/northwind/ashby-7/application?utm_source=test",
      }),
    ).toMatchObject({
      state: "ready",
      provider: "ashby",
      boardId: "northwind",
      sourceJobId: "ashby-7",
      targetUrl: "https://jobs.ashbyhq.com/northwind/ashby-7",
      routeKind: "recognized_url",
      verificationMethod: "complete_list",
    });
  });

  it("keeps unapproved destinations and discovery-origin rights fail-closed", () => {
    expect(
      routeAtsLink({
        source: "manual",
        sourceJobId: "candidate-copy",
        url: "https://jobs.smartrecruiters.com/Northwind/sr-7-role",
      }),
    ).toMatchObject({
      state: "gated",
      provider: "smartrecruiters",
      targetUrl: null,
      reason: "destination_source_rights_required",
      verificationState: "gated",
    });
    expect(
      routeAtsLink({
        source: "licensed_feed",
        sourceJobId: "feed-7",
        url: "https://job-boards.greenhouse.io/northwind/jobs/17001",
        sourceMeta: { sourceRegistryId: "adzuna" },
      }),
    ).toMatchObject({
      state: "gated",
      provider: "greenhouse",
      targetUrl: null,
      reason: "origin_source_rights_required",
    });
  });

  it.each([
    "http://jobs.lever.co/northwind/role-7",
    "https://user:pass@jobs.lever.co/northwind/role-7",
    "https://jobs.lever.co:8443/northwind/role-7",
    "https://jobs.lever.co/northwind/%2Fetc",
    "https://unreviewed.example.test/northwind/role-7",
  ])("does not route an unsafe or unrecognized candidate link: %s", (url) => {
    expect(routeAtsLink({ source: "manual", sourceJobId: "candidate-copy", url })).toMatchObject({
      state: "unrecognized",
      targetUrl: null,
    });
  });

  it("rechecks exact Greenhouse and Lever detail endpoints without redirects", async () => {
    const requests: string[] = [];
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push(String(url));
      expect(init?.redirect).toBe("error");
      if (String(url).includes("greenhouse")) {
        return new Response(
          JSON.stringify({
            id: 17001,
            title: "Platform Engineer",
            content: "Build typed services",
            absolute_url: "https://job-boards.greenhouse.io/northwind/jobs/17001",
            location: { name: "Chicago" },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          id: "lever-7",
          text: "Product Engineer",
          descriptionPlain: "Build candidate tools",
          hostedUrl: "https://jobs.lever.co/northwind/lever-7",
          categories: { location: "Remote" },
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const greenhouse = await verifyProviderJob(
      { provider: "greenhouse", board: "northwind", sourceJobId: "17001" },
      fetcher as typeof fetch,
    );
    const lever = await verifyProviderJob(
      { provider: "lever", board: "northwind", sourceJobId: "lever-7" },
      fetcher as typeof fetch,
    );
    expect(requests).toEqual([
      "https://boards-api.greenhouse.io/v1/boards/northwind/jobs/17001",
      "https://api.lever.co/v0/postings/northwind/lever-7",
    ]);
    expect(greenhouse).toMatchObject({ method: "detail_get", result: "present" });
    expect(lever).toMatchObject({ method: "detail_get", result: "present" });
  });

  it("treats a detail 404 as definitive and a partial Ashby absence as blocked", async () => {
    const missing = await verifyProviderJob(
      { provider: "greenhouse", board: "northwind", sourceJobId: "17001" },
      (async () =>
        new Response(JSON.stringify({ error: "missing" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
    );
    expect(missing).toMatchObject({
      method: "detail_get",
      result: "not_found",
      sourceItemCount: 0,
    });

    const partial = await verifyProviderJob(
      { provider: "ashby", board: "northwind", sourceJobId: "missing-role" },
      (async () =>
        new Response(
          JSON.stringify({
            jobs: Array.from({ length: 501 }, (_, index) => ({
              id: `ashby-${index}`,
              title: `Engineer ${index}`,
              descriptionPlain: "Build systems",
              jobUrl: `https://jobs.ashbyhq.com/northwind/ashby-${index}`,
            })),
          }),
          { headers: { "content-type": "application/json" } },
        )) as typeof fetch,
    );
    expect(partial).toMatchObject({
      method: "complete_list",
      result: "blocked",
      failureCode: "PROVIDER_PARTIAL_SNAPSHOT",
      sourceItemCount: 501,
    });
  });

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
      workMode: "unknown",
      workplaceEvidence: [expect.objectContaining({ mode: "unknown", confidence: "low" })],
    });
  });

  it("keeps every new source disabled until its registry gate is approved", async () => {
    expect(
      JOB_SOURCE_REGISTRY.filter((source) =>
        ["smartrecruiters", "adzuna", "linkedin", "indeed", "glassdoor"].includes(source.id),
      ).every((source) => !source.executionEnabled),
    ).toBe(true);
    await expect(
      fetchProviderJobsResult(
        { provider: "smartrecruiters", board: "northwind" },
        (async () => new Response("{}")) as typeof fetch,
      ),
    ).rejects.toThrow("SOURCE_EXECUTION_DISABLED");
  });

  it("maps the dormant SmartRecruiters adapter without enabling production execution", async () => {
    const fetcher = async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith("postings?limit=100&offset=0")) {
        return new Response(
          JSON.stringify({
            totalFound: 1,
            content: [{ id: "sr-7", name: "ML Engineer", releasedDate: "2026-08-25" }],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      expect(value).toContain("/postings/sr-7");
      return new Response(
        JSON.stringify({
          id: "sr-7",
          name: "ML Engineer",
          releasedDate: "2026-08-25",
          company: { name: "Northwind" },
          location: { city: "Chicago", region: "IL", country: "US", remote: true },
          ref: { to: "https://jobs.example.test/sr-7" },
          jobAd: {
            sections: {
              jobDescription: { text: "Build models" },
              qualifications: { text: "Python. ML systems." },
            },
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const result = await fetchProviderJobsResult(
      { provider: "smartrecruiters", board: "northwind" },
      fetcher as typeof fetch,
      { enforceRegistry: false },
    );
    expect(result.run).toMatchObject({ complete: true, pagesRead: 1, sourceItemCount: 1 });
    expect(result.jobs[0]).toMatchObject({
      sourceJobId: "sr-7",
      company: "Northwind",
      workMode: "remote",
      requirements: ["Python", "ML systems"],
      workplaceEvidence: [
        expect.objectContaining({
          method: "source_structured",
          sourceFieldOrLocator: "location.remote",
        }),
      ],
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

  it("marks a source run partial before truncating an oversized item set", async () => {
    const payload = {
      jobs: Array.from({ length: 501 }, (_, index) => ({
        id: index,
        title: `Engineer ${index}`,
        content: "TypeScript",
        absolute_url: `https://example.test/${index}`,
        location: { name: "Remote" },
      })),
    };
    const result = await fetchProviderJobsResult(
      { provider: "greenhouse", board: "northwind" },
      (async () =>
        new Response(JSON.stringify(payload), {
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
    );
    expect(result.jobs).toHaveLength(500);
    expect(result.run).toMatchObject({ complete: false, sourceItemCount: 501 });
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
