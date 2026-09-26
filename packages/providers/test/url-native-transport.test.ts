import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const originalRequest = https.request;
let server: http.Server | undefined;

afterEach(async () => {
  https.request = originalRequest;
  syncBuiltinESMExports();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve())),
    );
    server = undefined;
  }
});

describe("allowlisted URL native transport", () => {
  it("cancels a truncated response before rejecting the public fetch", async () => {
    server = http.createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("Synthetic candidate role description for transport verification. ");
      setTimeout(() => response.socket?.destroy(), 20);
    });
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(0, "127.0.0.1", () => {
        server?.removeListener("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_REQUIRED");

    let observedRequest: http.ClientRequest | undefined;
    https.request = ((_url, options, onResponse) => {
      const request = http.request(
        new URL(`http://127.0.0.1:${address.port}/synthetic`),
        {
          method: options.method,
          headers: options.headers,
        },
        onResponse,
      );
      observedRequest = request;
      return request;
    }) as typeof https.request;
    syncBuiltinESMExports();
    const { fetchAllowlistedJobPage } = await import("../src/url.js");

    const startedAt = Date.now();
    let requestDestroyedWhenRejected = false;
    const outcome = await fetchAllowlistedJobPage(
      {
        url: "https://careers.example.test/synthetic",
        allowedHosts: ["careers.example.test"],
      },
      { resolve: async () => [{ address: "93.184.216.34", family: 4 }] },
    ).then(
      () => "resolved",
      (error: unknown) => {
        requestDestroyedWhenRejected = observedRequest?.destroyed ?? false;
        return error instanceof Error ? error.message : "unknown";
      },
    );

    expect(outcome).toBe("URL_FETCH_FAILED");
    expect(requestDestroyedWhenRejected).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});
