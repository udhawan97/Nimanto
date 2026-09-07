import { createServer, type Server } from "node:http";
import { afterEach, expect, it } from "vitest";
import {
  draftLocalSummary,
  localModelInventory,
  localModelStatus,
  reviewLocalPacket,
} from "../src/ollama.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});
async function listen(server: Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing loopback address");
  return `http://127.0.0.1:${address.port}`;
}

it.each([301, 302, 303, 307, 308])(
  "rejects model redirects (%s) without contacting their destination",
  async (status) => {
    let destinationRequests = 0;
    const destination = await listen(
      createServer((_request, response) => {
        destinationRequests += 1;
        response.end(JSON.stringify({ models: [], response: "Synthetic candidate summary." }));
      }),
    );
    const origin = await listen(
      createServer((_request, response) => {
        response.writeHead(status, { location: destination });
        response.end();
      }),
    );
    // Remap only the initial fixed Ollama origin to a disposable server. Native
    // fetch still decides whether subsequent redirects may leave that origin.
    const fetcher: typeof fetch = (url, init) =>
      fetch(new URL(new URL(String(url)).pathname, origin), init);
    const results = await Promise.allSettled([
      localModelInventory(fetcher),
      draftLocalSummary(
        {
          model: "synthetic",
          role: "Engineer",
          company: "Fixture",
          evidence: ["Synthetic private evidence"],
        },
        fetcher,
      ),
      reviewLocalPacket(
        {
          model: { name: "synthetic", digest: "a".repeat(64), size: null },
          packet: {
            destination: { company: "Fixture", role: "Engineer" },
            summary: "Synthetic private evidence",
            claims: [],
            authorizationWording: "Synthetic wording",
          },
        },
        fetcher,
      ),
    ]);
    expect(await localModelStatus(fetcher)).toEqual({ available: false, models: [] });
    expect(destinationRequests).toBe(0);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected", "rejected"]);
  },
);

it.each(["malformed", "unavailable", "timed out"])(
  "keeps %s local model responses fail-closed",
  async (mode) => {
    const origin = await listen(
      createServer((_request, response) => {
        if (mode === "timed out") return;
        response.writeHead(mode === "unavailable" ? 503 : 200);
        response.end("invalid JSON");
      }),
    );
    const fetcher: typeof fetch = (url, init) =>
      fetch(new URL(new URL(String(url)).pathname, origin), {
        ...init,
        // Keep the production abort signal, with an additional short test budget
        // so a real hanging socket does not delay the suite for 45 seconds.
        signal: AbortSignal.any([init!.signal!, AbortSignal.timeout(50)]),
      });
    expect(await localModelStatus(fetcher)).toEqual({ available: false, models: [] });
    await expect(
      draftLocalSummary(
        { model: "synthetic", role: "Engineer", company: "Fixture", evidence: [] },
        fetcher,
      ),
    ).rejects.toThrow();
    await expect(
      reviewLocalPacket(
        {
          model: { name: "synthetic", digest: "a".repeat(64), size: null },
          packet: {
            destination: { company: "Fixture", role: "Engineer" },
            summary: "Synthetic",
            claims: [],
            authorizationWording: "Synthetic",
          },
        },
        fetcher,
      ),
    ).rejects.toThrow();
  },
);
