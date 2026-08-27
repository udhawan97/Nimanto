# Job-source expansion research

**Status:** research baseline used for the implemented marketplace foundations. It grants no provider access, data-rights approval, partnership, launch, release, or deployment authority; unapproved sources remain disabled in the runtime registry.

**Research date / source access date:** 2026-08-26

**Repository baseline:** Nimanto 0.8.0 at `3d7c696b6163632684a71efada1d49f319ae7da5`

## Executive recommendation

Nimanto should not try to become a general job-board crawler. The defensible version of an “Expedia for jobs” uses two complementary layers:

1. **Breadth from a licensed discovery feed** whose contract expressly permits Nimanto's end-user search, display, caching, retention, and deep-link use.
2. **Truth from the employer's current ATS posting** whenever a board-specific source is known, so Nimanto can recheck whether a role is still published and retain field-level provenance.

Start by hardening the existing Greenhouse, Lever, and Ashby integrations, adding SmartRecruiters, and building work-mode and lifecycle normalization. In parallel, seek written approval for an Adzuna quality trial and obtain LinkUp and Lightcast proposals. Jooble is a secondary pilot candidate only after written clarification of commercial display, storage, and retention rights. “Best source” should then be selected from measured US coverage, direct-employer coverage, successful reverification, dead-link rate, duplicate rate, and usable work-mode fields—not brand recognition.

Do not scrape LinkedIn, Indeed, Glassdoor, Google Jobs, or any other site that has not granted the required use. Public accessibility, a public GET endpoint, or a search result is not permission to aggregate or redistribute it.

## Current Nimanto baseline and gaps

The existing product has the correct trust posture: it is candidate-controlled, treats historical sponsorship data as evidence rather than a promise, uses deterministic matching, deep-links to provider-hosted applications, and prohibits scraping restricted providers. Its implementation is still a company-board importer, not a broad search catalog.

| Area | Current 0.8.0 behavior | Gap to close |
|---|---|---|
| Source breadth | Greenhouse, Lever, and Ashby; the user supplies a provider and board/organization identifier. | No broad licensed discovery layer and no automatic route from a discovered job to its employer ATS record. |
| Provider mapping | Common fields include ID, title, company, description, one location string, work mode, URL, requirements, hash, and source metadata. | Valuable official fields are dropped: source-published/updated dates, expiry/deadline, secondary locations, remote scope, structured employment/compensation fields, and many provider-specific status signals. |
| Work mode | Values are not canonical across providers; Greenhouse is `unspecified`, Lever can retain `on-site`, and Ashby's boolean remote flag becomes `remote` or `unspecified`. | `on-site` does not equal the matching engine's current `onsite` literal; hybrid, remote geography, conflicting evidence, and multiple physical locations are not represented reliably. |
| Freshness | An import upserts a mutable current role and refreshes the database `updated_at`. | A fetch time can be mistaken for a source change. There is no separate first/last seen, last successful verification, source-posted/source-updated, expiry, missing-since, or consecutive-miss state. Board disappearance is not a tombstone. |
| Filtering | Search supports text/title/company/location plus source, fit, tracking, and candidate visibility filters. | No canonical remote/hybrid/on-site filter, remote eligibility geography, verification recency, or “recently confirmed published” control. |
| Deduplication | Unique provider + source job ID. | The same job from a discovery feed and direct ATS remains duplicated; there is no reviewed canonical-URL/content lineage. Fuzzy similarity must propose, not silently merge. |
| Matching | Deterministic match bands use confirmed candidate evidence; visible blockers cover sponsorship, citizenship, clearance, and a limited location conflict. | Resume-derived evidence and job requirements need a versioned, candidate-approved projection. Role-family, seniority, multi-location, commute/relocation, salary, and remote-scope preferences need explicit fields. |
| H-1B context | Dated labels, employer-resolution abstention, freshness downgrades, dataset edition, parsed-row checksum, transform version, and row locator already prevent a historical filing from becoming a current promise. | Add original archive/layout hashes and authoritative source URLs. Separately, the current matcher regex-matches posting descriptions and can emit `exclude_from_recommendations` without a persisted candidate-confirmed exact posting fact or locator; that path must become warning-only until a precision-first gate passes. |

The target schema described in `docs/planning/architecture.md` already anticipates immutable raw snapshots, normalized versions, source timestamps, first/last seen, expiry/status, rights policy, and duplicate lineage. Expansion should implement that contract rather than adding more fields to the current mutable record ad hoc.

## Source ranking and access posture

This ranking evaluates *fit for Nimanto*, not the size or popularity of the consumer job site. “Public” below describes documented technical access only; it is not a conclusion about redistribution rights.

| Rank / source | Documented access | What it contributes | Recommendation and access constraint |
|---|---|---|---|
| **A — Greenhouse Job Board API** | Public GET endpoints for a named board's published jobs; listing and job details include IDs, URLs, location, `updated_at`, and optional detail fields. | Direct employer-hosted record; `first_published`, `application_deadline`, offices/departments, and pay-transparency fields are available on detailed responses. | **Harden now.** Keep it curated/company-scoped and deep-link to the original. A public GET does not by itself grant broad redistribution rights. [Official docs](https://docs.greenhouse.io/job-board.html) |
| **A — Lever Postings API** | Public endpoints for one account's published postings; the official repository says it does not provide full-text search across all Lever jobs. | Direct employer record, stable ID, all locations, country, hosted/apply URLs, optional salary, and `unspecified` / `on-site` / `remote` / `hybrid` workplace values. | **Harden now.** Normalize `on-site` to `onsite`; ingest all locations and country. Keep company-scoped. [Official repository](https://github.com/lever/postings-api) |
| **A — Ashby public job-posting API** | Public endpoint for one organization's currently published jobs. | Direct record with secondary locations, address, workplace type, `publishedAt`, employment type, and optional compensation. | **Harden now.** Prefer structured `workplaceType` over only `isRemote`; preserve all locations. Keep organization-scoped. [Official docs](https://developers.ashbyhq.com/docs/public-job-posting-api) |
| **A — SmartRecruiters Posting API** | Public Posting API lists active postings for a specified company and supports an individual-posting lookup. | Direct active state, `releasedDate`, structured country/region/city, and remote boolean plus job dimensions. | **Add next** as a direct verifier after rights review. It expands ATS coverage, not global discovery. [Official endpoint guide](https://developers.smartrecruiters.com/docs/endpoints) |
| **B — Adzuna** | Registered API credentials; broad keyword/location search. Published default quota is 25/minute, 250/day, 1,000/week, and 2,500/month. | Practical low-volume broad-discovery candidate with documented attribution requirements. | **Rights-gated pilot.** The reviewed terms describe publication with attribution and restrictions on commercial use, but that interpretation is not legal approval for Nimanto. Do not call the API for a trial or production until a dated rights matrix confirms display, cache, retention, deletion, attribution, and commercial use. [Official overview](https://developer.adzuna.com/overview), [official terms](https://developer.adzuna.com/docs/terms_of_service) |
| **B — Jooble** | API key; keyword/location/radius/salary/page search, with ID, title, company, source, link, type, and updated fields in the documented response. | Broad discovery and a useful source update timestamp. | **Secondary pilot only after written terms clarification.** Regional key scope, production quotas, price, display, caching, and retention rights are not established by the public API instructions reviewed. [Official API docs](https://help.jooble.org/en/support/solutions/articles/60001448238-rest-api-documentation), [connection guide](https://help.jooble.org/en/support/solutions/articles/60000922689-how-to-connect-to-the-jooble-rest-api) |
| **Enterprise candidate — LinkUp** | Commercial data product delivered as licensed feeds. | Employer-direct job data and explicit posted, updated, removed, and last-checked dates make it especially strong for freshness. | **Request proposal and trial.** Price and Nimanto-specific consumer display/retention rights are contract questions. Do not imply access before a signed agreement. [Official data page](https://www.linkup.com/data) |
| **Enterprise candidate — Lightcast Global Job Postings** | OAuth API under commercial access; documented filters include active status, company, occupation, skills, and geography; default documented limit is five requests/second. | Broad normalized coverage and occupational/skill enrichment. | **Request proposal and trial.** Confirm price, raw-content retention, display/deep-link rights, provenance detail, deletion obligations, and freshness SLA in the contract. [Official API overview](https://docs.lightcast.io/lightcast-api/reference/overview-global-job-postings) |
| **Partner / employer-authorized — Workable** | Full API uses an employer's Super Admin token; its careers-page guidance also documents public endpoints for published jobs. | Potential direct employer record; exact fields depend on the authorized endpoint and must not be conflated with a separate XML-feed format. | **Add only for an authorizing employer or after provider approval.** The reviewed documentation is for an employer's own account/careers page, not a grant for broad third-party aggregation. [Official guidance](https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page) |
| **Partner / employer-authorized — Recruitee** | Its Careers Site API is unauthenticated and supports displaying an employer's offers; its separate ATS API is token-authenticated. | Another direct ATS verification path. | **Partner-only pending a broad-use rights review.** Technical access to a company's careers endpoint does not by itself grant catalog-wide aggregation, storage, or redistribution rights. [Careers Site API](https://docs.recruitee.com/reference/intro-to-careers-site-api), [ATS authentication](https://docs.recruitee.com/reference/getting-started) |
| **Specialized / declared-use approval — USAJOBS** | Official search API with an API key obtained through a declared-use registration. | Authoritative federal postings and structured search. | **Defer until OPM accepts Nimanto's declared use plan.** The implementation may normalize/deduplicate internally only within the approved use, must retain USAJOBS source credit, preserve displayed source values, and use USAJOBS view/apply links. Parse hiring paths, citizenship, clearance, and authorization language; never infer eligibility from agency alone. The registration page was access-blocked during this review, so re-verify its current terms before enabling. [API registration](https://developer.usajobs.gov/apirequest/index), [official search API](https://developer.usajobs.gov/api-reference/get-api-search), [official terms](https://developer.usajobs.gov/guides/terms-of-use) |
| **Terms-conflicted — We Work Remotely** | A public RSS page exists, but the site's API terms separately prohibit using its data to build a job-search service and prohibit scraping, copying, saving, or storing the API data. | Remote-only inventory if a commercial agreement expressly grants it. | **Disabled pending written permission.** The permissive RSS wording does not override the product-use and storage restrictions in the API terms. [RSS page](https://weworkremotely.com/remote-job-rss-feed), [API terms](https://weworkremotely.com/api-terms-and-guidelines) |
| **Terms-conflicted — Remotive** | Public API results are delayed by 24 hours and require attribution/link-back; published terms limit polling to four calls per day and prohibit displaying jobs as a gate for collecting signups/email addresses. | Remote inventory and geography when used under an appropriate agreement. | **Disabled pending explicit approval for Nimanto's private/invite workbench.** Obtain a private/commercial API agreement or written confirmation covering product access, display, retention, request budget, and attribution. [Official public API terms](https://remotive.com/remote-jobs/api) |
| **Defer — The Muse** | Public jobs API with published rate limits. | Additional curated job discovery. | **Do not integrate without written approval.** Its API terms restrict product replication and require linking back; Nimanto's aggregation concept may conflict with those restrictions. [Official API](https://www.themuse.com/developers/api/v2), [official terms](https://www.themuse.com/developers/api/v2/terms) |
| **Not a discovery feed — ZipRecruiter Job API** | Partner API for creating, updating, and closing jobs in ZipRecruiter. | Employer/job-publisher distribution, not candidate-side job search. | **Do not use for this roadmap.** It is the wrong direction of data flow. [Official partner docs](https://www.ziprecruiter.com/partner/documentation/job-api/) |
| **Semantic standard, not a source — Google `JobPosting`** | Structured-data specification for employer pages; no job-search retrieval API is granted by this documentation. | Useful canonical semantics for `TELECOMMUTE`, applicant-location requirements, physical/hybrid locations, and `validThrough`. | **Use as a normalization reference only.** It does not authorize crawling Google or employer pages. [Official structured-data docs](https://developers.google.com/search/docs/appearance/structured-data/job-posting) |

### Explicit no-scrape / approval-only list

- **LinkedIn:** no browser automation, bots, extraction, or third-party scraper. Its documented job APIs are vetted programs, not open catalog access. Use only after explicit program approval and a rights review. [LinkedIn automation help](https://www.linkedin.com/help/linkedin/answer/a1341387), [Job Posting API terms](https://www.linkedin.com/legal/l/job-posting-api-terms)
- **Indeed:** no scraping, permanent database, product replication, or production integration outside the applicable approved developer purpose. Written approval is required before launch under the reviewed developer agreement. [Indeed developer agreement](https://docs.indeed.com/legal-terms/developer-agreement)
- **Glassdoor:** no automated scraping/mining, deep-linking, or competitive use without written permission under the current reviewed terms. [Glassdoor terms](https://www.glassdoor.com/about/terms/)
- **Google Jobs:** do not scrape search results. `JobPosting` is publisher markup guidance, not a retrieval license.
- Do not use browser extensions, RPA, residential proxies, “scraping APIs,” or purchased datasets to route around these boundaries. User-supplied posting text or files may remain tenant-private under Nimanto's existing contract, but must not enter a shared catalog, fixtures, training, or redistribution.

## Canonical work-mode and geography model

Work mode and remote eligibility are separate questions. A role can be remote while limited to a country, state, metro, or timezone; “remote” must not mean “work from anywhere.”

```ts
type WorkplaceMode = "remote" | "hybrid" | "onsite" | "unknown" | "conflicting";
type RemoteScope = "unrestricted" | "country" | "state_region" | "metro" | "timezone" | "unspecified";

interface WorkplaceEvidence {
  mode: WorkplaceMode;
  remoteScope: RemoteScope;
  eligibleRemoteAreas: StructuredArea[];
  physicalLocations: StructuredLocation[];
  evidenceKind: "explicit_provider_field" | "structured_page_data" | "exact_posting_text" | "location_hint" | "unknown";
  sourceFieldOrLocator: string;
  sourceValue: string;
  observedAt: string;
  confidence: "explicit" | "structured" | "text_inferred" | "unknown";
  normalizerVersion: string;
}
```

Normalization precedence should be explicit ATS field, then structured data from an approved source or authorized employer page, then exact posting text from an approved source or candidate-supplied private content, then location hint. Google `JobPosting` syntax is a semantic reference, not crawl permission. Conflicting high-quality observations must all be retained and stay `conflicting`; the current projection must not silently pick a winner. Never infer work mode from the employer's general policy or another posting.

Candidate filters should offer **Remote only**, **Remote + hybrid**, **On-site + hybrid**, and **All**, with an independent **include unknown** control. Remote filters also apply candidate-selected eligible areas/timezones. On-site and hybrid filters apply candidate commute radius, accepted metros, and relocation preference. Preserve each source's exact raw value so candidates can audit any normalization.

## Freshness, closure, and verification

### Lifecycle schema

```ts
type PublicationState = "active" | "possibly_closed" | "closed" | "expired";
type VerificationHealth = "verified" | "provider_reported" | "blocked" | "overdue" | "unknown";
type VerificationAuthority = "employer_ats" | "licensed_provider" | "authorized_employer_page" | "candidate_review" | "unknown";

interface PostingLifecycle {
  sourcePostedAt?: string;
  sourceUpdatedAt?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string | null;
  nextVerifyAt: string;
  expiresAt?: string;
  missingSince?: string;
  consecutiveSuccessfulMisses: number;
  publicationState: PublicationState;
  verificationHealth: VerificationHealth;
  verificationAuthority: VerificationAuthority;
  verificationMethod: "individual_endpoint" | "active_board_snapshot" | "provider_feed" | "structured_employer_page" | "manual";
  verificationResult: "present" | "not_found" | "absent_from_complete_list" | "expired" | "blocked" | "error";
  contentHash: string;
  sourcePolicyVersion: string;
}
```

Database `updated_at` is an internal mutation timestamp, never a job-age field. Store observations/snapshots immutably and project a current record from them.

Persist each verification attempt and result as an immutable event. Backfilled roles begin with `lastVerifiedAt = null`, `verificationHealth = "unknown"`, and their last known publication state; no local timestamp may manufacture a verification.

### Recheck strategy

- Mark **closed immediately** after a successful direct recheck returns an unambiguous `404`/`410` or provider-specific closed state. Mark **expired** when an authoritative deadline/`validThrough` is past.
- One absence from a complete, successfully fetched and fully paginated active-board snapshot becomes **possibly closed**, followed by a 6–12 hour recheck. Close after an individual endpoint confirms absence or two successful complete snapshots at least six hours apart both omit it.
- A timeout, `429`, `5xx`, authentication failure, redirect refusal, malformed response, or emergency source pause sets verification health to **blocked** while preserving the last known posting state. It must never be converted into a closure or a successful verification.
- Recheck candidate-shortlisted or application-linked roles every 6–24 hours; other active roles daily; possibly closed roles in 6–12 hours. Stop frequent checks after closure but retain provenance until the candidate's retention/deletion policy removes it.
- Age alone never proves closure. After 45 days without a successful recheck, label the record **not recently confirmed** and exclude it by default from **Recently confirmed published**, while keeping it searchable with the warning.
- Display method-qualified labels: **Employer ATS verified [timestamp]**, **Provider reported [timestamp]**, **Recheck overdue**, **Recheck blocked; last known state [state, timestamp]**, or **Source posting closed/expired [timestamp and evidence]**. Never call a licensed-feed observation “employer verified.” ATS presence confirms that source record was published at that time; it does not prove that recruiting is active, that the employer is legitimate, or that a related role was not reposted under another ID.

The Google `JobPosting` guidance supports the semantic treatment of a past `validThrough`, `404`/`410`, or removed structured markup as expiry/closure signals for an approved publisher surface. It does not create crawling permission.

### Duplicate lineage

Use provider + stable source job ID first, then a reviewed canonical apply URL. A discovery adapter may resolve a canonical apply link through a bounded safe-redirect policy and map recognized ATS hosts/identifiers to a direct detail or complete-board recheck. The source contract must permit that resolution; Adzuna records, in particular, must not be rechecked against the third-party employer, canonicalized, or have their deep link substituted until Adzuna grants that use in writing. Normalized employer + title + locations + content similarity may only propose a duplicate link. A candidate or deterministic high-precision rule can confirm lineage; Nimanto must preserve every source observation and explain which field won. Never silently merge based on fuzzy text.

## H-1B evidence without a sponsorship promise

Use three separate evidence families and show them separately:

1. **Current posting language:** exact, located wording from the active posting, such as an explicit no-sponsorship requirement. This is role-specific and expires with the posting.
2. **DOL OFLC LCA disclosure:** historical attestations/applications by legal employer, occupation, worksite, wage, program, and disclosure period. DOL's current performance page publishes quarterly files and layouts; as of this research date the latest listed FY2026 Q3 release covers determinations issued from 2025-10-01 through 2026-06-30. An LCA precedes an H-1B petition and is not proof of USCIS petition approval, an open role, or present employer policy. [DOL disclosure data](https://www.dol.gov/agencies/eta/foreign-labor/performance), [DOL H-1B program](https://www.dol.gov/agencies/eta/foreign-labor/programs/h-1b)
3. **USCIS H-1B Employer Data Hub:** historical petition-decision aggregates, including initial and continuing employment categories. This is not a promise to sponsor this role or candidate. The official hub pages returned automated-access denials during this review; availability, file periods, and layouts must be verified manually before a new edition is enabled. [Official hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub), [official FY2024 characteristics report](https://www.uscis.gov/sites/default/files/document/reports/ola_signed_h1b_characteristics_congressional_report_FY24.pdf)

For every government edition, retain the exact source URL, program, fiscal quarter/year, covered dates, retrieval time, original archive and layout, SHA-256, row locator, transform version, and employer-resolution version. Stop the affected pipeline when a layout or meaning changes. Employer resolution should use exact normalized legal names and reviewed aliases and must abstain on ambiguity; absence of a match is **unknown**, never “does not sponsor.”

Safe labels include **Historical LCA filing observed — FY2026 Q3**, **Historical USCIS continuing-employment decision data observed — [period]**, and **Explicit posting restriction — verified [date]**. Unsafe labels include **Sponsors H-1B**, **Transfer friendly**, **Will sponsor you**, or any hiring/approval probability.

Qualified immigration and data-rights review remains a launch gate; Nimanto is organizing sourced evidence, not providing legal advice.

## Deterministic resume and preference matching

Each search should bind a candidate-selected, versioned **search profile**, not silently score against every uploaded resume. The approved projection should contain:

- one selected resume/evidence version and candidate-confirmed claims;
- selected role families, alternate titles, seniority, skills, and industries;
- accepted locations, commute radius, relocation preference, workplace modes, remote eligibility areas/timezones, and salary floor;
- hard exclusions such as citizenship, clearance, and exact work-authorization conflicts; and
- the candidate's exact, confirmed authorization/sponsorship-needs statement, with an expiry/reconfirmation policy.

Use the current O*NET database as a version-pinned occupational taxonomy for title aliases, occupations, tasks, and skills, with required attribution. O*NET's official page lists release 31.0 on the research date and a CC BY 4.0 license. It is a taxonomy aid, not job inventory and not a substitute for candidate confirmation. [O*NET database](https://www.onetcenter.org/database.html)

The deterministic matcher should emit factor scores, exact evidence locators, missing-information penalties, and visible blockers under a versioned rule set. Models may suggest requirement extraction, title-to-occupation mappings, or resume evidence, but suggestions remain pending until confirmed and may not alter scoring, invent claims, or produce immigration conclusions. H-1B status and historical employer evidence must not become positive or negative fit/rank features. Only **potential conflicts** backed by verbatim posting language, a locator, observation time, and candidate-confirmed facts may create visible warnings. A posting remains searchable; exclusion from a recommended view is allowed only after candidate confirmation or a held-out, precision-first, zero-false-positive evaluated gate. Report recall, but do not optimize exclusion for recall. Until that gate passes, the current regex path is warning-only. Nimanto must not convert sponsorship wording into a legal-eligibility conclusion.

### Candidate privacy and hostile-source boundary

Job-source requests must never contain a resume, H-1B status, authorization statement, candidate-specific evidence, or private search history. Default discovery uses non-personal catalog pulls or coarse title/location fields; an optional coarse provider query requires separate consent and still cannot include immigration facts. Persist only a versioned server-keyed HMAC or opaque random reference in source runs, never an unkeyed hash of low-entropy title/location values, and delete it under the run's retention rule. Provider credentials and source payloads remain tenant-isolated; logs redact job content, URLs/query strings, candidate data, and secrets; source data follows explicit retention/export/deletion rules; and any model receives only the consented minimum fields under the existing model boundary.

Treat posting HTML, URLs, and attachments as hostile. Sanitize markup, discard scripts/forms/tracking pixels, validate apply domains and every redirect, never forward session credentials, and offer report/block controls. A posting's presence on an ATS is freshness evidence for that source record—not authentication of employer legitimacy.

## Phased delivery plan

| Phase | Scope | Exit gate | Indicative solo effort / uncertainty |
|---|---|---|---|
| **0 — Rights and schema foundation** | Deny-by-default source registry, allowed-use/retention matrix, execution/pause controls, immutable raw snapshots and normalized versions, lifecycle/workplace schemas, duplicate lineage, source health metrics. | Every enabled source has dated terms/contract evidence, an owner, deletion/export behavior, and tested execution/pause controls; provider failure cannot mark a job closed. | About 1–2 weeks. Legal review time is external and unbounded. |
| **1 — Trustworthy current sources** | Capture useful Greenhouse/Lever/Ashby timestamps and locations; canonicalize work mode; add immutable verification attempts, complete-scan evidence, closure rechecks, and method-qualified freshness labels/filters. | Fixtures cover all canonical modes, conflicts, outages, two misses at least six hours apart, direct not-found, expiry, and nullable backfill verification. No failed/partial fetch closes a role. | About 2–3 weeks; no broad-source fee assumed. |
| **2 — Candidate-controlled discovery** | Ship a candidate-selected, versioned Discovery Profile covering resume/evidence version, role families, titles, seniority, skills, industries, workplace modes, remote/physical geography, commute, relocation, compensation, and authorization-conflict preferences, plus deterministic explanations and filters. | Profile selection/version changes, privacy boundaries, deterministic replay, preference combinations, retention, export, and deletion pass end-to-end. A résumé/profile cannot change discovery without candidate action. | About 1–2 weeks. |
| **3 — Direct ATS expansion and routing** | Add SmartRecruiters; evaluate Workable/Recruitee only for authorized employers. Build safe canonical-link/redirect routing from an approved discovery record to recognized ATS detail or complete-board verification. | Per-source rights review, fixed-host network policy, bounded imports, fixtures, provenance coverage, and provider-specific closure tests pass. | Roughly 1–2 weeks per source; provider approval timing unknown. |
| **4 — One rights-approved discovery feed and grouping** | After dated approval, run one 14-day non-production bake-off: Adzuna only if its approval expressly permits ATS rechecks/canonicalization, or a contracted LinkUp/Lightcast trial. Jooble follows only after written clarification. Add source-preserving `RoleCluster` display. WWR, Remotive, and The Muse remain disabled pending written permission. | Written display/cache/retention/delete/attribution/canonicalization rights; measured US role coverage, employer-ATS verification rate where permitted, dead-link/duplicate rates, work-mode coverage, and cost per recently confirmed unique role. | About 2–4 weeks plus contracting; public quotas may constrain sample size. |
| **5 — H-1B evidence expansion** | Versioned quarterly DOL ingestion; separately gated USCIS ingestion after current official files/layouts and access are manually verified; employer resolution; exact role-wording facts. | Archive/layout hashes and source URLs, copy tests, warning-only fallback, candidate confirmation, zero-false-positive exclusion evaluation, resolver precision/abstention thresholds, freshness downgrades, and qualified review pass. | Initial 2–4 weeks plus quarterly operations; USCIS access/layout uncertainty remains. |
| **6 — Marketplace and enterprise decision** | Compare a successful Phase 4 source with LinkUp/Lightcast proposals; enable USAJOBS only under its accepted declared-use plan; add other partner adapters only after approval. | A user-complete marketplace has current ATS inventory, SmartRecruiters, at least one rights-approved broad feed, source grouping, verified filters, and acceptable freshness/provenance/deletion SLAs. | Price, procurement, and provider approval time are unknown. |

Do not sign or launch a discovery supplier until its written terms answer: end-user display, derived fields, caching and maximum retention, raw-content handling, canonical links and attribution, deletion/update obligations, geography, subprocessor/AI restrictions, rate limits, audit rights, termination/export, and whether Nimanto's aggregation is considered competitive use.

## “Best available source” governance

Maintain a dated source scorecard and review it quarterly. For each source and field, measure:

- unique US jobs after reviewed deduplication;
- share with a successful direct-employer recheck in the last 24 hours;
- dead-link and confirmed-closed-still-returned rates;
- time from employer closure to provider removal;
- duplicate and material-conflict rates;
- complete description, structured locations, explicit workplace mode/remote scope, source dates, compensation, and stable-ID coverage;
- H-1B employer-resolution precision and abstention rate—never filing volume as a hiring score;
- API error/rate-limit rate, attributable operator cost, contract restrictions, and deletion performance.

A new provider begins disabled, with synthetic/authorized fixtures, a dated rights decision, fixed-host/network budget, parser version, retention rule, health dashboard, deny-by-default execution flag, and emergency pause. It graduates only when it improves verified unique coverage without weakening freshness, provenance, candidate privacy, or restricted-source boundaries.

## Implementation acceptance gates

- Zero production requests to a restricted or unapproved provider; zero restricted-provider content in shared fixtures or catalog data.
- Every normalized field can identify its source observation, field/locator, retrieval time, and normalizer version.
- Canonical workplace tests cover provider spelling/case, all-locations arrays, remote geography, hybrid, conflict, and unknown.
- Freshness tests distinguish a successful absence from timeout, `429`, `5xx`, auth error, unsafe redirect, partial list, and parser failure.
- Directly confirmed source closure/expiry leaves the default **Recently confirmed published** result set; unknown or overdue roles remain visible only with their publication state, verification health, authority, and timestamp.
- Duplicate proposals are reversible and preserve all origins; no fuzzy silent merge.
- Resume/search-profile selection and every match band are deterministic, versioned, and explainable from confirmed evidence.
- H-1B copy never turns DOL LCA data, USCIS decisions, or employer-name similarity into a present sponsorship promise or hiring probability.
- H-1B exclusion has zero false positives on a held-out precision-first set or remains warning-only; report recall separately. An excluded role remains searchable outside the recommended view.
- Evidence-fit bands/sorts remain limited to validated US software/AI cohorts. Other role families are discoverable and labeled `experimental_unvalidated`, without fit-sort, until their own held-out gates pass.
- Each source has a dated approval owner, terms URL/version/review date, allowed display/deep-link/derived-field matrix, raw-body TTL, normalized-retention maximum, deletion/update SLA, commercial decision, AI/training prohibition, termination purge rule, cost/rate record, monitoring threshold, and tested deny-by-default execution/pause controls.
- Retention, export, and deletion tests cover Discovery Profiles and versions, redacted query references, source runs, raw payloads, normalized snapshots, verification attempts, availability transitions, clusters, metrics, caches, queues, exports, and backup suppression.

## Primary-source register

All sources below were accessed on **2026-08-26**. No secondary review, search-result snippet, or undocumented third-party API is used as authority.

- Greenhouse: [Job Board API](https://docs.greenhouse.io/job-board.html)
- Lever: [official Postings API repository](https://github.com/lever/postings-api)
- Ashby: [Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api)
- SmartRecruiters: [Posting API endpoints](https://developers.smartrecruiters.com/docs/endpoints)
- Workable: [careers-page API guidance](https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page)
- Recruitee: [Careers Site API introduction](https://docs.recruitee.com/reference/intro-to-careers-site-api), [ATS API introduction](https://docs.recruitee.com/reference/getting-started)
- Adzuna: [developer overview](https://developer.adzuna.com/overview), [API terms](https://developer.adzuna.com/docs/terms_of_service)
- Jooble: [REST API documentation](https://help.jooble.org/en/support/solutions/articles/60001448238-rest-api-documentation), [connection guide](https://help.jooble.org/en/support/solutions/articles/60000922689-how-to-connect-to-the-jooble-rest-api)
- LinkUp: [Job Market Data](https://www.linkup.com/data)
- Lightcast: [Global Job Postings API overview](https://docs.lightcast.io/lightcast-api/reference/overview-global-job-postings)
- We Work Remotely: [public RSS page](https://weworkremotely.com/remote-job-rss-feed), [API terms and guidelines](https://weworkremotely.com/api-terms-and-guidelines)
- Remotive: [public API terms](https://remotive.com/remote-jobs/api)
- The Muse: [API](https://www.themuse.com/developers/api/v2), [API terms](https://www.themuse.com/developers/api/v2/terms)
- ZipRecruiter: [Job API partner documentation](https://www.ziprecruiter.com/partner/documentation/job-api/)
- USAJOBS: [API registration](https://developer.usajobs.gov/apirequest/index), [Search API](https://developer.usajobs.gov/api-reference/get-api-search), [terms of use](https://developer.usajobs.gov/guides/terms-of-use)
- Google Search: [`JobPosting` structured data](https://developers.google.com/search/docs/appearance/structured-data/job-posting)
- LinkedIn: [automation policy help](https://www.linkedin.com/help/linkedin/answer/a1341387), [Job Posting API terms](https://www.linkedin.com/legal/l/job-posting-api-terms)
- Indeed: [developer agreement](https://docs.indeed.com/legal-terms/developer-agreement)
- Glassdoor: [terms of use](https://www.glassdoor.com/about/terms/)
- U.S. Department of Labor: [OFLC disclosure data](https://www.dol.gov/agencies/eta/foreign-labor/performance), [H-1B program](https://www.dol.gov/agencies/eta/foreign-labor/programs/h-1b)
- USCIS: [H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub), [FY2024 H-1B characteristics report](https://www.uscis.gov/sites/default/files/document/reports/ola_signed_h1b_characteristics_congressional_report_FY24.pdf)
- O*NET: [database releases and license](https://www.onetcenter.org/database.html)

## Open decisions before implementation

1. Which US fields and role families define the first broad-discovery benchmark, and what minimum direct-verification rate is acceptable?
2. Is Nimanto prepared to pay for an enterprise feed if it materially outperforms a low-volume Adzuna pilot on verified unique roles?
3. Will hosted Nimanto retain raw licensed descriptions, or can it minimize risk by retaining normalized evidence plus short source excerpts and always deep-linking?
4. Who provides qualified review for provider/data rights and immigration-language boundaries before the affected source or label is enabled?

The safest immediate product value is Phase 1: trustworthy work-mode filters and independently verified freshness across sources Nimanto already supports. Breadth should follow only when its rights and quality are proven.
