import { describe, expect, it } from "vitest";
import { assurePacket } from "../src/assurance.js";
import { transitionExternalAction } from "../src/external-actions.js";

describe("application assurance public seam", () => {
  it("passes a packet only when every material claim links to confirmed evidence", () => {
    const result = assurePacket({
      authorizationWording: "I am currently in H-1B status and may require employer action.",
      claims: [
        { text: "Built production ML pipelines.", evidenceIds: ["ev-1"] },
        { text: "Led API reliability work.", evidenceIds: ["ev-2"] },
      ],
      confirmedEvidenceIds: ["ev-1", "ev-2"],
      destination: { company: "Northwind Labs", role: "Senior AI Platform Engineer" },
    });

    expect(result.status).toBe("passed");
    expect(result.findings).toEqual([]);
  });

  it("blocks unsupported claims and altered authorization wording", () => {
    const result = assurePacket({
      authorizationWording: "I never require sponsorship.",
      lockedAuthorizationWording: "I am currently in H-1B status and may require employer action.",
      claims: [{ text: "Increased revenue by 400%.", evidenceIds: [] }],
      confirmedEvidenceIds: [],
      destination: { company: "Northwind Labs", role: "Engineer" },
    });

    expect(result.status).toBe("blocked");
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["UNSUPPORTED_CLAIM", "AUTHORIZATION_WORDING_CHANGED"]),
    );
  });
});

describe("external action state seam", () => {
  it("requires a human approval before execution", () => {
    expect(() => transitionExternalAction("pending_approval", "execute")).toThrow(
      "External action must be approved before execution.",
    );
    expect(transitionExternalAction("pending_approval", "approve")).toBe("approved");
    expect(transitionExternalAction("approved", "execute")).toBe("executing");
  });

  it("never coerces an ambiguous provider outcome into success", () => {
    expect(transitionExternalAction("executing", "mark_ambiguous")).toBe("ambiguous");
    expect(() => transitionExternalAction("ambiguous", "mark_succeeded")).toThrow();
  });
});
