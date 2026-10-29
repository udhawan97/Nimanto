# Graph Report - Nimanto  (2026-10-29)

## Corpus Check
- 295 files · ~8,461,824 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2472 nodes · 4424 edges · 175 communities (142 shown, 33 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.75)
- Incremental AST token cost: 0 input · 0 output. Earlier semantic extraction usage is unavailable.

## Graph Freshness
- Validated against source commit: `f309cdf9beb1e163be981bc09269dacb87da33b4`.
- Incremental AST refresh completed; dependency and generated-asset updates did not change graph topology.
- The manifest records refreshed source input hashes; documentation semantics are unchanged from the reviewed six-fix source.
- Five metadata-only JSON inputs produce no AST nodes. The v14 SQL fixture has no AST nodes because the optional SQL parser is absent; its behavior is covered by executable recovery tests.
- Run `graphify update .` after source changes.

## Community Hubs (Navigation)
- jobs.ts
- workspace.tsx
- matching.ts
- derive.ts
- government-dataset.ts
- iso
- NimantoEmblem
- store.ts
- documents/src/index.ts
- dashboard-read.ts
- NimantoEmblem
- role-discovery.ts
- career-ledger.tsx
- Run and operate the local beta
- parsers/src/index.ts
- deletion-coordinator.ts
- Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It
- Fastify API
- canonicalHash
- api
- workspace-read-currentness.test.tsx
- documents/package.json
- NimantoStore
- scripts
- Workspace
- packet-composer.ts
- calendar-export.ts
- dependencies
- .transaction
- providers/src/index.ts
- compilerOptions
- screenshot-evidence.mjs
- Nimanto third-party notices
- application-dossier.ts
- domain/src/index.ts
- buildServer
- applications-workbench.ts
- export-session.test.tsx
- dependencies
- Job-source expansion research
- career-operations.ts
- config.ts
- EvidenceClaim
- worker/package.json
- migrations.ts
- packet-lifecycle.test.ts
- Discovery Profile
- What changed
- database/package.json
- Nimanto Sources Licenses and Provider Gate
- domain/package.json
- parsers/package.json
- local-beta.spec.ts
- Candidate-selected frozen Packet v2 composition
- devDependencies
- Nimanto v0.4.0 — Inspectable History
- Nimanto v0.4.1 — Action Before Analysis
- version-sync.test.mjs
- browser-components.test.tsx
- Nimanto Initial Backend Plan
- Nimanto v0.3.0 — Evidence Thread
- Packet PDF font provenance and text policy
- verify-sbom-freshness.mjs
- career-ledger.ts
- .getPacket
- copy-vocabulary.test.ts
- .createContact
- Nimanto Architecture
- Nimanto Trust Privacy and Security Plan
- createSubmissionDraft
- worker.ts
- compilerOptions
- url.ts
- role-provenance.tsx
- createScopedRequestGate
- Nimanto Product Contract
- Nimanto redesign — Colour & Material 002
- package.json
- database/tsconfig.json
- database/tsconfig.build.json
- h1b-evidence.tsx
- Provider setup and trust boundaries
- submissions.ts
- .runWorkerCycle
- Candidate follow-up date
- compilerOptions
- domain/tsconfig.json
- compilerOptions
- providers/package.json
- compilerOptions
- server.test.ts
- api/tsconfig.json
- answer-history-currentness.test.tsx
- match-evidence-lens.ts
- identity-transitions.ts
- web/tsconfig.json
- 2. The palette
- acquireDataDirectoryLock
- layout.tsx
- worker/tsconfig.json
- worker/tsconfig.build.json
- Nimanto v0.10.0 — Keep the Record, Prove the Handoff
- Nimanto user-flow analysis
- Nimanto v0.2.0 — Colour & Material
- Nimanto v0.5.2 — Ask Clearly, Return Exactly
- Nimanto v0.8.0 — Find It, Compare It, Keep It
- Nimanto v0.9.0 — Choose the Search, Keep the Evidence
- 2. Where the candidate actually stalls
- store-lock.test.ts
- documents/tsconfig.json
- parsers/tsconfig.json
- providers/tsconfig.json
- ErrorBoundary
- First release
- Nimanto v0.5.3 — Proof Means Enforced
- Nimanto v0.5.4 — Work Stays Yours
- Nimanto v0.6.0 — Follow Up on Your Terms
- Nimanto v0.7.0 — One Place for Each Promise
- url-network.test.ts
- render-screenshots.mjs
- validate-sbom.mjs
- compilerOptions
- Nimanto Domain Language
- Sensitive workspace inspection export
- Local recovery readiness
- Durable discovery schedules
- Nimanto v0.5.5 — Same Boundaries, Fresh Runtime
- keywords
- render-social-card.mjs
- external-action-runtime.ts
- sanitize-sbom.mjs
- Frozen Packet composition
- First marketplace MVP
- 4. The mark
- 6. Workbench
- answer-history.test.ts
- release-assets.test.mjs
- sw.js
- dependencies
- v0.10.0 public-surface ledger
- v0.1.0 implemented slice matrix
- v0.5.2 public-surface ledger
- v0.5.3 public-surface ledger
- v0.5.4 public-surface ledger
- v0.5.5 public-surface ledger
- v0.6.0 public-surface ledger
- v0.7.0 public-surface ledger
- v0.8.0 public-surface ledger
- v0.9.0 public-surface ledger
- engines
- docker-context.test.mjs
- write-sbom-checksums.mjs
- AGENTS.md
- next.config.ts
- next-env.d.ts
- CODE_OF_CONDUCT.md
- CONTRIBUTING.md
- large-tenant-performance-budget.md
- GOVERNANCE.md
- SECURITY.md
- Hosted trust layer
- Six trust boundaries
- Ashby Job Postings API
- Greenhouse Job Board API
- Job source expansion research
- Lever Postings API
- SmartRecruiters Posting API

## God Nodes (most connected - your core abstractions)
1. `NimantoStore` - 187 edges
2. `buildServer()` - 111 edges
3. `canonicalHash()` - 59 edges
4. `Run and operate the local beta` - 58 edges
5. `iso()` - 32 edges
6. `Workspace()` - 25 edges
7. `scripts` - 25 edges
8. `Applications()` - 24 edges
9. `api()` - 24 edges
10. `NimantoEmblem` - 23 edges

## Surprising Connections (you probably didn't know these)
- `checkPdfMappingsAndOutlines()` --indirect_call--> `object()`  [INFERRED]
  packages/documents/test/documents.test.ts → apps/api/src/server.ts
- `FastifyRequest` --references--> `SessionIdentity`  [EXTRACTED]
  apps/api/src/server.ts → packages/database/src/store.ts
- `buildServer()` --indirect_call--> `draftLocalSummary()`  [INFERRED]
  apps/api/src/server.ts → packages/providers/src/ollama.ts
- `evidenceMatches()` --indirect_call--> `token()`  [INFERRED]
  packages/domain/src/matching.ts → apps/web/test/tokens.test.ts
- `normalizeProviderRole()` --calls--> `normalizeRoleSnapshot()`  [EXTRACTED]
  apps/api/src/discovery-cycle.ts → packages/domain/src/roles.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Candidate-controlled trust pipeline** — docs_architecture_system_candidate_approved_evidence_intake, docs_architecture_system_exact_snapshot_match_publication, docs_architecture_system_staged_packet_lifecycle, docs_architecture_system_exact_approved_action_lifecycle [EXTRACTED 1.00]
- **Marketplace foundation** — docs_planning_job_marketplace_expansion_plan_2026_08_26_source_registry, docs_planning_job_marketplace_expansion_plan_2026_08_26_provider_protocol, docs_planning_job_marketplace_expansion_plan_2026_08_26_role_availability, docs_planning_job_marketplace_expansion_plan_2026_08_26_work_mode_normalization, docs_planning_job_marketplace_expansion_plan_2026_08_26_discovery_profile, docs_planning_job_marketplace_expansion_plan_2026_08_26_rolecluster [EXTRACTED 1.00]
- **Nimanto runtime topology** — docs_architecture_system_static_next_js_workbench, docs_architecture_system_fastify_api, docs_architecture_system_pglite_postgresql, docs_architecture_system_durable_refresh_worker, docs_architecture_system_deny_by_default_source_registry, docs_architecture_system_exact_approved_action_lifecycle [EXTRACTED 1.00]
- **Confirmed Evidence to Match Flow** — docs_planning_architecture_confirmed_evidence_lifecycle, docs_planning_product_contract_career_evidence_vault, docs_planning_product_contract_evidence_states, docs_planning_product_contract_overall_match_bands, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Tenant Isolation Defense in Depth** — docs_planning_architecture_postgresql_rls_defense, docs_planning_architecture_single_candidate_tenancy, docs_planning_trust_and_security_tenant_authorization, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Review Before External Action** — docs_planning_architecture_no_external_effects_through_slice_3, docs_planning_product_contract_source_action_contract, docs_planning_product_contract_frozen_artifact_approval, docs_planning_backend_plan_slice_3_grounded_packet [INFERRED 0.95]

## Communities (175 total, 33 thin omitted)

### Community 0 - "jobs.ts"
Cohesion: 0.05
Nodes (77): AtsVerification, EnabledAtsProvider, enabledProvider(), providerErrorCode(), routeFor(), VerificationRequest, JobRecord, JobUpsertInput (+69 more)

### Community 1 - "workspace.tsx"
Cohesion: 0.04
Nodes (49): CareerOperationsSnapshot, CommandPalette(), PaletteEntry, siteCommands, Connection, ConnectionBanner(), ConnectionIndicator(), useConnection() (+41 more)

### Community 2 - "matching.ts"
Cohesion: 0.07
Nodes (41): channel(), css, luminance(), ratio(), token(), MatchRunRecord, RoleWordingReviewRecord, APPLICATION_STATUSES (+33 more)

### Community 3 - "derive.ts"
Cohesion: 0.06
Nodes (56): Applications(), downloadTextFile(), emptyEvidenceFilters(), EvidenceVault(), fileBase64(), localDayInstant(), projectApplicationView(), ActionLike (+48 more)

### Community 4 - "government-dataset.ts"
Cohesion: 0.09
Nodes (40): GovernmentDatasetTrust, TrustedEmployerResolutionEvaluation, exactText(), GovernmentDatasetAdmission, GovernmentDatasetIngestion, GovernmentDatasetRow, LABELS, record() (+32 more)

### Community 5 - "iso"
Cohesion: 0.08
Nodes (3): historyLimit(), iso(), isoRequired()

### Community 6 - "NimantoEmblem"
Cohesion: 0.10
Nodes (13): annulusJaali(), barShape(), bracketShape(), diamond(), getTHREE(), glowTexture(), NimantoEmblem, notchPoly() (+5 more)

### Community 7 - "store.ts"
Cohesion: 0.05
Nodes (49): AnswerBlockRecord, AnswerRevisionPage, AnswerRevisionRecord, ApplicationNoteRecord, AssuranceHistoryRecord, AssuranceRecord, CareerOperationsSnapshot, ClaimedSourceSchedule (+41 more)

### Community 8 - "documents/src/index.ts"
Cohesion: 0.08
Nodes (26): CanonicalPacket, createDocx(), createPdf(), decodeXml(), DocumentInspection, docxText(), inspectPacketArtifacts(), normalizedContent() (+18 more)

### Community 9 - "dashboard-read.ts"
Cohesion: 0.18
Nodes (8): DashboardRead, ExternalActionCapability, stores, rawDatabases, stores, temporaryRoots, SessionIdentity, freshH1bLabel()

### Community 10 - "NimantoEmblem"
Cohesion: 0.09
Nodes (17): BOUNDARY, METHOD, Brand(), HUB, Mark(), PETALS, clamp(), EmblemOptions (+9 more)

### Community 11 - "role-discovery.ts"
Cohesion: 0.10
Nodes (32): areaValue(), assessDiscoveryProfile(), compareCanonicalAreas(), confirmedArea(), countryLevelArea(), DiscoveryMatchPublication, DiscoveryProfileAssessment, DiscoveryProfileLike (+24 more)

### Community 13 - "career-ledger.tsx"
Cohesion: 0.11
Nodes (34): amountToMinor(), AnswerRevision, AnswerRevisionHistory(), AnswersPanel(), Application, applicationLabel(), CareerLedger(), Evidence (+26 more)

### Community 14 - "Run and operate the local beta"
Cohesion: 0.05
Nodes (44): Ambiguous-action reconciliation, Application cohort counts, Autonomous deletion recovery, Blocked Packet recovery, Candidate-authored Submission Record, Candidate Career Ledger, Candidate recorded timeline, Connected-account sending unavailable (+36 more)

### Community 15 - "parsers/src/index.ts"
Cohesion: 0.14
Nodes (26): EvidenceIntake, parseUpload(), previewHash(), requestObject(), requiredString(), reviewedProjection(), Upload, fixture() (+18 more)

### Community 16 - "deletion-coordinator.ts"
Cohesion: 0.11
Nodes (8): DeletionCoordinator, DeletionRun, RemovePath, warnCleanupPending(), databases, roots, stores, run()

### Community 17 - "Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It"
Cohesion: 0.06
Nodes (27): A UI-only Workbench mutation coordinator, Consistent current-Role normalization, Dependency and verification maintenance, Nimanto v0.5.0 — Clear Intent, Current Truth, One candidate Application transition policy, Separate Identity and navigation/focus transitions, Surface inventory, v0.5.0 public-surface ledger (+19 more)

### Community 18 - "Fastify API"
Cohesion: 0.10
Nodes (21): Candidate-approved evidence intake, Candidate Role disposition, Deep link and local test outbox, Deny-by-default source registry, Durable DiscoveryCycle, Durable refresh worker, Exact-approved action lifecycle, Exact-snapshot match publication (+13 more)

### Community 19 - "canonicalHash"
Cohesion: 0.10
Nodes (22): EnabledProvider, EnabledProviderRequest, normalizeFetchResult(), ProviderJobLike, ExternalActionLifecycle, publishMatch(), uniqueEvidenceIds(), PacketArtifactInspector (+14 more)

### Community 20 - "api"
Cohesion: 0.12
Nodes (31): ActionRunner, Actions(), ActivityLedger(), ApplicationDossier(), ApplicationFilterDisclosure(), ApplicationNoteEditor(), atsRouteGateLabel(), cadenceLabel() (+23 more)

### Community 21 - "workspace-read-currentness.test.tsx"
Cohesion: 0.16
Nodes (21): assertSessionFence(), button(), change(), click(), dashboard(), dossierDashboard(), dossierRun(), history() (+13 more)

### Community 22 - "documents/package.json"
Cohesion: 0.06
Nodes (31): docx, dependencies, docx, fflate, @nimanto/domain, pdf-lib, @pdf-lib/fontkit, pdfjs-dist (+23 more)

### Community 24 - "scripts"
Cohesion: 0.08
Nodes (25): scripts, build, check, clean, dev, dev:all, dev:core, format (+17 more)

### Community 25 - "Workspace"
Cohesion: 0.16
Nodes (16): emptyManualRoleDraft(), emptyReviewedUrlDraft(), manualRoleDraftForReview(), sameActionDraft(), sameManualRoleDraft(), sameReviewedUrlDraft(), withApplicationActivities(), Workspace() (+8 more)

### Community 26 - "packet-composer.ts"
Cohesion: 0.11
Nodes (18): Application, Evidence, Job, Match, PacketComposer(), Profile, RebindProfileVersionButton(), ComposerApplication (+10 more)

### Community 27 - "calendar-export.ts"
Cohesion: 0.13
Nodes (17): buildApplicationCsv(), CsvApplication, csvCell(), CsvJob, HEADERS, spreadsheetSafe(), buildFollowUpCalendar(), calendarDate() (+9 more)

### Community 28 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui (+38 more)

### Community 29 - ".transaction"
Cohesion: 0.15
Nodes (4): PacketLifecycle, annotateClusters(), classifyRoleFamily(), CandidateSubmissionInput

### Community 30 - "providers/src/index.ts"
Cohesion: 0.27
Nodes (7): draftLocalSummary(), LocalModelDescriptor, localModelInventory(), localModelStatus, reviewLocalPacket(), servers, temporaryRoots

### Community 31 - "compilerOptions"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2024, compilerOptions, allowJs, allowSyntheticDefaultImports, exactOptionalPropertyTypes, forceConsistentCasingInFileNames (+14 more)

### Community 32 - "screenshot-evidence.mjs"
Cohesion: 0.14
Nodes (17): apiPort, repository, sitePort, update, assertScreenshotBytesMatch(), assertScreenshotVisuallyMatches(), buildScreenshotEvidence(), collectFiles() (+9 more)

### Community 33 - "Nimanto third-party notices"
Cohesion: 0.10
Nodes (21): Nimanto acknowledgments, Original Colour & Material 002 fold-lotus visual system, Packet rendering: fontkit, regenerator-runtime, and Noto families, Published v0.10.0 dependency inventories, Separate 0.10.1-dev.0 unreleased dependency inventories, Candidate-controlled evidence and application decisions, 0.10.1-dev.0 unreleased source identity, Nimanto (+13 more)

### Community 34 - "application-dossier.ts"
Cohesion: 0.22
Nodes (8): ActionLike, ApplicationOwned, ContactLike, DossierApplication, DossierMatch, DossierSubmission, PacketLike, projectApplicationDossier()

### Community 35 - "domain/src/index.ts"
Cohesion: 0.11
Nodes (20): ProviderActionExecutor, approvedActionFixture(), mkdtempTracked(), stores, temporaryRoots, ExternalActionRecord, AssuranceFinding, AssuranceFindingCode (+12 more)

### Community 36 - "buildServer"
Cohesion: 0.12
Nodes (28): ArtifactManifest, verifiedArtifactBytes(), buildServer(), discoveryProfileInput(), fastify, FastifyRequest, H1B_LABELS, historyOptions() (+20 more)

### Community 37 - "applications-workbench.ts"
Cohesion: 0.16
Nodes (17): ApplicationNoteDraft, ApplicationsWorkbench, ApplicationsWorkbenchAction, applicationsWorkbenchReducer(), ApplicationsWorkbenchState, closeDraft(), createApplicationsWorkbenchState(), dateInputValue() (+9 more)

### Community 38 - "export-session.test.tsx"
Cohesion: 0.15
Nodes (12): ApiError, fenceApiWritesToSession(), createWorkbenchMutations(), MutationAdapters, RefreshOutcome, WorkbenchMutation, WorkbenchMutationOutcome, WorkbenchMutations (+4 more)

### Community 39 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, @fontsource/ibm-plex-mono, @fontsource/instrument-serif, @fontsource-variable/archivo, lucide-react, next, @nimanto/domain, react (+38 more)

### Community 40 - "Job-source expansion research"
Cohesion: 0.11
Nodes (18): “Best available source” governance, Candidate privacy and hostile-source boundary, Canonical work-mode and geography model, Current Nimanto baseline and gaps, Deterministic resume and preference matching, Duplicate lineage, Executive recommendation, Explicit no-scrape / approval-only list (+10 more)

### Community 41 - "career-operations.ts"
Cohesion: 0.11
Nodes (19): ApplicationActivityRecord, ApplicationRecord, InterviewRoundRecord, recordInstant(), ACTIVITY_KINDS, ACTIVITY_STATES, ActivityKind, ActivityState (+11 more)

### Community 42 - "config.ts"
Cohesion: 0.17
Nodes (13): ProviderJobVerifier, AllowlistedJobPageFetcher, booleanEnvironment(), loadOptions(), localBootstrapSecret(), LocalModelAdapter, NimantoApiOptions, portEnvironment() (+5 more)

### Community 43 - "EvidenceClaim"
Cohesion: 0.21
Nodes (5): seedDemo(), EvidenceRow, mapEvidence(), EvidenceClaim, ParsedEvidence

### Community 44 - "worker/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, tsx, @types/node, typescript, vitest, tsx, @types/node, typescript (+11 more)

### Community 45 - "migrations.ts"
Cohesion: 0.22
Nodes (15): migrations, freshSchemaSql, schemaVersion10Sql, schemaVersion11Sql, schemaVersion12Sql, schemaVersion13Sql, schemaVersion14Sql, schemaVersion15Sql (+7 more)

### Community 46 - "packet-lifecycle.test.ts"
Cohesion: 0.18
Nodes (6): PacketArtifactRenderer, get(), mkdtempTracked(), packetFixture(), stores, temporaryRoots

### Community 47 - "Discovery Profile"
Cohesion: 0.25
Nodes (8): Discovery Profile replay, Candidate-controlled metasearch workbench, Discovery Profile, DOL OFLC performance disclosure data, H-1B evidence layers, USCIS H-1B Employer Data Hub, Warning-only sponsorship boundary, Work-mode normalization

### Community 48 - "What changed"
Cohesion: 0.12
Nodes (15): Candidate-approved evidence intake, Durable discovery and dataset editions, Exact-approved external actions, Exact-snapshot match publication, Flow and responsive polish, Nimanto v0.4.2 — Exact Review, Exact Commit, One application transition policy, Resumable deletion write fence (+7 more)

### Community 49 - "database/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @electric-sql/pglite, @nimanto/domain, devDependencies, @types/node, typescript, vitest, exports (+14 more)

### Community 50 - "Nimanto Sources Licenses and Provider Gate"
Cohesion: 0.14
Nodes (16): Observability Allowlist, H-1B Evidence Taxonomy, Source and Action Capability Contract, Defer USAJOBS Ingestion, Dependency License and Security Ledger, Government Dataset Provenance, Greenhouse Job Board API, Slice-1 Greenhouse Source Policy (+8 more)

### Community 51 - "domain/package.json"
Cohesion: 0.11
Nodes (17): devDependencies, @types/node, typescript, vitest, exports, @types/node, typescript, vitest (+9 more)

### Community 52 - "parsers/package.json"
Cohesion: 0.07
Nodes (27): dependencies, fflate, @nimanto/domain, pdfjs-dist, saxes, devDependencies, pdf-lib, @types/node (+19 more)

### Community 53 - "local-beta.spec.ts"
Cohesion: 0.12
Nodes (3): apiPort, playwrightDataDir, webPort

### Community 54 - "Candidate-selected frozen Packet v2 composition"
Cohesion: 0.16
Nodes (16): Ambiguous external action terminal state, Read-only Application Dossier, Separate Packet and exact Action Intent approvals, Unweighted Evidence Strength source-mix basis, Historical ordinal without an invented calculation basis, Sensitive versioned inspection export, Explicit copy-only unverified local model draft, Exact-profile and exact-role Match Publication (+8 more)

### Community 55 - "devDependencies"
Cohesion: 0.12
Nodes (17): cspell, @cyclonedx/cdxgen, devDependencies, cspell, @cyclonedx/cdxgen, @playwright/test, prettier, sharp (+9 more)

### Community 56 - "Nimanto v0.4.0 — Inspectable History"
Cohesion: 0.13
Nodes (13): 1. Stored history and export v2, 2. Packet history and assurance comparison, 3. Record-review queue, 4. Literal profile and match comparison, 5. Application cohort counts, Correctness and privacy, Nimanto v0.4.0 — Inspectable History, Surface inventory (+5 more)

### Community 57 - "Nimanto v0.4.1 — Action Before Analysis"
Cohesion: 0.13
Nodes (13): 1. Manual role drafts survive section changes, 2. Applications opens on the work, 3. Section focus clears the sticky header, 4. No-op profile saves no longer create history, 5. Completion copy comes from returned data, Nimanto v0.4.1 — Action Before Analysis, Public surface, Surface inventory (+5 more)

### Community 58 - "version-sync.test.mjs"
Cohesion: 0.25
Nodes (13): countOccurrences(), currentSchemaVersion(), markdownSection(), releaseAssetPaths(), schemaVersionTextChecks(), validateVersionSync(), versionTextChecks(), workspacePackages (+5 more)

### Community 59 - "browser-components.test.tsx"
Cohesion: 0.16
Nodes (6): CopyLine(), CopyState, DeletionReceiptGuidance(), RoleIdentityReviewNotice(), answerAt(), serveRevisions()

### Community 60 - "Nimanto Initial Backend Plan"
Cohesion: 0.20
Nodes (14): Clean-Start Verification, Exact Implementation Approval Gate, Versioned Held-Out Evaluation, Nimanto Initial Backend Plan, Public Repository Gate, Slice 1 Evidence to Match, Slice 2 Transfer Intelligence, Slice 3 Grounded Packet (+6 more)

### Community 61 - "Nimanto v0.3.0 — Evidence Thread"
Cohesion: 0.14
Nodes (13): 1. Private role narrowing, 2. Recorded application timelines, 3. Sponsorship provenance and freshness, 4. Match anatomy, 5. Tamper-evident local activity, 6. Packet review, Correctness, Nimanto v0.3.0 — Evidence Thread (+5 more)

### Community 62 - "Packet PDF font provenance and text policy"
Cohesion: 0.20
Nodes (14): Bounded ToUnicode destinations and ActualText spans, Bundled static Noto fonts for API and worker PDFs, Canonical wording and Packet v2 hashes remain unchanged, Combining-mark outline mapping preserves extracted wording, DOCX display depends on viewer-installed fonts, Documented embedded-glyph outline decoding tests, Width-based wrapping at grapheme boundaries, NotoSans-Regular.ttf (+6 more)

### Community 63 - "verify-sbom-freshness.mjs"
Cohesion: 0.34
Nodes (12): compareDocuments(), comparePurlSets(), cyclonedxPurls(), registryPropertyName(), sortedPurls(), spdxPurls(), stableCycloneDx(), stableOccurrenceMetadata() (+4 more)

### Community 64 - "career-ledger.ts"
Cohesion: 0.25
Nodes (8): InsightsPanel(), ApplicationViewState, ApplicationViewProjection, careerLedgerInsightCounts(), changedApplicationsForView(), ApplicationLike, fixture(), stores

### Community 66 - "copy-vocabulary.test.ts"
Cohesion: 0.31
Nodes (7): copyLiterals(), DISCLAIMER_MARKERS, domainCopyFile, here, sentences(), stripComments(), stripIdentifierLiterals()

### Community 67 - ".createContact"
Cohesion: 0.22
Nodes (5): ContactRecord, recordDateOnly(), recordText(), CONTACT_KINDS, ContactKind

### Community 68 - "Nimanto Architecture"
Cohesion: 0.22
Nodes (13): Durable Idempotent Jobs, Inward Dependency Direction, TypeScript Modular Monolith Decision, Next.js Backend for Frontend Guide, Nimanto Architecture, PostgreSQL RLS and Application Authorization, PostgreSQL Row Security Documentation, Private Object Capability (+5 more)

### Community 69 - "Nimanto Trust Privacy and Security Plan"
Cohesion: 0.17
Nodes (13): Identity-Invariant Scoring, Accessibility and Trust Controls, Identity-Invariant Fairness Safeguards, Isolated Upload and Parsing Pipeline, Legal and Expert Review Flags, Nimanto Trust Privacy and Security Plan, Operator Access Reality, OWASP File Upload Cheat Sheet (+5 more)

### Community 70 - "createSubmissionDraft"
Cohesion: 0.30
Nodes (9): ApplicationSubmissionRecorder(), createSubmissionDraft(), localInputValue(), Packet, SubmissionDraft, ControlledRecorder(), initial(), packet() (+1 more)

### Community 71 - "worker.ts"
Cohesion: 0.32
Nodes (7): bootstrapSecret(), cycle(), loopbackApiOrigin(), nextDelay(), runCycle(), WorkerCycleResult, servers

### Community 72 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, exclude, extends (+4 more)

### Community 73 - "url.ts"
Cohesion: 0.36
Nodes (8): Address, beforeDeadline(), expandIPv6(), fetchAllowlistedJobPage(), isPrivateAddress(), requestPinned(), Response, textFromPage()

### Community 74 - "role-provenance.tsx"
Cohesion: 0.29
Nodes (9): dateOrUnknown(), human(), localDateTime(), reviewedDate(), RoleAvailability, RoleProvenanceCard(), RoleProvenanceData, RoleSourcePolicy (+1 more)

### Community 75 - "createScopedRequestGate"
Cohesion: 0.50
Nodes (3): createScopedRequestGate(), ScopedRequestGate, ScopedRequestToken

### Community 76 - "Nimanto Product Contract"
Cohesion: 0.22
Nodes (11): Confirmed Evidence Lifecycle, No External Effects Through Slice 3, Candidate-Controlled Job Search Operating System, Career Evidence Vault, DOL H-1B Program Guidance, Evidence States, Frozen Artifact Approval, Hard-Constraint Policy (+3 more)

### Community 77 - "Nimanto redesign — Colour & Material 002"
Cohesion: 0.18
Nodes (11): 0. Survey — what comparable open-source tools already ship, 10. Release ⚑, 1. Why, 3. Decisions, 5. Website, 7. Deferred — and what will _not_ change ⚑, 8. Files ⚑, 9. Verification ⚑ (+3 more)

### Community 78 - "package.json"
Cohesion: 0.14
Nodes (13): author, bugs, url, description, homepage, license, name, packageManager (+5 more)

### Community 79 - "database/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 80 - "database/tsconfig.build.json"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, noEmit, outDir, rootDir, exclude, extends, include (+3 more)

### Community 81 - "h1b-evidence.tsx"
Cohesion: 0.29
Nodes (9): dateTime(), GOVERNMENT_SOURCE_TYPES, H1bEvidencePanel(), human(), REVIEWABLE_CODES, RoleH1bSignal, RoleMatchSnapshot, RoleWordingBlocker (+1 more)

### Community 82 - "Provider setup and trust boundaries"
Cohesion: 0.20
Nodes (9): Connected accounts, Deep link, Government dataset editions (advanced API-only input), Job discovery providers, Local test outbox, Optional Ollama companion, Provider setup and trust boundaries, Reconcile an ambiguous action (+1 more)

### Community 83 - "submissions.ts"
Cohesion: 0.31
Nodes (8): ApplicationSubmissionRecord, clean(), normalizeCandidateSubmission(), PACKET_ARTIFACT_FORMATS, PacketArtifactFormat, SUBMISSION_CHANNELS, SubmissionChannel, now

### Community 84 - ".runWorkerCycle"
Cohesion: 0.22
Nodes (7): DiscoveryCycle, normalizeProviderRole(), scheduledFailureEvent(), ScheduledJobEvent, scheduledRetryDelayMinutes(), transitions, transitionScheduledJob()

### Community 85 - "Candidate follow-up date"
Cohesion: 0.67
Nodes (3): Candidate follow-up date, Local calendar reminder export, Record-review queue

### Community 86 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 87 - "domain/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 88 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 89 - "providers/package.json"
Cohesion: 0.10
Nodes (19): dependencies, @nimanto/domain, devDependencies, @types/node, typescript, vitest, exports, @nimanto/domain (+11 more)

### Community 90 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 92 - "server.test.ts"
Cohesion: 0.29
Nodes (4): apps, mkdtempTracked(), setup(), temporaryRoots

### Community 93 - "api/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 94 - "answer-history-currentness.test.tsx"
Cohesion: 0.25
Nodes (4): AnswerHistoryDetails(), at(), Pending, render()

### Community 95 - "match-evidence-lens.ts"
Cohesion: 0.36
Nodes (6): label(), MatchEvidenceLens(), MatchEvidenceLensProjection, MatchEvidenceResult, MatchEvidenceStrengthBasis, projectMatchEvidenceLens()

### Community 96 - "identity-transitions.ts"
Cohesion: 0.28
Nodes (7): DeletionReceipt, IdentityTransitionEvent, IdentityTransitionPlan, LocationDisposition, LocationInput, scrubCredential(), workspaceIdentityTransitions

### Community 97 - "web/tsconfig.json"
Cohesion: 0.13
Nodes (14): compilerOptions, incremental, jsx, plugins, exclude, extends, include, ../../tsconfig.base.json (+6 more)

### Community 98 - "2. The palette"
Cohesion: 0.22
Nodes (9): 2. The palette, Ground, Materials, ⚑ Non-text contrast (WCAG 1.4.11 — borders, chips, focus rings need ≥3:1), Proportion — the governing rule, Ramps, ⚑ Type on ink — computed, ⚑ Type scale (revision 1 shipped a font list with no system) (+1 more)

### Community 99 - "acquireDataDirectoryLock"
Cohesion: 0.27
Nodes (8): closeStore(), acquireDataDirectoryLock(), bootEpoch(), legacyOwnerIsDead(), privateFile(), sameFile(), migrateDatabase(), tightenPosixPermissions()

### Community 100 - "layout.tsx"
Cohesion: 0.32
Nodes (5): metadata, viewport, isLoopbackHost(), ServiceWorker(), serviceWorkerScriptUrl()

### Community 101 - "worker/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 102 - "worker/tsconfig.build.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, outDir, rootDir, extends, include, src, ./tsconfig.json

### Community 103 - "Nimanto v0.10.0 — Keep the Record, Prove the Handoff"
Cohesion: 0.25
Nodes (7): Added, Boundaries, Nimanto v0.10.0 — Keep the Record, Prove the Handoff, Preserved, Strengthened, Upgrade, Verify

### Community 104 - "Nimanto user-flow analysis"
Cohesion: 0.25
Nodes (5): 1. The intended flow, 3. Cross-cutting failure modes, 4. Constraints the fixes must respect, 5. Flow after the change, Nimanto user-flow analysis

### Community 105 - "Nimanto v0.2.0 — Colour & Material"
Cohesion: 0.25
Nodes (8): Colour & Material 002, Correctness, Nimanto v0.2.0 — Colour & Material, The mark, The website, The workbench, Unchanged, Verification

### Community 106 - "Nimanto v0.5.2 — Ask Clearly, Return Exactly"
Cohesion: 0.25
Nodes (7): Improved, Maintenance, Nimanto v0.5.2 — Ask Clearly, Return Exactly, Provenance, Still out of scope, Upgrade, Verification

### Community 107 - "Nimanto v0.8.0 — Find It, Compare It, Keep It"
Cohesion: 0.25
Nodes (7): Added, Boundaries, Nimanto v0.8.0 — Find It, Compare It, Keep It, Preserved, Strengthened, Upgrade, Verify

### Community 108 - "Nimanto v0.9.0 — Choose the Search, Keep the Evidence"
Cohesion: 0.25
Nodes (7): Added, Boundaries, Nimanto v0.9.0 — Choose the Search, Keep the Evidence, Preserved, Strengthened, Upgrade, Verify

### Community 109 - "2. Where the candidate actually stalls"
Cohesion: 0.25
Nodes (8): 2. Where the candidate actually stalls, S1 — "I imported. Now what?" (entry cliff), S2 — Blocked match is a terminal screen, S3 — Applications are a flat list with a `<select>`, S4 — The funnel is buried and under-read, S5 — Silence is indistinguishable from nothing-happened, S6 — No way to get anywhere fast, S7 — The app lies when the API is down

### Community 111 - "store-lock.test.ts"
Cohesion: 0.32
Nodes (6): children, contender(), message(), openChild(), roots, stores

### Community 112 - "documents/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 113 - "parsers/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 114 - "providers/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 116 - "First release"
Cohesion: 0.29
Nodes (6): Deliberate beta limits, First release, Included, Locally verified from the release tree, Nimanto v0.1.0 — local beta, Release gates

### Community 117 - "Nimanto v0.5.3 — Proof Means Enforced"
Cohesion: 0.29
Nodes (6): Boundaries, Fixed, Included from v0.5.2, Nimanto v0.5.3 — Proof Means Enforced, Upgrade, Verify

### Community 118 - "Nimanto v0.5.4 — Work Stays Yours"
Cohesion: 0.29
Nodes (6): Boundaries, Fixed, Improved, Nimanto v0.5.4 — Work Stays Yours, Upgrade, Verify

### Community 119 - "Nimanto v0.6.0 — Follow Up on Your Terms"
Cohesion: 0.29
Nodes (6): Added, Boundaries, Nimanto v0.6.0 — Follow Up on Your Terms, Refined, Upgrade, Verify

### Community 120 - "Nimanto v0.7.0 — One Place for Each Promise"
Cohesion: 0.29
Nodes (6): Boundaries, Deepened, Nimanto v0.7.0 — One Place for Each Promise, Preserved, Upgrade, Verify

### Community 121 - "url-network.test.ts"
Cohesion: 0.29
Nodes (4): FakeRequest, FakeResponse, input, transport

### Community 122 - "render-screenshots.mjs"
Cohesion: 0.29
Nodes (5): assets, publicAssets, root, siteOnly, workbenchOnly

### Community 123 - "validate-sbom.mjs"
Cohesion: 0.29
Nodes (4): args, releaseManifest, releaseWorkspaces, requiredPackages

### Community 124 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 125 - "Nimanto Domain Language"
Cohesion: 0.33
Nodes (5): Evidence and explanation, Nimanto Domain Language, Operations, Preparation and action, Role intake

### Community 126 - "Sensitive workspace inspection export"
Cohesion: 0.33
Nodes (6): Legacy lock marker recovery, Sensitive workspace inspection export, Spreadsheet-safe shown-record export, SQLite exclusive database ownership, Stopped full-directory backup, Stopped ownership protocol upgrade

### Community 127 - "Local recovery readiness"
Cohesion: 0.33
Nodes (5): Decision and scope, Local recovery readiness, Phase R1: synthetic stopped-copy rehearsal, Phase R2: deletion across older backups, Phase R3: hosted recovery acceptance

### Community 128 - "Durable discovery schedules"
Cohesion: 0.33
Nodes (5): Acceptance, Durable discovery schedules, Outcome, Public seams, State and safety contract

### Community 129 - "Nimanto v0.5.5 — Same Boundaries, Fresh Runtime"
Cohesion: 0.33
Nodes (5): Boundaries, Improved, Nimanto v0.5.5 — Same Boundaries, Fresh Runtime, Upgrade, Verify

### Community 130 - "keywords"
Cohesion: 0.33
Nodes (6): keywords, career-tools, evidence, h1b, job-search, local-first

### Community 131 - "render-social-card.mjs"
Cohesion: 0.33
Nodes (4): assets, faces, modules, root

### Community 133 - "external-action-runtime.ts"
Cohesion: 0.50
Nodes (3): deriveExternalActionRuntimeView(), ExternalActionRuntime, ExternalActionRuntimeView

### Community 135 - "sanitize-sbom.mjs"
Cohesion: 0.50
Nodes (3): hasMachineLocalPath(), paths, sanitize()

### Community 136 - "Frozen Packet composition"
Cohesion: 0.50
Nodes (4): Current Profile Version rebind, Exact reviewed Assurance approval, External-action currentness and runtime gate, Frozen Packet composition

### Community 137 - "First marketplace MVP"
Cohesion: 0.50
Nodes (4): First marketplace MVP, Rights-approved broad-feed bake-off, RoleCluster, Source-preserving grouping

### Community 138 - "4. The mark"
Cohesion: 0.50
Nodes (4): 4.1 Concept and provenance, 4.2 Surfaces, 4.3 Hero specification ⚑, 4. The mark

### Community 139 - "6. Workbench"
Cohesion: 0.50
Nodes (4): 6.1 Restyle — ⚑ layout, not only colour, 6.2 Features, 6.3 Robustness, 6. Workbench

### Community 143 - "dependencies"
Cohesion: 0.67
Nodes (3): concurrently, dependencies, concurrently

### Community 156 - "engines"
Cohesion: 0.67
Nodes (3): engines, node, pnpm

## Knowledge Gaps
- **894 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+889 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NimantoStore` connect `NimantoStore` to `jobs.ts`, `government-dataset.ts`, `iso`, `store.ts`, `dashboard-read.ts`, `.approveExternalActionExact`, `answer-history.test.ts`, `parsers/src/index.ts`, `deletion-coordinator.ts`, `canonicalHash`, `.transaction`, `domain/src/index.ts`, `buildServer`, `career-operations.ts`, `EvidenceClaim`, `packet-lifecycle.test.ts`, `career-ledger.ts`, `.getPacket`, `.createContact`, `.runWorkerCycle`, `server.test.ts`, `acquireDataDirectoryLock`, `store-lock.test.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `buildServer()` connect `buildServer` to `jobs.ts`, `iso`, `dashboard-read.ts`, `.approveExternalActionExact`, `parsers/src/index.ts`, `deletion-coordinator.ts`, `canonicalHash`, `NimantoStore`, `.transaction`, `providers/src/index.ts`, `career-operations.ts`, `config.ts`, `EvidenceClaim`, `packet-lifecycle.test.ts`, `.getPacket`, `.createContact`, `.runWorkerCycle`, `server.test.ts`, `acquireDataDirectoryLock`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `ApplicationStatus` connect `career-operations.ts` to `career-ledger.ts`, `workspace.tsx`, `matching.ts`, `derive.ts`, `buildServer`, `store.ts`, `career-ledger.tsx`, `canonicalHash`, `calendar-export.ts`, `.transaction`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _894 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `jobs.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05201465201465202 - nodes in this community are weakly interconnected._
- **Should `workspace.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.035959809624537285 - nodes in this community are weakly interconnected._
- **Should `matching.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06826241134751773 - nodes in this community are weakly interconnected._