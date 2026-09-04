# Graph Report - integration  (2026-09-03)

## Corpus Check
- 262 files · ~7,987,153 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2209 nodes · 3973 edges · 157 communities (123 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b3ebde0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- derive.ts
- workspace.tsx
- scripts
- packet-lifecycle.ts
- NimantoEmblem
- match-evidence-lens.ts
- store.ts
- config.ts
- parsers/src/index.ts
- Run and operate the local beta
- Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It
- dependencies
- sponsorship.ts
- roles.ts
- matching.ts
- NimantoEmblem
- .transaction
- calendar-export.ts
- NimantoStore
- migrations.ts
- screenshot-evidence.mjs
- ACKNOWLEDGMENTS.md
- dependencies
- compilerOptions
- role-discovery.ts
- api
- jobs.ts
- .createContact
- government-dataset.ts
- applications-workbench.ts
- What changed
- .exportTenant
- devDependencies
- Nimanto Sources Licenses and Provider Gate
- Job-source expansion research
- DeletionCoordinator
- Nimanto v0.4.0 — Inspectable History
- Nimanto v0.4.1 — Action Before Analysis
- EvidenceClaim
- Nimanto Initial Backend Plan
- Ashby Job Postings API
- Nimanto v0.3.0 — Evidence Thread
- domain/src/index.ts
- Nimanto Architecture
- Nimanto Trust Privacy and Security Plan
- verify-sbom-freshness.mjs
- ats-verification.ts
- package.json
- Six trust boundaries
- Fastify API
- compilerOptions
- version-sync.test.mjs
- browser-components.test.tsx
- Workspace
- worker/package.json
- keywords
- Nimanto Product Contract
- Nimanto redesign — Colour & Material 002
- database/package.json
- PacketHistoryPanel
- database/tsconfig.json
- database/tsconfig.build.json
- domain/package.json
- career-ledger.tsx
- packet-composer.ts
- workbench-mutations.ts
- Nimanto v0.9.0 — Choose the Search, Keep the Evidence
- documents/package.json
- compilerOptions
- domain/tsconfig.json
- parsers/package.json
- compilerOptions
- providers/package.json
- compilerOptions
- api/tsconfig.json
- identity-transitions.ts
- web/tsconfig.json
- worker.ts
- career-ledger.ts
- CONTRIBUTING.md
- 2. The palette
- SECURITY.md
- local-beta.spec.ts
- worker/tsconfig.json
- worker/tsconfig.build.json
- Greenhouse Job Board API
- Nimanto user-flow analysis
- Nimanto v0.2.0 — Colour & Material
- Nimanto v0.5.2 — Ask Clearly, Return Exactly
- Nimanto v0.8.0 — Find It, Compare It, Keep It
- 2. Where the candidate actually stalls
- Job source expansion research
- Lever Postings API
- documents/tsconfig.json
- parsers/tsconfig.json
- providers/tsconfig.json
- SmartRecruiters Posting API
- .runWorkerCycle
- application-dossier.ts
- layout.tsx
- ats-routing.ts
- First release
- Nimanto v0.5.3 — Proof Means Enforced
- Nimanto v0.5.4 — Work Stays Yours
- Nimanto v0.6.0 — Follow Up on Your Terms
- Nimanto v0.7.0 — One Place for Each Promise
- v0.9.0 public-surface ledger
- render-screenshots.mjs
- compilerOptions
- submissions.ts
- Nimanto Domain Language
- Durable discovery schedules
- Nimanto v0.5.5 — Same Boundaries, Fresh Runtime
- url.ts
- role-provenance.tsx
- render-social-card.mjs
- validate-sbom.mjs
- .approveExternalActionExact
- ErrorBoundary
- buildServer
- career-operations.ts
- h1b-evidence.tsx
- engines
- docker-context.test.mjs
- .#mapAssurance
- sanitize-sbom.mjs
- ExternalActionLifecycle
- 4. The mark
- 6. Workbench
- canonicalHash
- release-assets.test.mjs
- sw.js
- Local beta boundary
- v0.1.0 implemented slice matrix
- v0.5.2 public-surface ledger
- v0.5.3 public-surface ledger
- v0.5.4 public-surface ledger
- v0.5.5 public-surface ledger
- v0.6.0 public-surface ledger
- v0.7.0 public-surface ledger
- v0.8.0 public-surface ledger
- write-sbom-checksums.mjs
- AGENTS.md
- next.config.ts
- next-env.d.ts
- CODE_OF_CONDUCT.md
- GOVERNANCE.md
- schedules.ts
- application-submission.tsx
- copy-vocabulary.test.ts
- marketplace.ts
- store.test.ts
- dependencies
- large-tenant-performance-budget.md

## God Nodes (most connected - your core abstractions)
1. `NimantoStore` - 180 edges
2. `buildServer()` - 109 edges
3. `canonicalHash()` - 54 edges
4. `iso()` - 31 edges
5. `scripts` - 24 edges
6. `Workspace()` - 23 edges
7. `Applications()` - 23 edges
8. `NimantoEmblem` - 23 edges
9. `api()` - 22 edges
10. `ApplicationStatus` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Candidate-approved Discovery Profile` --semantically_similar_to--> `Discovery Profile replay`  [INFERRED] [semantically similar]
  README.md → docs/architecture/system.md
- `Source-qualified posting freshness` --semantically_similar_to--> `Source completeness policy`  [INFERRED] [semantically similar]
  README.md → docs/architecture/system.md
- `H-1B evidence separation` --semantically_similar_to--> `Warning-only sponsorship boundary`  [INFERRED] [semantically similar]
  README.md → docs/planning/job-marketplace-expansion-plan-2026-08-26.md
- `Grounded packet lifecycle` --semantically_similar_to--> `Staged packet lifecycle`  [INFERRED] [semantically similar]
  README.md → docs/architecture/system.md
- `Source-preserving Role grouping` --semantically_similar_to--> `RoleCluster`  [INFERRED] [semantically similar]
  README.md → docs/planning/job-marketplace-expansion-plan-2026-08-26.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Candidate-controlled trust pipeline** — docs_architecture_system_candidate_approved_evidence_intake, docs_architecture_system_exact_snapshot_match_publication, docs_architecture_system_staged_packet_lifecycle, docs_architecture_system_exact_approved_action_lifecycle [EXTRACTED 1.00]
- **Marketplace foundation** — docs_planning_job_marketplace_expansion_plan_2026_08_26_source_registry, docs_planning_job_marketplace_expansion_plan_2026_08_26_provider_protocol, docs_planning_job_marketplace_expansion_plan_2026_08_26_role_availability, docs_planning_job_marketplace_expansion_plan_2026_08_26_work_mode_normalization, docs_planning_job_marketplace_expansion_plan_2026_08_26_discovery_profile, docs_planning_job_marketplace_expansion_plan_2026_08_26_rolecluster [EXTRACTED 1.00]
- **Nimanto runtime topology** — docs_architecture_system_static_next_js_workbench, docs_architecture_system_fastify_api, docs_architecture_system_pglite_postgresql, docs_architecture_system_durable_refresh_worker, docs_architecture_system_deny_by_default_source_registry, docs_architecture_system_exact_approved_action_lifecycle [EXTRACTED 1.00]
- **Confirmed Evidence to Match Flow** — docs_planning_architecture_confirmed_evidence_lifecycle, docs_planning_product_contract_career_evidence_vault, docs_planning_product_contract_evidence_states, docs_planning_product_contract_overall_match_bands, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Tenant Isolation Defense in Depth** — docs_planning_architecture_postgresql_rls_defense, docs_planning_architecture_single_candidate_tenancy, docs_planning_trust_and_security_tenant_authorization, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Review Before External Action** — docs_planning_architecture_no_external_effects_through_slice_3, docs_planning_product_contract_source_action_contract, docs_planning_product_contract_frozen_artifact_approval, docs_planning_backend_plan_slice_3_grounded_packet [INFERRED 0.95]

## Communities (157 total, 34 thin omitted)

### Community 0 - "derive.ts"
Cohesion: 0.07
Nodes (52): Applications(), downloadTextFile(), emptyEvidenceFilters(), EvidenceVault(), fileBase64(), localDayInstant(), ActionLike, APPLICATION_MATCH_BUCKETS (+44 more)

### Community 1 - "workspace.tsx"
Cohesion: 0.04
Nodes (49): CommandPalette(), PaletteEntry, siteCommands, Connection, ConnectionBanner(), ConnectionIndicator(), useConnection(), Action (+41 more)

### Community 2 - "scripts"
Cohesion: 0.08
Nodes (24): scripts, build, check, clean, dev, dev:all, dev:core, format (+16 more)

### Community 3 - "packet-lifecycle.ts"
Cohesion: 0.08
Nodes (33): ArtifactManifest, PacketArtifactInspector, PacketArtifactRenderer, PacketRecord, CanonicalPacket, createDocx(), createPdf(), decodeXml() (+25 more)

### Community 4 - "NimantoEmblem"
Cohesion: 0.10
Nodes (13): annulusJaali(), barShape(), bracketShape(), diamond(), getTHREE(), glowTexture(), NimantoEmblem, notchPoly() (+5 more)

### Community 5 - "match-evidence-lens.ts"
Cohesion: 0.36
Nodes (6): label(), MatchEvidenceLens(), MatchEvidenceLensProjection, MatchEvidenceResult, MatchEvidenceStrengthBasis, projectMatchEvidenceLens()

### Community 6 - "store.ts"
Cohesion: 0.06
Nodes (37): migrateDatabase(), AnswerBlockRecord, AnswerRevisionRecord, ApplicationNoteRecord, AssuranceHistoryRecord, AssuranceRecord, CareerOperationsSnapshot, ClaimedSourceSchedule (+29 more)

### Community 7 - "config.ts"
Cohesion: 0.13
Nodes (17): ProviderJobVerifier, AllowlistedJobPageFetcher, booleanEnvironment(), GovernmentDatasetTrust, loadOptions(), localBootstrapSecret(), LocalModelAdapter, NimantoApiOptions (+9 more)

### Community 8 - "parsers/src/index.ts"
Cohesion: 0.15
Nodes (24): EvidenceIntake, parseUpload(), previewHash(), requestObject(), requiredString(), reviewedProjection(), Upload, stores (+16 more)

### Community 9 - "Run and operate the local beta"
Cohesion: 0.06
Nodes (30): A packet is blocked, A Submission Record is blocked, An action is ambiguous, Back up and restore, Data locations, Docker self-hosting, Execute is disabled, Gmail or Outlook is unavailable (+22 more)

### Community 10 - "Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It"
Cohesion: 0.06
Nodes (27): A UI-only Workbench mutation coordinator, Consistent current-Role normalization, Dependency and verification maintenance, Nimanto v0.5.0 — Clear Intent, Current Truth, One candidate Application transition policy, Separate Identity and navigation/focus transitions, Surface inventory, v0.5.0 public-surface ledger (+19 more)

### Community 11 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, @fontsource/ibm-plex-mono, @fontsource/instrument-serif, @fontsource-variable/archivo, lucide-react, next, @nimanto/domain, react (+38 more)

### Community 12 - "sponsorship.ts"
Cohesion: 0.16
Nodes (18): GovernmentDatasetIngestion, languageReview(), stores, buildEmployerCandidates(), EmployerAliasInput, EmployerCandidate, employerRegistryChecksum(), EmployerResolutionEvaluation (+10 more)

### Community 13 - "roles.ts"
Cohesion: 0.27
Nodes (12): JobRecord, JobUpsertInput, classifyRoleFamily(), RoleFamily, WorkplaceEvidence, WorkplaceMode, normalized(), normalizeRoleObservation() (+4 more)

### Community 14 - "matching.ts"
Cohesion: 0.07
Nodes (39): approvedActionFixture(), channel(), css, luminance(), ratio(), token(), MatchRunRecord, RoleWordingReviewRecord (+31 more)

### Community 15 - "NimantoEmblem"
Cohesion: 0.09
Nodes (17): BOUNDARY, METHOD, Brand(), HUB, Mark(), PETALS, clamp(), EmblemOptions (+9 more)

### Community 16 - ".transaction"
Cohesion: 0.15
Nodes (7): PacketLifecycle, verifyPacketArtifacts(), ApplicationRecord, ApplicationStatusEvent, createReceipt(), CandidateSubmissionInput, ApplicationStatus

### Community 17 - "calendar-export.ts"
Cohesion: 0.13
Nodes (17): buildApplicationCsv(), CsvApplication, csvCell(), CsvJob, HEADERS, spreadsheetSafe(), buildFollowUpCalendar(), calendarDate() (+9 more)

### Community 18 - "NimantoStore"
Cohesion: 0.07
Nodes (3): iso(), NimantoStore, sha256()

### Community 19 - "migrations.ts"
Cohesion: 0.19
Nodes (17): migrations, freshSchemaSql, schemaVersion10Sql, schemaVersion11Sql, schemaVersion12Sql, schemaVersion13Sql, schemaVersion14Sql, schemaVersion15Sql (+9 more)

### Community 20 - "screenshot-evidence.mjs"
Cohesion: 0.14
Nodes (17): apiPort, repository, sitePort, update, assertScreenshotBytesMatch(), assertScreenshotVisuallyMatches(), buildScreenshotEvidence(), collectFiles() (+9 more)

### Community 22 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui (+38 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2024, compilerOptions, allowJs, allowSyntheticDefaultImports, exactOptionalPropertyTypes, forceConsistentCasingInFileNames (+14 more)

### Community 24 - "role-discovery.ts"
Cohesion: 0.10
Nodes (32): areaValue(), assessDiscoveryProfile(), compareCanonicalAreas(), confirmedArea(), countryLevelArea(), DiscoveryMatchPublication, DiscoveryProfileAssessment, DiscoveryProfileLike (+24 more)

### Community 25 - "api"
Cohesion: 0.12
Nodes (28): ActionRunner, Actions(), ActivityLedger(), ApplicationDossier(), ApplicationFilterDisclosure(), ApplicationNoteEditor(), atsRouteGateLabel(), cadenceLabel() (+20 more)

### Community 26 - "jobs.ts"
Cohesion: 0.28
Nodes (22): normalizeWorkplaceMode(), area(), ashbyJobs(), assertBoard(), assertSourceJobId(), digest(), Fetcher, fetchProviderJobs() (+14 more)

### Community 27 - ".createContact"
Cohesion: 0.25
Nodes (5): ContactRecord, recordDateOnly(), recordText(), CONTACT_KINDS, ContactKind

### Community 28 - "government-dataset.ts"
Cohesion: 0.19
Nodes (17): TrustedEmployerResolutionEvaluation, exactText(), GovernmentDatasetAdmission, GovernmentDatasetRow, LABELS, record(), text(), TrustedGovernmentDatasetCatalog (+9 more)

### Community 29 - "applications-workbench.ts"
Cohesion: 0.16
Nodes (17): ApplicationNoteDraft, ApplicationsWorkbench, ApplicationsWorkbenchAction, applicationsWorkbenchReducer(), ApplicationsWorkbenchState, closeDraft(), createApplicationsWorkbenchState(), dateInputValue() (+9 more)

### Community 30 - "What changed"
Cohesion: 0.12
Nodes (15): Candidate-approved evidence intake, Durable discovery and dataset editions, Exact-approved external actions, Exact-snapshot match publication, Flow and responsive polish, Nimanto v0.4.2 — Exact Review, Exact Commit, One application transition policy, Resumable deletion write fence (+7 more)

### Community 32 - "devDependencies"
Cohesion: 0.12
Nodes (17): cspell, @cyclonedx/cdxgen, devDependencies, cspell, @cyclonedx/cdxgen, @playwright/test, prettier, sharp (+9 more)

### Community 33 - "Nimanto Sources Licenses and Provider Gate"
Cohesion: 0.14
Nodes (16): Observability Allowlist, H-1B Evidence Taxonomy, Source and Action Capability Contract, Defer USAJOBS Ingestion, Dependency License and Security Ledger, Government Dataset Provenance, Greenhouse Job Board API, Slice-1 Greenhouse Source Policy (+8 more)

### Community 34 - "Job-source expansion research"
Cohesion: 0.11
Nodes (18): “Best available source” governance, Candidate privacy and hostile-source boundary, Canonical work-mode and geography model, Current Nimanto baseline and gaps, Deterministic resume and preference matching, Duplicate lineage, Executive recommendation, Explicit no-scrape / approval-only list (+10 more)

### Community 35 - "DeletionCoordinator"
Cohesion: 0.23
Nodes (3): DeletionCoordinator, warnCleanupPending(), run()

### Community 36 - "Nimanto v0.4.0 — Inspectable History"
Cohesion: 0.13
Nodes (13): 1. Stored history and export v2, 2. Packet history and assurance comparison, 3. Record-review queue, 4. Literal profile and match comparison, 5. Application cohort counts, Correctness and privacy, Nimanto v0.4.0 — Inspectable History, Surface inventory (+5 more)

### Community 37 - "Nimanto v0.4.1 — Action Before Analysis"
Cohesion: 0.13
Nodes (13): 1. Manual role drafts survive section changes, 2. Applications opens on the work, 3. Section focus clears the sticky header, 4. No-op profile saves no longer create history, 5. Completion copy comes from returned data, Nimanto v0.4.1 — Action Before Analysis, Public surface, Surface inventory (+5 more)

### Community 38 - "EvidenceClaim"
Cohesion: 0.38
Nodes (3): EvidenceRow, mapEvidence(), EvidenceClaim

### Community 39 - "Nimanto Initial Backend Plan"
Cohesion: 0.20
Nodes (14): Clean-Start Verification, Exact Implementation Approval Gate, Versioned Held-Out Evaluation, Nimanto Initial Backend Plan, Public Repository Gate, Slice 1 Evidence to Match, Slice 2 Transfer Intelligence, Slice 3 Grounded Packet (+6 more)

### Community 41 - "Nimanto v0.3.0 — Evidence Thread"
Cohesion: 0.14
Nodes (13): 1. Private role narrowing, 2. Recorded application timelines, 3. Sponsorship provenance and freshness, 4. Match anatomy, 5. Tamper-evident local activity, 6. Packet review, Correctness, Nimanto v0.3.0 — Evidence Thread (+5 more)

### Community 42 - "domain/src/index.ts"
Cohesion: 0.10
Nodes (19): DashboardRead, DeletionRun, RemovePath, ExternalActionCapability, ProviderActionExecutor, FastifyRequest, stores, rawDatabases (+11 more)

### Community 43 - "Nimanto Architecture"
Cohesion: 0.22
Nodes (13): Durable Idempotent Jobs, Inward Dependency Direction, TypeScript Modular Monolith Decision, Next.js Backend for Frontend Guide, Nimanto Architecture, PostgreSQL RLS and Application Authorization, PostgreSQL Row Security Documentation, Private Object Capability (+5 more)

### Community 44 - "Nimanto Trust Privacy and Security Plan"
Cohesion: 0.17
Nodes (13): Identity-Invariant Scoring, Accessibility and Trust Controls, Identity-Invariant Fairness Safeguards, Isolated Upload and Parsing Pipeline, Legal and Expert Review Flags, Nimanto Trust Privacy and Security Plan, Operator Access Reality, OWASP File Upload Cheat Sheet (+5 more)

### Community 45 - "verify-sbom-freshness.mjs"
Cohesion: 0.34
Nodes (12): compareDocuments(), comparePurlSets(), cyclonedxPurls(), registryPropertyName(), sortedPurls(), spdxPurls(), stableCycloneDx(), stableOccurrenceMetadata() (+4 more)

### Community 46 - "ats-verification.ts"
Cohesion: 0.27
Nodes (7): AtsVerification, EnabledAtsProvider, enabledProvider(), providerErrorCode(), routeFor(), VerificationRequest, ProviderJobVerificationResult

### Community 47 - "package.json"
Cohesion: 0.14
Nodes (13): author, bugs, url, description, homepage, license, name, packageManager (+5 more)

### Community 49 - "Fastify API"
Cohesion: 0.05
Nodes (42): Candidate-approved evidence intake, Candidate Role disposition, Deep link and local test outbox, Deny-by-default source registry, Discovery Profile replay, Durable DiscoveryCycle, Durable refresh worker, Exact-approved action lifecycle (+34 more)

### Community 50 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, exclude, extends (+4 more)

### Community 51 - "version-sync.test.mjs"
Cohesion: 0.25
Nodes (13): countOccurrences(), currentSchemaVersion(), markdownSection(), releaseAssetPaths(), schemaVersionTextChecks(), validateVersionSync(), versionTextChecks(), workspacePackages (+5 more)

### Community 52 - "browser-components.test.tsx"
Cohesion: 0.16
Nodes (7): AnswerHistoryDetails(), CopyLine(), CopyState, DeletionReceiptGuidance(), RoleIdentityReviewNotice(), answerAt(), serveRevisions()

### Community 53 - "Workspace"
Cohesion: 0.16
Nodes (16): emptyManualRoleDraft(), emptyReviewedUrlDraft(), manualRoleDraftForReview(), sameActionDraft(), sameManualRoleDraft(), sameReviewedUrlDraft(), Workspace(), failureMessage() (+8 more)

### Community 54 - "worker/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, tsx, @types/node, typescript, vitest, tsx, @types/node, typescript (+11 more)

### Community 55 - "keywords"
Cohesion: 0.33
Nodes (6): keywords, career-tools, evidence, h1b, job-search, local-first

### Community 56 - "Nimanto Product Contract"
Cohesion: 0.22
Nodes (11): Confirmed Evidence Lifecycle, No External Effects Through Slice 3, Candidate-Controlled Job Search Operating System, Career Evidence Vault, DOL H-1B Program Guidance, Evidence States, Frozen Artifact Approval, Hard-Constraint Policy (+3 more)

### Community 57 - "Nimanto redesign — Colour & Material 002"
Cohesion: 0.18
Nodes (11): 0. Survey — what comparable open-source tools already ship, 10. Release ⚑, 1. Why, 3. Decisions, 5. Website, 7. Deferred — and what will _not_ change ⚑, 8. Files ⚑, 9. Verification ⚑ (+3 more)

### Community 58 - "database/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @electric-sql/pglite, @nimanto/domain, devDependencies, @types/node, typescript, vitest, exports (+14 more)

### Community 59 - "PacketHistoryPanel"
Cohesion: 0.29
Nodes (6): packetCanonicalDelta(), PacketHistoryPanel(), packetManifestDelta(), createScopedRequestGate(), ScopedRequestGate, ScopedRequestToken

### Community 60 - "database/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 61 - "database/tsconfig.build.json"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, noEmit, outDir, rootDir, exclude, extends, include (+3 more)

### Community 62 - "domain/package.json"
Cohesion: 0.11
Nodes (17): devDependencies, @types/node, typescript, vitest, exports, @types/node, typescript, vitest (+9 more)

### Community 63 - "career-ledger.tsx"
Cohesion: 0.10
Nodes (33): amountToMinor(), AnswerRevision, AnswerRevisionHistory(), AnswersPanel(), Application, applicationLabel(), CareerLedger(), CareerOperationsSnapshot (+25 more)

### Community 64 - "packet-composer.ts"
Cohesion: 0.13
Nodes (18): Application, Evidence, Job, Match, PacketComposer(), Profile, RebindProfileVersionButton(), ComposerApplication (+10 more)

### Community 65 - "workbench-mutations.ts"
Cohesion: 0.24
Nodes (7): createWorkbenchMutations(), MutationAdapters, RefreshOutcome, WorkbenchMutation, WorkbenchMutationOutcome, WorkbenchMutations, harness()

### Community 66 - "Nimanto v0.9.0 — Choose the Search, Keep the Evidence"
Cohesion: 0.25
Nodes (7): Added, Boundaries, Nimanto v0.9.0 — Choose the Search, Keep the Evidence, Preserved, Strengthened, Upgrade, Verify

### Community 67 - "documents/package.json"
Cohesion: 0.07
Nodes (27): docx, dependencies, docx, fflate, @nimanto/domain, pdf-lib, pdfjs-dist, devDependencies (+19 more)

### Community 68 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 69 - "domain/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 70 - "parsers/package.json"
Cohesion: 0.07
Nodes (27): dependencies, fflate, @nimanto/domain, pdfjs-dist, saxes, devDependencies, pdf-lib, @types/node (+19 more)

### Community 71 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 72 - "providers/package.json"
Cohesion: 0.10
Nodes (19): dependencies, @nimanto/domain, devDependencies, @types/node, typescript, vitest, exports, @nimanto/domain (+11 more)

### Community 73 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 74 - "api/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 75 - "identity-transitions.ts"
Cohesion: 0.28
Nodes (7): DeletionReceipt, IdentityTransitionEvent, IdentityTransitionPlan, LocationDisposition, LocationInput, scrubCredential(), workspaceIdentityTransitions

### Community 76 - "web/tsconfig.json"
Cohesion: 0.13
Nodes (14): compilerOptions, incremental, jsx, plugins, exclude, extends, include, ../../tsconfig.base.json (+6 more)

### Community 77 - "worker.ts"
Cohesion: 0.40
Nodes (7): setup(), bootstrapSecret(), cycle(), loopbackApiOrigin(), nextDelay(), runCycle(), WorkerCycleResult

### Community 78 - "career-ledger.ts"
Cohesion: 0.26
Nodes (11): ReviewsPanel(), ApplicationViewState, ApplicationViewProjection, careerLedgerInsightCounts(), changedApplicationsForView(), filtersFromSavedView(), projectApplicationView(), ApplicationLike (+3 more)

### Community 80 - "2. The palette"
Cohesion: 0.22
Nodes (9): 2. The palette, Ground, Materials, ⚑ Non-text contrast (WCAG 1.4.11 — borders, chips, focus rings need ≥3:1), Proportion — the governing rule, Ramps, ⚑ Type on ink — computed, ⚑ Type scale (revision 1 shipped a font list with no system) (+1 more)

### Community 83 - "worker/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 84 - "worker/tsconfig.build.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, outDir, rootDir, extends, include, src, ./tsconfig.json

### Community 86 - "Nimanto user-flow analysis"
Cohesion: 0.25
Nodes (5): 1. The intended flow, 3. Cross-cutting failure modes, 4. Constraints the fixes must respect, 5. Flow after the change, Nimanto user-flow analysis

### Community 87 - "Nimanto v0.2.0 — Colour & Material"
Cohesion: 0.25
Nodes (8): Colour & Material 002, Correctness, Nimanto v0.2.0 — Colour & Material, The mark, The website, The workbench, Unchanged, Verification

### Community 88 - "Nimanto v0.5.2 — Ask Clearly, Return Exactly"
Cohesion: 0.25
Nodes (7): Improved, Maintenance, Nimanto v0.5.2 — Ask Clearly, Return Exactly, Provenance, Still out of scope, Upgrade, Verification

### Community 89 - "Nimanto v0.8.0 — Find It, Compare It, Keep It"
Cohesion: 0.25
Nodes (7): Added, Boundaries, Nimanto v0.8.0 — Find It, Compare It, Keep It, Preserved, Strengthened, Upgrade, Verify

### Community 90 - "2. Where the candidate actually stalls"
Cohesion: 0.25
Nodes (8): 2. Where the candidate actually stalls, S1 — "I imported. Now what?" (entry cliff), S2 — Blocked match is a terminal screen, S3 — Applications are a flat list with a `<select>`, S4 — The funnel is buried and under-read, S5 — Silence is indistinguishable from nothing-happened, S6 — No way to get anywhere fast, S7 — The app lies when the API is down

### Community 93 - "documents/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 94 - "parsers/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 95 - "providers/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 97 - ".runWorkerCycle"
Cohesion: 0.18
Nodes (7): DiscoveryCycle, normalizeFetchResult(), normalizeProviderRole(), annotateClusters(), clusterKey(), CurrentRole, ProviderFetchRun

### Community 98 - "application-dossier.ts"
Cohesion: 0.25
Nodes (7): ActionLike, ApplicationOwned, ContactLike, DossierApplication, DossierSubmission, PacketLike, projectApplicationDossier()

### Community 99 - "layout.tsx"
Cohesion: 0.32
Nodes (5): metadata, viewport, isLoopbackHost(), ServiceWorker(), serviceWorkerScriptUrl()

### Community 100 - "ats-routing.ts"
Cohesion: 0.16
Nodes (19): ATS_PROVIDERS, AtsRoutingDecision, AtsRoutingInput, AtsRoutingProvider, CANDIDATE_OWNED_SOURCES, canonicalTarget(), decision(), gated() (+11 more)

### Community 101 - "First release"
Cohesion: 0.29
Nodes (6): Deliberate beta limits, First release, Included, Locally verified from the release tree, Nimanto v0.1.0 — local beta, Release gates

### Community 102 - "Nimanto v0.5.3 — Proof Means Enforced"
Cohesion: 0.29
Nodes (6): Boundaries, Fixed, Included from v0.5.2, Nimanto v0.5.3 — Proof Means Enforced, Upgrade, Verify

### Community 103 - "Nimanto v0.5.4 — Work Stays Yours"
Cohesion: 0.29
Nodes (6): Boundaries, Fixed, Improved, Nimanto v0.5.4 — Work Stays Yours, Upgrade, Verify

### Community 104 - "Nimanto v0.6.0 — Follow Up on Your Terms"
Cohesion: 0.29
Nodes (6): Added, Boundaries, Nimanto v0.6.0 — Follow Up on Your Terms, Refined, Upgrade, Verify

### Community 105 - "Nimanto v0.7.0 — One Place for Each Promise"
Cohesion: 0.29
Nodes (6): Boundaries, Deepened, Nimanto v0.7.0 — One Place for Each Promise, Preserved, Upgrade, Verify

### Community 107 - "render-screenshots.mjs"
Cohesion: 0.29
Nodes (5): assets, publicAssets, root, siteOnly, workbenchOnly

### Community 108 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 109 - "submissions.ts"
Cohesion: 0.31
Nodes (8): ApplicationSubmissionRecord, clean(), normalizeCandidateSubmission(), PACKET_ARTIFACT_FORMATS, PacketArtifactFormat, SUBMISSION_CHANNELS, SubmissionChannel, now

### Community 110 - "Nimanto Domain Language"
Cohesion: 0.33
Nodes (5): Evidence and explanation, Nimanto Domain Language, Operations, Preparation and action, Role intake

### Community 111 - "Durable discovery schedules"
Cohesion: 0.33
Nodes (5): Acceptance, Durable discovery schedules, Outcome, Public seams, State and safety contract

### Community 112 - "Nimanto v0.5.5 — Same Boundaries, Fresh Runtime"
Cohesion: 0.33
Nodes (5): Boundaries, Improved, Nimanto v0.5.5 — Same Boundaries, Fresh Runtime, Upgrade, Verify

### Community 113 - "url.ts"
Cohesion: 0.36
Nodes (5): Address, fetchAllowlistedJobPage(), isPrivateAddress(), Response, textFromPage()

### Community 114 - "role-provenance.tsx"
Cohesion: 0.29
Nodes (9): dateOrUnknown(), human(), localDateTime(), reviewedDate(), RoleAvailability, RoleProvenanceCard(), RoleProvenanceData, RoleSourcePolicy (+1 more)

### Community 115 - "render-social-card.mjs"
Cohesion: 0.33
Nodes (4): assets, faces, modules, root

### Community 116 - "validate-sbom.mjs"
Cohesion: 0.33
Nodes (4): args, releaseManifest, releaseWorkspaces, requiredPackages

### Community 119 - "buildServer"
Cohesion: 0.13
Nodes (26): verifiedArtifactBytes(), buildServer(), discoveryProfileInput(), fastify, H1B_LABELS, historyOptions(), identity(), JsonObject (+18 more)

### Community 120 - "career-operations.ts"
Cohesion: 0.13
Nodes (17): InsightsPanel(), ApplicationActivityRecord, InterviewRoundRecord, recordInstant(), ACTIVITY_KINDS, ACTIVITY_STATES, ActivityKind, ActivityState (+9 more)

### Community 121 - "h1b-evidence.tsx"
Cohesion: 0.29
Nodes (9): dateTime(), GOVERNMENT_SOURCE_TYPES, H1bEvidencePanel(), human(), REVIEWABLE_CODES, RoleH1bSignal, RoleMatchSnapshot, RoleWordingBlocker (+1 more)

### Community 122 - "engines"
Cohesion: 0.67
Nodes (3): engines, node, pnpm

### Community 125 - "sanitize-sbom.mjs"
Cohesion: 0.50
Nodes (3): hasMachineLocalPath(), paths, sanitize()

### Community 127 - "4. The mark"
Cohesion: 0.50
Nodes (4): 4.1 Concept and provenance, 4.2 Surfaces, 4.3 Hero specification ⚑, 4. The mark

### Community 128 - "6. Workbench"
Cohesion: 0.50
Nodes (4): 6.1 Restyle — ⚑ layout, not only colour, 6.2 Features, 6.3 Robustness, 6. Workbench

### Community 129 - "canonicalHash"
Cohesion: 0.13
Nodes (17): EnabledProvider, EnabledProviderRequest, ProviderJobLike, publishMatch(), uniqueEvidenceIds(), fixture(), stores, packetFixture() (+9 more)

### Community 132 - "Local beta boundary"
Cohesion: 0.67
Nodes (3): Hosted trust layer, Local beta boundary, Monorepo architecture

### Community 150 - "schedules.ts"
Cohesion: 0.43
Nodes (5): scheduledFailureEvent(), ScheduledJobEvent, scheduledRetryDelayMinutes(), transitions, transitionScheduledJob()

### Community 151 - "application-submission.tsx"
Cohesion: 0.43
Nodes (6): ApplicationSubmissionRecorder(), createSubmissionDraft(), localInputValue(), Packet, SubmissionDraft, ControlledRecorder()

### Community 152 - "copy-vocabulary.test.ts"
Cohesion: 0.38
Nodes (5): DISCLAIMER_MARKERS, here, sentences(), stripComments(), stripIdentifierLiterals()

### Community 153 - "marketplace.ts"
Cohesion: 0.18
Nodes (16): normalizeDiscoveryProfile(), normalizeList(), RoleAvailabilityRecord, RoleVerificationInput, VerificationAttemptRecord, isValidatedRoleFamily(), PublicationState, StructuredArea (+8 more)

### Community 154 - "store.test.ts"
Cohesion: 0.40
Nodes (3): stores, v041FixtureSql, roleSnapshotHash()

### Community 155 - "dependencies"
Cohesion: 0.67
Nodes (3): concurrently, dependencies, concurrently

## Knowledge Gaps
- **834 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+829 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NimantoStore` connect `NimantoStore` to `canonicalHash`, `packet-lifecycle.ts`, `store.ts`, `config.ts`, `parsers/src/index.ts`, `sponsorship.ts`, `.transaction`, `schedules.ts`, `marketplace.ts`, `store.test.ts`, `.createContact`, `government-dataset.ts`, `.exportTenant`, `DeletionCoordinator`, `EvidenceClaim`, `domain/src/index.ts`, `ats-verification.ts`, `.runWorkerCycle`, `.approveExternalActionExact`, `buildServer`, `career-operations.ts`, `.#mapAssurance`, `ExternalActionLifecycle`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `ApplicationStatus` connect `.transaction` to `derive.ts`, `workspace.tsx`, `packet-lifecycle.ts`, `store.ts`, `career-ledger.ts`, `matching.ts`, `calendar-export.ts`, `buildServer`, `career-operations.ts`, `career-ledger.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `buildServer()` connect `buildServer` to `canonicalHash`, `store.ts`, `config.ts`, `parsers/src/index.ts`, `.transaction`, `NimantoStore`, `jobs.ts`, `.createContact`, `.exportTenant`, `DeletionCoordinator`, `EvidenceClaim`, `domain/src/index.ts`, `ats-verification.ts`, `worker.ts`, `.runWorkerCycle`, `.approveExternalActionExact`, `career-operations.ts`, `.#mapAssurance`, `ExternalActionLifecycle`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _834 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `derive.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06599326599326599 - nodes in this community are weakly interconnected._
- **Should `workspace.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.03635432667690732 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._