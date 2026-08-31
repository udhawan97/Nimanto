import { describe, expect, it } from "vitest";
import { movePacketEvidence, projectPacketComposer } from "../lib/packet-composer.js";

const evidence = [
  {
    id: "e1",
    status: "confirmed",
    value: "TypeScript",
    kind: "skill",
    sourceName: "Resume",
    locator: "1",
  },
  {
    id: "e2",
    status: "confirmed",
    value: "Led migration",
    kind: "project",
    sourceName: "Resume",
    locator: "2",
  },
];

describe("packet composer projection", () => {
  it("keeps Profile order and maps exact Match requirements", () => {
    expect(
      projectPacketComposer({
        application: { jobId: "j1", profileVersionId: "p1" },
        profile: { id: "p1", claimIds: ["e2", "e1"] },
        job: { id: "j1", contentHash: "job-hash" },
        match: {
          id: "m1",
          jobId: "j1",
          profileVersionId: "p1",
          jobContentHash: "job-hash",
          result: {
            requirements: [{ requirement: "TypeScript", state: "supported", evidenceIds: ["e1"] }],
          },
        },
        evidence,
      }),
    ).toMatchObject({
      ready: true,
      matchId: "m1",
      options: [
        { id: "e2", requirements: [] },
        { id: "e1", requirements: ["TypeScript"] },
      ],
    });
  });

  it("fails closed when the current Role no longer matches the publication", () => {
    expect(
      projectPacketComposer({
        application: { jobId: "j1", profileVersionId: "p1" },
        profile: { id: "p1", claimIds: ["e1"] },
        job: { id: "j1", contentHash: "new" },
        match: {
          id: "m1",
          jobId: "j1",
          profileVersionId: "p1",
          jobContentHash: "old",
          result: { requirements: [] },
        },
        evidence,
      }).ready,
    ).toBe(false);
  });

  it("reorders only within the selected evidence list", () => {
    expect(movePacketEvidence(["e1", "e2", "e3"], "e2", -1)).toEqual(["e2", "e1", "e3"]);
    expect(movePacketEvidence(["e1", "e2"], "e1", -1)).toEqual(["e1", "e2"]);
  });
});
