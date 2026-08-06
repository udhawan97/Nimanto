import { describe, expect, it } from "vitest";
import { loopbackApiOrigin, nextDelay, runCycle } from "../src/worker.js";

describe("bounded source worker", () => {
  it("backs off without exceeding fifteen minutes", () => {
    expect(nextDelay(0)).toBe(5_000);
    expect(nextDelay(20)).toBe(15 * 60_000);
  });

  it("runs one durable schedule cycle through the private worker endpoint", async () => {
    const calls: string[] = [];
    const result = await runCycle({
      apiOrigin: "http://127.0.0.1:4310",
      bootstrapSecret: "private-key",
      fetcher: (async (url: string | URL | Request) => {
        calls.push(String(url));
        if (String(url).endsWith("/v1/worker/cycle")) {
          return new Response(
            JSON.stringify({ processed: 1, failed: 0, imported: 6, matched: 6 }),
            { headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });
    expect(result).toEqual({ processed: 1, failed: 0, imported: 6, matched: 6 });
    expect(calls).toEqual([
      "http://127.0.0.1:4310/health",
      "http://127.0.0.1:4310/v1/worker/cycle",
    ]);
  });

  it("refuses a schedule cycle without the private launch key", async () => {
    await expect(
      runCycle({
        apiOrigin: "http://127.0.0.1:4310",
        fetcher: (async () =>
          new Response(JSON.stringify({ status: "ok" }), {
            headers: { "content-type": "application/json" },
          })) as typeof fetch,
      }),
    ).rejects.toThrow("WORKER_BOOTSTRAP_SECRET_MISSING");
  });

  it("rejects non-loopback API origins before making any request", async () => {
    for (const apiOrigin of [
      "https://evil.example",
      "http://127.0.0.1.evil.example",
      "http://user:secret@127.0.0.1:4310",
      "http://127.0.0.1:4310/unexpected",
    ]) {
      let calls = 0;
      await expect(
        runCycle({
          apiOrigin,
          bootstrapSecret: "private-key",
          fetcher: (async () => {
            calls += 1;
            return new Response();
          }) as typeof fetch,
        }),
      ).rejects.toThrow("INVALID_API_ORIGIN");
      expect(calls).toBe(0);
    }
  });

  it("normalizes the supported loopback origins", () => {
    expect(loopbackApiOrigin("http://localhost:4310/")).toBe("http://localhost:4310");
    expect(loopbackApiOrigin("http://[::1]:4310")).toBe("http://[::1]:4310");
  });
});
