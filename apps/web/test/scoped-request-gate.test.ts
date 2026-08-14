import { describe, expect, it } from "vitest";
import { createScopedRequestGate } from "../lib/scoped-request-gate.js";

describe("Scoped request gate", () => {
  it("keeps a stream single-flight until its active request finishes", () => {
    const gate = createScopedRequestGate<string>();
    gate.select("application-a");

    const first = gate.begin("application-a");
    expect(first).not.toBeNull();
    expect(gate.begin("application-a")).toBeNull();
    expect(gate.finish(first!)).toBe(true);
    expect(gate.begin("application-a")).not.toBeNull();
  });

  it("invalidates an older result as soon as the selected scope changes", () => {
    const gate = createScopedRequestGate<string>();
    gate.select("packet-a");
    const stale = gate.begin("packet-a")!;

    gate.select("packet-b");
    const current = gate.begin("packet-b")!;

    expect(gate.isCurrent(stale)).toBe(false);
    expect(gate.finish(stale)).toBe(false);
    expect(gate.isCurrent(current)).toBe(true);
    expect(gate.finish(current)).toBe(true);
  });

  it("lets packet and assurance pagination use independent streams", () => {
    const packets = createScopedRequestGate<string>();
    const assurances = createScopedRequestGate<string>();
    packets.select("application-a");
    assurances.select("packet-a");

    expect(packets.begin("application-a")).not.toBeNull();
    expect(assurances.begin("packet-a")).not.toBeNull();
  });
});
