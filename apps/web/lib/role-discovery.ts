type StructuredAreaLike = {
  displayLabel?: unknown;
  countryCode?: unknown;
  subdivisionCode?: unknown;
  metroId?: unknown;
  timeZone?: unknown;
  resolution?: unknown;
};

type RoleLike = {
  source: string;
  title: string;
  company: string;
  description?: string;
  requirements?: readonly string[];
  location?: string;
  workMode?: string;
  roleFamily?: string;
  workplaceEvidence?: Array<{
    eligibleRemoteAreas?: StructuredAreaLike[];
    physicalLocations?: StructuredAreaLike[];
  }>;
  availability?: {
    publicationState: string;
    verificationHealth: string;
    lastSeenAt?: string;
  };
  tracked: boolean;
  candidateDisposition?: { state: "active" | "archived" };
  match: { result: { band: string; blockers: readonly unknown[] } } | null;
  sourceMeta?: {
    compensation?: {
      minimum?: number | null;
      maximum?: number | null;
      currency?: string;
    } | null;
  };
};

type DiscoveryProfileLike = {
  roleFamilies: readonly string[];
  includeTitles: readonly string[];
  excludeTitles: readonly string[];
  seniorityLevels?: readonly string[];
  industries?: readonly string[];
  mustHaveSkills?: readonly string[];
  preferredSkills?: readonly string[];
  acceptedPhysicalAreas: readonly StructuredAreaLike[];
  commuteRadiusMiles?: number | null;
  relocationPreference?: "no" | "consider" | "yes";
  workModes: readonly string[];
  eligibleRemoteAreas: readonly StructuredAreaLike[];
  minimumCompensation?: Readonly<{ amount: number; currency: string }> | null;
  authorizationStatementVersionId?: string | null;
  authorizationStatementExpiresAt?: string | null;
  freshnessMaximumHours: number;
  sourceIds: readonly string[];
};

export type DiscoveryProfileReason = Readonly<{
  code:
    | "role_family"
    | "include_title"
    | "exclude_title"
    | "seniority"
    | "industry"
    | "must_have_skill"
    | "preferred_skill"
    | "area"
    | "commute_radius"
    | "relocation"
    | "work_mode"
    | "minimum_compensation"
    | "freshness"
    | "source"
    | "authorization_expiry";
  state: "matched" | "excluded" | "unresolved";
  detail: string;
}>;

export type DiscoveryProfileAssessment = Readonly<{
  included: boolean;
  reasons: readonly DiscoveryProfileReason[];
}>;

export type RoleFilters = {
  query: string;
  source: string;
  fit: string;
  tracking: "all" | "tracked" | "untracked";
  visibility?: "active" | "archived" | "all";
  workMode?: string;
  roleFamily?: string;
  publication?: "current" | "possibly_closed" | "closed" | "all";
  verification?: "all" | "verified" | "needs_review";
};

export type RoleDiscoveryFilters = RoleFilters & {
  visibility: "active" | "archived" | "all";
  workMode: string;
  roleFamily: string;
  publication: "current" | "possibly_closed" | "closed" | "all";
  verification: "all" | "verified" | "needs_review";
  discovery: "recommended" | "excluded" | "all";
};

export function emptyRoleDiscoveryFilters(): RoleDiscoveryFilters {
  return {
    query: "",
    source: "all",
    fit: "all",
    tracking: "all",
    visibility: "active",
    workMode: "all",
    roleFamily: "all",
    publication: "current",
    verification: "all",
    discovery: "recommended",
  };
}

function roleDiscoveryFiltersAreActive(filters: RoleDiscoveryFilters): boolean {
  return Boolean(
    filters.query ||
    filters.source !== "all" ||
    filters.fit !== "all" ||
    filters.tracking !== "all" ||
    filters.visibility !== "active" ||
    filters.workMode !== "all" ||
    filters.roleFamily !== "all" ||
    filters.publication !== "current" ||
    filters.verification !== "all" ||
    filters.discovery !== "recommended",
  );
}

/* These filters are intentionally pure and ephemeral. The workbench owns the
 * input state for the life of the open section; no query, source, or shortlist
 * preference is written to the API or local storage. */
function filterRoles<T extends RoleLike>(roles: readonly T[], filters: RoleFilters): T[] {
  const query = filters.query.trim().toLocaleLowerCase("en-US");
  return roles.filter((role) => {
    if (
      query &&
      ![
        role.title,
        role.company,
        role.location ?? "",
        role.description ?? "",
        ...(role.requirements ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("en-US")
        .includes(query)
    )
      return false;
    if (filters.source !== "all" && role.source !== filters.source) return false;
    if (filters.workMode && filters.workMode !== "all") {
      if (filters.workMode === "non_remote") {
        if (role.workMode !== "hybrid" && role.workMode !== "onsite") return false;
      } else if (role.workMode !== filters.workMode) return false;
    }
    if (
      filters.roleFamily &&
      filters.roleFamily !== "all" &&
      role.roleFamily !== filters.roleFamily
    ) {
      return false;
    }
    const publication = filters.publication ?? "current";
    const publicationState = role.availability?.publicationState ?? "active";
    if (publication === "current" && publicationState !== "active") return false;
    if (publication === "possibly_closed" && publicationState !== "possibly_closed") return false;
    if (publication === "closed" && !["closed", "expired"].includes(publicationState)) return false;
    const verification = filters.verification ?? "all";
    const health = role.availability?.verificationHealth ?? "unknown";
    if (verification === "verified" && !["verified", "provider_reported"].includes(health)) {
      return false;
    }
    if (verification === "needs_review" && ["verified", "provider_reported"].includes(health)) {
      return false;
    }
    if (filters.tracking === "tracked" && !role.tracked) return false;
    if (filters.tracking === "untracked" && role.tracked) return false;
    const archived = role.candidateDisposition?.state === "archived";
    const visibility = filters.visibility ?? "active";
    if (visibility === "active" && archived) return false;
    if (visibility === "archived" && !archived) return false;
    if (filters.fit === "all") return true;
    if (filters.fit === "unmatched") return role.match === null;
    if (filters.fit === "blocked") return Boolean(role.match?.result.blockers.length);
    return role.match?.result.band === filters.fit;
  });
}

function discoveryText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

function discoveryTerms(values: readonly string[] | undefined): string[] {
  return (values ?? []).map(discoveryText).filter(Boolean);
}

function literalPhraseMatch(corpus: string, term: string): boolean {
  if (!term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}\\p{M}\\p{Pc}])${escaped}(?=$|[^\\p{L}\\p{N}\\p{M}\\p{Pc}])`,
    "iu",
  ).test(corpus);
}

function areaValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? discoveryText(value) : null;
}

function confirmedArea(area: StructuredAreaLike): boolean {
  return area.resolution === "confirmed";
}

function countryLevelArea(area: StructuredAreaLike): boolean {
  const countryCode = areaValue(area.countryCode)?.toUpperCase();
  const label = areaValue(area.displayLabel);
  if (!countryCode || !label) return false;
  if (areaValue(area.metroId) || areaValue(area.subdivisionCode) || areaValue(area.timeZone)) {
    return false;
  }
  if (label === discoveryText(countryCode)) return true;
  try {
    const displayName = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode);
    if (displayName && label === discoveryText(displayName)) return true;
  } catch {
    return false;
  }
  return countryCode === "US" && ["usa", "u.s.", "u.s.a."].includes(label);
}

function compareCanonicalAreas(
  candidate: StructuredAreaLike,
  observed: StructuredAreaLike,
): boolean | null {
  if (!confirmedArea(candidate) || !confirmedArea(observed)) return null;
  const fields = ["countryCode", "subdivisionCode", "metroId", "timeZone"] as const;
  const expected = fields.flatMap((field) => {
    const value = areaValue(candidate[field]);
    return value ? [{ field, value }] : [];
  });
  if (expected.length === 0) return null;
  if (
    expected.length === 1 &&
    expected[0]?.field === "countryCode" &&
    !countryLevelArea(candidate)
  ) {
    return null;
  }
  let incomplete = false;
  for (const identity of expected) {
    const actual = areaValue(observed[identity.field]);
    if (!actual) incomplete = true;
    else if (actual !== identity.value) return false;
  }
  return incomplete ? null : true;
}

/** Explain one role against only the candidate-approved discovery inputs. The
 * literal posting corpus is deterministic; unknown compensation, distance, or
 * authorization state stays visible and explicitly unresolved. */
function assessDiscoveryProfile(
  role: RoleLike,
  profile: DiscoveryProfileLike | null,
  now: Date,
): DiscoveryProfileAssessment {
  if (!profile) return { included: true, reasons: [] };
  const reasons: DiscoveryProfileReason[] = [];
  const add = (
    code: DiscoveryProfileReason["code"],
    state: DiscoveryProfileReason["state"],
    detail: string,
  ) => reasons.push({ code, state, detail });
  const postingText = discoveryText(
    [role.title, role.description ?? "", ...(role.requirements ?? [])].join(" "),
  );
  const industryText = discoveryText(`${role.company} ${postingText}`);
  const title = discoveryText(role.title);
  const matchAny = (corpus: string, terms: readonly string[]) =>
    terms.some((term) => literalPhraseMatch(corpus, term));

  if (profile.roleFamilies.length > 0) {
    const matched = profile.roleFamilies.includes(role.roleFamily ?? "");
    add("role_family", matched ? "matched" : "excluded", role.roleFamily ?? "unknown");
  }
  const includeTitles = discoveryTerms(profile.includeTitles);
  if (includeTitles.length > 0) {
    const matched = matchAny(title, includeTitles);
    add("include_title", matched ? "matched" : "excluded", matched ? role.title : "No title match");
  }
  const excludeTitles = discoveryTerms(profile.excludeTitles);
  const excludedTitle = excludeTitles.find((value) => literalPhraseMatch(title, value));
  if (excludedTitle) add("exclude_title", "excluded", excludedTitle);

  const seniority = discoveryTerms(profile.seniorityLevels);
  if (seniority.length > 0) {
    const matched = matchAny(postingText, seniority);
    add(
      "seniority",
      matched ? "matched" : "excluded",
      matched ? "Literal posting match" : "No literal posting match",
    );
  }
  const industries = discoveryTerms(profile.industries);
  if (industries.length > 0) {
    const matched = matchAny(industryText, industries);
    add(
      "industry",
      matched ? "matched" : "excluded",
      matched ? "Literal posting match" : "No literal posting match",
    );
  }
  const mustHaveSkills = discoveryTerms(profile.mustHaveSkills);
  if (mustHaveSkills.length > 0) {
    const missing = mustHaveSkills.filter((skill) => !literalPhraseMatch(postingText, skill));
    add(
      "must_have_skill",
      missing.length === 0 ? "matched" : "excluded",
      missing.length === 0 ? "All literal skill terms found" : `Missing: ${missing.join(", ")}`,
    );
  }
  const preferredSkills = discoveryTerms(profile.preferredSkills);
  if (preferredSkills.length > 0) {
    const found = preferredSkills.filter((skill) => literalPhraseMatch(postingText, skill));
    add(
      "preferred_skill",
      found.length > 0 ? "matched" : "unresolved",
      found.length > 0 ? `Found: ${found.join(", ")}` : "No literal preferred-skill match",
    );
  }

  if (profile.workModes.length > 0) {
    const matched = profile.workModes.includes(role.workMode ?? "unknown");
    add("work_mode", matched ? "matched" : "excluded", role.workMode ?? "unknown");
  }
  if (profile.sourceIds.length > 0) {
    const matched = profile.sourceIds.includes(role.source);
    add("source", matched ? "matched" : "excluded", role.source);
  }

  const cutoff = now.getTime() - profile.freshnessMaximumHours * 60 * 60 * 1000;
  const observedAt = role.availability?.lastSeenAt;
  if (observedAt) {
    const observedTime = Date.parse(observedAt);
    const state = Number.isNaN(observedTime)
      ? "unresolved"
      : observedTime < cutoff
        ? "excluded"
        : "matched";
    add("freshness", state, observedAt);
  } else {
    add("freshness", "unresolved", "No observation time");
  }

  const workplaceMode = role.workMode ?? "unknown";
  const candidateAreas =
    workplaceMode === "remote"
      ? profile.eligibleRemoteAreas
      : workplaceMode === "onsite" || workplaceMode === "hybrid"
        ? profile.acceptedPhysicalAreas
        : [...profile.acceptedPhysicalAreas, ...profile.eligibleRemoteAreas];
  if (candidateAreas.length > 0) {
    if (workplaceMode === "unknown" || workplaceMode === "conflicting") {
      add("area", "unresolved", "Workplace mode is not established");
    } else {
      const observedAreas = (role.workplaceEvidence ?? []).flatMap((evidence) =>
        workplaceMode === "remote"
          ? (evidence.eligibleRemoteAreas ?? [])
          : (evidence.physicalLocations ?? []),
      );
      const comparisons = candidateAreas.flatMap((candidate) =>
        observedAreas.map((observed) => compareCanonicalAreas(candidate, observed)),
      );
      if (comparisons.includes(true)) {
        add("area", "matched", role.location || "Canonical area match");
      } else if (
        comparisons.length === 0 ||
        comparisons.includes(null) ||
        candidateAreas.some((area) => !confirmedArea(area)) ||
        observedAreas.some((area) => !confirmedArea(area))
      ) {
        add("area", "unresolved", "Canonical area evidence is incomplete or ambiguous");
      } else {
        add("area", "excluded", "Confirmed canonical areas do not match");
      }
    }
  }

  if (profile.commuteRadiusMiles !== null && profile.commuteRadiusMiles !== undefined) {
    add("commute_radius", "unresolved", "No confirmed role coordinates");
  }
  if (profile.relocationPreference && profile.relocationPreference !== "consider") {
    add("relocation", "unresolved", "Recorded for candidate review; no relocation inference");
  }

  if (profile.minimumCompensation) {
    const posted = role.sourceMeta?.compensation;
    const currency = posted?.currency?.toUpperCase();
    const floorCurrency = profile.minimumCompensation.currency.toUpperCase();
    if (!posted || !currency) {
      add("minimum_compensation", "unresolved", "Posting compensation not established");
    } else if (currency !== floorCurrency) {
      add(
        "minimum_compensation",
        "unresolved",
        `${currency} cannot be compared with ${floorCurrency}`,
      );
    } else if (
      posted.maximum !== null &&
      posted.maximum !== undefined &&
      posted.maximum < profile.minimumCompensation.amount
    ) {
      add("minimum_compensation", "excluded", `Posted maximum ${posted.maximum} ${currency}`);
    } else if (
      posted.minimum !== null &&
      posted.minimum !== undefined &&
      posted.minimum >= profile.minimumCompensation.amount
    ) {
      add("minimum_compensation", "matched", `Posted minimum ${posted.minimum} ${currency}`);
    } else {
      add("minimum_compensation", "unresolved", "Posted range crosses or omits the approved floor");
    }
  }

  if (profile.authorizationStatementExpiresAt) {
    const expiry = Date.parse(profile.authorizationStatementExpiresAt);
    add(
      "authorization_expiry",
      !profile.authorizationStatementVersionId || Number.isNaN(expiry) || expiry <= now.getTime()
        ? "unresolved"
        : "matched",
      !profile.authorizationStatementVersionId
        ? "No linked authorization statement"
        : Number.isNaN(expiry)
          ? "Expiry is invalid"
          : profile.authorizationStatementExpiresAt,
    );
  }

  return {
    included: !reasons.some((reason) => reason.state === "excluded"),
    reasons,
  };
}

/** Apply only the candidate-approved discovery inputs. Resume evidence enters
 * matching through its saved profile version; it is never silently converted
 * into search preferences here. */
function groupRolesByDiscoveryAssessment<
  T extends Readonly<{ id: string; cluster: Readonly<{ id: string }> }>,
>(roles: readonly T[], assessments: ReadonlyMap<string, unknown>): T[][] {
  const groups = new Map<string, T[]>();
  for (const role of roles) {
    const key = `${role.cluster.id}:${JSON.stringify(assessments.get(role.id) ?? null)}`;
    groups.set(key, [...(groups.get(key) ?? []), role]);
  }
  return [...groups.values()];
}

function discoveryProfileSuggestions(
  profile: Pick<
    DiscoveryProfileLike,
    | "includeTitles"
    | "mustHaveSkills"
    | "preferredSkills"
    | "acceptedPhysicalAreas"
    | "eligibleRemoteAreas"
  > | null,
): string[] {
  if (!profile) return [];
  const candidates = [
    ...profile.includeTitles,
    ...(profile.mustHaveSkills ?? []),
    ...(profile.preferredSkills ?? []),
    ...[...profile.acceptedPhysicalAreas, ...profile.eligibleRemoteAreas].flatMap((area) =>
      typeof area.displayLabel === "string" ? [area.displayLabel] : [],
    ),
  ];
  const seen = new Set<string>();
  return candidates.flatMap((value) => {
    const normalized = value.normalize("NFC").trim();
    const key = discoveryText(normalized);
    if (!normalized || seen.has(key) || seen.size >= 6) return [];
    seen.add(key);
    return [normalized];
  });
}

type DiscoveryRoleRecord = Omit<RoleLike, "availability" | "match" | "tracked"> & {
  id: string;
  cluster: Readonly<{ id: string }>;
  availability: NonNullable<RoleLike["availability"]> & { lastSeenAt: string };
};

type DiscoveryMatchPublication = {
  jobId: string;
  result: { band: string; blockers: readonly unknown[] };
};

export type ProjectedDiscoveryRole<
  T extends DiscoveryRoleRecord,
  M extends DiscoveryMatchPublication,
> = T & {
  match: M | null;
  tracked: boolean;
};

export type ProjectedDiscoveryRoleGroup<
  T extends DiscoveryRoleRecord,
  M extends DiscoveryMatchPublication,
> = Readonly<{
  representative: ProjectedDiscoveryRole<T, M>;
  members: readonly ProjectedDiscoveryRole<T, M>[];
  assessment: DiscoveryProfileAssessment;
}>;

export type RoleDiscoveryProjection<
  T extends DiscoveryRoleRecord,
  M extends DiscoveryMatchPublication,
> = Readonly<{
  groups: readonly ProjectedDiscoveryRoleGroup<T, M>[];
  comparisonRoles: readonly ProjectedDiscoveryRole<T, M>[];
  suggestedQueries: readonly string[];
  sourceOptions: readonly string[];
  counts: Readonly<{ totalRoles: number; visibleRoles: number; explanationGroups: number }>;
  filtersActive: boolean;
}>;

/**
 * Build the complete candidate-visible Role discovery projection from one
 * frozen dashboard snapshot and one injected evaluation time. The Workspace
 * adapter owns rendering, focus, browser state, and actions; this module owns
 * every deterministic join, assessment, membership, grouping, order, count,
 * and suggestion shown by that adapter.
 */
export function projectRoleDiscovery<
  T extends DiscoveryRoleRecord,
  M extends DiscoveryMatchPublication,
>(input: {
  roles: readonly T[];
  matches: readonly M[];
  applications: ReadonlyArray<{ jobId?: string }>;
  profile: DiscoveryProfileLike | null;
  filters: RoleDiscoveryFilters;
  effectiveQuery: string;
  comparisonRoleIds: readonly string[];
  evaluatedAt: Date;
}): RoleDiscoveryProjection<T, M> {
  const latestMatches = new Map(input.matches.map((match) => [match.jobId, match]));
  const trackedRoleIds = new Set(
    input.applications.flatMap((application) => (application.jobId ? [application.jobId] : [])),
  );
  const roles = input.roles.map((role) => ({
    ...role,
    match: latestMatches.get(role.id) ?? null,
    tracked: trackedRoleIds.has(role.id),
  }));
  const assessments = new Map<string, DiscoveryProfileAssessment>();
  for (const role of roles) {
    assessments.set(role.id, assessDiscoveryProfile(role, input.profile, input.evaluatedAt));
  }
  const discoveredRoles = roles.filter((role) => {
    const included = assessments.get(role.id)?.included ?? true;
    if (input.filters.discovery === "all") return true;
    return input.filters.discovery === "recommended" ? included : !included;
  });
  const visibleRoles = filterRoles(discoveredRoles, {
    ...input.filters,
    query: input.effectiveQuery,
  });
  const groups = groupRolesByDiscoveryAssessment(visibleRoles, assessments).map((members) => {
    const sortedMembers = members.toSorted((left, right) => {
      const leftVerified = left.availability.verificationHealth === "verified" ? 1 : 0;
      const rightVerified = right.availability.verificationHealth === "verified" ? 1 : 0;
      return (
        rightVerified - leftVerified ||
        right.availability.lastSeenAt.localeCompare(left.availability.lastSeenAt)
      );
    });
    const representative = sortedMembers[0]!;
    return {
      representative,
      members: sortedMembers,
      assessment: assessments.get(representative.id) ?? { included: true, reasons: [] },
    };
  });
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const comparisonRoles = input.comparisonRoleIds.flatMap((id) => {
    const role = rolesById.get(id);
    return role ? [role] : [];
  });
  return {
    groups,
    comparisonRoles,
    suggestedQueries: discoveryProfileSuggestions(input.profile),
    sourceOptions: [...new Set(input.roles.map((role) => role.source))].toSorted(),
    counts: {
      totalRoles: roles.length,
      visibleRoles: visibleRoles.length,
      explanationGroups: groups.length,
    },
    filtersActive: roleDiscoveryFiltersAreActive(input.filters),
  };
}
