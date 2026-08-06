import { describe, expect, it } from "vitest";
import { loopbackApiOrigin, nextDelay, runCycle } from "../src/worker.js";

describe("bounded source worker", () => {
  it("backs off without exceeding fifteen minutes", () => {
    expect(nextDelay(0)).toBe(5_000);
    expect(nextDelay(20)).toBe(15 * 60_000);
  });

  it("performs only a health check when no source is configured", async () => {
    const calls: string[] = [];
    const result = await runCycle({
      apiOrigin: "http://127.0.0.1:4310",
      fetcher: (async (url: string | URL | Request) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });
    expect(result).toEqual({ status: "healthy", imported: 0 });
    expect(calls).toEqual(["http://127.0.0.1:4310/health"]);
  });

  it("refuses a configured refresh without the private launch key", async () => {
    await expect(
      runCycle({
        apiOrigin: "http://127.0.0.1:4310",
        source: { provider: "greenhouse", board: "northwind" },
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
