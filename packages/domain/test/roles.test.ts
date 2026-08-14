import { describe, expect, it } from "vitest";
import { normalizeRoleObservation, type RoleSource } from "../src/roles.js";

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
    ).toEqual({
      source: "manual",
      sourceJobId: "role-1",
      title: "Staff Engineer",
      company: "Northwind",
      description: "Build trustworthy systems.",
      location: "",
      workMode: "unspecified",
      url: "",
      requirements: ["TypeScript", "Evidence design"],
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

  it.each<RoleSource>(["manual", "allowlisted_url", "greenhouse", "lever", "ashby"])(
    "accepts the closed %s source variant without changing its identity",
    (source) => {
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
    },
  );

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
