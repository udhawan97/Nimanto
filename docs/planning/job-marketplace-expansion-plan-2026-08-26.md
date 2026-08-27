# Nimanto job marketplace expansion plan

**Status:** implemented on `main` for code-owned foundations and approved ATS execution; gated sources remain disabled pending source-specific rights, credentials, and quality acceptance. This document does not authorize a provider partnership, immigration conclusion, release, or deployment.

**Prepared:** 2026-08-26
**Companion research:** [Job source expansion research](./job-source-expansion-research-2026-08-26.md)

## Decision

Build a private, candidate-controlled **metasearch workbench**, not a public copy of every major job board.

The best first inventory is not “all of LinkedIn, Indeed, and Glassdoor.” Their useful discovery access is restricted, partnership-dependent, or contract-sensitive. The strongest near-term mix is:

1. employer-authoritative public ATS boards, beginning with Nimanto's existing Greenhouse, Lever, and Ashby adapters and then SmartRecruiters;
2. licensed or explicitly published discovery APIs and feeds, added only with their attribution, caching, retention, and rate requirements;
3. official DOL and USCIS historical evidence kept separate from current-role wording; and
4. partnership-only sources kept in a capability registry until written access exists.

This approach maximizes freshness and provenance while keeping the architecture ready for broader inventory.

## Implemented scope

| Capability | Current state |
| --- | --- |
| Source governance | One deny-by-default registry exposes enabled, candidate, prohibited, terms, retention, attribution, and complete-snapshot status. Greenhouse, Lever, and Ashby remain enabled; every new source remains gated. |
| Provider protocol | Fetches return roles plus a complete/partial source-run record. Greenhouse, Lever, and Ashby preserve richer source dates and workplace evidence. A paginated SmartRecruiters adapter is implemented but cannot execute until its registry gate is approved. |
| Posting lifecycle | Schema version 8 stores source runs, immutable normalized observations, role availability, and verification attempts. Raw provider payloads are hashed and discarded under the current zero-hour policy. |
| Stale protection | One complete-list miss sets `possibly_closed`; a second complete miss at least six hours later sets `closed`. Failed and partial runs never close a role. Source `validThrough` can set `expired`; elapsed recheck time becomes `overdue`, not closed. |
| Work mode | `remote`, `hybrid`, `onsite`, `unknown`, and `conflicting` are canonical domain values with source-field evidence and structured areas. The workbench includes remote, non-remote, individual-mode, role-family, posting-state, and verification filters. |
| Personalization | Candidate-approved Discovery Profiles are versioned, idempotent, linked to an exact Evidence Profile, and applied to title, role-family, source, area, work-mode, and observation-age discovery. No résumé inference is silently persisted. |
| Aggregation | Exact-field normalized company/title/location clusters group possible cross-source variants while retaining every source record, link, wording, and verification label. Same-source roles are not collapsed by title/location alone. |
| H-1B boundary | Exact current-posting wording is a visible warning with locator/time evidence. Historical company signals are displayed separately and never treated as current sponsorship proof or an automatic rejection. |
| Data control | `nimanto_export_v3` includes discovery profiles, source runs, observations, verification attempts, and availability; tenant deletion cascades through all new tenant-owned tables. |

Licensed feeds, partner-only sources, and terms-conflicted aggregators are deliberately not executable. Their registry entries make future activation explicit without treating adapter code, a public endpoint, or user demand as data rights.

## Product outcome

The candidate should be able to:

- approve a Discovery Profile suggested from one exact confirmed Profile Version or define it manually;
- search several approved sources from one place;
- filter `remote`, `hybrid`, `onsite`, `unknown`, or `conflicting`, including remote geography restrictions;
- see “posted 35 days ago · employer ATS verified 2 hours ago” or “provider reported 2 hours ago” rather than treating age as closure;
- group likely duplicate source variants without losing each source's identity or wording;
- understand why a role was shown, which confirmed evidence supports it, and which constraints conflict;
- see current role sponsorship wording separately from historical employer evidence; and
- follow the employer/source application link while Nimanto retains its existing approval boundaries.

Nimanto must not claim that historical filings mean a current employer will sponsor, that a remote job can legally employ a candidate in every location, or that an old but still-live posting is stale.

## Baseline addressed by this implementation

The implementation builds on Nimanto's existing seams:

- `@nimanto/providers` fetches Greenhouse, Lever, and Ashby public boards through fixed HTTPS hosts.
- `DiscoveryCycle` supports direct imports and durable scheduled refreshes.
- Provider adapters emit `RoleObservation` before common normalization and now retain immutable normalized observations alongside the mutable current projection.
- `(tenant, source, sourceJobId)` prevents duplicate rows from the same source.
- matching is deterministic and historical H-1B signals have provenance and freshness rules.

The code-owned gaps above are now closed. The remaining breadth constraint is external: a broad feed must grant Nimanto the required access, display, caching, retention, canonical-link, deletion, and termination rights and must pass the benchmark described below before its registry entry can be enabled.

## Source portfolio

The ranking below is about **fit for Nimanto**, not a claim about consumer traffic or total market share.

| Priority | Source class | Candidates | Why | Gate |
| --- | --- | --- | --- | --- |
| P0 | Existing public ATS | Greenhouse, Lever, Ashby | Employer-authoritative current published inventory; already implemented | Correct mappings, pagination/completeness evidence, source dates, terms record |
| P1 | Additional public ATS | SmartRecruiters | Official public Posting API for active company postings; useful structured dates/location/remote fields | Source-specific rights review, fixtures, pagination, complete-scan semantics |
| P2 | Enterprise discovery feeds | LinkUp, Lightcast | Licensed normalized breadth and, for LinkUp, explicit lifecycle fields | Proposal, trial, written display/cache/retention/deletion rights, freshness SLA, cost decision |
| P2 | Broad discovery API | Jooble | Keyword/location discovery API | Written clarification of production quotas, display, caching, retention, and regional key scope |
| Defer | Broad discovery API | The Muse | Public jobs API, categories, levels, locations | Written approval: product-replication and current general/API terms may conflict with aggregation |
| P2 | Broad discovery API | Adzuna | Search API with broad inventory | API key, attribution, low default quotas; license/written consent may be required beyond trial/personal research |
| P2 | Government jobs | USAJOBS | Official live-search API with open/close dates and remote filter | OPM token and use-plan approval; explicit citizenship/clearance/hiring-path blockers |
| Disabled | Terms-conflicted remote sources | We Work Remotely, Remotive | Potential remote inventory | Written permission/private agreement required. WWR's API terms prohibit a job-search service and storing API data; Remotive's public terms impose delay/attribution/request limits and conflict with an invite-only listing workbench. |
| Watch | Restricted or partner-only | LinkedIn, Indeed, Glassdoor, ZipRecruiter discovery | Important future reach | Written partner access and source-specific contract; never scrape as a substitute |
| Watch | Employer-authorized ATS | Workable, Recruitee | Useful structured public/careers data for the authorizing employer | Employer or provider authorization; reviewed docs do not grant broad third-party aggregation |
| Watch | Unreviewed employer ATS | Workday, iCIMS, others | Important enterprise coverage | Official documented access or written permission; existing allowlisted URL intake remains fallback |

Do not ingest MyVisaJobs, H1BGrader, or another visa-data intermediary as the authoritative H-1B dataset unless it provides an approved API and redistribution license. Prefer the government files it derives from.

## Architecture

### 1. Source registry

Replace repeated provider unions with one server-owned registry.

```ts
type SourceAccessState = "candidate" | "approved" | "enabled" | "paused" | "revoked";

type SourceRegistryEntry = {
  source: string;
  accessClass: "public_api" | "public_feed" | "licensed_api" | "partner_api" | "manual";
  state: SourceAccessState;
  executionEnabled: boolean;
  emergencyPausedAt: string | null;
  owner: string;
  termsUrl: string;
  termsVersion: string;
  termsReviewedAt: string | null;
  commercialUseDecision: "allowed" | "prohibited" | "unclear";
  allowedDisplayFields: string[];
  deepLinkAllowed: boolean;
  derivedFieldsAllowed: boolean;
  attribution: { label: string; linkRequired: boolean } | null;
  rawBodyTtlHours: number;
  normalizedRetentionDays: number;
  deletionUpdateSlaHours: number;
  terminationPurgeRequired: boolean;
  aiOrTrainingUseAllowed: false;
  redistributionAllowed: boolean;
  maxRequestsPerMinute: number;
  refreshCadenceMinutes: number;
  freshnessTtlMinutes: number;
  resultLimit: number;
  supportsCompleteSnapshot: boolean;
};
```

An adapter is denied by default and cannot run unless its registry state is `enabled`, `executionEnabled` is true, `emergencyPausedAt` is null, and its terms review is current. Secrets stay server-side and never enter the static web bundle or export.

### 2. Provider protocol

Generalize `fetchProviderJobs` into source-specific adapters behind one protocol. A fetch must describe the run as well as the roles.

```ts
type SourceRun = {
  source: string;
  boardId?: string;
  queryReferenceHmac?: string;
  startedAt: string;
  completedAt: string;
  complete: boolean;
  pagesRead: number;
  sourceItemCount: number;
  responseFingerprint: string;
  retryAfterObserved: boolean;
};

type SourceResult = {
  observations: RoleObservation[];
  run: SourceRun;
};
```

`complete` must be false after truncation, pagination failure, rate-limit exhaustion, invalid items, or a partial upstream response. A partial run can refresh roles it saw but can never close roles it did not see.

Source requests never include resume text, H-1B status, authorization evidence, or raw private search history. Default discovery uses non-personal catalog pulls; an optional provider query may use separately consented coarse title/location fields only. Persist only a versioned, server-keyed HMAC over the canonical coarse query and consent record, never an unkeyed low-entropy hash or raw candidate query; delete it with the source run under the source's retention limit. Each adapter writes an immutable, rights-policy-bounded raw snapshot and immutable normalized version before updating the mutable `CurrentRole` projection.

For an approved discovery source, canonical apply-link resolution follows bounded redirects, rejects unsafe targets, maps recognized ATS hosts/identifiers, and rechecks the individual detail endpoint or a complete employer board. The source rights record must allow that contact and deep-link handling; Adzuna records receive no third-party ATS recheck, canonicalization, or deep-link substitution until Adzuna grants it in writing.

### 3. Availability evidence

Add a separate tenant-owned `role_availability` record so source freshness is not confused with role content or candidate disposition.

```ts
type PublicationState = "active" | "possibly_closed" | "closed" | "expired";
type VerificationHealth = "verified" | "provider_reported" | "blocked" | "overdue" | "unknown";
type VerificationAuthority = "employer_ats" | "licensed_provider" | "authorized_employer_page" | "candidate_review" | "unknown";

type RoleAvailability = {
  jobId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string | null;
  sourcePostedAt: string | null;
  sourceUpdatedAt: string | null;
  validThrough: string | null;
  publicationState: PublicationState;
  verificationHealth: VerificationHealth;
  verificationAuthority: VerificationAuthority;
  verificationMethod: "complete_list" | "detail_get" | "provider_feed" | "structured_employer_page" | "valid_through" | "manual";
  consecutiveCompleteMisses: number;
  closedAt: string | null;
  closureReason: "expired" | "source_removed" | "detail_not_found" | "manual" | null;
};
```

Keep candidate archive state independent. A candidate can archive an active role, and a tracked application survives a source closure. Persist every verification attempt/result and every publication transition as immutable evidence. Backfills begin with `lastVerifiedAt = null` and `verificationHealth = "unknown"`.

### 4. Freshness algorithm

Use source liveness, not a universal posting-age cutoff.

1. A successful employer ATS complete list or detail response sets `lastSeenAt`, `lastVerifiedAt`, `publicationState = active`, `verificationHealth = verified`, and `verificationAuthority = employer_ats`. A licensed-feed hit is `provider_reported`, not employer-verified.
2. `validThrough` in the past sets `publicationState = expired` when it comes from an approved authoritative source.
3. A definitive source detail `404` or equivalent sets `closed` when the adapter contract defines that response as unpublished.
4. Absence from one complete list sets `possibly_closed`, increments a miss count, and triggers a detail check where supported.
5. Two consecutive complete misses at least six hours apart may set `closed`; failed or partial runs never increment misses.
6. Passing the source-specific verification TTL changes verification health to `overdue`; it does not assert closure.
7. Opening an overdue result requests a bounded recheck before presenting the application link as recently verified.
8. A later verified reappearance returns the role to `active` and records the transition.

Default search hides `closed` and `expired`, includes `possibly_closed`, `overdue`, `blocked`, and `unknown` with precise warnings, and lets the candidate inspect every state. Cards use method-qualified labels: **Employer ATS verified today**, **Provider reported today**, **Recheck overdue**, or **Recheck blocked**.

Google's job-posting guidance is a useful interoperability baseline: honor `datePosted`, `validThrough`, `jobLocationType`, `applicantLocationRequirements`, `404/410`, and removal of job structured data. These are evidence inputs, not guarantees that a page is truthful.

### 5. Work-mode normalization

Use a closed canonical mode plus source evidence.

```ts
type WorkMode = "remote" | "hybrid" | "onsite" | "unknown" | "conflicting";

type WorkModeEvidence = {
  mode: WorkMode;
  method: "source_structured" | "posting_text" | "candidate_reviewed" | "unknown";
  sourceText: string | null;
  sourceFieldOrLocator: string;
  observedAt: string;
  normalizerVersion: string;
  confidence: "high" | "medium" | "low";
  eligibleRemoteAreas: Array<{ country?: string; region?: string; metro?: string; timezone?: string }>;
  physicalLocations: Array<{ country?: string; region?: string; city?: string }>;
};
```

Mapping order:

1. official structured fields such as Ashby `isRemote`/`workplaceType`, Lever `workplaceType`, or SmartRecruiters `location.remote`;
2. valid `JobPosting` structured data from an approved source, authorized employer page, or candidate-supplied private content;
3. exact posting wording from those same authorized inputs, retained as evidence;
4. `unknown`.

Retain every work-mode observation. Text heuristics must not silently turn “flexible,” “remote days,” or “remote considered” into fully remote. A remote job's permitted geography remains separate from its work mode. Conflicting high-quality observations remain `conflicting` rather than being overwritten.

The UI filter should expose:

- Remote only;
- Hybrid;
- On-site;
- Unknown or conflicting; and
- Any mode.

“Non-remote” can be a convenience group for `hybrid + onsite`, but those modes should stay individually visible.

### 6. Discovery Profile

Add a candidate-approved, versioned search input separate from the Evidence Profile and Match Publication.

```ts
type StructuredArea = {
  displayLabel: string;
  countryCode: string | null; // ISO 3166-1 alpha-2
  subdivisionCode: string | null; // ISO 3166-2
  metroId: string | null; // reviewed canonical metro registry
  timeZone: string | null; // IANA timezone
  resolution: "confirmed" | "unknown";
};

type DiscoveryProfile = {
  id: string;
  profileVersionId: string | null;
  roleFamilies: string[];
  includeTitles: string[];
  excludeTitles: string[];
  seniorityLevels: string[];
  industries: string[];
  mustHaveSkills: string[];
  preferredSkills: string[];
  acceptedPhysicalAreas: StructuredArea[];
  commuteRadiusMiles: number | null;
  relocationPreference: "no" | "consider" | "yes";
  workModes: WorkMode[];
  eligibleRemoteAreas: StructuredArea[];
  minimumCompensation: { amount: number; currency: string } | null;
  currentPostingSponsorshipFilter: "show_all" | "hide_confirmed_exact_conflicts_from_recommended";
  authorizationStatementVersionId: string | null;
  authorizationStatementExpiresAt: string | null;
  freshnessMaximumHours: number;
  sourceIds: string[];
  matcherVersion: string;
  normalizerVersion: string;
  approvedAt: string;
};
```

`StructuredArea` stores a display label separately from stable ISO country/subdivision codes, a reviewed metro identifier when applicable, and an IANA timezone. Ambiguous candidate input such as “Georgia,” “Washington,” or “Central time” must be confirmed to one structured area or remain `unknown`; it cannot silently include or exclude a job.

Resume-derived titles, skills, and role families enter as a preview. Nothing becomes a saved search until the candidate confirms it. Manual selection must work without a résumé.

The sponsorship control is a display/filter preference over candidate-confirmed, exact current-posting wording only. It never boosts fit or rank from historical employer data, never hides a job from all search, and remains warning-only until the precision-first exclusion gate passes.

Initial role families should reuse the product contract: AI/ML, software/technical, data/analytics, product, and business/strategy/operations/solutions. The candidate may choose several; Nimanto should not overfit discovery to the candidate's current title.

### 7. H-1B evidence on results

Show three separately labeled layers:

1. **Current role wording** — exact positive, negative, or unknown sponsorship/work-authorization text from this posting, with locator and observation time.
2. **Current employer policy** — dated employer-authored wording, if independently sourced and still within its policy freshness window.
3. **Historical government evidence** — checksum-addressed DOL LCA and USCIS petition-decision editions, with period, employer-resolution state, limitations, and freshness.

The discovery and match rules must obey these constraints:

- a role always remains searchable; only exact wording with locator/observation time plus candidate confirmation—or a held-out, precision-first, zero-false-positive evaluated rule—may exclude it from the recommended view;
- until that exclusion gate passes, all sponsorship regex output is warning-only and recall is reported rather than optimized at the expense of precision;
- DOL history can say that filings were observed for an employer/title/worksite/period, never that this role supports transfer;
- USCIS history can describe petition decisions by employer and period, never a present job promise or personal eligibility;
- no government-record absence becomes negative evidence;
- historical evidence does not increase the existing Evidence Match band;
- employer joins remain exact/alias-based and abstain when ambiguous; the existing evaluated precision gate remains fail-closed; and
- legal questions are linked to qualified counsel, not answered by Nimanto.

All configured role families may be discovered. Evidence-fit bands and fit sorting remain enabled only for validated US software/AI cohorts; every other family is labeled `experimental_unvalidated` and has no fit-sort until its held-out gates pass.

On each result, display an H-1B evidence panel rather than one “sponsors” badge. Example:

> Role wording: not found
>
> Employer history: DOL LCA records observed in FY2025, Chicago, software occupations
>
> Meaning: historical context only; verify current transfer support with the employer

### 8. Cross-source grouping

Do not overwrite or deduplicate source rows. Add a derived `RoleCluster` that groups source variants while retaining every Role Observation and application URL.

Safe automatic grouping can use:

- the same provider source identity;
- the same employer-owned canonical application URL;
- a reviewed employer identity plus exact normalized requisition identifier; or
- a high-precision evaluated combination of employer, title, location, and content fingerprint.

Fuzzy candidates remain separate or appear as “possible duplicate.” Clustering may collapse cards for display, but matching, freshness, H-1B wording, and application links remain source-specific.

## Result experience

The Jobs section becomes a metasearch surface with:

- one query bar and a visible active Discovery Profile;
- filters for role family, work mode, remote geography, location, source, compensation, freshness, evidence match, current sponsorship wording, employer history, tracked state, and candidate archive state;
- deterministic sorts: newest source date, recently verified, evidence fit (validated cohorts only), and title/company;
- grouped source variants with the freshest employer-authoritative variant first;
- badges that name evidence precisely: `Employer ATS verified`, `Provider reported`, `Recheck overdue`, `Recheck blocked`, `Remote — US only`, `Role says no sponsorship`, `Historical filing evidence`, and `Unknown`;
- “Why shown” with selected role family, confirmed evidence links, explicit exclusions, and rule version;
- the existing Compare, Explain fit, Track, and Archive actions; and
- no auto-apply or implied delivery.

## Delivery phases

### Phase 0 — rights and schema foundation

**Effort:** small

**Deliverables:** deny-by-default source registry, full rights/retention matrix, immutable raw snapshots and normalized versions, canonical lifecycle/workplace vocabulary, source-specific freshness policy, target source shortlist.

No adapter is enabled merely because an endpoint is technically reachable.

### Phase 1 — trustworthy current sources

**Effort:** medium

**Deliverables:** generalized provider result/run contract, immutable verification attempts, availability records, complete/partial scan handling, provider observation dates, closure transitions, method-qualified verification UI, canonical work-mode evidence, remote geography, and work-mode/freshness filters.

Backfill existing roles with unknown verification and `lastVerifiedAt = null`, then let a successful source refresh establish the correct authority and health. Do not manufacture `firstSeenAt` from local `updatedAt`.

### Phase 2 — candidate-controlled discovery

**Effort:** medium

**Deliverables:** candidate-approved Discovery Profile with titles, families, seniority, industries, skills, commute/relocation, work mode/geography, compensation, source/freshness preferences, authorization statement version/expiry, matcher/normalizer versions, and deterministic query suggestions/explanations.

### Phase 3 — direct ATS expansion and routing

**Effort:** medium

**Deliverables:** SmartRecruiters adapter, provider-specific pagination and fixtures, source schedules, attribution/provenance cards, and rights-permitted safe routing from a canonical apply link to a recognized ATS detail or complete-board recheck. Workable or Recruitee stays disabled unless an employer/provider authorizes broad use.

Improve the existing adapters at the same time:

- Greenhouse: preserve `updated_at`, departments/offices/language when available;
- Lever: canonicalize `workplaceType`, retain all locations, country, team/department/level and salary fields;
- Ashby: preserve `publishedAt`, `workplaceType`, secondary locations, department/team/employment type, and compensation when requested.

### Phase 4 — one rights-approved discovery feed and grouping

**Effort:** medium plus access dependency

**Deliverables:** one 14-day non-production bake-off—Adzuna only after written rights for Nimanto's exact display/retention and, separately, ATS recheck/canonical-link behavior, or a contracted LinkUp/Lightcast trial—plus source-preserving `RoleCluster` display. Jooble follows only after written clarification. WWR, Remotive, and The Muse remain disabled pending written permission.

Start with one source per class. Measure unique, verified, candidate-relevant roles before adding another feed.

### Phase 5 — H-1B evidence expansion

**Effort:** large

**Deliverables:** current role-wording evidence with locator/time/candidate confirmation, employer entity/alias registry, DOL edition pipeline, optional current USCIS edition, role-card evidence panels, warning-only fallback, and precision/abstention evaluation.

Keep government ingestion local, checksum-addressed, reproducible, and bounded to relevant employer records rather than sending raw candidate data to an external enrichment service.

### Phase 6 — marketplace and enterprise decision

**Effort:** large plus external dependency

**Deliverables:** compare the successful Phase 4 source with LinkUp/Lightcast proposals; enable USAJOBS only under its accepted declared-use plan; add adapter shells and contract/revocation tests for other approved partner APIs.

The exit is a user-complete marketplace: existing ATS inventory, SmartRecruiters, at least one rights-approved broad feed, source grouping, and remote/freshness/H-1B evidence filters. LinkedIn, Indeed, Glassdoor, ZipRecruiter discovery, Workday, and iCIMS remain disabled until access is documented. Partnership lead time can exceed implementation time.

## Acceptance gates

### Source and freshness

- 100% of roles shown as `Employer ATS verified` have employer-ATS authority and a `lastVerifiedAt` inside that source's TTL; provider-feed records are labeled `Provider reported`.
- No failed, truncated, rate-limited, or partial scan closes a role.
- A definitive detail-not-found or two complete misses at least six hours apart closes the role and leaves its Application history intact.
- `sourcePostedAt`, `sourceUpdatedAt`, `lastSeenAt`, and local `updatedAt` are never substituted for one another.
- Every enabled adapter has terms-review, attribution, request-budget, pagination, response-size, redirect, retry, deletion, and deny-by-default execution/emergency-pause tests.
- Rights records cover allowed display/deep-link/derived fields, raw TTL, normalized retention, update/deletion SLA, commercial use, AI/training restrictions, and termination purge.

### Remote and filters

- Structured `remote`, `hybrid`, and `onsite` fixtures map deterministically for every source.
- Ambiguous text remains `unknown`; it is never included in “Remote only.”
- Remote geography restrictions are visible and independently filterable.
- Candidate and posting geography use the same canonical country/subdivision/metro identifiers and IANA timezones; ambiguity, cross-border eligibility, and timezone-boundary fixtures filter deterministically or remain `unknown`.
- Filter combinations are pure, keyboard accessible, and reset at the existing identity boundary unless a Discovery Profile is explicitly saved.

### H-1B integrity

- Every role/company/history label has exact wording or a dataset locator, edition, period, checksum, transformation version, and limitation.
- Identity-only résumé changes do not change discovery or matching output.
- Historical data never produces `current_role_transfer_support` or a personal eligibility statement.
- Employer resolution meets the existing reviewed precision gate or abstains.
- Exclusion from the recommended view has zero false positives on a held-out precision-first set or remains warning-only; recall is reported separately, historical absence is never a blocker, and every role remains searchable.
- Evidence-fit sorting is unavailable for `experimental_unvalidated` role families until their own held-out gates pass.

### Marketplace behavior

- A grouped result preserves each source variant, URL, content hash, freshness state, and role wording.
- The candidate can explain why every result appeared and can correct source facts or Discovery Profile selections.
- Same input snapshots and rule versions reproduce the same filter, grouping, and explanation output.
- No adapter applies, sends messages, creates packets, or changes external-action authority.
- Export/deletion tests cover Discovery Profiles/versions, redacted query references, source runs, raw payloads, normalized snapshots, verification attempts, availability transitions, clusters, metrics, caches, queues, exports, and backup suppression.

## Metrics for deciding whether to add the next source

Measure per source for a 14-day non-production bake-off with enough successful refreshes to exercise its declared cadence:

- fetched roles;
- roles employer-ATS verified and roles only provider-reported;
- unique roles after high-confidence grouping;
- roles within selected families/locations/work modes;
- roles with explicit current sponsorship wording;
- roles with resolvable historical employer evidence;
- candidate tracks, archives, source-link opens, and applications, as private local counts;
- freshness failures, partial scans, rate limits, and closure reversals; and
- attribution/license incidents.

Do not use raw posting volume as the expansion criterion. Prefer sources that add unique, current, relevant roles.

## Recommended foundation and first marketplace MVP

The smallest coherent **foundation** is:

1. availability evidence and source runs for the existing three ATS adapters;
2. canonical work modes plus Remote/Hybrid/On-site/Unknown filters;
3. `sourcePostedAt`, nullable `lastVerifiedAt`, separate publication/verification states, and method-qualified UI;
4. candidate-approved, versioned Discovery Profiles derived from one selected Profile Version or entered manually;
5. SmartRecruiters as the first new adapter.

That foundation improves today's curated company-board workflow but is not yet an Expedia-like marketplace. The **first user-complete marketplace MVP** additionally requires one rights-approved broad discovery feed, rights-permitted ATS reverification, and source-preserving grouping. Workable or another employer-authorized ATS can follow only when the required permission exists.

The role-card H-1B panel follows in Phase 5, after exact wording/locator persistence, candidate confirmation, and precision gates exist. Until then, existing historical signals stay separate and cannot affect fit rank.

| Milestone | Can ship without new provider rights? | External dependency | Exit gate |
| --- | --- | --- | --- |
| Trustworthy existing ATS foundation | Yes, subject to a current rights record for each existing source | None beyond review | Phase 1 freshness/work-mode gates pass |
| Candidate-controlled discovery | Yes | None | Phase 2 privacy, replay, export, and deletion gates pass |
| SmartRecruiters | Only after its source-specific review | Provider terms decision | Phase 3 adapter and closure fixtures pass |
| Marketplace MVP | No | Written/licensed broad-feed rights, including recheck/canonicalization terms where used | Phase 4 14-day bake-off and grouping gates pass |
| H-1B recommended-view exclusion | No by default | Qualified immigration-language review and zero-false-positive evaluation | Otherwise warning-only; role remains searchable |
| Restricted major boards | No | Explicit partner agreement | Adapter remains disabled until documented |

## Primary references

- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Lever Postings API](https://github.com/lever/postings-api)
- [Ashby Job Postings API](https://developers.ashbyhq.com/docs/public-job-posting-api)
- [SmartRecruiters Posting API endpoints](https://developers.smartrecruiters.com/docs/endpoints)
- [Workable employer careers-page guidance](https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page)
- [Recruitee Careers Site API](https://docs.recruitee.com/reference/intro-to-careers-site-api)
- [We Work Remotely public RSS](https://weworkremotely.com/remote-job-rss-feed) and [API terms](https://weworkremotely.com/api-terms-and-guidelines)
- [Remotive public API terms](https://remotive.com/remote-jobs/api)
- [LinkUp job market data](https://www.linkup.com/data)
- [Lightcast Global Job Postings API](https://docs.lightcast.io/lightcast-api/reference/overview-global-job-postings)
- [Jooble REST API](https://help.jooble.org/en/support/solutions/articles/60001448238-rest-api-documentation)
- [The Muse public API](https://www.themuse.com/developers/api/v2) and [API terms](https://www.themuse.com/developers/api/v2/terms)
- [Adzuna API](https://developer.adzuna.com/overview) and [API terms](https://developer.adzuna.com/docs/terms_of_service)
- [USAJOBS API registration](https://developer.usajobs.gov/apirequest/index), [Search API](https://developer.usajobs.gov/api-reference/get-api-search), and [API terms](https://developer.usajobs.gov/guides/terms-of-use)
- [Google JobPosting guidance](https://developers.google.com/search/docs/appearance/structured-data/job-posting) and [Schema.org JobPosting](https://schema.org/JobPosting)
- [DOL OFLC performance disclosure data](https://www.dol.gov/agencies/eta/foreign-labor/performance)
- [DOL H-1B program](https://www.dol.gov/agencies/whd/immigration/h1b)
- [USCIS H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub)
- [LinkedIn API access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
- [ZipRecruiter Partner Platform](https://www.ziprecruiter.com/partner/documentation/)
