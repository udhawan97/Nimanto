import {
  applicationFollowUpPolicy,
  applicationTransitions,
  candidateLocalDate,
  type ApplicationStatus,
} from "@nimanto/domain";
import type { Section } from "./navigation-transitions.js";

/* Pure derived logic for the workbench.
 *
 * Nothing here imports React or the workspace component: the parameter types are
 * structural, so the richer types in workspace.tsx satisfy them and this module
 * stays testable without a DOM. It is also the only place the product's
 * "never infer an outcome from silence" rule is enforced in code rather than in
 * copy — see followUpNote below. */

export type { ApplicationStatus };

export type { Section } from "./navigation-transitions.js";

type EvidenceLike = { status: string };
type FilterEvidenceLike = {
  kind: string;
  value: string;
  status: string;
  sourceName: string;
  locator: string;
};
type JobLike = {
  id: string;
  candidateDisposition?: { state: "active" | "archived" };
};
type MatchLike = { job: { id: string }; result: { blockers: unknown[] } };
type OutcomeLike = { id?: string; type?: string; note?: string; occurredAt: string };
type ApplicationNoteLike = { id?: string; text: string; recordedAt: string };
type ApplicationLike = {
  id: string;
  jobId?: string;
  status: ApplicationStatus;
  createdAt?: string;
  followUpOn?: string | null;
  outcomes?: OutcomeLike[];
  notes?: ApplicationNoteLike[];
  job?: { title: string; company: string };
};
type PacketLike = { status: string; applicationId?: string };
type ActionLike = { state: string };

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
  match: { result: { band: string; blockers: unknown[] } } | null;
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

export type EvidenceFilters = {
  query: string;
  kind: string;
  status: string;
  source: string;
};

/** A literal lens over candidate evidence and its stored provenance. Search is
 * deliberately limited to fields already visible in the vault; it never
 * derives a skill, confidence, or relationship between claims. */
export function filterEvidence<T extends FilterEvidenceLike>(
  evidence: readonly T[],
  filters: EvidenceFilters,
): T[] {
  const query = filters.query.trim().toLocaleLowerCase("en-US");
  return evidence.filter((claim) => {
    if (
      query &&
      ![claim.value, claim.sourceName, claim.locator]
        .join(" ")
        .toLocaleLowerCase("en-US")
        .includes(query)
    ) {
      return false;
    }
    if (filters.kind !== "all" && claim.kind !== filters.kind) return false;
    if (filters.status !== "all" && claim.status !== filters.status) return false;
    if (filters.source !== "all" && claim.sourceName !== filters.source) return false;
    return true;
  });
}

/* These filters are intentionally pure and ephemeral. The workbench owns the
 * input state for the life of the open section; no query, source, or shortlist
 * preference is written to the API or local storage. */
export function filterRoles<T extends RoleLike>(roles: readonly T[], filters: RoleFilters): T[] {
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
export function assessDiscoveryProfile(
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
export function applyDiscoveryProfile<T extends RoleLike>(
  roles: readonly T[],
  profile: DiscoveryProfileLike | null,
  now: Date,
): T[] {
  return roles.filter((role) => assessDiscoveryProfile(role, profile, now).included);
}

export function groupRolesByDiscoveryAssessment<
  T extends Readonly<{ id: string; cluster: Readonly<{ id: string }> }>,
>(roles: readonly T[], assessments: ReadonlyMap<string, unknown>): T[][] {
  const groups = new Map<string, T[]>();
  for (const role of roles) {
    const key = `${role.cluster.id}:${JSON.stringify(assessments.get(role.id) ?? null)}`;
    groups.set(key, [...(groups.get(key) ?? []), role]);
  }
  return [...groups.values()];
}

export function discoveryProfileSuggestions(
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

export type ApplicationFilters = {
  query: string;
  status: "all" | ApplicationStatus;
  source: string;
  followUp: "all" | "due" | "scheduled" | "none" | "inactive";
};

export type ApplicationSort = "stored" | "newest" | "follow_up" | "role";

/** One literal, tab-local lens over Application records. It changes neither the
 * candidate record nor the counts below the work surface. */
export function filterApplications<T extends ApplicationLike>(
  applications: readonly T[],
  jobs: ReadonlyArray<{ id: string; source: string }>,
  filters: ApplicationFilters,
  now: Date,
): T[] {
  const query = filters.query.trim().toLocaleLowerCase("en-US");
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const today = candidateLocalDate(now);
  return applications.filter((application) => {
    if (
      query &&
      ![
        application.job?.title ?? "",
        application.job?.company ?? "",
        ...(application.outcomes ?? []).flatMap((outcome) => [
          outcome.type ?? "",
          outcome.note ?? "",
        ]),
        ...(application.notes ?? []).map((note) => note.text),
      ]
        .join(" ")
        .toLocaleLowerCase("en-US")
        .includes(query)
    ) {
      return false;
    }
    if (filters.status !== "all" && application.status !== filters.status) return false;
    if (
      filters.source !== "all" &&
      (!application.jobId || jobsById.get(application.jobId)?.source !== filters.source)
    ) {
      return false;
    }
    if (filters.followUp === "all") return true;
    return applicationFollowUpPolicy.observe(application, today).kind === filters.followUp;
  });
}

function parsedInstant(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/** Sorts a copied Application view by fields the candidate can inspect. The
 * default preserves server order; no sort writes state or reconstructs an
 * employer event. */
export function sortApplications<T extends ApplicationLike>(
  applications: readonly T[],
  sort: ApplicationSort,
): T[] {
  if (sort === "stored") return [...applications];
  return applications.toSorted((left, right) => {
    if (sort === "newest") {
      return (
        parsedInstant(right.createdAt) - parsedInstant(left.createdAt) ||
        left.id.localeCompare(right.id)
      );
    }
    if (sort === "follow_up") {
      const leftDate = left.followUpOn ?? "9999-12-31";
      const rightDate = right.followUpOn ?? "9999-12-31";
      return leftDate.localeCompare(rightDate) || left.id.localeCompare(right.id);
    }
    return (
      (left.job?.title ?? "").localeCompare(right.job?.title ?? "", "en-US") ||
      (left.job?.company ?? "").localeCompare(right.job?.company ?? "", "en-US") ||
      left.id.localeCompare(right.id)
    );
  });
}

/* ── F2 · next-step rail ─────────────────────────────────────────────────── */

export type NextStep = {
  id: string;
  title: string;
  detail: string;
  section: Section;
  tone: "live" | "idle";
};

/* Ordered by where the candidate is blocked earliest in the flow, not by how
 * many items each bucket holds. Confirming evidence unblocks matching, which
 * unblocks packets, which unblocks actions — so a single pending claim
 * outranks ten packets awaiting assurance. */
export function nextSteps(
  input: {
    evidence: EvidenceLike[];
    jobs: JobLike[];
    matches: MatchLike[];
    applications: ApplicationLike[];
    packets: PacketLike[];
    externalActions: ActionLike[];
  },
  now = new Date(),
): NextStep[] {
  const steps: NextStep[] = [];
  const activeJobs = input.jobs.filter((job) => job.candidateDisposition?.state !== "archived");
  const activeJobIds = new Set(activeJobs.map((job) => job.id));
  const activeMatches = input.matches.filter((match) => activeJobIds.has(match.job.id));
  const pending = input.evidence.filter((item) => item.status === "pending").length;
  if (pending > 0) {
    steps.push({
      id: "confirm-evidence",
      title: `Confirm ${pending} imported claim${pending === 1 ? "" : "s"}`,
      detail: "Imported claims stay pending until you decide. Nothing scores until then.",
      section: "evidence",
      tone: "live",
    });
  }

  const matched = new Set(activeMatches.map((match) => match.job.id));
  const unmatched = activeJobs.filter((job) => !matched.has(job.id)).length;
  if (unmatched > 0) {
    steps.push({
      id: "run-matches",
      title: `Explain ${unmatched} role${unmatched === 1 ? "" : "s"}`,
      detail: "Deterministic scoring against confirmed evidence only. No model is used.",
      section: "jobs",
      tone: "idle",
    });
  }

  const blocked = activeMatches.filter((match) => match.result.blockers.length > 0).length;
  if (blocked > 0) {
    steps.push({
      id: "review-blockers",
      title: `Review ${blocked} role${blocked === 1 ? "" : "s"} with blockers`,
      detail: "Sponsorship, citizenship, clearance, or location constraints are visible.",
      section: "jobs",
      tone: "idle",
    });
  }

  /* The two steps below close the gap between "the app explained a role" and
   * "the app has something to prepare". Without them the rail rendered its
   * all-clear at exactly the points where the candidate's next move is obvious
   * to them and unprompted by us. Both read from applications, which is why
   * nextSteps takes them at all. */
  // Withdrawn counts as decided: the candidate already answered this role, and
  // re-suggesting it would be the rail arguing with them.
  const applied = new Set(input.applications.map((application) => application.jobId));
  const untracked = activeMatches.filter((match) => !applied.has(match.job.id)).length;
  if (untracked > 0) {
    steps.push({
      id: "track-roles",
      title: `Track ${untracked} explained role${untracked === 1 ? "" : "s"}`,
      detail: "Tracking a role starts the application record. It sends nothing to the employer.",
      section: "jobs",
      tone: "idle",
    });
  }

  const packeted = new Set(input.packets.map((packet) => packet.applicationId));
  const unprepared = input.applications.filter(
    (application) =>
      (application.status === "tracked" || application.status === "prepared") &&
      !packeted.has(application.id),
  ).length;
  if (unprepared > 0) {
    steps.push({
      id: "prepare-packets",
      title: `Prepare ${unprepared} packet${unprepared === 1 ? "" : "s"}`,
      detail:
        "Packets are assembled from confirmed evidence and your locked authorization wording.",
      section: "packets",
      tone: "idle",
    });
  }

  const reviewQueue = recordReviewQueue(input.applications, now);
  const reviewDue = reviewQueue.length;
  if (reviewDue > 0) {
    const candidateDates = reviewQueue.filter((item) => item.basis === "candidate_reminder").length;
    const activityFallbacks = reviewDue - candidateDates;
    const detail =
      candidateDates > 0 && activityFallbacks > 0
        ? `${candidateDates} candidate-set date${candidateDates === 1 ? "" : "s"} and ${activityFallbacks} activity fallback${activityFallbacks === 1 ? "" : "s"} are due. No outcome is inferred.`
        : candidateDates > 0
          ? `${candidateDates} candidate-set follow-up date${candidateDates === 1 ? " is" : "s are"} due. No outcome is inferred.`
          : "At least 336 hours have elapsed since the last thing you recorded. No outcome is inferred.";
    steps.push({
      id: "review-records",
      title: `Review ${reviewDue} application record${reviewDue === 1 ? "" : "s"}`,
      detail,
      section: "applications",
      tone: "idle",
    });
  }

  const draftPackets = input.packets.filter((packet) => packet.status === "draft").length;
  if (draftPackets > 0) {
    steps.push({
      id: "assure-packets",
      title: `Run assurance on ${draftPackets} packet${draftPackets === 1 ? "" : "s"}`,
      detail: "Assurance must pass before a packet can be approved.",
      section: "packets",
      tone: "idle",
    });
  }

  const awaiting = input.externalActions.filter(
    (action) => action.state === "pending_approval",
  ).length;
  if (awaiting > 0) {
    steps.push({
      id: "approve-actions",
      title: `Approve ${awaiting} action${awaiting === 1 ? "" : "s"}`,
      detail: "You approve the exact recipient and payload. Nothing sends on its own.",
      section: "actions",
      tone: "live",
    });
  }

  return steps;
}

/* ── F6 · follow-up observation ──────────────────────────────────────────── */

export const FOLLOW_UP_DAYS = 14;

/** Baseline is the newest thing the candidate actually recorded. `updated_at` is
 *  bumped by a status write but NOT by addOutcome, so it is not an activity
 *  timestamp and is deliberately not used here. */
export function lastRecordedAt(application: ApplicationLike): string | null {
  const stamps = [
    application.createdAt,
    ...(application.outcomes ?? []).map((outcome) => outcome.occurredAt),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (stamps.length === 0) return null;
  return stamps.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
}

export function daysSinceLastRecord(application: ApplicationLike, now: Date): number | null {
  const at = lastRecordedAt(application);
  if (!at) return null;
  const parsed = Date.parse(at);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((now.getTime() - parsed) / 86_400_000);
}

function localDateStart(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year === 0) return null;
  // The multi-argument Date constructor remaps years 0–99 to 1900–1999.
  // setFullYear preserves the literal ISO year returned by PostgreSQL.
  const parsed = new Date(0);
  parsed.setFullYear(year!, month! - 1, day!);
  parsed.setHours(0, 0, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month! - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function dateLabel(value: Date): string {
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* Deliberately an observation about the candidate's own record-keeping, never a
 * status. The product promises "Nimanto never infers an outcome from silence" —
 * so this may not say stale, cold, ignored, or likely-rejected. Terminal states
 * are exempt: nothing is pending on a withdrawn application. */
export function followUpNote(application: ApplicationLike, now: Date): string | null {
  const observation = applicationFollowUpPolicy.observe(application, candidateLocalDate(now));
  if (observation.kind !== "none") {
    const reminder = localDateStart(observation.date)!;
    if (observation.kind === "inactive") {
      return `Follow-up reminder inactive · ${dateLabel(reminder)}`;
    }
    return `Follow-up reminder${observation.kind === "due" ? " due" : ""} · ${dateLabel(reminder)}`;
  }
  if (application.status === "withdrawn") return null;
  const days = daysSinceLastRecord(application, now);
  if (days === null || days < FOLLOW_UP_DAYS) return null;
  const at = lastRecordedAt(application)!;
  const on = dateLabel(new Date(Date.parse(at)));
  return `Nothing recorded since ${on}`;
}

export const RECORD_REVIEW_HOURS = FOLLOW_UP_DAYS * 24;

export type RecordReviewItem<T extends ApplicationLike> = {
  application: T;
  basis: "candidate_reminder" | "record_activity";
  dueOn: string | null;
  lastRecordedAt: string | null;
  dueAt: string;
  elapsedHours: number | null;
};

/** A queue over an explicit candidate reminder when one exists, otherwise over
 * literal stored activity. It never infers an employer response or changes the
 * application status. */
export function recordReviewQueue<T extends ApplicationLike>(
  applications: readonly T[],
  now: Date,
): Array<RecordReviewItem<T>> {
  return applications
    .flatMap<RecordReviewItem<T>>((application): Array<RecordReviewItem<T>> => {
      const observation = applicationFollowUpPolicy.observe(application, candidateLocalDate(now));
      if (observation.kind === "inactive") return [];
      if (observation.kind === "scheduled") return [];
      if (observation.kind === "due") {
        const reminder = localDateStart(observation.date)!;
        return [
          {
            application,
            basis: "candidate_reminder" as const,
            dueOn: observation.date,
            lastRecordedAt: lastRecordedAt(application),
            dueAt: reminder.toISOString(),
            elapsedHours: null,
          },
        ];
      }
      if (application.status === "withdrawn") return [];
      const recordedAt = lastRecordedAt(application);
      if (!recordedAt) return [];
      const parsed = Date.parse(recordedAt);
      if (Number.isNaN(parsed)) return [];
      const elapsedHours = Math.floor((now.getTime() - parsed) / 3_600_000);
      if (elapsedHours < RECORD_REVIEW_HOURS) return [];
      return [
        {
          application,
          basis: "record_activity" as const,
          dueOn: null,
          lastRecordedAt: recordedAt,
          dueAt: new Date(parsed + RECORD_REVIEW_HOURS * 3_600_000).toISOString(),
          elapsedHours,
        },
      ];
    })
    .toSorted(
      (left, right) =>
        Date.parse(left.dueAt) - Date.parse(right.dueAt) ||
        left.application.id.localeCompare(right.application.id),
    );
}

export type ProfileVersionLike = {
  claimIds: readonly string[];
  authorizationWording: string;
};

export function countedNoun(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

type ArtifactManifestLike = {
  artifacts?: ReadonlyArray<{ filename: string; format?: string; sha256?: string }>;
};

/** Completion copy is inventory, not a promise about a hard-coded generator.
 * The returned manifest is the source of truth for both file and file-type
 * counts, so changing the document set cannot silently make the UI inaccurate. */
export function packetInventoryNotice(manifest: ArtifactManifestLike): string {
  const artifacts = manifest.artifacts ?? [];
  const fileTypes = new Set(
    artifacts.map((artifact) => {
      const extension = artifact.filename.match(/\.([^.]+)$/)?.[1];
      return (extension ?? artifact.format ?? "unknown").toLocaleLowerCase("en-US");
    }),
  );
  return `Packet generated: ${countedNoun(artifacts.length, "file")} across ${countedNoun(fileTypes.size, "file type")}.`;
}

function canonicalProfileInput(wording: string, claimIds: readonly string[]) {
  return {
    authorizationWording: wording.normalize("NFC").trim(),
    claimIds: [...claimIds].toSorted(),
  };
}

/** Advisory client comparison only. The store repeats this normalization under
 * a tenant lock and remains the authority for whether a version is inserted. */
export function profileInputChanged(
  profile: ProfileVersionLike | null,
  authorizationWording: string,
  confirmedClaimIds: readonly string[],
): boolean {
  if (!profile) return true;
  const before = canonicalProfileInput(profile.authorizationWording, profile.claimIds);
  const after = canonicalProfileInput(authorizationWording, confirmedClaimIds);
  return (
    before.authorizationWording !== after.authorizationWording ||
    before.claimIds.length !== after.claimIds.length ||
    before.claimIds.some((id, index) => id !== after.claimIds[index])
  );
}

/** How many confirmed claims are not in the latest Profile Version yet.
 *
 * Matching scores the claim set frozen into a Profile Version, so a claim the
 * candidate just confirmed changes nothing until a version is saved. This is
 * deliberately narrower than `profileInputChanged`, which is also true for an
 * authorization-wording edit or a claim removal — neither of which adds
 * scoreable evidence, so neither may be described to the candidate as a claim
 * waiting to be scored. */
export function unscoredConfirmedClaims(
  profile: ProfileVersionLike | null,
  confirmedClaimIds: readonly string[],
): number {
  if (!profile) return confirmedClaimIds.length;
  const saved = new Set(profile.claimIds);
  return confirmedClaimIds.filter((id) => !saved.has(id)).length;
}

export type ExplanationFreshness =
  "current" | "scored_against_earlier_version" | "confirmed_evidence_unsaved";

/** Why an explanation may not reflect the candidate's evidence, and which
 * remedy applies. Two different things can be stale, and they need opposite
 * actions:
 *
 *  - the explanation predates the saved Profile Version → explain again;
 *  - confirmed claims are in no saved version at all → save one first, because
 *    explaining again would return an identical result.
 *
 * Comparing version ids alone cannot see the second case: a freshly published
 * match is always stamped with the current version, so the very sequence this
 * exists for — confirm a claim, explain again, get the same score — reads as
 * current. Unsaved evidence is reported first because explaining again without
 * saving does nothing. */
export function explanationFreshness(
  match: { profileVersionId: string | null },
  profile: (ProfileVersionLike & { id: string }) | null,
  confirmedClaimIds: readonly string[],
): ExplanationFreshness {
  if (unscoredConfirmedClaims(profile, confirmedClaimIds) > 0) return "confirmed_evidence_unsaved";
  if (profile && match.profileVersionId !== profile.id) return "scored_against_earlier_version";
  return "current";
}

/** Literal set and string comparison only; it makes no claim about why a
 * profile changed or whether a later match result was caused by that change. */
export function profileVersionDiff(before: ProfileVersionLike, after: ProfileVersionLike) {
  const beforeClaims = new Set(before.claimIds);
  const afterClaims = new Set(after.claimIds);
  return {
    addedClaimIds: after.claimIds.filter((id) => !beforeClaims.has(id)).toSorted(),
    removedClaimIds: before.claimIds.filter((id) => !afterClaims.has(id)).toSorted(),
    authorizationWordingChanged: before.authorizationWording !== after.authorizationWording,
    beforeAuthorizationWording: before.authorizationWording,
    afterAuthorizationWording: after.authorizationWording,
  };
}

export const APPLICATION_MATCH_BUCKETS = [
  "strong_evidence",
  "promising_evidence",
  "partial_evidence",
  "weak_evidence",
  "not_scored",
  "unmatched",
  "unknown",
] as const;
export type ApplicationMatchBucket = (typeof APPLICATION_MATCH_BUCKETS)[number];

type CohortJobLike = { id: string; source: string };
type CohortMatchLike = { jobId: string; result: { band: string } };

/** Current-snapshot counts over applications created inside an explicit instant
 * range. The result intentionally contains no rate, probability, or reconstructed
 * historical source/match state. */
export function applicationCohortCounts(input: {
  applications: readonly ApplicationLike[];
  jobs: readonly CohortJobLike[];
  matches: readonly CohortMatchLike[];
  startAt: string;
  endAtExclusive: string;
  source: string;
  matchBucket: "all" | ApplicationMatchBucket;
}) {
  const start = Date.parse(input.startAt);
  const end = Date.parse(input.endAtExclusive);
  const jobs = new Map(input.jobs.map((job) => [job.id, job]));
  const matches = new Map(input.matches.map((match) => [match.jobId, match]));
  const bucketFor = (application: ApplicationLike): ApplicationMatchBucket => {
    const match = application.jobId ? matches.get(application.jobId) : undefined;
    if (!match) return "unmatched";
    const band = match.result.band;
    return APPLICATION_MATCH_BUCKETS.includes(band as ApplicationMatchBucket)
      ? (band as ApplicationMatchBucket)
      : "unknown";
  };
  const selected = input.applications.filter((application) => {
    const created = Date.parse(application.createdAt ?? "");
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(created)) return false;
    if (created < start || created >= end) return false;
    const job = application.jobId ? jobs.get(application.jobId) : undefined;
    if (input.source !== "all" && job?.source !== input.source) return false;
    return input.matchBucket === "all" || bucketFor(application) === input.matchBucket;
  });
  const byMatchBucket = Object.fromEntries(
    APPLICATION_MATCH_BUCKETS.map((bucket) => [
      bucket,
      selected.filter((application) => bucketFor(application) === bucket).length,
    ]),
  ) as Record<ApplicationMatchBucket, number>;
  const hasOutcome = (application: ApplicationLike, type: string) =>
    application.outcomes?.some((outcome) => outcome.type === type) ?? false;
  return {
    sampleSize: selected.length,
    applicationIds: selected.map((application) => application.id),
    byMatchBucket,
    outcomes: {
      replies: selected.filter((application) => hasOutcome(application, "reply")).length,
      screens: selected.filter((application) => hasOutcome(application, "screen")).length,
      interviews: selected.filter((application) => hasOutcome(application, "interview")).length,
      offers: selected.filter((application) => hasOutcome(application, "offer")).length,
    },
  };
}

export type RecordedTimelineEntry = {
  id: string;
  type: string;
  note: string;
  occurredAt: string;
  kind: "application" | "outcome" | "note";
};

/* A chronology of records, not a reconstructed hiring process. In particular,
 * status transitions are absent because the current application status does not
 * tell us when a real-world event occurred. */
export function recordedApplicationTimeline(application: ApplicationLike): RecordedTimelineEntry[] {
  const entries: RecordedTimelineEntry[] = [];
  if (application.createdAt) {
    entries.push({
      id: `${application.id}-created`,
      type: "tracked",
      note: "Application record created",
      occurredAt: application.createdAt,
      kind: "application",
    });
  }
  for (const outcome of application.outcomes ?? []) {
    entries.push({
      id: outcome.id ?? `${application.id}-${outcome.occurredAt}-${outcome.type ?? "outcome"}`,
      type: outcome.type ?? "outcome",
      note: outcome.note ?? "",
      occurredAt: outcome.occurredAt,
      kind: "outcome",
    });
  }
  for (const note of application.notes ?? []) {
    entries.push({
      id: note.id ?? `${application.id}-${note.recordedAt}-note`,
      type: "private note",
      note: note.text,
      occurredAt: note.recordedAt,
      kind: "note",
    });
  }
  return entries.toSorted((left, right) => {
    const time = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
    return Number.isNaN(time) || time === 0 ? left.id.localeCompare(right.id) : time;
  });
}

/** Kept as a compatibility name for tests and downstream imports. */
export const recordedOutcomeTimeline = recordedApplicationTimeline;

/* ── F1 · pipeline board ─────────────────────────────────────────────────── */

export const BOARD_COLUMNS: readonly { id: ApplicationStatus; label: string }[] = [
  { id: "tracked", label: "Tracked" },
  { id: "prepared", label: "Prepared" },
  { id: "approved_for_export", label: "Approved for export" },
  { id: "submitted_externally", label: "Submitted" },
  { id: "withdrawn", label: "Withdrawn" },
];

export function boardColumns<T extends ApplicationLike>(
  applications: T[],
): { id: ApplicationStatus; label: string; items: T[] }[] {
  return BOARD_COLUMNS.map((column) => ({
    ...column,
    items: applications.filter((application) => application.status === column.id),
  }));
}

export function canMove(from: ApplicationStatus, to: ApplicationStatus): boolean {
  const decision = applicationTransitions.candidate(from).decide(to);
  return decision.kind !== "illegal";
}

export function needsConfirmation(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return (
    applicationTransitions.candidate(from).options.find((option) => option.to === to)
      ?.confirmation === "required"
  );
}

/* Every status control offers this list and nothing else. Derived from the same
 * table `canMove` reads, so a control cannot drift into proposing a move the
 * domain forbids — the candidate should never learn about an illegal transition
 * from a rejected request. The status already held is included so a `<select>`
 * can render its own current value. */
export function legalTargets(from: ApplicationStatus): ApplicationStatus[] {
  return BOARD_COLUMNS.map((column) => column.id).filter((to) => canMove(from, to));
}

export function confirmationPrompt(to: ApplicationStatus, application: ApplicationLike): string {
  const role = application.job
    ? `${application.job.title} at ${application.job.company}`
    : "this application";
  if (to === "submitted_externally") {
    return `Record that you submitted ${role} externally? Nimanto does not submit anything for you — this only records that you did.`;
  }
  if (to === "withdrawn") return `Mark ${role} as withdrawn?`;
  return `Mark ${role} as approved for export?`;
}

/* ── Failure copy ────────────────────────────────────────────────────────── */

/* The API returns a specific `code` alongside a deliberately generic message,
 * because one sentence has to serve every validation failure it has. The client
 * holds the code and is the only place that knows which screen the candidate is
 * looking at, so this is where a rejection becomes something to act on. */
const FAILURE_COPY: Record<string, string> = {
  RATE_LIMITED:
    "The local API is throttling requests. Wait a moment, then retry — nothing was lost, and the service is running.",
  INVALID_COMPENSATION: "The posted annual maximum must be greater than or equal to the minimum.",
  INVALID_APPLICATION_TRANSITION:
    "An application moves Tracked → Prepared → Approved for export → Submitted externally. Move it to the next stage first, or withdraw it.",
  APPLICATION_TRANSITION_CONFIRMATION_REQUIRED:
    "Confirm this consequential application change before Nimanto records it.",
  INVALID_CONFIRMATION: "Type the confirmation phrase exactly as shown, including capitals.",
  EVIDENCE_PREVIEW_CHANGED: "The file changed since you previewed it. Review the preview again.",
  IDENTITY_CHANGED:
    "The authenticated workspace changed in another tab. Nothing was saved; review this workspace before trying again.",
  LATEST_APPROVED_PACKET_REQUIRED:
    "A newer packet replaced the one selected for this action. Refresh, review and approve the current packet, then create and approve a replacement action.",
  ACTION_APPROVAL_STALE:
    "A newer packet replaced the one approved for this action. Review and approve the current packet, then create and approve a replacement action.",
  PROHIBITED_DOCUMENT_CONTENT:
    "That file looks like an immigration or identity document. Nimanto refuses those — remove it and import career evidence only.",
  UNSUPPORTED_FILE_TYPE:
    "Nimanto reads TXT, Markdown, JSON, DOCX, a text-layer PDF, or an approved LinkedIn archive.",
  FILE_TOO_LARGE: "That file is above the import size limit. Split it or import a smaller export.",
  EXTERNAL_ACTIONS_DISABLED:
    "Turn on the execution runtime switch first. It always starts off after the service restarts.",
};

/** `null` means "say nothing" — the caller already has a better surface for it.
 *  A transport failure is exactly that case: the connection banner names which
 *  half is down and how to restart it, so repeating the browser's own
 *  "Failed to fetch" underneath adds noise and no information. */
export function failureMessage(input: {
  code?: string | null;
  message?: string | null;
  transport?: boolean;
}): string | null {
  if (input.transport) return null;
  const improved = input.code ? FAILURE_COPY[input.code] : undefined;
  return improved || input.message || "Nimanto could not complete that request.";
}

/* ── Section routing ─────────────────────────────────────────────────────── */

/* ── F5 · funnel ─────────────────────────────────────────────────────────── */

/* Counts only. The API ships the caveat "not a hiring probability" and the source
 * ledger states no hiring-probability claim is supportable, so a conversion rate
 * off a sample of one or two would manufacture exactly that claim. */
export function funnelStages(funnel: {
  sampleSize: number;
  replies: number;
  screens: number;
  interviews: number;
  offers: number;
}): { id: string; label: string; count: number }[] {
  return [
    { id: "tracked", label: "Tracked", count: funnel.sampleSize },
    { id: "replies", label: "Replies", count: funnel.replies },
    { id: "screens", label: "Screens", count: funnel.screens },
    { id: "interviews", label: "Interviews", count: funnel.interviews },
    { id: "offers", label: "Offers", count: funnel.offers },
  ];
}
