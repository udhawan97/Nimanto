import { describe, expect, it } from "vitest";
import { canonicalHash, createReceipt, verifyReceipt } from "../src/receipts.js";

describe("receipt hashing public seam", () => {
  it("keeps the input hash stable across object key order", () => {
    expect(canonicalHash({ b: 2, a: "é" })).toBe(canonicalHash({ a: "e\u0301", b: 2 }));
  });

  it("creates a unique execution receipt that still links stable input and artifact hashes", () => {
    const first = createReceipt({
      id: "receipt-1",
      type: "match.published",
      occurredAt: "2026-08-05T12:00:00.000Z",
      input: { profile: "v1", job: "job-1" },
      artifact: { band: "strong_evidence" },
    });
    const second = createReceipt({
      id: "receipt-2",
      type: "match.published",
      occurredAt: "2026-08-05T12:00:01.000Z",
      input: { job: "job-1", profile: "v1" },
      artifact: { band: "strong_evidence" },
    });

    expect(first.inputHash).toBe(second.inputHash);
    expect(first.artifactHash).toBe(second.artifactHash);
    expect(first.receiptHash).not.toBe(second.receiptHash);
    expect(verifyReceipt(first)).toBe(true);
    expect(verifyReceipt({ ...first, artifactHash: "tampered" })).toBe(false);
  });
});
