# Nimanto initial backend plan

**Status:** Historical reviewed production plan; implementation has begun  
**Snapshot:** 2026-08-05  
**Approval scope:** Slices 1–3 together, delivered sequentially; Slice 4 always requires a separate plan and approval

This file preserves the original production-grade acceptance map. It is intentionally more ambitious than the first local beta. Current implemented/deferred status is maintained in the [v0.1.0 slice matrix](../releases/v0.1.0-slice-matrix.md); no unchecked production control below is implied by the v0.1.0 tag.

## Delivery principles

Build test-first vertical slices in a TypeScript modular monolith. Domain contracts and state machines precede adapters. Each milestone has a red test, smallest implementation, verification, and an intentional commit. Slice 1 must pass clean-start and acceptance gates before Slice 2 begins; Slice 2 receives its incremental specification and must pass before Slice 3 begins. A valid blocker stops progression.

The repository remains uninitialized until the exact approval gate is satisfied. That approval explicitly includes eventual public GitHub creation after local Slices 1–3 verification, as required by the user; public creation is an irreversible publication step and will not happen earlier. After approval, reverify the empty/planning-only directory, authenticated GitHub owner, repository-name availability, expected remotes, and public visibility before any repository creation. Never attach to or overwrite an unexpected repository.

## Slice 1 — detailed evidence-to-match plan

| Milestone / intended commit | Build | Test-first acceptance |
|---|---|---|
| 0. `chore: establish licensed secure project` | Initialize `main`; Apache-2.0, DCO, governance/security/contribution files, NOTICE/acknowledgments/data-rights ledger; pnpm/Turbo workspace; pinned Node/toolchain; synthetic-only rule | Secret/license policy, lockfile integrity, clean install; no application behavior claimed |
| 1. `test: codify domain contracts and state machines` | JSON Schemas, stable errors, identifiers, invitation/import/profile/job/match/export/deletion states, source/evidence semantics | Contract examples and forbidden transitions fail before implementation |
| 2. `feat: add tenant-safe persistence foundation` | PostgreSQL 18, Drizzle migrations, non-owner runtime roles, `FORCE RLS`, transaction-local tenant context, migration/rollback procedure | Malicious cross-tenant row/SQL suite; missing context defaults deny; pool context cannot leak |
| 3. `feat: add invite-only passkey access` | One-shot platform-admin bootstrap; hashed single-use 72-hour invites; transactional acceptance; Better Auth passkeys, recovery codes, sessions, throttles and recent reauth | Issue, accept, expiry, revoke, reuse, email substitution, concurrent consume, public-signup rejection, throttle, revocation and admin-boundary tests |
| 4. `feat: add private quarantine storage` | Storage port; SeaweedFS S3 adapter; object ownership; generated key; app-proxied upload/download with single-use two-minute capabilities; retention metadata | Anonymous/foreign/replay/expiry, repeated PUT, MIME/size mismatch, immutable object-version inventory; no storage URL/key reaches browser/logs |
| 5. `feat: add evidence import and confirmation` | Positive-only LinkedIn allowlist; deterministic file metadata and OOXML/PDF text extraction in per-job sandbox; preview/profile versions; confirmed manual employment, education, projects, certifications, accomplishments, skills, preferences, locked authorization wording, and GitHub/portfolio URL evidence; reject zero-text/forbidden docs | Adversarial files, third-party exclusion, unsupported DOCX, cross-job sandbox discovery, interrupted 24-hour rejection purge, metadata/locator fidelity; no unconfirmed fact reaches scoring |
| 6. `feat: add provenance-safe job intake` | Manual text/file plus optional private original URL without fetch; fixed-host Greenhouse adapter with strict board-token, redirect, time, type and size controls; immutable raw/normalized snapshots; exact and reviewable fuzzy dedupe; stale/closed state | Official-format fixtures, token fuzz, egress escape, refresh/change/delete/stale/duplicate/conflict/reversible-merge tests; prompt-like text remains inert data |
| 7. `feat: add deterministic evidence matching` | Versioned features and confirmation; required qualifications, relevant accomplishments, role/level alignment, skills/domain overlap; unmet-requirement analysis; v1 band/coverage/Evidence Strength constants and explanations | Frozen repeatability, feature-vector identity, explanation completeness, explicit-blocker recall, unknown/missing semantics, work-authorization scope and employment-gap invariance |
| 8. `feat: add receipts and durable work` | pg-boss transactional enqueue; minimal tenant-scoped payloads; inbox/idempotency; retries/cancel/DLQ; RFC 8785 + SHA-256 hashes | Duplicate/replay/cancel/poison/stale/cross-tenant workers; independently verifiable stable `input_hash`/`artifact_hash`; deterministic hashing for a fixed receipt and intentionally distinct per-execution `receipt_hash`; no content in queue diagnostics |
| 9. `feat: add portable export and verified deletion` | Full tenant export; recent reauth; deletion lock/cancel/revoke/purge; object/version/cache/receipt/model-trace inventory; external backup-suppression ledger; one-purpose status URL | Cross-tenant export denial, archive parity, interrupted deletion resume, restored-backup non-resurrection, status-token privacy/expiry and 7/30-day deadlines |
| 10. `feat: add accessible slice one demo` | Minimal Next.js harness for invite/passkey, import/confirm, manual/Greenhouse job, evidence-linked match, export and delete | Playwright flow, keyboard, Safari/VoiceOver manual evidence, zoom/reflow/reduced-motion, no serious/critical axe findings; no full dashboard work |
| 11. `chore: harden clean start and CI` | Docker Compose, health/readiness, safe config validation, PII-safe Pino/OpenTelemetry, migration job, SBOM/secret/license/advisory checks, least-privilege GitHub Actions pinned to SHAs, operations docs | Clean clone-to-demo, backup/restore, migration forward/rollback, log canary scan, fork-PR secret denial, CI parity and failure drills |

After every milestone, update architecture/API/security/local-development documentation to match tested behavior. After Slice 1 passes, commit a scoped acceptance record before beginning the separately detailed Slice-2 specification.

## Slice-1 acceptance thresholds

All results name fixture version, numerator, denominator, platform, and rule/parser version.

| Area | Blocking threshold |
|---|---|
| Tenant defense | 0 successful unauthorized operations across every row/object/job/export/receipt/worker case |
| Invitations/auth | 100% of issue, accept, expiry, revoke, reuse, race, substitution, throttle and session-revoke cases behave as specified; public signup has no route |
| Import safety | 0 unconfirmed/low-confidence facts enter a profile used by scoring; 100% confirmed facts in held-out documents have a source locator or explicit diagnostic |
| Job provenance | 100% normalized fixtures retain provider, canonical/private source reference, snapshot hash, retrieval method, timestamps, rights policy and duplicate lineage |
| Matching | 100% deterministic repeats identical; 100% components link to evidence or `unknown`; all labeled explicit blockers detected; false positives and denominator published |
| Fairness | Byte-identical normalized feature vector and exactly 0 change to band/components/blockers/internal value for identity-only perturbations with job-relevant facts held fixed |
| Injection resistance | 0 tool actions, instruction following or trust-boundary changes from adversarial imported text |
| Receipts | 100% writes trace to stable `input_hash` and frozen `artifact_hash`; repeat runs preserve those hashes/results while each execution receipt has its own `receipt_hash` covering run/timestamps/approvals/outcomes |
| Export/deletion | 100% inventory coverage; primary/object-version purge <=7 days; external suppression prevents resurrection; backup and suppression expiry <=30 days; status URL reveals only state |
| Accessibility | 0 serious/critical automated findings plus passing keyboard, focus, semantics, reflow, reduced-motion and error-recovery checklist on the complete demo flow |

No rate/latency target becomes a release promise until the clean test environment, dataset size, hardware, and measurement method are recorded. Resource exhaustion and per-tenant quotas are still tested.

## Synthetic and held-out fixtures

Create 30–50 redacted-from-scratch end-to-end candidate/posting pairs, never copied personal documents, plus targeted adversarial libraries. Split every slice into an inspectable development set for rule tuning and a separate held-out set opened for one scored run per rule version; publish all failures and never reuse a held-out set across slices. Thresholds are fixed before its first run.

The targeted Slice-1 libraries include at least 50 labeled blocker-positive cases, paired fairness projections, parser attacks, source lifecycle cases, and tenant/worker authorization attacks. Together they cover:

- AI/ML and software roles across junior through staff scope, remote/hybrid/on-site, and multiple U.S. locations;
- all five ingested role families, with non-engineering scoring visibly experimental;
- direct, ambiguous, missing, contradictory and user-attested evidence;
- exact and fuzzy duplicates, reposts, closed/stale jobs and conflicting provider fields;
- explicit clearance/citizenship/work-authorization/location constraints and nuanced sponsorship wording;
- dates, title aliases, transferable skills, multi-column résumés, malformed PDFs/DOCX, archive bombs and forbidden-document markers;
- prompt injections and hostile HTML/text;
- identity, school/country cue, disability disclosure and employment-gap metamorphic pairs.

Fixture labels require independent review and change history. Evaluation reports include failures; a failing case is not removed to improve a metric. Experimental role families are excluded from score-quality claims but remain in fairness, injection, isolation, provenance and explanation tests.

## Slice 2 — acceptance map and required incremental plan

Before implementation, add concise specifications for employer resolution, DOL/USCIS ingestion and checksums, source freshness/downgrades, compensation/benefits, interview evidence, and each new adapter's rights/retention policy.

Slice 2 is accepted only when:

- Lever and every URL/adapter path passes source-specific contract, budget, kill-switch, SSRF and provenance tests;
- DOL LCA and USCIS petition datasets remain distinct, immutable by edition/checksum, reproducibly normalized, and display exact “data as of” semantics;
- employer auto-resolution demonstrates point precision >=0.98 and a 95% Wilson lower bound >=0.95 on at least 300 predicted-positive independently reviewed representative matches; it also reports false positives, recall, abstention and denominator. Increase the sample when the bound misses; ambiguous matches cannot improve a signal;
- every H-1B label follows the product taxonomy and deterministic freshness downgrade; only confirmed `no_sponsorship_of_any_kind` is excluded from recommendations by default;
- O*NET/BLS/compensation/benefit values preserve occupation, geography, level, units, period, source, sample/limitations, and attribution; missing company evidence stays `unknown`;
- interview-process statements carry official/user source, date, role/location applicability, confidence and anecdotal status;
- source coverage is reported, never described as “all jobs.”
- schedules can only discover, refresh, dedupe and score within tenant/source budgets and cancellation/kill switches; they cannot prepare, approve, email, or submit;
- the manual application tracker records posting/profile/band versions plus user-entered submitted date/status and append-only reply, screen, interview, offer, rejection or withdrawal outcomes; funnel reports are candidate-only and show role family, source, band, sample size and time window without predicting future results.

## Slice 3 — acceptance map and required incremental plan

Before implementation, add canonical-document, renderer/font/image digest, Application Assurance rule, model-provider policy, local hardware benchmark, and held-out model capability/evaluation specifications.

Slice 3 uses three named layers over the frozen artifacts: (1) deterministic truth/data rules, (2) deterministic document/render rules with different failure modes, and (3) independent recruiter-quality plus evidence/risk review using genuinely distinct reviewer roles/configurations and recorded versions. Human artifact approval follows these layers and cannot waive a blocker. Slice 3 is accepted only when:

- deterministic discovery, scoring and tracking work with no model;
- provider routing records exact model tag/digest, hardware, working context cap, purpose, fields sent, consent, timeout and result; missing local model and cloud outage fail without silent fallback;
- the same-machine companion binds only to loopback, requires a per-install bearer token exchanged outside webpage content, enforces exact `Origin`/`Host` allowlists, rejects absent/untrusted origins, configures restrictive Ollama origins, and passes DNS-rebinding tests; browser code never reaches Ollama directly;
- Nimanto bundles neither Ollama nor model weights. `gemma4:12b` and a Gemma 4 E4B or other evaluated smaller fallback are resolved by current catalog/local digest and enabled only after task-specific hardware/capability evaluation;
- every material generated claim links to confirmed evidence or exact user attestation; observed unsupported-claim count is zero on the published held-out suite;
- required-field/schema validation; date, employer/title, authorization and compensation consistency; tailored-versus-master semantic diff; duplicate application/outreach detection; prompt-injection isolation; locked authorization wording; `user_attested` exact text/actor/timestamp/reason/receipt metadata; and rejection of fabricated skills, degrees, certifications, metrics, employment and legal claims are mandatory truth checks;
- one canonical application document produces modern and ATS-safe DOCX/PDF plus shared text/JSON, and all four résumé files are actually rendered, previewed and inspected;
- content parity, spelling, punctuation, filenames, metadata, page properties, embedded/substituted fonts, extractable critical fields, links, clipping/overflow, blank pages and ATS-safe round-trip checks meet versioned deterministic thresholds. LibreOffice or another DOCX preview is a smoke/visual inspection path and never proves Microsoft Word pixel fidelity;
- the incremental spec identifies which outputs are byte-stable and which use declared semantic/visual tolerances. Every check is versioned as deterministic/model-dependent and required/advisory. Grammar, exported-document contrast, accessibility tagging, widows/orphans and subjective visual quality start advisory until a measured versioned threshold promotes them; advisory findings require resolution or named final-approver waiver, while required findings cannot be waived;
- all deterministic layers pass; the full application-approval demo requires an evaluated provider for the configured model-dependent independent review. Without one, deterministic discovery/scoring/tracking still work and approval resolves `blocked_unavailable` rather than passing;
- a shared renderer/template/rule failure blocks the affected batch while an application-only failure quarantines that application;
- approval shows exact immutable artifacts, destination context and warnings; an edit invalidates approval;
- scheduled work may prepare only into the approval queue within tenant quotas; it cannot approve, email or submit;
- the content-hashed receipt traces inputs/sources, model/provider and prompt/template versions, deterministic checks, reviewer versions/verdicts, findings/waivers, approvals, output hashes and external-action result (`not_attempted` in Slice 3);
- email and external submission remain technically absent.

Passing Nimanto's gate is not a universal ATS guarantee.

## Verification and clean-start proof

Local verification uses the project's documented commands, a new temporary data directory, and no developer-global state:

1. Build pinned Caddy, application, PostgreSQL, SeaweedFS and parser-sandbox containers and install from the lockfile.
2. Start reverse proxy, web, API, worker, PostgreSQL and object storage with one Compose command.
3. Run migrations as the migration role; verify runtime roles cannot migrate or bypass RLS.
4. Bootstrap the first platform admin, issue and consume an invitation, and complete the synthetic end-to-end slice.
5. Run unit, contract, real-PostgreSQL integration, worker, security, accessibility and browser suites.
6. Export and delete the synthetic tenant; restore a backup and prove suppression prevents reappearance.
7. Stop, delete only the named temporary environment, recreate it, and repeat the smoke flow.

Before public repository creation, run the complete Slices 1–3 clean-environment demo: manual and Greenhouse/Lever ingest; DOL/USCIS transfer enrichment; deterministic score/provenance inspection; modern and ATS-safe résumé variants in DOCX and PDF plus shared text/JSON; full Assurance and approval without send; manual outcome tracking; export, deletion/restore suppression, and receipt verification. Any permitted real-posting check is manual/network-marked and never committed or required by CI.

Before a public repository is created, scan the full intended first commit for secrets, personal data, restricted-provider content, missing notices, unsafe workflows and generated artifacts. After push, wait for GitHub CI and correct failures before reporting completion. GitHub artifact attestations can later record build provenance and SBOM links, but are not a substitute for tests or platform signing ([GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)).

## Observability contract

Allowlisted fields are service, environment, event name, request/job ID, tenant-scoped ephemeral correlation ID, actor class, contract/rule version, duration bucket, result/error code, retry count and aggregate byte/item counts. Never record résumé/posting/email/model content, evidence values, names, addresses, raw URLs/query strings, object keys, signed URLs, tokens, cookies, provider keys or model prompts/results.

Metrics cover request latency/error counts, queue age/retries/DLQ, parser outcomes, source freshness, match evaluation counts, assurance findings, export/deletion age and object reconciliation. Alerts are actionable and tenant-content free. A synthetic canary secret in fixtures must never appear in captured logs, traces, CI artifacts, snapshots, or error responses.

## Accessibility and operations evidence

Automated Playwright/axe checks run in CI, but manual Safari/VoiceOver, keyboard, focus, 200% zoom/reflow, contrast, reduced-motion and accessible validation results remain a release checklist. NVDA with Firefox or Edge is required before hosted public beta. Slice 3 separately validates exported documents.

Operations runbooks cover bootstrap, configuration, migration/rollback, backup/restore, key/secret rotation, session revocation, source kill switch, queue drain/quarantine, object reconciliation, data export/deletion, incident response and clean uninstall. Each distinguishes hosted-operator responsibility from self-hosted responsibility.

## Cost and lock-in ledger

| Item | Beta expectation | First likely paid/resource threshold | Exit path |
|---|---|---|---|
| PostgreSQL/SeaweedFS self-host | Software license cost $0; machine, disk, backup and operator time are not free | Host capacity and backup retention | Standard PostgreSQL dump/restore and S3 object copy |
| Cloudflare R2 optional | Standard free allocation: 10 GB-month, 1M Class A, 10M Class B monthly, free egress | Storage $0.015/GB-month; Class A $4.50/M; Class B $0.36/M, with unit rounding ([pricing](https://developers.cloudflare.com/r2/pricing/)) | S3 adapter plus object inventory/copy |
| GitHub public repository/CI | Public project features; verify current Actions allowances before relying on heavy document/browser CI | Compute/storage/minute limits or hosted runners | Reproducible local CI scripts and self-hosted runner option |
| Local Ollama later | Software/model downloads may be free; user hardware, electricity, storage and model license still apply | Hardware/model capability | Provider-neutral gateway; no bundled runtime/weights |
| Cloud models later | BYOK only; no free-tier assumption | Provider tokens and retention/compliance needs | Local provider or another evaluated adapter |
| Qualified legal review | No free-tier assumption; counsel and budget are not yet selected | Required before any hosted beta invitation for immigration wording, employment/fairness, privacy, source terms and incident duties | Local self-host development may proceed; hosted beta remains blocked until owner, scope and budget are recorded |

Free tier is a demo convenience, not production architecture. Every adopted component and data source remains in the SPDX/SBOM/NOTICE/attribution/data-rights ledger.

## Explicit deferrals

Slice 1 defers DOL/USCIS enrichment, employer resolution, Lever/URL breadth, compensation/benefits and interview intelligence. Slice 2 defers model generation and document assurance. The initial milestone defers Gmail/Outlook, contacts, external submission, browser autofill, standing approval policies, Tauri, offline embedded desktop, updater, platform signing/notarization, cryptographic receipt signing and multi-member tenants.

Before Slice 4, a separate incremental plan must cover Gmail/Microsoft OAuth scopes, verification and provider/user limits; per-deployment client provisioning; external-action permissions, rate/idempotency/kill switches; desktop packaging; Apple notarization and Windows trust signing as distinct from updater signatures; relaunch and rollback prevention; and compromised-updater-key recovery, including the case where a new installer is required.

## Review record

- Exact independent critique model verified by Claude CLI: `claude-opus-5`.
- Opus critique status: complete; valid blockers reconciled into the documents. Its proposed second publication token and local-only replacement were rejected because they contradict the user's explicit authority and outcome.
- Council status: complete; two four-role rounds finished and every valid blocker received targeted closure acceptance.
- Implementation authority: **not granted**.

Implementation may begin only after the complete critique/council gate and a later user reply whose trimmed text is an exact case-insensitive match for:

`APPROVED: BUILD THE BACKEND`
