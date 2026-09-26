import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

type FakeRequest = EventEmitter & {
  destroyed: boolean;
  destroy(error: Error): void;
  end(): void;
};

type FakeResponse = EventEmitter & {
  complete: boolean;
  headers: Record<string, string>;
  statusCode: number;
};

const transport = vi.hoisted(() => ({
  calls: 0,
  requestDestroyed: false,
  plan: undefined as
    ((respond: (response: FakeResponse) => void, request: FakeRequest) => void) | undefined,
}));

vi.mock("node:https", async () => {
  const { EventEmitter: MockEventEmitter } = await import("node:events");
  return {
    request: vi.fn(
      (_url: URL, _options: object, respond: (response: FakeResponse) => void): FakeRequest => {
        transport.calls += 1;
        const request = new MockEventEmitter() as FakeRequest;
        request.destroyed = false;
        request.destroy = (error) => {
          request.destroyed = true;
          transport.requestDestroyed = true;
          request.emit("error", error);
        };
        request.end = () => transport.plan?.(respond, request);
        return request;
      },
    ),
  };
});

const { fetchAllowlistedJobPage } = await import("../src/url.js");

function response(): FakeResponse {
  const value = new EventEmitter() as FakeResponse;
  value.complete = false;
  value.statusCode = 200;
  value.headers = { "content-type": "text/html; charset=utf-8" };
  return value;
}

const input = {
  url: "https://careers.example.test/jobs/7",
  allowedHosts: ["careers.example.test"],
};
const publicAddress = async () => [{ address: "93.184.216.34", family: 4 }];

afterEach(() => {
  transport.calls = 0;
  transport.requestDestroyed = false;
  transport.plan = undefined;
  vi.useRealTimers();
});

describe("allowlisted URL network completion", () => {
  it.each(["aborted", "close", "end", "error"])(
    "fails closed when a partial response emits %s",
    async (event) => {
      transport.plan = (respond) => {
        const incoming = response();
        respond(incoming);
        incoming.emit("data", Buffer.from("<html><body>partial"));
        if (event === "error") incoming.emit(event, new Error("socket hang up: ECONNRESET"));
        else incoming.emit(event);
      };

      const result = fetchAllowlistedJobPage(input, { resolve: publicAddress });
      const observed = await Promise.race([
        result.then(
          () => "resolved",
          (error: unknown) => (error instanceof Error ? error.message : "unknown"),
        ),
        new Promise<string>((resolve) => setTimeout(() => resolve("still-pending"), 25)),
      ]);

      expect(observed).toBe("URL_FETCH_FAILED");
    },
  );

  it("uses one deadline across DNS resolution, response headers, and the body", async () => {
    vi.useFakeTimers();
    transport.plan = (respond) => {
      setTimeout(() => {
        const incoming = response();
        respond(incoming);
        incoming.emit("data", Buffer.from("<html><body>Platform Engineer"));
        setTimeout(() => {
          incoming.emit("data", Buffer.from(" builds reliable candidate tools.</body></html>"));
          incoming.complete = true;
          incoming.emit("end");
        }, 5_000);
      }, 3_000);
    };
    const resolveAfterThreeSeconds = () =>
      new Promise<{ address: string; family: number }[]>((resolve) => {
        setTimeout(() => resolve([{ address: "93.184.216.34", family: 4 }]), 3_000);
      });

    let observed = "still-pending";
    let requestDestroyedWhenSettled = false;
    void fetchAllowlistedJobPage(input, { resolve: resolveAfterThreeSeconds }).then(
      () => {
        observed = "resolved";
      },
      (error: unknown) => {
        requestDestroyedWhenSettled = transport.requestDestroyed;
        observed = error instanceof Error ? error.message : "unknown";
      },
    );

    await vi.advanceTimersByTimeAsync(9_999);
    expect(observed).toBe("still-pending");
    await vi.advanceTimersByTimeAsync(1);
    expect(observed).toBe("URL_FETCH_TIMEOUT");
    expect(requestDestroyedWhenSettled).toBe(true);
  });

  it("keeps normal exact-host HTTPS intake working without relaxing policy", async () => {
    transport.plan = (respond) => {
      const incoming = response();
      respond(incoming);
      incoming.emit(
        "data",
        Buffer.from("<html><body><h1>Platform Engineer</h1><p>Build candidate tools.</p>"),
      );
      incoming.emit("data", Buffer.from("</body></html>"));
      incoming.complete = true;
      incoming.emit("end");
    };

    await expect(fetchAllowlistedJobPage(input, { resolve: publicAddress })).resolves.toMatchObject(
      {
        canonicalUrl: input.url,
        text: "Platform Engineer Build candidate tools.",
      },
    );
    await expect(
      fetchAllowlistedJobPage(
        { ...input, url: "https://unreviewed.example.test/jobs/7" },
        { resolve: publicAddress },
      ),
    ).rejects.toThrow("SOURCE_URL_NOT_ALLOWED");
    expect(transport.calls).toBe(1);
  });
});
