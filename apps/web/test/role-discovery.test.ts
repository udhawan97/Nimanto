import { describe, expect, it } from "vitest";
import {
  emptyRoleDiscoveryFilters,
  projectRoleDiscovery,
  type RoleDiscoveryFilters,
} from "../lib/role-discovery.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1_000).toISOString();

type TestArea = {
  displayLabel?: string;
  countryCode?: string | null;
  subdivisionCode?: string | null;
  metroId?: string | null;
  timeZone?: string | null;
  resolution?: string;
};

type TestRole = {
  id: string;
  source: string;
  title: string;
  company: string;
  description: string;
  requirements: string[];
  location: string;
  workMode: string;
  roleFamily: string;
  cluster: { id: string };
  availability: {
    publicationState: string;
    verificationHealth: string;
    lastSeenAt: string;
  };
  candidateDisposition: { state: "active" | "archived" };
  workplaceEvidence?: Array<{
    eligibleRemoteAreas?: TestArea[];
    physicalLocations?: TestArea[];
  }>;
  sourceMeta?: {
    compensation?: {
      minimum?: number | null;
      maximum?: number | null;
      currency?: string;
    } | null;
  };
};

function role(overrides: Partial<TestRole> = {}): TestRole {
  return {
    id: "platform",
    source: "greenhouse",
    title: "Platform Engineer",
    company: "Northwind",
    description: "Build resilient TypeScript services",
    requirements: ["TypeScript", "PostgreSQL"],
    location: "Chicago",
    workMode: "hybrid",
    roleFamily: "software_technical",
    cluster: { id: "platform-cluster" },
    availability: {
      publicationState: "active",
      verificationHealth: "verified",
      lastSeenAt: daysAgo(1),
      ...overrides.availability,
    },
    candidateDisposition: { state: "active", ...overrides.candidateDisposition },
    ...overrides,
  };
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    roleFamilies: [] as string[],
    includeTitles: [] as string[],
    excludeTitles: [] as string[],
    seniorityLevels: [] as string[],
    industries: [] as string[],
    mustHaveSkills: [] as string[],
    preferredSkills: [] as string[],
    acceptedPhysicalAreas: [] as TestArea[],
    commuteRadiusMiles: null,
    relocationPreference: "consider" as const,
    workModes: [] as string[],
    eligibleRemoteAreas: [] as TestArea[],
    minimumCompensation: null as { amount: number; currency: string } | null,
    authorizationStatementVersionId: null as string | null,
    authorizationStatementExpiresAt: null as string | null,
    freshnessMaximumHours: 7 * 24,
    sourceIds: [] as string[],
    ...overrides,
  };
}

function project(input: {
  roles: TestRole[];
  matches?: Array<{
    id: string;
    jobId: string;
    result: { band: string; blockers: unknown[] };
  }>;
  applications?: Array<{ jobId?: string }>;
  profile?: ReturnType<typeof profile> | null;
  filters?: RoleDiscoveryFilters;
  effectiveQuery?: string;
  comparisonRoleIds?: string[];
}) {
  const filters = input.filters ?? emptyRoleDiscoveryFilters();
  return projectRoleDiscovery({
    roles: input.roles,
    matches: input.matches ?? [],
    applications: input.applications ?? [],
    profile: input.profile ?? null,
    filters,
    effectiveQuery: input.effectiveQuery ?? filters.query,
    comparisonRoleIds: input.comparisonRoleIds ?? [],
    evaluatedAt: NOW,
  });
}

function projectedRoleIds(projection: ReturnType<typeof project>): string[] {
  return projection.groups.flatMap((group) => group.members.map((member) => member.id));
}

describe("Role discovery projection", () => {
  it("owns joins, render-ready groups, ordering, comparison, counts, and input immutability", () => {
    const roles = [
      role({
        id: "older-verified",
        availability: {
          publicationState: "active",
          verificationHealth: "verified",
          lastSeenAt: daysAgo(3),
        },
      }),
      role({
        id: "newer-unverified",
        source: "lever",
        availability: {
          publicationState: "active",
          verificationHealth: "unknown",
          lastSeenAt: daysAgo(1),
        },
      }),
      role({
        id: "data",
        title: "Data Analyst",
        company: "Contoso",
        source: "manual",
        roleFamily: "data_analytics",
        cluster: { id: "data-cluster" },
      }),
    ];
    const before = structuredClone(roles);

    const projection = project({
      roles,
      matches: [
        {
          id: "old",
          jobId: "older-verified",
          result: { band: "partial_evidence", blockers: [{}] },
        },
        {
          id: "current",
          jobId: "older-verified",
          result: { band: "strong_evidence", blockers: [] },
        },
      ],
      applications: [{ jobId: "newer-unverified" }],
      filters: { ...emptyRoleDiscoveryFilters(), discovery: "all" },
      comparisonRoleIds: ["newer-unverified", "missing", "older-verified"],
    });

    expect(
      projection.groups.map(({ representative, members, assessment }) => ({
        representative: representative.id,
        members: members.map((member) => ({
          id: member.id,
          match: member.match?.id,
          tracked: member.tracked,
        })),
        assessment,
      })),
    ).toEqual([
      {
        representative: "older-verified",
        members: [
          { id: "older-verified", match: "current", tracked: false },
          { id: "newer-unverified", match: undefined, tracked: true },
        ],
        assessment: { included: true, reasons: [] },
      },
      {
        representative: "data",
        members: [{ id: "data", match: undefined, tracked: false }],
        assessment: { included: true, reasons: [] },
      },
    ]);
    expect(projection.comparisonRoles.map((item) => item.id)).toEqual([
      "newer-unverified",
      "older-verified",
    ]);
    expect(projection.sourceOptions).toEqual(["greenhouse", "lever", "manual"]);
    expect(projection.counts).toEqual({
      totalRoles: 3,
      visibleRoles: 3,
      explanationGroups: 2,
    });
    expect(roles).toEqual(before);
  });

  it("applies every candidate-visible filter through the single interface", () => {
    const target = role({
      id: "target",
      candidateDisposition: { state: "archived" },
    });
    const projection = project({
      roles: [
        target,
        role({ id: "wrong-source", source: "lever" }),
        role({
          id: "wrong-publication",
          availability: {
            publicationState: "possibly_closed",
            verificationHealth: "unknown",
            lastSeenAt: daysAgo(1),
          },
        }),
      ],
      matches: [
        {
          id: "target-match",
          jobId: "target",
          result: { band: "strong_evidence", blockers: [] },
        },
      ],
      applications: [{ jobId: "target" }],
      filters: {
        query: "platform",
        source: "greenhouse",
        fit: "strong_evidence",
        tracking: "tracked",
        visibility: "archived",
        workMode: "hybrid",
        roleFamily: "software_technical",
        publication: "current",
        verification: "verified",
        discovery: "all",
      },
    });

    expect(projectedRoleIds(projection)).toEqual(["target"]);
    expect(projection.filtersActive).toBe(true);
  });

  it("independently discriminates every filter axis and its grouped contract values", () => {
    const cases: Array<{
      name: string;
      roles: TestRole[];
      filters: Partial<RoleDiscoveryFilters>;
      matches?: Array<{
        id: string;
        jobId: string;
        result: { band: string; blockers: unknown[] };
      }>;
      applications?: Array<{ jobId?: string }>;
      expected: string[];
    }> = [
      {
        name: "query",
        roles: [
          role({ id: "matching" }),
          role({
            id: "other",
            title: "Product Designer",
            company: "Contoso",
            description: "Create accessible interfaces",
            requirements: ["Figma"],
            location: "Austin",
          }),
        ],
        filters: { query: "platform" },
        expected: ["matching"],
      },
      {
        name: "source",
        roles: [role({ id: "matching" }), role({ id: "other", source: "lever" })],
        filters: { source: "greenhouse" },
        expected: ["matching"],
      },
      {
        name: "blocked fit",
        roles: [role({ id: "matching" }), role({ id: "other" })],
        filters: { fit: "blocked" },
        matches: [
          {
            id: "blocked",
            jobId: "matching",
            result: { band: "partial_evidence", blockers: [{}] },
          },
          {
            id: "clear",
            jobId: "other",
            result: { band: "partial_evidence", blockers: [] },
          },
        ],
        expected: ["matching"],
      },
      {
        name: "unmatched fit",
        roles: [role({ id: "matching" }), role({ id: "other" })],
        filters: { fit: "unmatched" },
        matches: [
          {
            id: "matched",
            jobId: "other",
            result: { band: "strong_evidence", blockers: [] },
          },
        ],
        expected: ["matching"],
      },
      {
        name: "tracking",
        roles: [role({ id: "matching" }), role({ id: "other" })],
        filters: { tracking: "tracked" },
        applications: [{ jobId: "matching" }],
        expected: ["matching"],
      },
      {
        name: "visibility",
        roles: [
          role({ id: "matching", candidateDisposition: { state: "archived" } }),
          role({ id: "other" }),
        ],
        filters: { visibility: "archived" },
        expected: ["matching"],
      },
      {
        name: "non-remote work mode",
        roles: [
          role({ id: "hybrid", workMode: "hybrid" }),
          role({ id: "onsite", workMode: "onsite", cluster: { id: "onsite" } }),
          role({ id: "remote", workMode: "remote", cluster: { id: "remote" } }),
        ],
        filters: { workMode: "non_remote" },
        expected: ["hybrid", "onsite"],
      },
      {
        name: "role family",
        roles: [role({ id: "matching" }), role({ id: "other", roleFamily: "data_analytics" })],
        filters: { roleFamily: "software_technical" },
        expected: ["matching"],
      },
      {
        name: "closed publication family",
        roles: [
          role({
            id: "closed",
            availability: {
              publicationState: "closed",
              verificationHealth: "verified",
              lastSeenAt: daysAgo(1),
            },
          }),
          role({
            id: "expired",
            cluster: { id: "expired" },
            availability: {
              publicationState: "expired",
              verificationHealth: "verified",
              lastSeenAt: daysAgo(1),
            },
          }),
          role({ id: "active", cluster: { id: "active" } }),
        ],
        filters: { publication: "closed" },
        expected: ["closed", "expired"],
      },
      {
        name: "verified publication health",
        roles: [
          role({ id: "verified" }),
          role({
            id: "provider-reported",
            cluster: { id: "provider-reported" },
            availability: {
              publicationState: "active",
              verificationHealth: "provider_reported",
              lastSeenAt: daysAgo(1),
            },
          }),
          role({
            id: "unknown",
            cluster: { id: "unknown" },
            availability: {
              publicationState: "active",
              verificationHealth: "unknown",
              lastSeenAt: daysAgo(1),
            },
          }),
        ],
        filters: { verification: "verified" },
        expected: ["verified", "provider-reported"],
      },
      {
        name: "verification review queue",
        roles: [
          role({ id: "verified" }),
          role({
            id: "unknown",
            cluster: { id: "unknown" },
            availability: {
              publicationState: "active",
              verificationHealth: "unknown",
              lastSeenAt: daysAgo(1),
            },
          }),
        ],
        filters: { verification: "needs_review" },
        expected: ["unknown"],
      },
    ];

    for (const testCase of cases) {
      const projection = project({
        roles: testCase.roles,
        ...(testCase.matches ? { matches: testCase.matches } : {}),
        ...(testCase.applications ? { applications: testCase.applications } : {}),
        filters: {
          ...emptyRoleDiscoveryFilters(),
          discovery: "all",
          ...testCase.filters,
        },
      });
      expect(projectedRoleIds(projection), testCase.name).toEqual(testCase.expected);
    }
  });

  it("uses immediate filters for feedback while the effective query may be deferred", () => {
    const projection = project({
      roles: [role()],
      filters: { ...emptyRoleDiscoveryFilters(), query: "not-yet-applied" },
      effectiveQuery: "",
    });

    expect(projection.counts.visibleRoles).toBe(1);
    expect(projection.filtersActive).toBe(true);
    expect(
      project({
        roles: [role()],
        filters: { ...emptyRoleDiscoveryFilters(), query: "not-yet-applied" },
        effectiveQuery: "not-yet-applied",
      }).counts.visibleRoles,
    ).toBe(0);
  });

  it("falls back to freshness when variants have the same verification state", () => {
    const projection = project({
      roles: [
        role({
          id: "older",
          availability: {
            publicationState: "active",
            verificationHealth: "verified",
            lastSeenAt: daysAgo(4),
          },
        }),
        role({
          id: "newer",
          source: "lever",
          availability: {
            publicationState: "active",
            verificationHealth: "verified",
            lastSeenAt: daysAgo(1),
          },
        }),
      ],
      filters: { ...emptyRoleDiscoveryFilters(), discovery: "all" },
    });

    expect(projection.groups).toHaveLength(1);
    expect(projection.groups[0]?.representative.id).toBe("newer");
    expect(projection.groups[0]?.members.map((member) => member.id)).toEqual(["newer", "older"]);
  });

  it("returns one assessment with each rendered group and separates different ledgers", () => {
    const discoveryProfile = profile({
      roleFamilies: ["software_technical"],
      includeTitles: ["Platform Engineer"],
      mustHaveSkills: ["TypeScript"],
      preferredSkills: ["Rust"],
      workModes: ["hybrid"],
      sourceIds: ["greenhouse"],
    });
    const projection = project({
      roles: [role(), role({ id: "lever", source: "lever" })],
      profile: discoveryProfile,
      filters: { ...emptyRoleDiscoveryFilters(), discovery: "all" },
    });

    expect(projection.groups).toHaveLength(2);
    expect(projection.groups.map((group) => group.assessment.included)).toEqual([true, false]);
    expect(projection.groups[0]?.assessment.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "must_have_skill", state: "matched" }),
        expect.objectContaining({ code: "preferred_skill", state: "unresolved" }),
      ]),
    );
    expect(projection.groups[1]?.assessment.reasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "source", state: "excluded" })]),
    );
  });

  it("keeps literal matching, compensation, and authorization uncertainty fail-closed", () => {
    const discoveryProfile = profile({
      includeTitles: ["AI"],
      mustHaveSkills: ["Go"],
      minimumCompensation: { amount: 150_000, currency: "USD" },
      authorizationStatementExpiresAt: "2027-01-01T00:00:00.000Z",
    });
    const projection = project({
      roles: [
        role({
          title: "Chair of Operations",
          company: "Google",
          description: "Build paid governance systems",
          requirements: [],
          sourceMeta: {
            compensation: { minimum: 90_000, maximum: 120_000, currency: "USD" },
          },
        }),
      ],
      profile: discoveryProfile,
      filters: { ...emptyRoleDiscoveryFilters(), discovery: "all" },
    });
    const assessment = projection.groups[0]!.assessment;

    expect(assessment.included).toBe(false);
    expect(assessment.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "include_title", state: "excluded" }),
        expect.objectContaining({ code: "must_have_skill", state: "excluded" }),
        expect.objectContaining({ code: "minimum_compensation", state: "excluded" }),
        expect.objectContaining({ code: "authorization_expiry", state: "unresolved" }),
      ]),
    );
  });

  it("keeps physical and remote canonical geography separate without inferring ambiguity", () => {
    const chicago = {
      displayLabel: "Chicago, IL",
      countryCode: "US",
      subdivisionCode: "US-IL",
      metroId: "chi",
      timeZone: "America/Chicago",
      resolution: "confirmed",
    };
    const unitedStates = {
      displayLabel: "United States",
      countryCode: "US",
      subdivisionCode: null,
      metroId: null,
      timeZone: null,
      resolution: "confirmed",
    };
    const discoveryProfile = profile({
      acceptedPhysicalAreas: [chicago],
      eligibleRemoteAreas: [unitedStates],
    });
    const projection = project({
      roles: [
        role({
          id: "onsite",
          workMode: "onsite",
          workplaceEvidence: [
            {
              physicalLocations: [
                {
                  displayLabel: "New York, NY",
                  countryCode: "US",
                  subdivisionCode: "US-NY",
                  metroId: "nyc",
                  timeZone: "America/New_York",
                  resolution: "confirmed",
                },
              ],
            },
          ],
        }),
        role({
          id: "remote",
          source: "lever",
          workMode: "remote",
          workplaceEvidence: [{ eligibleRemoteAreas: [{ ...unitedStates, displayLabel: "US" }] }],
        }),
        role({
          id: "ambiguous",
          source: "manual",
          workMode: "unknown",
          workplaceEvidence: [],
        }),
      ],
      profile: discoveryProfile,
      filters: { ...emptyRoleDiscoveryFilters(), discovery: "all" },
    });
    const assessments = new Map(
      projection.groups.map((group) => [group.representative.id, group.assessment]),
    );

    expect(assessments.get("onsite")).toMatchObject({
      included: false,
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: "area", state: "excluded" }),
      ]),
    });
    expect(assessments.get("remote")).toMatchObject({
      included: true,
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: "area", state: "matched" }),
      ]),
    });
    expect(assessments.get("ambiguous")).toMatchObject({
      included: true,
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: "area", state: "unresolved" }),
      ]),
    });
  });

  it("keeps recommendation membership, counts, and bounded suggestions on one snapshot", () => {
    const discoveryProfile = profile({
      roleFamilies: ["software_technical"],
      includeTitles: ["Platform Engineer", "ML Engineer"],
      mustHaveSkills: ["TypeScript"],
      preferredSkills: ["PostgreSQL", "Rust"],
      acceptedPhysicalAreas: [{ displayLabel: "Chicago", countryCode: "US" }],
      eligibleRemoteAreas: [{ displayLabel: "United States", countryCode: "US" }],
      workModes: ["hybrid"],
      sourceIds: ["greenhouse"],
    });
    const recommended = project({
      roles: [
        role(),
        role({
          id: "data",
          title: "Data Analyst",
          roleFamily: "data_analytics",
          source: "manual",
          cluster: { id: "data" },
        }),
      ],
      profile: discoveryProfile,
    });

    expect(projectedRoleIds(recommended)).toEqual(["platform"]);
    expect(recommended.counts).toEqual({
      totalRoles: 2,
      visibleRoles: 1,
      explanationGroups: 1,
    });
    expect(recommended.suggestedQueries).toEqual([
      "Platform Engineer",
      "ML Engineer",
      "TypeScript",
      "PostgreSQL",
      "Rust",
      "Chicago",
    ]);
    expect(recommended.filtersActive).toBe(false);
  });
});
