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

describe("Profile Version rebinding", () => {
  const bound = { id: "aaaaaaaa-1111-4111-8111-111111111111", claimIds: ["e1"] };
  const current = { id: "bbbbbbbb-2222-4222-8222-222222222222", claimIds: ["e1"] };

  it("names both Profile Versions and offers a rebind when the current Profile is newer", () => {
    expect(
      projectPacketComposer({
        application: { jobId: "j1", profileVersionId: bound.id },
        profile: current,
        job: { id: "j1", contentHash: "job-hash" },
        match: null,
        evidence,
      }),
    ).toMatchObject({
      ready: false,
      rebindAvailable: true,
      reason:
        "This Application is bound to Profile Version aaaaaaaa; your current Profile is bbbbbbbb.",
    });
  });

  it("offers a rebind for an Application that was never bound to a Profile Version", () => {
    expect(
      projectPacketComposer({
        application: { jobId: "j1", profileVersionId: null },
        profile: current,
        job: { id: "j1", contentHash: "job-hash" },
        match: null,
        evidence,
      }),
    ).toMatchObject({
      ready: false,
      rebindAvailable: true,
      reason:
        "This Application is not bound to a Profile Version; your current Profile is bbbbbbbb.",
    });
  });

  it("offers no rebind when there is no Profile Version to bind to", () => {
    expect(
      projectPacketComposer({
        application: { jobId: "j1", profileVersionId: null },
        profile: null,
        job: { id: "j1", contentHash: "job-hash" },
        match: null,
        evidence,
      }),
    ).toMatchObject({
      ready: false,
      rebindAvailable: false,
      reason: "Save the Application's exact Profile Version first.",
    });
  });

  it("offers no rebind once the Application is on the current Profile Version", () => {
    expect(
      projectPacketComposer({
        application: { jobId: "j1", profileVersionId: "p1" },
        profile: { id: "p1", claimIds: ["e1"] },
        job: { id: "j1", contentHash: "job-hash" },
        match: {
          id: "m1",
          jobId: "j1",
          profileVersionId: "p1",
          jobContentHash: "job-hash",
          result: { requirements: [] },
        },
        evidence,
      }),
    ).toMatchObject({ ready: true, rebindAvailable: false });
  });
});
