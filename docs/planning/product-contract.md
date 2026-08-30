# Nimanto product contract

**Status:** Historical production proposal; not a v0.1.0 implementation claim  
**Evidence snapshot:** 2026-08-05  
**Initial milestone:** Slices 1–3, implemented sequentially only after explicit approval

This document preserves the reviewed long-horizon target and its safety reasoning. The shipped local-beta depth, accepted substitutions, and still-closed production gates are recorded in the [v0.1.0 slice matrix](../releases/v0.1.0-slice-matrix.md). Where this proposal and the release matrix differ, the release matrix is the source of truth for current behavior.

## Product promise and boundary

Nimanto is a private, candidate-controlled job-search and application operating system for people who already hold H-1B status and are exploring a U.S. employer transfer. It helps a candidate preserve career evidence, find and assess roles, understand historical transfer-related signals, prepare truthful application material, and track outcomes.

Nimanto is not immigration counsel, an employer screening product, a universal job index, a hiring-probability model, or a high-volume auto-apply bot. It must never infer personal transfer eligibility, a lawful start date, petition strategy, or petition success. Department of Labor LCA data records employer attestations and determinations, not USCIS petition outcomes or a promise that a current role supports transfer ([DOL H-1B program](https://www.dol.gov/agencies/eta/foreign-labor/programs/h-1b), [OFLC disclosure data](https://www.dol.gov/agencies/eta/foreign-labor/performance)).

## Primary user and jobs to be done

The initial user is an individual H-1B holder in the United States who wants to change employers and needs a careful, explainable workflow rather than indiscriminate application volume.

They need to:

1. Build a Career Evidence Vault whose facts can be corrected, confirmed, exported, and deleted.
2. Discover or privately import relevant roles across AI/ML, software/technical, data/analytics, product, and business/strategy/operations/solutions families.
3. See which job requirements are supported, missing, inferred, unknown, or blocked, with exact profile and posting evidence.
4. See dated H-1B evidence without mistaking historical filings for current sponsorship policy.
5. Prepare and inspect truthful application materials, then approve a frozen artifact set.
6. Track their own outcomes and funnel history without being compared with an unobserved applicant pool.

## Candidate-controlled data

Allowed v1 inputs are résumés; employment history; projects, skills, certifications, and accomplishments; selected GitHub repositories and portfolio pages; preferences; and user-confirmed work-authorization facts and approved wording.

A LinkedIn input is limited to a positive allowlist from a user-downloaded archive—`Profile`, `Positions`, `Education`, `Skills`, `Certifications`, and `Projects`—or a sanitized profile PDF. Nimanto will preview every accepted file and field before ingestion. Messages, contacts, connections, invitations, advertising, and every unlisted archive section are structurally non-ingestible: they are dropped before parsing and no setting can enable them. The raw archive/PDF is encrypted while temporary and deleted after confirmed extraction unless the user deliberately selects a documented retention option. Nimanto never scrapes LinkedIn.

Nimanto v1 will refuse passports, Social Security numbers, visa stamps, I-797s, I-94s, attorney files, and other raw immigration identity or legal documents. If detected, the import is quarantined and the user is told to remove the material.

## Scope by slice

| Slice | Authorized outcome after approval | Explicitly not included |
|---|---|---|
| 1 — evidence to match | Invite-only passkey access; tenant isolation; private evidence vault; deterministic résumé and approved LinkedIn-export/PDF extraction with preview and confirmation; Greenhouse and manual job intake; deterministic match, seniority, coverage, and gap analysis; receipts, export, deletion; minimal accessible demo harness | Full dashboard/design system, model-generated facts, DOL/USCIS enrichment, external sending |
| 2 — transfer intelligence | Lever, approved allowlisted URL intake, DOL/USCIS bulk pipelines, employer resolution, transfer taxonomy, compensation/benefit context, interview evidence; scheduled discover/refresh/dedupe/score; manual application/outcome tracking and personal funnel | Unsupported crawling, personal legal advice, automatic external action |
| 3 — grounded packet | Provider-neutral local/BYOK model gateway; evidence-grounded packet; synchronized modern and ATS-safe DOCX/PDF; assurance and an approval queue for immutable artifact sets; scheduled preparation into that queue only | Email, form submission, desktop application, updater |
| 4 — later, separate approval | Gmail/Outlook, compliant contacts and connectors, bounded scheduled approvals, Tauri and signed delivery | Any unreviewed or unrestricted autonomous action |

All five role families are retained from the first ingestion model. Only U.S. software-engineering and AI/ML-engineering cohorts may receive an initial validated scoring claim after their held-out gates pass. Results for other families are labeled `experimental_unvalidated` until their own representative fixtures and thresholds pass.

## Score and evidence semantics

Nimanto displays an ordinal **Overall Match band**, never a percentage or hiring probability:

- `strong_evidence`
- `promising_evidence`
- `partial_evidence`
- `weak_evidence`
- `not_scored` when evidence coverage is below the reviewed minimum

The deterministic formula uses four dimensions: required qualifications (35 weight units), relevant accomplishments (30), role/level alignment (20), and skills/domain overlap (15). A versioned rule maps confirmed requirement-evidence pairs to `supported` or `missing`; `unknown` items are excluded from the known denominator and reduce a separately displayed coverage measure. Slice-1 `inferred` mappings are heuristic-only; later model-suggested mappings use the same state. They cannot affect a score until the user confirms them.

`scoring_rules_v1` fixes the initial internal cut points before the held-out set is opened: `strong_evidence >= 0.80`, `promising_evidence >= 0.65`, `partial_evidence >= 0.45`, and `weak_evidence < 0.45`. Known-requirement coverage below `0.60` yields `not_scored`, regardless of the internal value. The UI exposes bands, dimension states, evidence links, exclusions, formula version, and the applicable threshold in plain language; it does not display the internal value as a percentage.

Evidence Strength is a separate ordinal derived from the share of known weighted requirements supported by source-linked evidence rather than only `user_attested` evidence: `source_strong >= 0.80`, `source_mixed >= 0.50`, otherwise `source_limited`. Coverage is `coverage_sufficient` or `coverage_low` at the same `0.60` floor. Stored extraction confidence is the closed enum `high | medium | low`; confidence alone never confirms a fact.

Evidence states are:

| State | Meaning | Scoring effect |
|---|---|---|
| `supported` | Confirmed source locator supports the requirement | Included |
| `user_attested` | User approved exact text without independent source | Included but visibly lowers Evidence Strength |
| `inferred` | Suggested mapping awaiting confirmation | Excluded |
| `missing` | The candidate record should contain evidence but does not | Counts as unsupported |
| `unknown` | Posting/profile lacks enough information to decide | Excluded; lowers coverage |
| `blocker` | Confirmed user non-negotiable or explicit hard constraint conflicts | Outside all averages |

Hard-constraint flags include citizenship, clearance, work authorization, location, and role-specific transfer incompatibility. Affected jobs remain searchable. Each flag shows exact source text/locator, consequence (`visible_warning`), confidence, and a user path to correct the posting fact, profile fact, or preference without rewriting source history. A candidate may acknowledge an exact, snapshot-bound sponsorship or citizenship quote, but the current product keeps every such result warning-only until the held-out zero-false-positive exclusion gate and qualified review pass. Employment gaps never lower a score or create a blocker. The v0.1.0 free-text projection removes only documented cues and does not claim comprehensive de-identification; sensitive identity content must not be imported as scoring evidence.

Every material generated claim in Slice 3 must link to confirmed evidence, carry an exact `user_attested` exception, or be blocked. Nimanto will say “Application Assurance passed for this artifact and rule version,” never “guaranteed ATS compatible.”

## H-1B evidence taxonomy

Nimanto preserves source semantics and uses these non-predictive labels:

- `current_role_transfer_support`
- `current_company_policy_support`
- `recent_positive_history`
- `possible`
- `uncertain`
- `no_sponsorship_of_any_kind`
- `no_new_cap_petitions`
- `no_permanent_sponsorship`
- `unspecified_negative`

Every signal carries the exact source wording or record locator, dataset/edition, filing or decision type, fiscal period, observation date, transformation version, role/location scope, confidence, freshness, limitations, and “not legal advice.” DOL LCAs and USCIS petition statistics remain separate evidence families.

Every government edition is disabled until a server-trusted provenance manifest
binds its HTTPS source page, exact archive and layout URLs/checksums, layout
version, retrieval and data-as-of dates, normalized row-set checksum,
transformation version, reuse review, and reviewer. The manifest has one
canonical checksum; caller-supplied provenance or any drift fails before signal
writes. Legacy editions remain visibly unverified rather than receiving
backfilled claims.

Government evidence language is a separate approval boundary. A server-trusted
review manifest must bind the exact source type and transformation to the
checksum of the immutable display/limitation contract, with the qualified
reviewer's name, qualification, and review time. The caller cannot provide this
review. Missing review or later contract drift blocks the edition before any
signal write; legacy records never receive a backfilled approval.

The enum names are internal evidence categories required by this contract, not legal conclusions. User-facing copy always attributes the statement—“this posting states…,” “this employer policy states…,” or “historical filings were observed…”—and shows the quotation/record locator. It never says “you can transfer,” “you are eligible,” or otherwise applies the source to the candidate's legal situation.

Provisional Slice-2 freshness rules require a dedicated incremental specification before implementation: posting-specific wording expires when the posting closes or after 45 days without reconfirmation; employer policy becomes `uncertain` after 90 days; quarterly/annual government evidence remains historical and is labeled by exact period. At the end of the eighth completed quarter after its supporting period, `recent_positive_history` deterministically transitions to `uncertain`; a source-specific rule can be stricter. No stale item retains a `current_*` label. Cap-subject/cap-exempt employer context is displayed as sourced context only. Worksite-change or amendment implications always carry a legal-review flag and are never resolved by Nimanto.

Employer resolution cannot automatically improve a signal until an independently reviewed hand-labeled set demonstrates at least 0.98 precision and reports recall, abstention, false positives, denominator, and confidence interval. Ambiguous and absent matches remain `possible` or `uncertain`; absence is not negative evidence.

Reviewed employer aliases remain tenant-local evidence records with exact source
locators and observation times. Normalization never merges two canonical
employers: an alias collision abstains. A qualifying resolver evaluation binds
the deterministic checksum of the complete canonical-employer and active-alias
registry; any registry change disables positive linkage until a newly reviewed
evaluation covers that exact snapshot.

## Source and action contract

Every adapter declares `discovery_only`, `deep_link`, `form_assist`, `authorized_api_submit`, or `authorized_email_send`, plus terms-review date, request/rate budget, retry/backoff, caching, raw/transient-body deletion, normalized retention, redistribution/training rights, and kill switch. Greenhouse is the first automated source because its published-job GET endpoints are public without authentication ([Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html)). Lever follows only in its reviewed slice ([Lever Postings API](https://github.com/lever/postings-api)). USAJOBS ingestion is deferred unless OPM gives written approval for Nimanto's normalization, retention, and display plan under its [API terms](https://developer.usajobs.gov/guides/terms-of-use); ordinary linking and user-supplied text remain available. Manual paste/upload always remains available.

Nimanto does not scrape or automate LinkedIn, Indeed, Glassdoor, or another restricted provider. User-supplied content from such a source stays tenant-private and out of training, telemetry, shared search, fixtures, and redistribution. Technical accessibility is never treated as permission.

## Success criteria

The milestone may advance only when the named, versioned held-out suite shows:

- zero successful cross-tenant reads or writes across rows, objects, jobs, exports, receipts, and workers;
- zero unsupported material claims and 100% claim-to-evidence/attestation coverage in Slice 3;
- 100% recall for labeled explicit blockers, with denominator and false positives reported;
- 100% of score components linked to profile evidence, posting evidence, or `unknown`;
- repeat runs over frozen inputs produce the same rule version, band, components, stable input hash, and expected deterministic artifact hashes; each execution receipt has its own hash because run IDs/timestamps differ;
- identity-only fairness perturbations produce a byte-identical normalized feature vector and therefore no component or band change when job-relevant evidence is held constant;
- malicious posting text triggers no instruction-following or unapproved tool action;
- import failures and low-confidence extractions fail to preview/confirmation, never silently enter scoring;
- export and deletion tests cover primary data, object versions, queues, caches, derivatives, traces, and restore suppression;
- the demo harness passes keyboard, screen-reader-semantic, zoom/reflow, reduced-motion, and WCAG 2.2 AA checks appropriate to the implemented surface ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)).

Scoring-quality metrics cover only the validated U.S. software-engineering and AI/ML-engineering cohorts. Other role families remain subject to isolation, injection, fairness, provenance and explanation-completeness gates but are excluded from score-quality claims. Before beta, at least 8 of 10 moderated participants must unaided restate the top band driver and one excluded/unknown factor; otherwise scoring presentation is redesigned or withheld.

## Kill criteria

Stop or narrow the beta if any tenant isolation breach occurs; an unsupported claim reaches an approvable artifact; work-authorization wording changes without fresh confirmation; required assurance silently downgrades; restricted-provider content enters shared/public data; deletion cannot be verified within the published deadline; scoring changes under identity-only perturbations; or users cannot understand why a match band was assigned in moderated validation.

Any legal ambiguity about immigration guidance, provider terms, employment-data use, or privacy applicability blocks the affected feature and is routed to qualified counsel. Breadth never overrides trust.
