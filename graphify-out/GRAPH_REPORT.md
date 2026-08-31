# Graph Report - worktree  (2026-08-30)

## Corpus Check
- 246 files · ~7,516,506 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2098 nodes · 3690 edges · 144 communities (112 shown, 32 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47cecd62`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- derive.ts
- workspace.tsx
- scripts
- documents/src/index.ts
- NimantoEmblem
- external-actions.ts
- store.ts
- applications.ts
- parsers/src/index.ts
- Run and operate the local beta
- Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It
- dependencies
- government-dataset.ts
- api
- matching.ts
- NimantoEmblem
- dashboard-read.ts
- calendar-export.ts
- NimantoStore
- migrations.ts
- screenshot-evidence.mjs
- ACKNOWLEDGMENTS.md
- dependencies
- compilerOptions
- role-discovery.ts
- .transaction
- canonicalHash
- discovery-cycle.ts
- external-action-lifecycle.ts
- applications-workbench.ts
- What changed
- buildServer
- devDependencies
- Nimanto Sources Licenses and Provider Gate
- Job-source expansion research
- roles.ts
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
- .exportTenant
- package.json
- Six trust boundaries
- Fastify API
- compilerOptions
- version-sync.test.mjs
- DeletionCoordinator
- Workspace
- worker/package.json
- keywords
- Nimanto Product Contract
- Nimanto redesign — Colour & Material 002
- database/package.json
- marketplace.ts
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
- repository
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
- iso
- application-dossier.ts
- career-operations.ts
- jobs.ts
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
- application-submission.tsx
- h1b-evidence.tsx
- render-social-card.mjs
- validate-sbom.mjs
- .createContact
- .#mapJob
- PacketHistoryPanel
- sanitize-sbom.mjs
- 4. The mark
- 6. Workbench
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
- packet-lifecycle.ts

## God Nodes (most connected - your core abstractions)
1. `NimantoStore` - 166 edges
2. `buildServer()` - 100 edges
3. `canonicalHash()` - 53 edges
4. `iso()` - 30 edges
5. `NimantoEmblem` - 23 edges
6. `scripts` - 23 edges
7. `api()` - 21 edges
8. `Workspace()` - 20 edges
9. `Applications()` - 20 edges
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

## Communities (144 total, 32 thin omitted)

### Community 0 - "derive.ts"
Cohesion: 0.07
Nodes (50): Applications(), downloadTextFile(), localDayInstant(), Overview(), ActionLike, APPLICATION_MATCH_BUCKETS, ApplicationActivityLike, applicationCohortCounts() (+42 more)

### Community 1 - "workspace.tsx"
Cohesion: 0.03
Nodes (52): CareerLedger(), CareerOperationsSnapshot, CommandPalette(), PaletteEntry, siteCommands, Connection, ConnectionBanner(), ConnectionIndicator() (+44 more)

### Community 2 - "scripts"
Cohesion: 0.09
Nodes (23): scripts, build, check, clean, dev, dev:all, dev:core, format (+15 more)

### Community 3 - "documents/src/index.ts"
Cohesion: 0.20
Nodes (16): CanonicalPacket, createDocx(), createPdf(), decodeXml(), DocumentInspection, docxText(), inspectPacketArtifacts(), normalizedContent() (+8 more)

### Community 4 - "NimantoEmblem"
Cohesion: 0.10
Nodes (13): annulusJaali(), barShape(), bracketShape(), diamond(), getTHREE(), glowTexture(), NimantoEmblem, notchPoly() (+5 more)

### Community 5 - "external-actions.ts"
Cohesion: 0.20
Nodes (8): ExternalActionRecord, AssuranceFinding, AssuranceFindingCode, assurePacket(), PacketAssuranceResult, ExternalActionEvent, transitions, ExternalActionState

### Community 6 - "store.ts"
Cohesion: 0.06
Nodes (37): FastifyRequest, migrateDatabase(), AnswerBlockRecord, AnswerRevisionRecord, ApplicationNoteRecord, AssuranceHistoryRecord, AssuranceRecord, CareerOperationsSnapshot (+29 more)

### Community 7 - "applications.ts"
Cohesion: 0.21
Nodes (9): APPLICATION_STATUSES, applicationTransitions, CandidateApplicationDecision, CandidateApplicationOption, consequentialTargets, isStatus(), legalCandidateTargets, PacketApplicationDecision (+1 more)

### Community 8 - "parsers/src/index.ts"
Cohesion: 0.15
Nodes (23): EvidenceIntake, parseUpload(), previewHash(), requestObject(), requiredString(), reviewedProjection(), Upload, stores (+15 more)

### Community 9 - "Run and operate the local beta"
Cohesion: 0.06
Nodes (30): A packet is blocked, A Submission Record is blocked, An action is ambiguous, Back up and restore, Data locations, Docker self-hosting, Execute is disabled, Gmail or Outlook is unavailable (+22 more)

### Community 10 - "Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It"
Cohesion: 0.06
Nodes (27): A UI-only Workbench mutation coordinator, Consistent current-Role normalization, Dependency and verification maintenance, Nimanto v0.5.0 — Clear Intent, Current Truth, One candidate Application transition policy, Separate Identity and navigation/focus transitions, Surface inventory, v0.5.0 public-surface ledger (+19 more)

### Community 11 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, @fontsource/ibm-plex-mono, @fontsource/instrument-serif, @fontsource-variable/archivo, lucide-react, next, @nimanto/domain, react (+38 more)

### Community 12 - "government-dataset.ts"
Cohesion: 0.07
Nodes (47): ProviderJobVerifier, AllowlistedJobPageFetcher, GovernmentDatasetTrust, loadOptions(), localBootstrapSecret(), LocalModelAdapter, NimantoApiOptions, TrustedEmployerResolutionEvaluation (+39 more)

### Community 13 - "api"
Cohesion: 0.11
Nodes (28): Actions(), ActivityLedger(), ApplicationFilterDisclosure(), ApplicationNoteEditor(), atsRouteGateLabel(), cadenceLabel(), DataControls(), dateInputValue() (+20 more)

### Community 14 - "matching.ts"
Cohesion: 0.10
Nodes (31): channel(), css, luminance(), ratio(), token(), MatchRunRecord, RoleWordingReviewRecord, bandFromValue() (+23 more)

### Community 15 - "NimantoEmblem"
Cohesion: 0.08
Nodes (19): BOUNDARY, METHOD, Brand(), HUB, Mark(), PETALS, CopyLine(), CopyState (+11 more)

### Community 16 - "dashboard-read.ts"
Cohesion: 0.38
Nodes (3): DashboardRead, stores, freshH1bLabel()

### Community 17 - "calendar-export.ts"
Cohesion: 0.13
Nodes (17): buildApplicationCsv(), CsvApplication, csvCell(), CsvJob, HEADERS, spreadsheetSafe(), buildFollowUpCalendar(), calendarDate() (+9 more)

### Community 19 - "migrations.ts"
Cohesion: 0.21
Nodes (15): backfillIntegrityHashes(), migrations, freshSchemaSql, schemaVersion10Sql, schemaVersion11Sql, schemaVersion12Sql, schemaVersion13Sql, schemaVersion14Sql (+7 more)

### Community 20 - "screenshot-evidence.mjs"
Cohesion: 0.13
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

### Community 25 - ".transaction"
Cohesion: 0.16
Nodes (5): PacketLifecycle, verifyPacketArtifacts(), ExecutionReceipt, verifyReceipt(), CandidateSubmissionInput

### Community 26 - "canonicalHash"
Cohesion: 0.20
Nodes (4): annotateClusters(), clusterKey(), transitionExternalAction(), canonicalHash()

### Community 27 - "discovery-cycle.ts"
Cohesion: 0.13
Nodes (15): DiscoveryCycle, EnabledProvider, EnabledProviderRequest, normalizeFetchResult(), normalizeProviderRole(), ProviderJobLike, CurrentRole, scheduledFailureEvent() (+7 more)

### Community 28 - "external-action-lifecycle.ts"
Cohesion: 0.17
Nodes (9): ExternalActionLifecycle, ProviderActionExecutor, stores, ExternalActionProvider, ActionPayload, ActionResult, buildDeepLink(), executeProviderAction() (+1 more)

### Community 29 - "applications-workbench.ts"
Cohesion: 0.16
Nodes (16): ApplicationNoteDraft, ApplicationsWorkbench, ApplicationsWorkbenchAction, applicationsWorkbenchReducer(), ApplicationsWorkbenchState, closeDraft(), createApplicationsWorkbenchState(), dateInputValue() (+8 more)

### Community 30 - "What changed"
Cohesion: 0.12
Nodes (15): Candidate-approved evidence intake, Durable discovery and dataset editions, Exact-approved external actions, Exact-snapshot match publication, Flow and responsive polish, Nimanto v0.4.2 — Exact Review, Exact Commit, One application transition policy, Resumable deletion write fence (+7 more)

### Community 31 - "buildServer"
Cohesion: 0.15
Nodes (23): verifiedArtifactBytes(), buildServer(), discoveryProfileInput(), fastify, H1B_LABELS, historyOptions(), identity(), JsonObject (+15 more)

### Community 32 - "devDependencies"
Cohesion: 0.11
Nodes (19): concurrently, cspell, @cyclonedx/cdxgen, devDependencies, concurrently, cspell, @cyclonedx/cdxgen, @playwright/test (+11 more)

### Community 33 - "Nimanto Sources Licenses and Provider Gate"
Cohesion: 0.14
Nodes (16): Observability Allowlist, H-1B Evidence Taxonomy, Source and Action Capability Contract, Defer USAJOBS Ingestion, Dependency License and Security Ledger, Government Dataset Provenance, Greenhouse Job Board API, Slice-1 Greenhouse Source Policy (+8 more)

### Community 34 - "Job-source expansion research"
Cohesion: 0.11
Nodes (18): “Best available source” governance, Candidate privacy and hostile-source boundary, Canonical work-mode and geography model, Current Nimanto baseline and gaps, Deterministic resume and preference matching, Duplicate lineage, Executive recommendation, Explicit no-scrape / approval-only list (+10 more)

### Community 35 - "roles.ts"
Cohesion: 0.29
Nodes (11): JobRecord, JobUpsertInput, RoleFamily, WorkplaceEvidence, WorkplaceMode, normalized(), normalizeRoleObservation(), required() (+3 more)

### Community 36 - "Nimanto v0.4.0 — Inspectable History"
Cohesion: 0.13
Nodes (13): 1. Stored history and export v2, 2. Packet history and assurance comparison, 3. Record-review queue, 4. Literal profile and match comparison, 5. Application cohort counts, Correctness and privacy, Nimanto v0.4.0 — Inspectable History, Surface inventory (+5 more)

### Community 37 - "Nimanto v0.4.1 — Action Before Analysis"
Cohesion: 0.13
Nodes (13): 1. Manual role drafts survive section changes, 2. Applications opens on the work, 3. Section focus clears the sticky header, 4. No-op profile saves no longer create history, 5. Completion copy comes from returned data, Nimanto v0.4.1 — Action Before Analysis, Public surface, Surface inventory (+5 more)

### Community 38 - "EvidenceClaim"
Cohesion: 0.18
Nodes (5): seedDemo(), EvidenceRow, mapEvidence(), EvidenceClaim, ParsedEvidence

### Community 39 - "Nimanto Initial Backend Plan"
Cohesion: 0.20
Nodes (14): Clean-Start Verification, Exact Implementation Approval Gate, Versioned Held-Out Evaluation, Nimanto Initial Backend Plan, Public Repository Gate, Slice 1 Evidence to Match, Slice 2 Transfer Intelligence, Slice 3 Grounded Packet (+6 more)

### Community 41 - "Nimanto v0.3.0 — Evidence Thread"
Cohesion: 0.14
Nodes (13): 1. Private role narrowing, 2. Recorded application timelines, 3. Sponsorship provenance and freshness, 4. Match anatomy, 5. Tamper-evident local activity, 6. Packet review, Correctness, Nimanto v0.3.0 — Evidence Thread (+5 more)

### Community 42 - "domain/src/index.ts"
Cohesion: 0.24
Nodes (8): publishMatch(), uniqueEvidenceIds(), fixture(), stores, packetFixture(), canonicalize(), canonicalJson(), createReceipt()

### Community 43 - "Nimanto Architecture"
Cohesion: 0.22
Nodes (13): Durable Idempotent Jobs, Inward Dependency Direction, TypeScript Modular Monolith Decision, Next.js Backend for Frontend Guide, Nimanto Architecture, PostgreSQL RLS and Application Authorization, PostgreSQL Row Security Documentation, Private Object Capability (+5 more)

### Community 44 - "Nimanto Trust Privacy and Security Plan"
Cohesion: 0.17
Nodes (13): Identity-Invariant Scoring, Accessibility and Trust Controls, Identity-Invariant Fairness Safeguards, Isolated Upload and Parsing Pipeline, Legal and Expert Review Flags, Nimanto Trust Privacy and Security Plan, Operator Access Reality, OWASP File Upload Cheat Sheet (+5 more)

### Community 45 - "verify-sbom-freshness.mjs"
Cohesion: 0.34
Nodes (12): compareDocuments(), comparePurlSets(), cyclonedxPurls(), registryPropertyName(), sortedPurls(), spdxPurls(), stableCycloneDx(), stableOccurrenceMetadata() (+4 more)

### Community 47 - "package.json"
Cohesion: 0.14
Nodes (13): author, bugs, url, description, engines, node, pnpm, homepage (+5 more)

### Community 49 - "Fastify API"
Cohesion: 0.05
Nodes (42): Candidate-approved evidence intake, Candidate Role disposition, Deep link and local test outbox, Deny-by-default source registry, Discovery Profile replay, Durable DiscoveryCycle, Durable refresh worker, Exact-approved action lifecycle (+34 more)

### Community 50 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, exclude, extends (+4 more)

### Community 51 - "version-sync.test.mjs"
Cohesion: 0.29
Nodes (10): countOccurrences(), markdownSection(), releaseAssetPaths(), validateVersionSync(), versionTextChecks(), workspacePackages, checks, fixtureFiles (+2 more)

### Community 53 - "Workspace"
Cohesion: 0.17
Nodes (15): emptyManualRoleDraft(), emptyReviewedUrlDraft(), sameActionDraft(), sameManualRoleDraft(), sameReviewedUrlDraft(), Workspace(), failureMessage(), createWorkspaceNavigationTransitions() (+7 more)

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

### Community 59 - "marketplace.ts"
Cohesion: 0.18
Nodes (16): normalizeDiscoveryProfile(), normalizeList(), RoleAvailabilityRecord, RoleVerificationInput, VerificationAttemptRecord, isValidatedRoleFamily(), PublicationState, StructuredArea (+8 more)

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
Cohesion: 0.16
Nodes (21): amountToMinor(), AnswersPanel(), Application, applicationLabel(), Evidence, formatMoney(), human(), Job (+13 more)

### Community 64 - "packet-composer.ts"
Cohesion: 0.14
Nodes (16): Application, Evidence, Job, Match, PacketComposer(), Profile, ComposerApplication, ComposerEvidence (+8 more)

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

### Community 78 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

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

### Community 98 - "application-dossier.ts"
Cohesion: 0.22
Nodes (8): ApplicationDossier(), ActionLike, ApplicationOwned, ContactLike, DossierApplication, DossierSubmission, PacketLike, projectApplicationDossier()

### Community 99 - "career-operations.ts"
Cohesion: 0.10
Nodes (19): InsightsPanel(), ApplicationActivityRecord, InterviewRoundRecord, OutcomeRecord, recordDateOnly(), recordInstant(), recordText(), ACTIVITY_KINDS (+11 more)

### Community 100 - "jobs.ts"
Cohesion: 0.07
Nodes (57): AtsVerification, EnabledAtsProvider, enabledProvider(), providerErrorCode(), routeFor(), VerificationRequest, normalizeWorkplaceMode(), ATS_PROVIDERS (+49 more)

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

### Community 113 - "application-submission.tsx"
Cohesion: 0.50
Nodes (4): ApplicationSubmissionRecorder(), localInputValue(), Packet, SubmissionDraft

### Community 114 - "h1b-evidence.tsx"
Cohesion: 0.07
Nodes (26): metadata, viewport, metadata, ErrorBoundary, dateTime(), GOVERNMENT_SOURCE_TYPES, H1bEvidencePanel(), human() (+18 more)

### Community 115 - "render-social-card.mjs"
Cohesion: 0.33
Nodes (4): assets, faces, modules, root

### Community 116 - "validate-sbom.mjs"
Cohesion: 0.33
Nodes (4): paths, releaseManifest, releaseWorkspaces, requiredPackages

### Community 117 - ".createContact"
Cohesion: 0.50
Nodes (3): ContactRecord, CONTACT_KINDS, ContactKind

### Community 119 - "PacketHistoryPanel"
Cohesion: 0.29
Nodes (6): packetCanonicalDelta(), PacketHistoryPanel(), packetManifestDelta(), createScopedRequestGate(), ScopedRequestGate, ScopedRequestToken

### Community 125 - "sanitize-sbom.mjs"
Cohesion: 0.50
Nodes (3): hasMachineLocalPath(), paths, sanitize()

### Community 127 - "4. The mark"
Cohesion: 0.50
Nodes (4): 4.1 Concept and provenance, 4.2 Surfaces, 4.3 Hero specification ⚑, 4. The mark

### Community 128 - "6. Workbench"
Cohesion: 0.50
Nodes (4): 6.1 Restyle — ⚑ layout, not only colour, 6.2 Features, 6.3 Robustness, 6. Workbench

### Community 132 - "Local beta boundary"
Cohesion: 0.67
Nodes (3): Hosted trust layer, Local beta boundary, Monorepo architecture

### Community 154 - "packet-lifecycle.ts"
Cohesion: 0.21
Nodes (7): DeletionRun, RemovePath, ArtifactManifest, PacketArtifactInspector, PacketArtifactRenderer, stores, PacketRecord

## Knowledge Gaps
- **814 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+809 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NimantoStore` connect `NimantoStore` to `store.ts`, `parsers/src/index.ts`, `government-dataset.ts`, `dashboard-read.ts`, `.transaction`, `canonicalHash`, `packet-lifecycle.ts`, `discovery-cycle.ts`, `external-action-lifecycle.ts`, `buildServer`, `EvidenceClaim`, `domain/src/index.ts`, `.exportTenant`, `DeletionCoordinator`, `iso`, `career-operations.ts`, `jobs.ts`, `.createContact`, `.#mapJob`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `ApplicationStatus` connect `career-ledger.tsx` to `derive.ts`, `workspace.tsx`, `career-operations.ts`, `store.ts`, `applications.ts`, `matching.ts`, `calendar-export.ts`, `.transaction`, `packet-lifecycle.ts`, `buildServer`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _814 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `derive.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06748911465892599 - nodes in this community are weakly interconnected._
- **Should `workspace.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0344988344988345 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `NimantoEmblem` be split into smaller, more focused modules?**
  _Cohesion score 0.09957325746799431 - nodes in this community are weakly interconnected._