# Graph Report - .  (2026-09-05)

## Corpus Check
- Large corpus: 292 files · ~7,990,629 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1930 nodes · 3754 edges · 115 communities (98 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113

## God Nodes (most connected - your core abstractions)
1. `NimantoStore` - 181 edges
2. `buildServer()` - 109 edges
3. `canonicalHash()` - 54 edges
4. `iso()` - 32 edges
5. `Workspace()` - 24 edges
6. `Applications()` - 24 edges
7. `scripts` - 24 edges
8. `NimantoEmblem` - 23 edges
9. `api()` - 22 edges
10. `ApplicationStatus` - 18 edges

## Surprising Connections (you probably didn't know these)
- `evidenceMatches()` --indirect_call--> `token()`  [INFERRED]
  packages/domain/src/matching.ts → apps/web/test/tokens.test.ts
- `Candidate-approved Discovery Profile` --semantically_similar_to--> `Discovery Profile replay`  [INFERRED] [semantically similar]
  README.md → docs/architecture/system.md
- `Source-qualified posting freshness` --semantically_similar_to--> `Source completeness policy`  [INFERRED] [semantically similar]
  README.md → docs/architecture/system.md
- `H-1B evidence separation` --semantically_similar_to--> `Warning-only sponsorship boundary`  [INFERRED] [semantically similar]
  README.md → docs/planning/job-marketplace-expansion-plan-2026-08-26.md
- `Grounded packet lifecycle` --semantically_similar_to--> `Staged packet lifecycle`  [INFERRED] [semantically similar]
  README.md → docs/architecture/system.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Candidate-controlled trust pipeline** — docs_architecture_system_candidate_approved_evidence_intake, docs_architecture_system_exact_snapshot_match_publication, docs_architecture_system_staged_packet_lifecycle, docs_architecture_system_exact_approved_action_lifecycle [EXTRACTED 1.00]
- **Marketplace foundation** — docs_planning_job_marketplace_expansion_plan_2026_08_26_source_registry, docs_planning_job_marketplace_expansion_plan_2026_08_26_provider_protocol, docs_planning_job_marketplace_expansion_plan_2026_08_26_role_availability, docs_planning_job_marketplace_expansion_plan_2026_08_26_work_mode_normalization, docs_planning_job_marketplace_expansion_plan_2026_08_26_discovery_profile, docs_planning_job_marketplace_expansion_plan_2026_08_26_rolecluster [EXTRACTED 1.00]
- **Nimanto runtime topology** — docs_architecture_system_static_next_js_workbench, docs_architecture_system_fastify_api, docs_architecture_system_pglite_postgresql, docs_architecture_system_durable_refresh_worker, docs_architecture_system_deny_by_default_source_registry, docs_architecture_system_exact_approved_action_lifecycle [EXTRACTED 1.00]
- **Confirmed Evidence to Match Flow** — docs_planning_architecture_confirmed_evidence_lifecycle, docs_planning_product_contract_career_evidence_vault, docs_planning_product_contract_evidence_states, docs_planning_product_contract_overall_match_bands, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Tenant Isolation Defense in Depth** — docs_planning_architecture_postgresql_rls_defense, docs_planning_architecture_single_candidate_tenancy, docs_planning_trust_and_security_tenant_authorization, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Review Before External Action** — docs_planning_architecture_no_external_effects_through_slice_3, docs_planning_product_contract_source_action_contract, docs_planning_product_contract_frozen_artifact_approval, docs_planning_backend_plan_slice_3_grounded_packet [INFERRED 0.95]

## Communities (115 total, 17 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (70): DiscoveryCycle, EnabledProvider, EnabledProviderRequest, normalizeFetchResult(), normalizeProviderRole(), ProviderJobLike, JobRecord, JobUpsertInput (+62 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (51): GovernmentDatasetTrust, TrustedEmployerResolutionEvaluation, exactText(), GovernmentDatasetAdmission, GovernmentDatasetIngestion, GovernmentDatasetRow, LABELS, record() (+43 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (46): Connection, ConnectionBanner(), ConnectionIndicator(), useConnection(), Action, ActionDraft, Application, ApplicationNote (+38 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (56): Applications(), downloadTextFile(), emptyEvidenceFilters(), EvidenceVault(), fileBase64(), localDayInstant(), projectApplicationView(), ActionLike (+48 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (46): dependencies, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui (+38 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (37): PacketArtifactInspector, PacketArtifactRenderer, verifiedArtifactBytes(), verifyPacketArtifacts(), mkdtempTracked(), packetFixture(), stores, temporaryRoots (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (46): dependencies, @fontsource/ibm-plex-mono, @fontsource/instrument-serif, @fontsource-variable/archivo, lucide-react, next, @nimanto/domain, react (+38 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (41): amountToMinor(), AnswerRevision, AnswerRevisionHistory(), AnswersPanel(), Application, applicationLabel(), CareerLedger(), CareerOperationsSnapshot (+33 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (42): Candidate-approved evidence intake, Candidate Role disposition, Deep link and local test outbox, Deny-by-default source registry, Discovery Profile replay, Durable DiscoveryCycle, Durable refresh worker, Exact-approved action lifecycle (+34 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (13): annulusJaali(), barShape(), bracketShape(), diamond(), getTHREE(), glowTexture(), NimantoEmblem, notchPoly() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (36): AnswerBlockRecord, AnswerRevisionPage, AnswerRevisionRecord, ApplicationNoteRecord, AssuranceHistoryRecord, AssuranceRecord, CareerOperationsSnapshot, ClaimedSourceSchedule (+28 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (32): areaValue(), assessDiscoveryProfile(), compareCanonicalAreas(), confirmedArea(), countryLevelArea(), DiscoveryMatchPublication, DiscoveryProfileAssessment, DiscoveryProfileLike (+24 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (27): EvidenceIntake, parseUpload(), previewHash(), requestObject(), requiredString(), reviewedProjection(), Upload, fixture() (+19 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (4): PacketLifecycle, ApplicationRecord, CandidateSubmissionInput, ApplicationStatus

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (8): buildServer(), historyLimit(), recordText(), sha256(), ANSWER_TOPICS, CONTACT_KINDS, INTERVIEW_ROUND_KINDS, INTERVIEW_ROUND_STATES

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (27): MatchRunRecord, RoleWordingReviewRecord, bandFromValue(), blockerText(), evidenceMatches(), evidenceStrength(), IDENTITY_PATTERNS, locationBlockers() (+19 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (28): ActionRunner, Actions(), ActivityLedger(), ApplicationDossier(), ApplicationFilterDisclosure(), ApplicationNoteEditor(), atsRouteGateLabel(), cadenceLabel() (+20 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (27): docx, dependencies, docx, fflate, @nimanto/domain, pdf-lib, pdfjs-dist, devDependencies (+19 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (27): dependencies, fflate, @nimanto/domain, pdfjs-dist, saxes, devDependencies, pdf-lib, @types/node (+19 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (9): clamp(), EmblemOptions, glowTexture(), inOutQuint(), lerp(), NimantoEmblem, outQuint(), petalShape() (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (17): buildApplicationCsv(), CsvApplication, csvCell(), CsvJob, HEADERS, spreadsheetSafe(), buildFollowUpCalendar(), calendarDate() (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (24): scripts, build, check, clean, dev, dev:all, dev:core, format (+16 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (22): dependencies, @electric-sql/pglite, @nimanto/domain, devDependencies, @types/node, typescript, vitest, exports (+14 more)

### Community 25 - "Community 25"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2024, compilerOptions, allowJs, allowSyntheticDefaultImports, exactOptionalPropertyTypes, forceConsistentCasingInFileNames (+14 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (17): apiPort, repository, sitePort, update, assertScreenshotBytesMatch(), assertScreenshotVisuallyMatches(), buildScreenshotEvidence(), collectFiles() (+9 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (11): DashboardRead, ExternalActionCapability, ProviderActionExecutor, FastifyRequest, stores, rawDatabases, stores, temporaryRoots (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.16
Nodes (12): publishMatch(), uniqueEvidenceIds(), fixture(), mkdtempTracked(), stores, temporaryRoots, annotateClusters(), clusterKey() (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (19): ArtifactManifest, discoveryProfileInput(), fastify, H1B_LABELS, historyOptions(), identity(), JsonObject, manualOperationId() (+11 more)

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (17): Application, Evidence, Job, Match, PacketComposer(), Profile, ComposerApplication, ComposerEvidence (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.10
Nodes (19): devDependencies, tsx, @types/node, typescript, vitest, tsx, @types/node, typescript (+11 more)

### Community 32 - "Community 32"
Cohesion: 0.10
Nodes (19): dependencies, @nimanto/domain, devDependencies, @types/node, typescript, vitest, exports, @nimanto/domain (+11 more)

### Community 34 - "Community 34"
Cohesion: 0.16
Nodes (16): emptyManualRoleDraft(), emptyReviewedUrlDraft(), manualRoleDraftForReview(), sameActionDraft(), sameManualRoleDraft(), sameReviewedUrlDraft(), withApplicationActivities(), Workspace() (+8 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (17): ApplicationNoteDraft, ApplicationsWorkbench, ApplicationsWorkbenchAction, applicationsWorkbenchReducer(), ApplicationsWorkbenchState, closeDraft(), createApplicationsWorkbenchState(), dateInputValue() (+9 more)

### Community 36 - "Community 36"
Cohesion: 0.17
Nodes (13): ProviderJobVerifier, AllowlistedJobPageFetcher, booleanEnvironment(), loadOptions(), localBootstrapSecret(), LocalModelAdapter, NimantoApiOptions, portEnvironment() (+5 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (16): backfillIntegrityHashes(), migrations, freshSchemaSql, schemaVersion10Sql, schemaVersion11Sql, schemaVersion12Sql, schemaVersion13Sql, schemaVersion14Sql (+8 more)

### Community 38 - "Community 38"
Cohesion: 0.11
Nodes (17): devDependencies, @types/node, typescript, vitest, exports, @types/node, typescript, vitest (+9 more)

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (17): ATS_PROVIDERS, AtsRoutingDecision, AtsRoutingInput, AtsRoutingProvider, CANDIDATE_OWNED_SOURCES, canonicalTarget(), decision(), gated() (+9 more)

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (17): cspell, @cyclonedx/cdxgen, devDependencies, cspell, @cyclonedx/cdxgen, @playwright/test, prettier, sharp (+9 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (15): ContactRecord, InterviewRoundRecord, OfferRecord, ACTIVITY_STATES, ApplicationStatusEvent, ContactKind, describeApplicationDurations(), DescriptiveApplication (+7 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (11): BOUNDARY, METHOD, Brand(), HUB, Mark(), PETALS, CommandPalette(), PaletteEntry (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.13
Nodes (4): RFC-6761, apiPort, playwrightDataDir, webPort

### Community 44 - "Community 44"
Cohesion: 0.14
Nodes (16): Observability Allowlist, H-1B Evidence Taxonomy, Source and Action Capability Contract, Defer USAJOBS Ingestion, Dependency License and Security Ledger, Government Dataset Provenance, Greenhouse Job Board API, Slice-1 Greenhouse Source Policy (+8 more)

### Community 45 - "Community 45"
Cohesion: 0.19
Nodes (3): DeletionCoordinator, warnCleanupPending(), run()

### Community 46 - "Community 46"
Cohesion: 0.15
Nodes (7): AnswerHistoryDetails(), CopyLine(), CopyState, DeletionReceiptGuidance(), RoleIdentityReviewNotice(), answerAt(), serveRevisions()

### Community 47 - "Community 47"
Cohesion: 0.13
Nodes (14): compilerOptions, incremental, jsx, plugins, exclude, extends, include, ../../tsconfig.base.json (+6 more)

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (13): countOccurrences(), currentSchemaVersion(), markdownSection(), releaseAssetPaths(), schemaVersionTextChecks(), validateVersionSync(), versionTextChecks(), workspacePackages (+5 more)

### Community 49 - "Community 49"
Cohesion: 0.20
Nodes (14): Clean-Start Verification, Exact Implementation Approval Gate, Versioned Held-Out Evaluation, Nimanto Initial Backend Plan, Public Repository Gate, Slice 1 Evidence to Match, Slice 2 Transfer Intelligence, Slice 3 Grounded Packet (+6 more)

### Community 50 - "Community 50"
Cohesion: 0.14
Nodes (13): author, bugs, url, description, homepage, license, name, packageManager (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.34
Nodes (12): compareDocuments(), comparePurlSets(), cyclonedxPurls(), registryPropertyName(), sortedPurls(), spdxPurls(), stableCycloneDx(), stableOccurrenceMetadata() (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.22
Nodes (13): Durable Idempotent Jobs, Inward Dependency Direction, TypeScript Modular Monolith Decision, Next.js Backend for Frontend Guide, Nimanto Architecture, PostgreSQL RLS and Application Authorization, PostgreSQL Row Security Documentation, Private Object Capability (+5 more)

### Community 53 - "Community 53"
Cohesion: 0.17
Nodes (13): Identity-Invariant Scoring, Accessibility and Trust Controls, Identity-Invariant Fairness Safeguards, Isolated Upload and Parsing Pipeline, Legal and Expert Review Flags, Nimanto Trust Privacy and Security Plan, Operator Access Reality, OWASP File Upload Cheat Sheet (+5 more)

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, exclude, extends (+4 more)

### Community 55 - "Community 55"
Cohesion: 0.20
Nodes (9): ExternalActionRecord, AssuranceFinding, AssuranceFindingCode, assurePacket(), PacketAssuranceResult, ExternalActionEvent, transitionExternalAction(), transitions (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 57 - "Community 57"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, noEmit, outDir, rootDir, exclude, extends, include (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 59 - "Community 59"
Cohesion: 0.35
Nodes (4): seedDemo(), EvidenceRow, mapEvidence(), EvidenceClaim

### Community 60 - "Community 60"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (9): dateOrUnknown(), human(), localDateTime(), reviewedDate(), RoleAvailability, RoleProvenanceCard(), RoleProvenanceData, RoleSourcePolicy (+1 more)

### Community 62 - "Community 62"
Cohesion: 0.22
Nodes (11): Confirmed Evidence Lifecycle, No External Effects Through Slice 3, Candidate-Controlled Job Search Operating System, Career Evidence Vault, DOL H-1B Program Guidance, Evidence States, Frozen Artifact Approval, Hard-Constraint Policy (+3 more)

### Community 63 - "Community 63"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 64 - "Community 64"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 65 - "Community 65"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.27
Nodes (7): AtsVerification, EnabledAtsProvider, enabledProvider(), providerErrorCode(), routeFor(), VerificationRequest, ProviderJobVerificationResult

### Community 67 - "Community 67"
Cohesion: 0.22
Nodes (6): DeletionRun, RemovePath, approvedActionFixture(), mkdtempTracked(), stores, temporaryRoots

### Community 68 - "Community 68"
Cohesion: 0.24
Nodes (7): createWorkbenchMutations(), MutationAdapters, RefreshOutcome, WorkbenchMutation, WorkbenchMutationOutcome, WorkbenchMutations, harness()

### Community 69 - "Community 69"
Cohesion: 0.31
Nodes (8): ApplicationSubmissionRecord, clean(), normalizeCandidateSubmission(), PACKET_ARTIFACT_FORMATS, PacketArtifactFormat, SUBMISSION_CHANNELS, SubmissionChannel, now

### Community 70 - "Community 70"
Cohesion: 0.33
Nodes (6): Address, expandIPv6(), fetchAllowlistedJobPage(), isPrivateAddress(), Response, textFromPage()

### Community 71 - "Community 71"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 72 - "Community 72"
Cohesion: 0.36
Nodes (6): label(), MatchEvidenceLens(), MatchEvidenceLensProjection, MatchEvidenceResult, MatchEvidenceStrengthBasis, projectMatchEvidenceLens()

### Community 73 - "Community 73"
Cohesion: 0.25
Nodes (7): ActionLike, ApplicationOwned, ContactLike, DossierApplication, DossierSubmission, PacketLike, projectApplicationDossier()

### Community 74 - "Community 74"
Cohesion: 0.28
Nodes (7): DeletionReceipt, IdentityTransitionEvent, IdentityTransitionPlan, LocationDisposition, LocationInput, scrubCredential(), workspaceIdentityTransitions

### Community 75 - "Community 75"
Cohesion: 0.31
Nodes (7): copyLiterals(), DISCLAIMER_MARKERS, domainCopyFile, here, sentences(), stripComments(), stripIdentifierLiterals()

### Community 76 - "Community 76"
Cohesion: 0.47
Nodes (6): bootstrapSecret(), cycle(), loopbackApiOrigin(), nextDelay(), runCycle(), WorkerCycleResult

### Community 77 - "Community 77"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 78 - "Community 78"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, outDir, rootDir, extends, include, src, ./tsconfig.json

### Community 79 - "Community 79"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 80 - "Community 80"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 81 - "Community 81"
Cohesion: 0.33
Nodes (6): draftLocalSummary(), LocalModelDescriptor, localModelInventory(), localModelStatus, reviewLocalPacket(), temporaryRoots

### Community 82 - "Community 82"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 83 - "Community 83"
Cohesion: 0.32
Nodes (5): metadata, viewport, isLoopbackHost(), ServiceWorker(), serviceWorkerScriptUrl()

### Community 84 - "Community 84"
Cohesion: 0.36
Nodes (7): ApplicationSubmissionRecorder(), createSubmissionDraft(), localInputValue(), Packet, RebindProfileVersionButton(), SubmissionDraft, ControlledRecorder()

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (6): packetCanonicalDelta(), PacketHistoryPanel(), packetManifestDelta(), createScopedRequestGate(), ScopedRequestGate, ScopedRequestToken

### Community 87 - "Community 87"
Cohesion: 0.29
Nodes (5): migrateDatabase(), acquireDataDirectoryLock(), currentBootEpoch(), processIsAlive(), tightenPosixPermissions()

### Community 88 - "Community 88"
Cohesion: 0.52
Nodes (6): ExternalActionProvider, ActionPayload, ActionResult, buildDeepLink(), executeProviderAction(), validateActionPayload()

### Community 89 - "Community 89"
Cohesion: 0.29
Nodes (5): assets, publicAssets, root, siteOnly, workbenchOnly

### Community 90 - "Community 90"
Cohesion: 0.47
Nodes (5): channel(), css, luminance(), ratio(), token()

### Community 91 - "Community 91"
Cohesion: 0.33
Nodes (6): keywords, career-tools, evidence, h1b, job-search, local-first

### Community 92 - "Community 92"
Cohesion: 0.33
Nodes (5): ApplicationActivityRecord, recordInstant(), ACTIVITY_KINDS, ActivityKind, ActivityState

### Community 94 - "Community 94"
Cohesion: 0.33
Nodes (4): assets, faces, modules, root

### Community 95 - "Community 95"
Cohesion: 0.33
Nodes (4): args, releaseManifest, releaseWorkspaces, requiredPackages

### Community 96 - "Community 96"
Cohesion: 0.50
Nodes (3): deriveExternalActionRuntimeView(), ExternalActionRuntime, ExternalActionRuntimeView

### Community 97 - "Community 97"
Cohesion: 0.50
Nodes (3): hasMachineLocalPath(), paths, sanitize()

### Community 100 - "Community 100"
Cohesion: 0.67
Nodes (3): concurrently, dependencies, concurrently

### Community 101 - "Community 101"
Cohesion: 0.67
Nodes (3): Hosted trust layer, Local beta boundary, Monorepo architecture

### Community 102 - "Community 102"
Cohesion: 0.67
Nodes (3): engines, node, pnpm

## Knowledge Gaps
- **630 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+625 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NimantoStore` connect `Community 4` to `Community 0`, `Community 33`, `Community 66`, `Community 67`, `Community 1`, `Community 6`, `Community 59`, `Community 11`, `Community 45`, `Community 13`, `Community 14`, `Community 15`, `Community 92`, `Community 20`, `Community 87`, `Community 27`, `Community 28`, `Community 29`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `ApplicationStatus` connect `Community 14` to `Community 2`, `Community 3`, `Community 6`, `Community 8`, `Community 41`, `Community 11`, `Community 16`, `Community 22`, `Community 29`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `buildServer()` connect `Community 15` to `Community 0`, `Community 1`, `Community 4`, `Community 6`, `Community 13`, `Community 14`, `Community 20`, `Community 27`, `Community 28`, `Community 29`, `Community 33`, `Community 36`, `Community 41`, `Community 45`, `Community 59`, `Community 66`, `Community 81`, `Community 87`, `Community 92`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Workspace()` (e.g. with `emptyEvidenceFilters()` and `applicationsWorkbenchReducer()`) actually correct?**
  _`Workspace()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _630 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05311542390194075 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0679563492063492 - nodes in this community are weakly interconnected._