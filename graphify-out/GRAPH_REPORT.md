# Graph Report - /Users/umang/Documents/Codex/2026-10-13/new-chat/work/nimanto-security-20261121/repo  (2026-11-21)

## Corpus Check
- Large corpus: 331 files · ~8,450,726 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2382 nodes · 4340 edges · 165 communities (140 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- government-dataset.ts
- workspace.tsx
- database/src/index.ts
- derive.ts
- Packet
- NimantoStore
- dependencies
- dependencies
- store.ts
- Nimanto Trust Privacy and Security Plan
- canonicalHash
- Nimanto v0.10.0 local-beta workflow release
- NimantoEmblem
- career-ledger.tsx
- NimantoEmblem
- role-discovery.ts
- iso
- documents/package.json
- buildServer
- Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It
- api
- parsers/package.json
- workspace-read-currentness.test.tsx
- .transaction
- scripts
- career-operations.ts
- packet-composer.ts
- calendar-export.ts
- marketplace.ts
- ats-routing.ts
- screenshot-evidence.mjs
- packet-lifecycle.test.ts
- database/package.json
- jobs.ts
- compilerOptions
- providers/package.json
- server.ts
- applications-workbench.ts
- worker/package.json
- Workspace
- export-session.test.tsx
- Job-source expansion research
- documents/src/index.ts
- PacketPdfFonts
- EvidenceClaim
- migrations.ts
- domain/package.json
- devDependencies
- What changed
- providers/src/index.ts
- local-beta.spec.ts
- application-dossier.ts
- matching.ts
- career-ledger.ts
- web/tsconfig.json
- Nimanto v0.4.0 — Inspectable History
- Nimanto v0.4.1 — Action Before Analysis
- types.ts
- version-sync.test.mjs
- browser-components.test.tsx
- Nimanto v0.3.0 — Evidence Thread
- package.json
- verify-sbom-freshness.mjs
- discovery-cycle.ts
- compilerOptions
- createSubmissionDraft
- worker.ts
- database/tsconfig.json
- database/tsconfig.build.json
- applications.ts
- domain/tsconfig.json
- providers.test.ts
- compilerOptions
- h1b-evidence.tsx
- role-provenance.tsx
- Nimanto redesign — Colour & Material 002
- compilerOptions
- compilerOptions
- compilerOptions
- ats-verification.ts
- submissions.ts
- schedules.ts
- domain/src/index.ts
- api/tsconfig.json
- answer-history-currentness.test.tsx
- match-evidence-lens.ts
- identity-transitions.ts
- copy-vocabulary.test.ts
- worker/tsconfig.json
- worker/tsconfig.build.json
- 2. The palette
- acquireDataDirectoryLock
- ExternalActionProvider
- documents/tsconfig.json
- parsers/tsconfig.json
- providers/tsconfig.json
- .runWorkerCycle
- packet-lifecycle.ts
- layout.tsx
- Nimanto user-flow analysis
- Nimanto v0.2.0 — Colour & Material
- Nimanto v0.5.2 — Ask Clearly, Return Exactly
- Nimanto v0.8.0 — Find It, Compare It, Keep It
- 2. Where the candidate actually stalls
- store-lock.test.ts
- external-action-lifecycle.test.ts
- ErrorBoundary
- First release
- Nimanto v0.5.3 — Proof Means Enforced
- Nimanto v0.5.4 — Work Stays Yours
- Nimanto v0.6.0 — Follow Up on Your Terms
- Nimanto v0.7.0 — One Place for Each Promise
- url-network.test.ts
- render-screenshots.mjs
- validate-sbom.mjs
- tokens.test.ts
- Durable discovery schedules
- Nimanto v0.5.5 — Same Boundaries, Fresh Runtime
- keywords
- render-social-card.mjs
- external-action-runtime.ts
- sanitize-sbom.mjs
- Candidate-owned career ledger
- Nimanto social card with gold botanical emblem
- Nimanto social card
- Nimanto landing screenshot with dark background, gold accents, and botanical emblem
- Career ledger: depicted candidate-owned workspace record with Now, People, Answers, Reviews, Insights and Offers tabs
- 4. The mark
- 6. Workbench
- ContactKind
- answer-history.test.ts
- release-assets.test.mjs
- Local beta CI
- Full candidate CodeQL scan: diff-informed queries and overlay analysis disabled
- sw.js
- dependencies
- v0.5.2 public-surface ledger
- v0.5.3 public-surface ledger
- v0.5.4 public-surface ledger
- v0.5.5 public-surface ledger
- v0.6.0 public-surface ledger
- v0.7.0 public-surface ledger
- v0.8.0 public-surface ledger
- engines
- pnpm workspace dependency and build policy
- docker-context.test.mjs
- write-sbom-checksums.mjs
- AGENTS.md
- next.config.ts
- next-env.d.ts
- CODE_OF_CONDUCT.md
- GOVERNANCE.md
- SECURITY.md
- Weekly dependency updates
- Large-tenant Dashboard budget
- v0.10.1-dev.0 CycloneDX/SPDX SHA-256 manifest
- v0.8.0 CycloneDX/SPDX SHA-256 manifest

## God Nodes (most connected - your core abstractions)
1. `NimantoStore` - 187 edges
2. `buildServer()` - 111 edges
3. `canonicalHash()` - 59 edges
4. `iso()` - 32 edges
5. `Workspace()` - 25 edges
6. `scripts` - 25 edges
7. `Applications()` - 24 edges
8. `api()` - 24 edges
9. `NimantoEmblem` - 23 edges
10. `runRecoveryDrill()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `evidenceMatches()` --indirect_call--> `token()`  [INFERRED]
  packages/domain/src/matching.ts → apps/web/test/tokens.test.ts
- `Versioned government and occupational datasets` --semantically_similar_to--> `Bundled static Noto fonts`  [INFERRED] [semantically similar]
  docs/planning/sources-and-licenses.md → packages/documents/fonts/README.md
- `checkPdfMappingsAndOutlines()` --indirect_call--> `object()`  [INFERRED]
  packages/documents/test/documents.test.ts → apps/api/src/server.ts
- `buildServer()` --indirect_call--> `draftLocalSummary()`  [INFERRED]
  apps/api/src/server.ts → packages/providers/src/ollama.ts
- `Loopback self-hosted container` --conceptually_related_to--> `Local beta operations`  [INFERRED]
  compose.yaml → docs/operations/local-beta.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Distinct packet, action, and runtime approval gates** — context_assurance_run, context_packet, context_action_intent, docs_architecture_system_action_lifecycle [EXTRACTED 1.00]
- **Tenant Isolation Defense in Depth** — docs_planning_architecture_postgresql_rls_defense, docs_planning_architecture_single_candidate_tenancy, docs_planning_trust_and_security_tenant_authorization, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]

## Communities (165 total, 25 thin omitted)

### Community 0 - "government-dataset.ts"
Cohesion: 0.05
Nodes (57): ProviderJobVerifier, AllowlistedJobPageFetcher, booleanEnvironment(), GovernmentDatasetTrust, loadOptions(), localBootstrapSecret(), LocalModelAdapter, NimantoApiOptions (+49 more)

### Community 1 - "workspace.tsx"
Cohesion: 0.04
Nodes (48): CommandPalette(), PaletteEntry, siteCommands, Connection, ConnectionBanner(), ConnectionIndicator(), useConnection(), Action (+40 more)

### Community 2 - "database/src/index.ts"
Cohesion: 0.06
Nodes (40): DashboardRead, EvidenceIntake, parseUpload(), previewHash(), requestObject(), requiredString(), reviewedProjection(), Upload (+32 more)

### Community 3 - "derive.ts"
Cohesion: 0.07
Nodes (52): Applications(), downloadTextFile(), emptyEvidenceFilters(), EvidenceVault(), fileBase64(), localDayInstant(), ActionLike, APPLICATION_MATCH_BUCKET_LABELS (+44 more)

### Community 4 - "Packet"
Cohesion: 0.05
Nodes (50): Open-source acknowledgments, Loopback self-hosted container, Action Intent, Application, Assurance Run, Current Role, Dataset Edition, Deletion Run (+42 more)

### Community 6 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui (+38 more)

### Community 7 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, @fontsource/ibm-plex-mono, @fontsource/instrument-serif, @fontsource-variable/archivo, lucide-react, next, @nimanto/domain, react (+38 more)

### Community 8 - "store.ts"
Cohesion: 0.06
Nodes (46): AnswerBlockRecord, AnswerRevisionPage, AnswerRevisionRecord, ApplicationNoteRecord, AssuranceHistoryRecord, AssuranceRecord, CareerOperationsSnapshot, ClaimedSourceSchedule (+38 more)

### Community 9 - "Nimanto Trust Privacy and Security Plan"
Cohesion: 0.07
Nodes (42): Confirmed Evidence Lifecycle, Durable Idempotent Jobs, Inward Dependency Direction, TypeScript Modular Monolith Decision, Next.js Backend for Frontend Guide, Nimanto Architecture, No External Effects Through Slice 3, PostgreSQL RLS and Application Authorization (+34 more)

### Community 10 - "canonicalHash"
Cohesion: 0.11
Nodes (22): ProviderActionExecutor, publishMatch(), uniqueEvidenceIds(), PacketLifecycle, verifiedArtifactBytes(), verifyPacketArtifacts(), assertOwnership(), recoveryTreeDigest() (+14 more)

### Community 11 - "Nimanto v0.10.0 local-beta workflow release"
Cohesion: 0.07
Nodes (40): Candidate-controlled Career Evidence Vault, Qualified government language review, Server-trusted government provenance manifest, Nimanto historical product contract, scoring_rules_v1 ordinal match and coverage gates, Source capability and permission contract, Dependency compatibility, security and license gate, Proposed TypeScript modular monolith (+32 more)

### Community 12 - "NimantoEmblem"
Cohesion: 0.10
Nodes (13): annulusJaali(), barShape(), bracketShape(), diamond(), getTHREE(), glowTexture(), NimantoEmblem, notchPoly() (+5 more)

### Community 13 - "career-ledger.tsx"
Cohesion: 0.10
Nodes (34): amountToMinor(), AnswerRevision, AnswerRevisionHistory(), AnswersPanel(), Application, applicationLabel(), CareerLedger(), CareerOperationsSnapshot (+26 more)

### Community 14 - "NimantoEmblem"
Cohesion: 0.09
Nodes (17): BOUNDARY, METHOD, Brand(), HUB, Mark(), PETALS, clamp(), EmblemOptions (+9 more)

### Community 15 - "role-discovery.ts"
Cohesion: 0.10
Nodes (32): areaValue(), assessDiscoveryProfile(), compareCanonicalAreas(), confirmedArea(), countryLevelArea(), DiscoveryMatchPublication, DiscoveryProfileAssessment, DiscoveryProfileLike (+24 more)

### Community 16 - "iso"
Cohesion: 0.10
Nodes (3): historyLimit(), iso(), isoRequired()

### Community 17 - "documents/package.json"
Cohesion: 0.06
Nodes (31): docx, dependencies, docx, fflate, @nimanto/domain, pdf-lib, @pdf-lib/fontkit, pdfjs-dist (+23 more)

### Community 18 - "buildServer"
Cohesion: 0.11
Nodes (7): ExternalActionLifecycle, buildServer(), apps, fixture(), roots, sha256(), transitionExternalAction()

### Community 19 - "Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It"
Cohesion: 0.06
Nodes (27): A UI-only Workbench mutation coordinator, Consistent current-Role normalization, Dependency and verification maintenance, Nimanto v0.5.0 — Clear Intent, Current Truth, One candidate Application transition policy, Separate Identity and navigation/focus transitions, Surface inventory, v0.5.0 public-surface ledger (+19 more)

### Community 20 - "api"
Cohesion: 0.12
Nodes (30): ActionRunner, Actions(), ActivityLedger(), ApplicationFilterDisclosure(), ApplicationNoteEditor(), atsRouteGateLabel(), cadenceLabel(), DataControls() (+22 more)

### Community 21 - "parsers/package.json"
Cohesion: 0.07
Nodes (27): dependencies, fflate, @nimanto/domain, pdfjs-dist, saxes, devDependencies, pdf-lib, @types/node (+19 more)

### Community 22 - "workspace-read-currentness.test.tsx"
Cohesion: 0.16
Nodes (21): assertSessionFence(), button(), change(), click(), dashboard(), dossierDashboard(), dossierRun(), history() (+13 more)

### Community 24 - "scripts"
Cohesion: 0.08
Nodes (25): scripts, build, check, clean, dev, dev:all, dev:core, format (+17 more)

### Community 25 - "career-operations.ts"
Cohesion: 0.12
Nodes (20): ApplicationActivityRecord, InterviewRoundRecord, recordInstant(), recordText(), ACTIVITY_KINDS, ACTIVITY_STATES, ActivityKind, ActivityState (+12 more)

### Community 26 - "packet-composer.ts"
Cohesion: 0.11
Nodes (18): Application, Evidence, Job, Match, PacketComposer(), Profile, RebindProfileVersionButton(), ComposerApplication (+10 more)

### Community 27 - "calendar-export.ts"
Cohesion: 0.13
Nodes (17): buildApplicationCsv(), CsvApplication, csvCell(), CsvJob, HEADERS, spreadsheetSafe(), buildFollowUpCalendar(), calendarDate() (+9 more)

### Community 28 - "marketplace.ts"
Cohesion: 0.18
Nodes (20): JobRecord, JobUpsertInput, classifyRoleFamily(), isValidatedRoleFamily(), RoleFamily, StructuredArea, VALIDATED_ROLE_FAMILIES, validateStructuredArea() (+12 more)

### Community 29 - "ats-routing.ts"
Cohesion: 0.16
Nodes (19): ATS_PROVIDERS, AtsRoutingDecision, AtsRoutingInput, AtsRoutingProvider, CANDIDATE_OWNED_SOURCES, canonicalTarget(), decision(), gated() (+11 more)

### Community 30 - "screenshot-evidence.mjs"
Cohesion: 0.13
Nodes (18): apiPort, repository, run(), sitePort, update, assertScreenshotBytesMatch(), assertScreenshotVisuallyMatches(), buildScreenshotEvidence() (+10 more)

### Community 31 - "packet-lifecycle.test.ts"
Cohesion: 0.12
Nodes (8): DeletionCoordinator, DeletionRun, RemovePath, warnCleanupPending(), PacketArtifactRenderer, get(), stores, temporaryRoots

### Community 32 - "database/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @electric-sql/pglite, @nimanto/domain, devDependencies, @types/node, typescript, vitest, exports (+14 more)

### Community 33 - "jobs.ts"
Cohesion: 0.29
Nodes (22): normalizeWorkplaceMode(), area(), ashbyJobs(), assertBoard(), assertSourceJobId(), digest(), Fetcher, fetchProviderJobsResult() (+14 more)

### Community 34 - "compilerOptions"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2024, compilerOptions, allowJs, allowSyntheticDefaultImports, exactOptionalPropertyTypes, forceConsistentCasingInFileNames (+14 more)

### Community 35 - "providers/package.json"
Cohesion: 0.09
Nodes (21): htmlparser2, dependencies, htmlparser2, @nimanto/domain, devDependencies, @types/node, typescript, vitest (+13 more)

### Community 36 - "server.ts"
Cohesion: 0.18
Nodes (19): discoveryProfileInput(), fastify, H1B_LABELS, historyOptions(), identity(), JsonObject, manualOperationId(), manualRoleInput() (+11 more)

### Community 37 - "applications-workbench.ts"
Cohesion: 0.15
Nodes (18): ApplicationNoteDraft, ApplicationsWorkbench, ApplicationsWorkbenchAction, applicationsWorkbenchReducer(), ApplicationsWorkbenchState, ApplicationViewState, closeDraft(), createApplicationsWorkbenchState() (+10 more)

### Community 38 - "worker/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, tsx, @types/node, typescript, vitest, tsx, @types/node, typescript (+11 more)

### Community 39 - "Workspace"
Cohesion: 0.16
Nodes (16): emptyManualRoleDraft(), emptyReviewedUrlDraft(), manualRoleDraftForReview(), sameActionDraft(), sameManualRoleDraft(), sameReviewedUrlDraft(), withApplicationActivities(), Workspace() (+8 more)

### Community 40 - "export-session.test.tsx"
Cohesion: 0.15
Nodes (12): ApiError, fenceApiWritesToSession(), createWorkbenchMutations(), MutationAdapters, RefreshOutcome, WorkbenchMutation, WorkbenchMutationOutcome, WorkbenchMutations (+4 more)

### Community 41 - "Job-source expansion research"
Cohesion: 0.11
Nodes (18): “Best available source” governance, Candidate privacy and hostile-source boundary, Canonical work-mode and geography model, Current Nimanto baseline and gaps, Deterministic resume and preference matching, Duplicate lineage, Executive recommendation, Explicit no-scrape / approval-only list (+10 more)

### Community 42 - "documents/src/index.ts"
Cohesion: 0.18
Nodes (16): createDocx(), createPdf(), decodeXml(), docxText(), inspectPacketArtifacts(), normalizedContent(), PacketArtifact, PacketClaim (+8 more)

### Community 43 - "PacketPdfFonts"
Cohesion: 0.13
Nodes (7): fontFiles, graphemes, LoadedFont, loadFonts(), PacketFontEmbedder, PacketPdfFonts, Run

### Community 44 - "EvidenceClaim"
Cohesion: 0.18
Nodes (7): seedDemo(), mkdtempTracked(), packetFixture(), EvidenceRow, mapEvidence(), EvidenceClaim, ParsedEvidence

### Community 45 - "migrations.ts"
Cohesion: 0.20
Nodes (16): backfillIntegrityHashes(), migrations, freshSchemaSql, schemaVersion10Sql, schemaVersion11Sql, schemaVersion12Sql, schemaVersion13Sql, schemaVersion14Sql (+8 more)

### Community 46 - "domain/package.json"
Cohesion: 0.11
Nodes (17): devDependencies, @types/node, typescript, vitest, exports, @types/node, typescript, vitest (+9 more)

### Community 47 - "devDependencies"
Cohesion: 0.12
Nodes (17): cspell, @cyclonedx/cdxgen, devDependencies, cspell, @cyclonedx/cdxgen, @playwright/test, prettier, sharp (+9 more)

### Community 48 - "What changed"
Cohesion: 0.12
Nodes (15): Candidate-approved evidence intake, Durable discovery and dataset editions, Exact-approved external actions, Exact-snapshot match publication, Flow and responsive polish, Nimanto v0.4.2 — Exact Review, Exact Commit, One application transition policy, Resumable deletion write fence (+7 more)

### Community 49 - "providers/src/index.ts"
Cohesion: 0.20
Nodes (12): htmlText(), fetchProviderJobs(), Address, beforeDeadline(), expandIPv6(), fetchAllowlistedJobPage(), isPrivateAddress(), requestPinned() (+4 more)

### Community 50 - "local-beta.spec.ts"
Cohesion: 0.12
Nodes (3): apiPort, playwrightDataDir, webPort

### Community 51 - "application-dossier.ts"
Cohesion: 0.14
Nodes (12): ApplicationDossier(), ActionLike, ApplicationOwned, ContactLike, DossierApplication, DossierMatch, DossierSubmission, PacketLike (+4 more)

### Community 52 - "matching.ts"
Cohesion: 0.27
Nodes (14): bandFromValue(), blockerText(), evidenceMatches(), evidenceStrength(), IDENTITY_PATTERNS, locationBlockers(), matchJob(), normalizedCandidateProjection() (+6 more)

### Community 53 - "career-ledger.ts"
Cohesion: 0.22
Nodes (12): InsightsPanel(), ApplicationViewProjection, careerLedgerInsightCounts(), changedApplicationsForView(), filtersFromSavedView(), projectApplicationView(), ApplicationLike, filterApplications() (+4 more)

### Community 54 - "web/tsconfig.json"
Cohesion: 0.13
Nodes (14): compilerOptions, incremental, jsx, plugins, exclude, extends, include, ../../tsconfig.base.json (+6 more)

### Community 55 - "Nimanto v0.4.0 — Inspectable History"
Cohesion: 0.13
Nodes (13): 1. Stored history and export v2, 2. Packet history and assurance comparison, 3. Record-review queue, 4. Literal profile and match comparison, 5. Application cohort counts, Correctness and privacy, Nimanto v0.4.0 — Inspectable History, Surface inventory (+5 more)

### Community 56 - "Nimanto v0.4.1 — Action Before Analysis"
Cohesion: 0.13
Nodes (13): 1. Manual role drafts survive section changes, 2. Applications opens on the work, 3. Section focus clears the sticky header, 4. No-op profile saves no longer create history, 5. Completion copy comes from returned data, Nimanto v0.4.1 — Action Before Analysis, Public surface, Surface inventory (+5 more)

### Community 57 - "types.ts"
Cohesion: 0.13
Nodes (14): MatchRunRecord, RoleWordingReviewRecord, CoverageState, EvidenceConfidence, EvidenceState, EvidenceStatus, EvidenceStrength, EvidenceStrengthBasis (+6 more)

### Community 58 - "version-sync.test.mjs"
Cohesion: 0.25
Nodes (13): countOccurrences(), currentSchemaVersion(), markdownSection(), releaseAssetPaths(), schemaVersionTextChecks(), validateVersionSync(), versionTextChecks(), workspacePackages (+5 more)

### Community 59 - "browser-components.test.tsx"
Cohesion: 0.16
Nodes (6): CopyLine(), CopyState, DeletionReceiptGuidance(), RoleIdentityReviewNotice(), answerAt(), serveRevisions()

### Community 60 - "Nimanto v0.3.0 — Evidence Thread"
Cohesion: 0.14
Nodes (13): 1. Private role narrowing, 2. Recorded application timelines, 3. Sponsorship provenance and freshness, 4. Match anatomy, 5. Tamper-evident local activity, 6. Packet review, Correctness, Nimanto v0.3.0 — Evidence Thread (+5 more)

### Community 61 - "package.json"
Cohesion: 0.14
Nodes (13): author, bugs, url, description, homepage, license, name, packageManager (+5 more)

### Community 62 - "verify-sbom-freshness.mjs"
Cohesion: 0.34
Nodes (12): compareDocuments(), comparePurlSets(), cyclonedxPurls(), registryPropertyName(), sortedPurls(), spdxPurls(), stableCycloneDx(), stableOccurrenceMetadata() (+4 more)

### Community 63 - "discovery-cycle.ts"
Cohesion: 0.17
Nodes (11): EnabledProvider, EnabledProviderRequest, ProviderJobLike, adapterRole(), payloads, publicationFixture(), stores, CurrentRole (+3 more)

### Community 64 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, exclude, extends (+4 more)

### Community 65 - "createSubmissionDraft"
Cohesion: 0.30
Nodes (9): ApplicationSubmissionRecorder(), createSubmissionDraft(), localInputValue(), Packet, SubmissionDraft, ControlledRecorder(), initial(), packet() (+1 more)

### Community 66 - "worker.ts"
Cohesion: 0.32
Nodes (7): bootstrapSecret(), cycle(), loopbackApiOrigin(), nextDelay(), runCycle(), WorkerCycleResult, servers

### Community 67 - "database/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 68 - "database/tsconfig.build.json"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, noEmit, outDir, rootDir, exclude, extends, include (+3 more)

### Community 69 - "applications.ts"
Cohesion: 0.21
Nodes (9): APPLICATION_STATUSES, applicationTransitions, CandidateApplicationDecision, CandidateApplicationOption, consequentialTargets, isStatus(), legalCandidateTargets, PacketApplicationDecision (+1 more)

### Community 70 - "domain/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 71 - "providers.test.ts"
Cohesion: 0.29
Nodes (7): draftLocalSummary(), LocalModelDescriptor, localModelInventory(), localModelStatus, reviewLocalPacket(), servers, temporaryRoots

### Community 72 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 73 - "h1b-evidence.tsx"
Cohesion: 0.25
Nodes (10): dateTime(), GOVERNMENT_SOURCE_TYPES, H1bEvidencePanel(), human(), REVIEWABLE_CODES, RoleH1bSignal, RoleMatchSnapshot, RoleWordingBlocker (+2 more)

### Community 74 - "role-provenance.tsx"
Cohesion: 0.29
Nodes (9): dateOrUnknown(), human(), localDateTime(), reviewedDate(), RoleAvailability, RoleProvenanceCard(), RoleProvenanceData, RoleSourcePolicy (+1 more)

### Community 75 - "Nimanto redesign — Colour & Material 002"
Cohesion: 0.18
Nodes (11): 0. Survey — what comparable open-source tools already ship, 10. Release ⚑, 1. Why, 3. Decisions, 5. Website, 7. Deferred — and what will _not_ change ⚑, 8. Files ⚑, 9. Verification ⚑ (+3 more)

### Community 76 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 77 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 78 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 79 - "ats-verification.ts"
Cohesion: 0.27
Nodes (7): AtsVerification, EnabledAtsProvider, enabledProvider(), providerErrorCode(), routeFor(), VerificationRequest, ProviderJobVerificationResult

### Community 80 - "submissions.ts"
Cohesion: 0.31
Nodes (8): ApplicationSubmissionRecord, clean(), normalizeCandidateSubmission(), PACKET_ARTIFACT_FORMATS, PacketArtifactFormat, SUBMISSION_CHANNELS, SubmissionChannel, now

### Community 81 - "schedules.ts"
Cohesion: 0.31
Nodes (7): SourceScheduleRecord, scheduledFailureEvent(), ScheduledJobEvent, ScheduledJobState, scheduledRetryDelayMinutes(), transitions, transitionScheduledJob()

### Community 82 - "domain/src/index.ts"
Cohesion: 0.24
Nodes (6): AssuranceFinding, AssuranceFindingCode, assurePacket(), PacketAssuranceResult, ExternalActionEvent, transitions

### Community 83 - "api/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 84 - "answer-history-currentness.test.tsx"
Cohesion: 0.25
Nodes (4): AnswerHistoryDetails(), at(), Pending, render()

### Community 85 - "match-evidence-lens.ts"
Cohesion: 0.36
Nodes (6): label(), MatchEvidenceLens(), MatchEvidenceLensProjection, MatchEvidenceResult, MatchEvidenceStrengthBasis, projectMatchEvidenceLens()

### Community 86 - "identity-transitions.ts"
Cohesion: 0.28
Nodes (7): DeletionReceipt, IdentityTransitionEvent, IdentityTransitionPlan, LocationDisposition, LocationInput, scrubCredential(), workspaceIdentityTransitions

### Community 87 - "copy-vocabulary.test.ts"
Cohesion: 0.31
Nodes (7): copyLiterals(), DISCLAIMER_MARKERS, domainCopyFile, here, sentences(), stripComments(), stripIdentifierLiterals()

### Community 88 - "worker/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 89 - "worker/tsconfig.build.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, outDir, rootDir, extends, include, src, ./tsconfig.json

### Community 90 - "2. The palette"
Cohesion: 0.22
Nodes (9): 2. The palette, Ground, Materials, ⚑ Non-text contrast (WCAG 1.4.11 — borders, chips, focus rings need ≥3:1), Proportion — the governing rule, Ramps, ⚑ Type on ink — computed, ⚑ Type scale (revision 1 shipped a font list with no system) (+1 more)

### Community 91 - "acquireDataDirectoryLock"
Cohesion: 0.36
Nodes (7): acquireDataDirectoryLock(), bootEpoch(), legacyOwnerIsDead(), privateFile(), sameFile(), migrateDatabase(), tightenPosixPermissions()

### Community 92 - "ExternalActionProvider"
Cohesion: 0.36
Nodes (8): ExternalActionRecord, ExternalActionProvider, ExternalActionState, ActionPayload, ActionResult, buildDeepLink(), executeProviderAction(), validateActionPayload()

### Community 93 - "documents/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 94 - "parsers/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 95 - "providers/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 96 - ".runWorkerCycle"
Cohesion: 0.43
Nodes (3): DiscoveryCycle, normalizeFetchResult(), normalizeProviderRole()

### Community 97 - "packet-lifecycle.ts"
Cohesion: 0.25
Nodes (6): ArtifactManifest, PacketArtifactInspector, roots, PacketRecord, CanonicalPacket, DocumentInspection

### Community 98 - "layout.tsx"
Cohesion: 0.32
Nodes (5): metadata, viewport, isLoopbackHost(), ServiceWorker(), serviceWorkerScriptUrl()

### Community 99 - "Nimanto user-flow analysis"
Cohesion: 0.25
Nodes (5): 1. The intended flow, 3. Cross-cutting failure modes, 4. Constraints the fixes must respect, 5. Flow after the change, Nimanto user-flow analysis

### Community 100 - "Nimanto v0.2.0 — Colour & Material"
Cohesion: 0.25
Nodes (8): Colour & Material 002, Correctness, Nimanto v0.2.0 — Colour & Material, The mark, The website, The workbench, Unchanged, Verification

### Community 101 - "Nimanto v0.5.2 — Ask Clearly, Return Exactly"
Cohesion: 0.25
Nodes (7): Improved, Maintenance, Nimanto v0.5.2 — Ask Clearly, Return Exactly, Provenance, Still out of scope, Upgrade, Verification

### Community 102 - "Nimanto v0.8.0 — Find It, Compare It, Keep It"
Cohesion: 0.25
Nodes (7): Added, Boundaries, Nimanto v0.8.0 — Find It, Compare It, Keep It, Preserved, Strengthened, Upgrade, Verify

### Community 103 - "2. Where the candidate actually stalls"
Cohesion: 0.25
Nodes (8): 2. Where the candidate actually stalls, S1 — "I imported. Now what?" (entry cliff), S2 — Blocked match is a terminal screen, S3 — Applications are a flat list with a `<select>`, S4 — The funnel is buried and under-read, S5 — Silence is indistinguishable from nothing-happened, S6 — No way to get anywhere fast, S7 — The app lies when the API is down

### Community 104 - "store-lock.test.ts"
Cohesion: 0.32
Nodes (6): children, contender(), message(), openChild(), roots, stores

### Community 106 - "external-action-lifecycle.test.ts"
Cohesion: 0.33
Nodes (4): approvedActionFixture(), mkdtempTracked(), stores, temporaryRoots

### Community 108 - "First release"
Cohesion: 0.29
Nodes (6): Deliberate beta limits, First release, Included, Locally verified from the release tree, Nimanto v0.1.0 — local beta, Release gates

### Community 109 - "Nimanto v0.5.3 — Proof Means Enforced"
Cohesion: 0.29
Nodes (6): Boundaries, Fixed, Included from v0.5.2, Nimanto v0.5.3 — Proof Means Enforced, Upgrade, Verify

### Community 110 - "Nimanto v0.5.4 — Work Stays Yours"
Cohesion: 0.29
Nodes (6): Boundaries, Fixed, Improved, Nimanto v0.5.4 — Work Stays Yours, Upgrade, Verify

### Community 111 - "Nimanto v0.6.0 — Follow Up on Your Terms"
Cohesion: 0.29
Nodes (6): Added, Boundaries, Nimanto v0.6.0 — Follow Up on Your Terms, Refined, Upgrade, Verify

### Community 112 - "Nimanto v0.7.0 — One Place for Each Promise"
Cohesion: 0.29
Nodes (6): Boundaries, Deepened, Nimanto v0.7.0 — One Place for Each Promise, Preserved, Upgrade, Verify

### Community 113 - "url-network.test.ts"
Cohesion: 0.29
Nodes (4): FakeRequest, FakeResponse, input, transport

### Community 114 - "render-screenshots.mjs"
Cohesion: 0.29
Nodes (5): assets, publicAssets, root, siteOnly, workbenchOnly

### Community 115 - "validate-sbom.mjs"
Cohesion: 0.29
Nodes (4): args, releaseManifest, releaseWorkspaces, requiredPackages

### Community 116 - "tokens.test.ts"
Cohesion: 0.47
Nodes (5): channel(), css, luminance(), ratio(), token()

### Community 117 - "Durable discovery schedules"
Cohesion: 0.33
Nodes (5): Acceptance, Durable discovery schedules, Outcome, Public seams, State and safety contract

### Community 118 - "Nimanto v0.5.5 — Same Boundaries, Fresh Runtime"
Cohesion: 0.33
Nodes (5): Boundaries, Improved, Nimanto v0.5.5 — Same Boundaries, Fresh Runtime, Upgrade, Verify

### Community 119 - "keywords"
Cohesion: 0.33
Nodes (6): keywords, career-tools, evidence, h1b, job-search, local-first

### Community 120 - "render-social-card.mjs"
Cohesion: 0.33
Nodes (4): assets, faces, modules, root

### Community 121 - "external-action-runtime.ts"
Cohesion: 0.50
Nodes (3): deriveExternalActionRuntimeView(), ExternalActionRuntime, ExternalActionRuntimeView

### Community 122 - "sanitize-sbom.mjs"
Cohesion: 0.50
Nodes (3): hasMachineLocalPath(), paths, sanitize()

### Community 123 - "Candidate-owned career ledger"
Cohesion: 0.50
Nodes (4): Candidate-owned career ledger, Interview-round scheduling and preparation, Typed work and next-action planning, Nimanto applications workbench screenshot

### Community 124 - "Nimanto social card with gold botanical emblem"
Cohesion: 0.50
Nodes (4): Private candidate-controlled role discovery and application workbench for H-1B professionals, Evidence first, applications second, Local-first, explainable, no silent send, Nimanto social card with gold botanical emblem

### Community 125 - "Nimanto social card"
Cohesion: 0.50
Nodes (4): Private candidate-controlled role discovery and application workbench for H-1B professionals, Evidence before applications, Local-first, explainable operation with no silent send, Nimanto social card

### Community 126 - "Nimanto landing screenshot with dark background, gold accents, and botanical emblem"
Cohesion: 0.50
Nodes (4): Depicted candidate control: approve searches, inspect explanations, control handoffs, no silent send, Depicted local-first workbench for H-1B professionals, Nimanto landing screenshot with dark background, gold accents, and botanical emblem, Displayed unreleased local build v0.10.1-dev.0

### Community 127 - "Career ledger: depicted candidate-owned workspace record with Now, People, Answers, Reviews, Insights and Offers tabs"
Cohesion: 0.50
Nodes (4): Career ledger: depicted candidate-owned workspace record with Now, People, Answers, Reviews, Insights and Offers tabs, Interview rounds: depicted application-linked preparation with round, scheduled time and format, Nimanto workbench screenshot; depicted state only, not current acceptance, Typed work: depicted application-linked next action with activity type and due time

### Community 128 - "4. The mark"
Cohesion: 0.50
Nodes (4): 4.1 Concept and provenance, 4.2 Surfaces, 4.3 Hero specification ⚑, 4. The mark

### Community 129 - "6. Workbench"
Cohesion: 0.50
Nodes (4): 6.1 Restyle — ⚑ layout, not only colour, 6.2 Features, 6.3 Robustness, 6. Workbench

### Community 130 - "ContactKind"
Cohesion: 0.50
Nodes (3): ContactRecord, CONTACT_KINDS, ContactKind

### Community 133 - "Local beta CI"
Cohesion: 0.67
Nodes (3): Local beta CI, Container canary and runtime verification, CI-gated static website deployment

### Community 134 - "Full candidate CodeQL scan: diff-informed queries and overlay analysis disabled"
Cohesion: 0.67
Nodes (3): Full candidate CodeQL scan: diff-informed queries and overlay analysis disabled, CodeQL permissions: contents read and security-events write, CodeQL triggers: main pushes, pull requests, Monday 08:23 UTC schedule

### Community 136 - "dependencies"
Cohesion: 0.67
Nodes (3): concurrently, dependencies, concurrently

### Community 144 - "engines"
Cohesion: 0.67
Nodes (3): engines, node, pnpm

### Community 145 - "pnpm workspace dependency and build policy"
Cohesion: 0.67
Nodes (3): fast-uri 3.1.9 and 4.2.3 scoped version overrides, Reviewed-parent glob and minimatch security overrides, pnpm workspace dependency and build policy

## Knowledge Gaps
- **848 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+843 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NimantoStore` connect `NimantoStore` to `government-dataset.ts`, `database/src/index.ts`, `ContactKind`, `answer-history.test.ts`, `store.ts`, `canonicalHash`, `iso`, `buildServer`, `.transaction`, `career-operations.ts`, `packet-lifecycle.test.ts`, `server.ts`, `EvidenceClaim`, `career-ledger.ts`, `discovery-cycle.ts`, `ats-verification.ts`, `schedules.ts`, `acquireDataDirectoryLock`, `.runWorkerCycle`, `packet-lifecycle.ts`, `store-lock.test.ts`, `.approveExternalActionExact`, `external-action-lifecycle.test.ts`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `buildServer()` connect `buildServer` to `government-dataset.ts`, `.runWorkerCycle`, `database/src/index.ts`, `ContactKind`, `server.ts`, `NimantoStore`, `jobs.ts`, `providers.test.ts`, `.approveExternalActionExact`, `canonicalHash`, `EvidenceClaim`, `ats-verification.ts`, `iso`, `.transaction`, `career-operations.ts`, `marketplace.ts`, `packet-lifecycle.test.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `ApplicationStatus` connect `career-operations.ts` to `packet-lifecycle.ts`, `workspace.tsx`, `derive.ts`, `server.ts`, `applications.ts`, `store.ts`, `canonicalHash`, `career-ledger.tsx`, `career-ledger.ts`, `.transaction`, `types.ts`, `calendar-export.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Workspace()` (e.g. with `emptyEvidenceFilters()` and `applicationsWorkbenchReducer()`) actually correct?**
  _`Workspace()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _848 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `government-dataset.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05297334244702666 - nodes in this community are weakly interconnected._
- **Should `workspace.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0366120218579235 - nodes in this community are weakly interconnected._