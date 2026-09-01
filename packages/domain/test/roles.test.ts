import { describe, expect, it } from "vitest";
import {
  normalizeRoleObservation,
  normalizeRoleSnapshot,
  roleSnapshotHash,
  type RoleSource,
} from "../src/roles.js";

describe("current role intake normalization", () => {
  it("normalizes one observation into the mutable persistence shape", () => {
    expect(
      normalizeRoleObservation({
        source: "manual",
        sourceRoleId: " role-1 ",
        title: "  Staff Engineer  ",
        company: " Northwind ",
        description: " Build trustworthy systems. ",
        requirements: [" TypeScript ", "", "Evidence design"],
        contentHash: " hash-1 ",
        sourceMeta: { manual: true },
      }),
    ).toMatchObject({
      source: "manual",
      sourceJobId: "role-1",
      title: "Staff Engineer",
      company: "Northwind",
      description: "Build trustworthy systems.",
      location: "",
      workMode: "unknown",
      url: "",
      requirements: ["TypeScript", "Evidence design"],
      roleFamily: "software_technical",
      capability: "deep_link",
      sourceMeta: { manual: true },
      contentHash: "hash-1",
    });
  });

  it("preserves source-owned identity, hash, provenance, and optional fields", () => {
    const provenance = { board: "northwind", observedAt: "2026-08-13T00:00:00.000Z" };
    const role = normalizeRoleObservation({
      source: "greenhouse",
      sourceRoleId: "gh-7",
      title: "Engineer",
      company: "Northwind",
      description: "Description",
      location: "Chicago",
      workMode: "hybrid",
      url: "https://example.test/jobs/7",
      requirements: ["TypeScript"],
      contentHash: "sha256",
      sourceMeta: provenance,
    });
    expect(role.sourceJobId).toBe("gh-7");
    expect(role.contentHash).toBe("sha256");
    expect(role.sourceMeta).toEqual(provenance);
    expect(role).toMatchObject({ location: "Chicago", workMode: "hybrid" });
  });

  it("keeps opaque identity separate from complete decision-content hashing", () => {
    const normalized = (sourceRoleId: string) =>
      normalizeRoleObservation({
        source: "manual",
        sourceRoleId,
        title: "Staff Engineer",
        company: "Northwind",
        description: "Build trustworthy systems.",
        location: "Chicago",
        workMode: "hybrid",
        url: "https://example.test/roles/staff",
        requirements: ["TypeScript"],
        workplaceEvidence: [
          {
            mode: "hybrid",
            method: "posting_text",
            sourceText: "Hybrid in Chicago",
            sourceFieldOrLocator: "posting",
            observedAt: "2026-08-31T12:00:00.000Z",
            normalizerVersion: "workplace_normalizer_v1",
            confidence: "high",
            eligibleRemoteAreas: [],
            physicalLocations: [],
          },
        ],
        contentHash: "source-unavailable",
        sourceMeta: { compensation: { minimum: 150_000, currency: "USD" } },
      });
    const first = normalized("opaque-a");
    const second = normalized("opaque-b");
    const baseline = roleSnapshotHash(first);
    expect(roleSnapshotHash(second)).toBe(baseline);
    expect(roleSnapshotHash({ ...first, location: "New York" })).not.toBe(baseline);
    expect(roleSnapshotHash({ ...first, workMode: "onsite" })).not.toBe(baseline);
    expect(roleSnapshotHash({ ...first, requirements: ["TypeScript", "PostgreSQL"] })).not.toBe(
      baseline,
    );
    expect(roleSnapshotHash({ ...first, sourceMeta: { benefits: ["Medical"] } })).not.toBe(
      baseline,
    );
  });

  it("derives a stable snapshot hash after complete normalization", () => {
    const observation = {
      source: "greenhouse" as const,
      sourceRoleId: "provider-17",
      title: " Platform Engineer ",
      company: " Northwind ",
      description: " Build dependable services. ",
      location: " Chicago ",
      workMode: "hybrid",
      url: " https://example.test/jobs/17 ",
      requirements: [" TypeScript ", ""],
      sourceMeta: { board: "northwind", observedAt: "2026-08-31T12:00:00.000Z" },
      observedAt: "2026-08-31T12:00:00.000Z",
    };
    const first = normalizeRoleSnapshot(observation);
    const second = normalizeRoleSnapshot({
      ...observation,
      observedAt: "2026-09-01T12:00:00.000Z",
      sourceMeta: { ...observation.sourceMeta, observedAt: "2026-09-01T12:00:00.000Z" },
    });
    expect(second.contentHash).toBe(first.contentHash);
    expect(normalizeRoleSnapshot({ ...observation, workMode: "remote" }).contentHash).not.toBe(
      first.contentHash,
    );
    expect(
      normalizeRoleSnapshot({
        ...observation,
        sourcePostedAt: "2026-08-30T12:00:00.000Z",
      }).contentHash,
    ).not.toBe(first.contentHash);
  });

  it.each<RoleSource>([
    "manual",
    "allowlisted_url",
    "greenhouse",
    "lever",
    "ashby",
    "smartrecruiters",
    "licensed_feed",
  ])("accepts the closed %s source variant without changing its identity", (source) => {
    const role = normalizeRoleObservation({
      source,
      sourceRoleId: `${source}-7`,
      title: "Engineer",
      company: "Northwind",
      description: "Build trustworthy systems.",
      contentHash: `${source}-hash`,
      sourceMeta: { source },
    });
    expect(role).toMatchObject({
      source,
      sourceJobId: `${source}-7`,
      contentHash: `${source}-hash`,
    });
  });

  it.each([
    ["ROLE_SOURCE_ID_REQUIRED", { sourceRoleId: "" }],
    ["ROLE_TITLE_REQUIRED", { title: "" }],
    ["ROLE_COMPANY_REQUIRED", { company: "" }],
    ["ROLE_DESCRIPTION_REQUIRED", { description: "" }],
    ["ROLE_SOURCE_HASH_REQUIRED", { contentHash: "" }],
  ])("rejects an invalid observation as %s", (code, override) => {
    expect(() =>
      normalizeRoleObservation({
        source: "lever",
        sourceRoleId: "id",
        title: "Engineer",
        company: "Northwind",
        description: "Description",
        contentHash: "hash",
        sourceMeta: { board: "northwind" },
        ...override,
      }),
    ).toThrow(code);
  });
});
