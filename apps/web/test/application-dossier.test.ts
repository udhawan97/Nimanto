import { describe, expect, it } from "vitest";
import { projectApplicationDossier } from "../lib/application-dossier.js";

describe("application dossier projection", () => {
  it("joins only records owned by one Application without inventing state", () => {
    const dossier = projectApplicationDossier({
      application: {
        id: "a1",
        jobId: "j1",
        profileVersionId: "profile-current",
        submissions: [
          {
            id: "s1",
            packetId: null,
            materialsCaptured: false,
            artifactFormats: [],
            channel: "other",
            destination: "Portal",
            submittedAt: "2026-08-30T10:00:00.000Z",
            packetArtifactHash: null,
          },
        ],
      },
      jobs: [{ id: "j1", title: "Engineer", contentHash: "role-current" }],
      matches: [
        {
          id: "m1",
          jobId: "j1",
          profileVersionId: "profile-current",
          jobContentHash: "role-current",
        },
      ],
      packets: [
        { id: "p1", applicationId: "a1" },
        { id: "p2", applicationId: "a2" },
      ],
      actionPackets: [{ id: "p0", applicationId: "a1" }],
      actions: [
        { id: "x1", packetId: "p0" },
        { id: "x2", packetId: "p2" },
      ],
      receipts: [
        { id: "r1", material: { applicationId: "a1" } },
        { id: "r2", material: { applicationId: "a2" } },
      ],
      careerOperations: {
        activities: [{ applicationId: "a1" }, { applicationId: "a2" }],
        contacts: [{ applicationLinks: [{ applicationId: "a1" }] }],
        interviews: [{ applicationId: "a1" }],
        offers: [{ applicationId: "a2" }],
      },
    });
    expect(dossier.packets.map((packet) => packet.id)).toEqual(["p1", "p0"]);
    expect(dossier.actions).toEqual([{ id: "x1", packetId: "p0" }]);
    expect(dossier.activities).toHaveLength(1);
    expect(dossier.receipts).toEqual([{ id: "r1", material: { applicationId: "a1" } }]);
    expect(dossier.offers).toHaveLength(0);
    expect(dossier.submissions[0]?.id).toBe("s1");
    expect(dossier.match?.id).toBe("m1");
    expect(dossier.matchHistory).toEqual([]);
  });

  it("never promotes a stale Match and keeps it as labeled immutable history", () => {
    const dossier = projectApplicationDossier({
      application: {
        id: "a1",
        jobId: "j1",
        profileVersionId: "profile-current",
      },
      jobs: [{ id: "j1", contentHash: "role-current" }],
      matches: [
        {
          id: "old-role",
          jobId: "j1",
          profileVersionId: "profile-current",
          jobContentHash: "role-old",
        },
        {
          id: "old-profile",
          jobId: "j1",
          profileVersionId: "profile-old",
          jobContentHash: "role-current",
        },
      ],
      packets: [],
      actionPackets: [],
      actions: [],
      receipts: [],
      careerOperations: { activities: [], contacts: [], interviews: [], offers: [] },
    });

    expect(dossier.match).toBeNull();
    expect(dossier.matchHistory.map((match) => match.id)).toEqual(["old-role", "old-profile"]);
  });
});
