import { createServer, type Server } from "node:http";
import { afterEach, expect, it } from "vitest";
import { runCycle } from "../src/worker.js";

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

it("completes a normal loopback health and cycle request", async () => {
  const requests: string[] = [];
  const result = { processed: 1, failed: 0, imported: 1, matched: 1 };
  const apiOrigin = await listen(
    createServer((request, response) => {
      requests.push(request.url!);
      if (request.url === "/v1/worker/cycle") {
        expect(request.headers["x-nimanto-bootstrap-secret"]).toBe("synthetic-private-key");
      } else expect(request.headers["x-nimanto-bootstrap-secret"]).toBeUndefined();
      response.end(JSON.stringify(result));
    }),
  );
  expect(await runCycle({ apiOrigin, bootstrapSecret: "synthetic-private-key" })).toEqual(result);
  expect(requests).toEqual(["/health", "/v1/worker/cycle"]);
});

it.each(
  [301, 302, 303, 307, 308].flatMap((status) =>
    ["/health", "/v1/worker/cycle"].map((endpoint) => ({ status, endpoint })),
  ),
)(
  "rejects $status redirects at $endpoint before reaching the destination",
  async ({ status, endpoint }) => {
    const destinationHeaders: unknown[] = [];
    const result = { processed: 1, failed: 0, imported: 1, matched: 1 };
    const destination = await listen(
      createServer((request, response) => {
        destinationHeaders.push(request.headers);
        response.end(JSON.stringify(result));
      }),
    );
    const apiOrigin = await listen(
      createServer((request, response) => {
        if (request.url === endpoint) {
          response.writeHead(status, { location: destination });
          response.end();
        } else response.end(JSON.stringify(result));
      }),
    );
    const outcome = await Promise.allSettled([
      runCycle({ apiOrigin, bootstrapSecret: "synthetic-private-key" }),
    ]);
    expect(destinationHeaders).toEqual([]);
    expect(outcome[0]?.status).toBe("rejected");
  },
);
