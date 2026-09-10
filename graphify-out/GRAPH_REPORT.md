# Graph Report - Nimanto  (2026-09-10)

Scoped incremental update: code extraction plus the new recovery plan; private working notes excluded.

## Corpus Check
- 306 manifest entries; full-corpus word count not recomputed for this scoped update.
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2325 nodes · 4240 edges · 184 communities (146 shown, 38 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- api/package.json
- dependencies
- @nimanto/domain
- database/package.json
- ats-verification.ts
- government-dataset.ts
- dashboard-read.ts
- domain/src/index.ts
- DeletionCoordinator
- discovery-cycle.ts
- parsers/src/index.ts
- buildServer
- canonicalHash
- packet-lifecycle.ts
- server.ts
- .approve
- .transaction
- NimantoStore
- EvidenceClaim
- ./tsconfig.json
- compilerOptions
- ../../tsconfig.base.json
- layout.tsx
- NimantoEmblem
- ErrorBoundary
- createSubmissionDraft
- career-ledger.tsx
- workspace.tsx
- browser-components.test.tsx
- h1b-evidence.tsx
- match-evidence-lens.ts
- packet-composer.ts
- role-provenance.tsx
- api
- Workspace
- derive.ts
- export-session.test.tsx
- application-csv-export.ts
- application-dossier.ts
- applications-workbench.ts
- calendar-export.ts
- external-action-runtime.ts
- identity-transitions.ts
- role-discovery.ts
- next-env.d.ts
- next.config.ts
- dependencies
- devDependencies
- sw.js
- copy-vocabulary.test.ts
- matching.ts
- web/tsconfig.json
- include
- worker/package.json
- worker.ts
- worker/tsconfig.build.json
- worker/tsconfig.json
- NimantoEmblem
- package.json
- repository
- keywords
- engines
- scripts
- dependencies
- devDependencies
- @types/node
- acquireDataDirectoryLock
- migrations.ts
- store.ts
- RoleFamily
- marketplace.ts
- submissions.ts
- career-operations.ts
- external-actions.ts
- schedules.ts
- answer-history.test.ts
- store-lock.test.ts
- roles.ts
- database/tsconfig.build.json
- database/tsconfig.json
- documents/package.json
- parsers/package.json
- documents/src/index.ts
- compilerOptions
- documents/tsconfig.json
- domain/package.json
- applications.ts
- jobs.ts
- compilerOptions
- domain/tsconfig.json
- compilerOptions
- parsers/tsconfig.json
- providers/package.json
- ats-routing.ts
- providers/src/index.ts
- providers.test.ts
- compilerOptions
- providers/tsconfig.json
- local-beta.spec.ts
- screenshot-evidence.mjs
- docker-context.test.mjs
- release-assets.test.mjs
- render-screenshots.mjs
- render-social-card.mjs
- sanitize-sbom.mjs
- verify-sbom-freshness.mjs
- validate-sbom.mjs
- version-sync.test.mjs
- write-sbom-checksums.mjs
- compilerOptions
- ACKNOWLEDGMENTS.md
- CODE_OF_CONDUCT.md
- Nimanto Domain Language
- CONTRIBUTING.md
- GOVERNANCE.md
- SECURITY.md
- AGENTS.md
- large-tenant-performance-budget.md
- Provider setup and trust boundaries
- Job-source expansion research
- Durable discovery schedules
- v0.1.0 implemented slice matrix
- First release
- Nimanto user-flow analysis
- Nimanto v0.2.0 — Colour & Material
- Nimanto v0.3.0 — Evidence Thread
- Nimanto v0.4.0 — Inspectable History
- Nimanto v0.4.1 — Action Before Analysis
- What changed
- Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It
- v0.5.2 public-surface ledger
- Nimanto v0.5.2 — Ask Clearly, Return Exactly
- v0.5.3 public-surface ledger
- Nimanto v0.5.3 — Proof Means Enforced
- v0.5.4 public-surface ledger
- Nimanto v0.5.4 — Work Stays Yours
- v0.5.5 public-surface ledger
- Nimanto v0.5.5 — Same Boundaries, Fresh Runtime
- v0.6.0 public-surface ledger
- Nimanto v0.6.0 — Follow Up on Your Terms
- v0.7.0 public-surface ledger
- Nimanto v0.7.0 — One Place for Each Promise
- v0.8.0 public-surface ledger
- Nimanto v0.8.0 — Find It, Compare It, Keep It
- v0.9.0 public-surface ledger
- Nimanto v0.9.0 — Choose the Search, Keep the Evidence
- Nimanto redesign — Colour & Material 002
- 2. The palette
- 4. The mark
- 6. Workbench
- 2. Where the candidate actually stalls
- Nimanto Sources Licenses and Provider Gate
- Nimanto Initial Backend Plan
- Nimanto Architecture
- Nimanto Trust Privacy and Security Plan
- Nimanto Product Contract
- Fastify API
- Local beta boundary
- Ashby Job Postings API
- Greenhouse Job Board API
- Job source expansion research
- Lever Postings API
- SmartRecruiters Posting API
- Six trust boundaries
- Run and operate the local beta
- Private email-bound invitations
- Sensitive workspace inspection export
- Schema version 15
- Deletion completion versus pending cleanup
- Autonomous deletion recovery
- Discovery-only worker boundary
- Candidate follow-up date
- Exact draft snapshot preservation
- Candidate-authored Submission Record
- Frozen Packet composition
- Troubleshooting
- local-recovery-readiness.md
- recovery-drill.ts
- recovery-drill.test.ts

## God Nodes (most connected - your core abstractions)
1. `NimantoStore` - 184 edges
2. `buildServer()` - 109 edges
3. `Run and operate the local beta` - 73 edges
4. `canonicalHash()` - 57 edges
5. `iso()` - 32 edges
6. `scripts` - 25 edges
7. `Workspace()` - 24 edges
8. `Applications()` - 24 edges
9. `NimantoEmblem` - 23 edges
10. `api()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Discovery Profile replay` --semantically_similar_to--> `Candidate-approved Discovery Profile`  [INFERRED] [semantically similar]
  docs/architecture/system.md → README.md
- `Source-qualified posting freshness` --semantically_similar_to--> `Source completeness policy`  [INFERRED] [semantically similar]
  README.md → docs/architecture/system.md
- `Warning-only sponsorship boundary` --semantically_similar_to--> `H-1B evidence separation`  [INFERRED] [semantically similar]
  docs/planning/job-marketplace-expansion-plan-2026-08-26.md → README.md
- `Staged packet lifecycle` --semantically_similar_to--> `Grounded packet lifecycle`  [INFERRED] [semantically similar]
  docs/architecture/system.md → README.md
- `RoleCluster` --semantically_similar_to--> `Source-preserving Role grouping`  [INFERRED] [semantically similar]
  docs/planning/job-marketplace-expansion-plan-2026-08-26.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Candidate-controlled trust pipeline** — docs_architecture_system_candidate_approved_evidence_intake, docs_architecture_system_exact_snapshot_match_publication, docs_architecture_system_staged_packet_lifecycle, docs_architecture_system_exact_approved_action_lifecycle [EXTRACTED 1.00]
- **Marketplace foundation** — docs_planning_job_marketplace_expansion_plan_2026_08_26_source_registry, docs_planning_job_marketplace_expansion_plan_2026_08_26_provider_protocol, docs_planning_job_marketplace_expansion_plan_2026_08_26_role_availability, docs_planning_job_marketplace_expansion_plan_2026_08_26_work_mode_normalization, docs_planning_job_marketplace_expansion_plan_2026_08_26_discovery_profile, docs_planning_job_marketplace_expansion_plan_2026_08_26_rolecluster [EXTRACTED 1.00]
- **Nimanto runtime topology** — docs_architecture_system_static_next_js_workbench, docs_architecture_system_fastify_api, docs_architecture_system_pglite_postgresql, docs_architecture_system_durable_refresh_worker, docs_architecture_system_deny_by_default_source_registry, docs_architecture_system_exact_approved_action_lifecycle [EXTRACTED 1.00]
- **Confirmed Evidence to Match Flow** — docs_planning_architecture_confirmed_evidence_lifecycle, docs_planning_product_contract_career_evidence_vault, docs_planning_product_contract_evidence_states, docs_planning_product_contract_overall_match_bands, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Tenant Isolation Defense in Depth** — docs_planning_architecture_postgresql_rls_defense, docs_planning_architecture_single_candidate_tenancy, docs_planning_trust_and_security_tenant_authorization, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Review Before External Action** — docs_planning_architecture_no_external_effects_through_slice_3, docs_planning_product_contract_source_action_contract, docs_planning_product_contract_frozen_artifact_approval, docs_planning_backend_plan_slice_3_grounded_packet [INFERRED 0.95]

## Communities (183 total, 37 thin omitted)

### Community 36 - "api/package.json"
Cohesion: 0.11
Nodes (17): name, version, private, type, scripts, build, dev, start (+9 more)

### Community 21 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @fastify/cookie, @fastify/cookie, @fastify/cors, @fastify/cors, @fastify/helmet, @fastify/helmet, @fastify/rate-limit (+15 more)

### Community 28 - "@nimanto/domain"
Cohesion: 0.11
Nodes (20): @nimanto/domain, @nimanto/domain, @nimanto/domain, dependencies, @nimanto/domain, docx, docx, fflate (+12 more)

### Community 44 - "database/package.json"
Cohesion: 0.12
Nodes (15): @electric-sql/pglite, @electric-sql/pglite, name, version, private, type, exports, scripts (+7 more)

### Community 79 - "ats-verification.ts"
Cohesion: 0.27
Nodes (7): EnabledAtsProvider, VerificationRequest, routeFor(), enabledProvider(), providerErrorCode(), AtsVerification, ProviderJobVerificationResult

### Community 0 - "government-dataset.ts"
Cohesion: 0.06
Nodes (54): ProviderJobVerifier, LocalModelAdapter, AllowlistedJobPageFetcher, TrustedEmployerResolutionEvaluation, GovernmentDatasetTrust, NimantoApiOptions, booleanEnvironment(), portEnvironment() (+46 more)

### Community 37 - "dashboard-read.ts"
Cohesion: 0.16
Nodes (10): DashboardRead, ExternalActionCapability, FastifyRequest, stores, stores, rawDatabases, temporaryRoots, LocalIdentity (+2 more)

### Community 26 - "domain/src/index.ts"
Cohesion: 0.16
Nodes (13): RemovePath, DeletionRun, ProviderActionExecutor, stores, temporaryRoots, mkdtempTracked(), approvedActionFixture(), ExternalActionProvider (+5 more)

### Community 48 - "DeletionCoordinator"
Cohesion: 0.19
Nodes (3): warnCleanupPending(), DeletionCoordinator, run()

### Community 45 - "discovery-cycle.ts"
Cohesion: 0.20
Nodes (10): EnabledProvider, EnabledProviderRequest, ProviderJobLike, normalizeProviderRole(), normalizeFetchResult(), DiscoveryCycle, CurrentRole, JobProvider (+2 more)

### Community 13 - "parsers/src/index.ts"
Cohesion: 0.14
Nodes (27): Upload, requestObject(), requiredString(), parseUpload(), reviewedProjection(), previewHash(), EvidenceIntake, stores (+19 more)

### Community 8 - "buildServer"
Cohesion: 0.08
Nodes (11): ExternalActionLifecycle, buildServer(), sha256(), recordInstant(), ACTIVITY_KINDS, ACTIVITY_STATES, CONTACT_KINDS, INTERVIEW_ROUND_KINDS (+3 more)

### Community 14 - "canonicalHash"
Cohesion: 0.12
Nodes (12): uniqueEvidenceIds(), publishMatch(), stores, temporaryRoots, mkdtempTracked(), fixture(), transitionExternalAction(), ExecutionReceipt (+4 more)

### Community 68 - "packet-lifecycle.ts"
Cohesion: 0.20
Nodes (8): PacketArtifactRenderer, PacketArtifactInspector, stores, temporaryRoots, mkdtempTracked(), get(), PacketRecord, DocumentInspection

### Community 29 - "server.ts"
Cohesion: 0.18
Nodes (19): ArtifactManifest, H1B_LABELS, fastify, JsonObject, object(), string(), strings(), optionalString() (+11 more)

### Community 30 - ".approve"
Cohesion: 0.13
Nodes (3): verifiedArtifactBytes(), verifyPacketArtifacts(), reviewedPacket()

### Community 18 - ".transaction"
Cohesion: 0.16
Nodes (5): PacketLifecycle, ApplicationRecord, recordText(), CandidateSubmissionInput, ApplicationStatus

### Community 1 - "NimantoStore"
Cohesion: 0.07
Nodes (6): iso(), isoRequired(), clusterKey(), annotateClusters(), historyLimit(), NimantoStore

### Community 42 - "EvidenceClaim"
Cohesion: 0.21
Nodes (4): seedDemo(), packetFixture(), mapEvidence(), EvidenceClaim

### Community 128 - "./tsconfig.json"
Cohesion: 0.40
Nodes (4): extends, ./tsconfig.json, include, src

### Community 119 - "compilerOptions"
Cohesion: 0.33
Nodes (6): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir

### Community 89 - "../../tsconfig.base.json"
Cohesion: 0.22
Nodes (8): extends, ../../tsconfig.base.json, compilerOptions, types, node, include, src, test

### Community 98 - "layout.tsx"
Cohesion: 0.32
Nodes (5): metadata, viewport, isLoopbackHost(), serviceWorkerScriptUrl(), ServiceWorker()

### Community 10 - "NimantoEmblem"
Cohesion: 0.09
Nodes (17): METHOD, BOUNDARY, HUB, PETALS, Mark(), Brand(), clamp(), lerp() (+9 more)

### Community 63 - "createSubmissionDraft"
Cohesion: 0.30
Nodes (9): Packet, localInputValue(), createSubmissionDraft(), ApplicationSubmissionRecorder(), SubmissionDraft, ControlledRecorder(), packet(), initial() (+1 more)

### Community 4 - "career-ledger.tsx"
Cohesion: 0.07
Nodes (45): Application, Evidence, Job, AnswerRevision, CareerOperationsSnapshot, tabs, human(), applicationLabel() (+37 more)

### Community 2 - "workspace.tsx"
Cohesion: 0.03
Nodes (54): PaletteEntry, siteCommands, CommandPalette(), Connection, useConnection(), ConnectionIndicator(), ConnectionBanner(), Evidence (+46 more)

### Community 54 - "browser-components.test.tsx"
Cohesion: 0.16
Nodes (6): CopyState, CopyLine(), DeletionReceiptGuidance(), RoleIdentityReviewNotice(), answerAt(), serveRevisions()

### Community 69 - "h1b-evidence.tsx"
Cohesion: 0.25
Nodes (10): RoleWordingBlocker, RoleWordingReview, RoleH1bSignal, RoleMatchSnapshot, REVIEWABLE_CODES, GOVERNMENT_SOURCE_TYPES, human(), dateTime() (+2 more)

### Community 90 - "match-evidence-lens.ts"
Cohesion: 0.36
Nodes (6): label(), MatchEvidenceLens(), MatchEvidenceStrengthBasis, MatchEvidenceResult, MatchEvidenceLensProjection, projectMatchEvidenceLens()

### Community 27 - "packet-composer.ts"
Cohesion: 0.13
Nodes (18): Evidence, Application, Profile, Job, Match, RebindProfileVersionButton(), PacketComposer(), ComposerEvidence (+10 more)

### Community 70 - "role-provenance.tsx"
Cohesion: 0.29
Nodes (9): RoleProvenanceData, RoleSourcePolicy, RoleAvailability, human(), localDateTime(), reviewedDate(), dateOrUnknown(), SourceRunEvidence() (+1 more)

### Community 16 - "api"
Cohesion: 0.13
Nodes (30): emptyActionDraft(), emptyEvidenceFilters(), ActionRunner, human(), dateInputValue(), cadenceLabel(), localDateTime(), postingVerificationLabel() (+22 more)

### Community 31 - "Workspace"
Cohesion: 0.15
Nodes (17): sameActionDraft(), emptyManualRoleDraft(), manualRoleDraftForReview(), sameManualRoleDraft(), emptyReviewedUrlDraft(), sameReviewedUrlDraft(), withApplicationActivities(), Workspace() (+9 more)

### Community 3 - "derive.ts"
Cohesion: 0.07
Nodes (54): localDayInstant(), downloadTextFile(), Applications(), projectApplicationView(), EvidenceLike, FilterEvidenceLike, JobLike, MatchLike (+46 more)

### Community 33 - "export-session.test.tsx"
Cohesion: 0.15
Nodes (12): ApiError, fenceApiWritesToSession(), WorkbenchMutation, WorkbenchMutationOutcome, RefreshOutcome, WorkbenchMutations, MutationAdapters, createWorkbenchMutations() (+4 more)

### Community 99 - "application-csv-export.ts"
Cohesion: 0.36
Nodes (6): CsvApplication, CsvJob, HEADERS, spreadsheetSafe(), csvCell(), buildApplicationCsv()

### Community 91 - "application-dossier.ts"
Cohesion: 0.25
Nodes (7): DossierSubmission, DossierApplication, ApplicationOwned, PacketLike, ActionLike, ContactLike, projectApplicationDossier()

### Community 34 - "applications-workbench.ts"
Cohesion: 0.16
Nodes (17): OutcomeDraft, ReminderDraft, ApplicationNoteDraft, DraftState, ApplicationsWorkbenchState, ApplicationsWorkbenchAction, ApplicationsWorkbench, dateInputValue() (+9 more)

### Community 49 - "calendar-export.ts"
Cohesion: 0.19
Nodes (10): FollowUpApplication, escapeCalendarText(), utcStamp(), calendarDate(), encoder, foldCalendarLine(), buildFollowUpCalendar(), RFC-5545 (+2 more)

### Community 129 - "external-action-runtime.ts"
Cohesion: 0.50
Nodes (3): ExternalActionRuntime, ExternalActionRuntimeView, deriveExternalActionRuntimeView()

### Community 92 - "identity-transitions.ts"
Cohesion: 0.28
Nodes (7): DeletionReceipt, IdentityTransitionEvent, IdentityTransitionPlan, LocationInput, LocationDisposition, scrubCredential(), workspaceIdentityTransitions

### Community 11 - "role-discovery.ts"
Cohesion: 0.10
Nodes (32): StructuredAreaLike, RoleLike, DiscoveryProfileLike, DiscoveryProfileReason, DiscoveryProfileAssessment, RoleFilters, RoleDiscoveryFilters, emptyRoleDiscoveryFilters() (+24 more)

### Community 17 - "dependencies"
Cohesion: 0.07
Nodes (29): name, version, private, type, scripts, build, dev, start (+21 more)

### Community 60 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @types/node, @types/react, @types/react, @types/react-dom, @types/react-dom, @types/three, @types/three (+5 more)

### Community 93 - "copy-vocabulary.test.ts"
Cohesion: 0.31
Nodes (7): DISCLAIMER_MARKERS, here, stripComments(), stripIdentifierLiterals(), sentences(), domainCopyFile, copyLiterals()

### Community 12 - "matching.ts"
Cohesion: 0.10
Nodes (32): css, token(), channel(), luminance(), ratio(), MatchRunRecord, RoleWordingReviewRecord, STOP_WORDS (+24 more)

### Community 94 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): extends, compilerOptions, jsx, incremental, plugins, exclude, node_modules, out

### Community 130 - "include"
Cohesion: 0.40
Nodes (5): include, next-env.d.ts, .next/types/**/*.ts, **/*.ts, **/*.tsx

### Community 38 - "worker/package.json"
Cohesion: 0.11
Nodes (17): name, version, private, type, scripts, build, dev, start (+9 more)

### Community 64 - "worker.ts"
Cohesion: 0.32
Nodes (7): bootstrapSecret(), cycle(), WorkerCycleResult, nextDelay(), loopbackApiOrigin(), runCycle(), servers

### Community 101 - "worker/tsconfig.build.json"
Cohesion: 0.25
Nodes (7): extends, compilerOptions, noEmit, outDir, rootDir, include, src

### Community 100 - "worker/tsconfig.json"
Cohesion: 0.25
Nodes (7): extends, compilerOptions, types, node, include, src, test

### Community 9 - "NimantoEmblem"
Cohesion: 0.10
Nodes (13): getTHREE(), diamond(), bracketShape(), annulusJaali(), barShape(), glowTexture(), notchPoly(), polyShape() (+5 more)

### Community 74 - "package.json"
Cohesion: 0.15
Nodes (11): name, version, private, description, author, homepage, bugs, url (+3 more)

### Community 153 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

### Community 124 - "keywords"
Cohesion: 0.33
Nodes (6): keywords, career-tools, evidence, h1b, job-search, local-first

### Community 152 - "engines"
Cohesion: 0.67
Nodes (3): engines, node, pnpm

### Community 19 - "scripts"
Cohesion: 0.08
Nodes (24): scripts, build, check, clean, dev, dev:all, dev:core, format:check (+16 more)

### Community 139 - "dependencies"
Cohesion: 0.67
Nodes (3): dependencies, concurrently, concurrently

### Community 55 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, @cyclonedx/cdxgen, @cyclonedx/cdxgen, @playwright/test, @playwright/test, cspell, cspell, prettier (+6 more)

### Community 22 - "@types/node"
Cohesion: 0.10
Nodes (23): @types/node, @types/node, typescript, devDependencies, @types/node, typescript, vitest, vitest (+15 more)

### Community 97 - "acquireDataDirectoryLock"
Cohesion: 0.36
Nodes (7): privateFile(), sameFile(), bootEpoch(), legacyOwnerIsDead(), acquireDataDirectoryLock(), migrateDatabase(), tightenPosixPermissions()

### Community 39 - "migrations.ts"
Cohesion: 0.20
Nodes (16): backfillIntegrityHashes(), migrations, freshSchemaSql, schemaVersion2Sql, schemaVersion3Sql, schemaVersion4Sql, schemaVersion5Sql, schemaVersion7Sql (+8 more)

### Community 7 - "store.ts"
Cohesion: 0.06
Nodes (39): EvidenceRow, SessionRow, InvitationRecord, InvitationRetentionRecord, ProfileVersionRecord, ProfileVersionSaveResult, HistoryPage, AnswerRevisionPage (+31 more)

### Community 125 - "RoleFamily"
Cohesion: 0.60
Nodes (6): JobRecord, JobUpsertInput, WorkplaceMode, RoleFamily, WorkplaceEvidence, ProviderJob

### Community 40 - "marketplace.ts"
Cohesion: 0.18
Nodes (16): RoleAvailabilityRecord, VerificationAttemptRecord, RoleVerificationInput, normalizeList(), normalizeDiscoveryProfile(), WORKPLACE_MODES, VALIDATED_ROLE_FAMILIES, StructuredArea (+8 more)

### Community 80 - "submissions.ts"
Cohesion: 0.31
Nodes (8): ApplicationSubmissionRecord, SUBMISSION_CHANNELS, SubmissionChannel, PACKET_ARTIFACT_FORMATS, PacketArtifactFormat, clean(), normalizeCandidateSubmission(), now

### Community 58 - "career-operations.ts"
Cohesion: 0.20
Nodes (12): ApplicationActivityRecord, InterviewRoundRecord, ActivityKind, ActivityState, InterviewRoundKind, InterviewRoundState, ApplicationStatusEvent, DescriptiveApplication (+4 more)

### Community 75 - "external-actions.ts"
Cohesion: 0.20
Nodes (8): ExternalActionRecord, AssuranceFindingCode, AssuranceFinding, PacketAssuranceResult, assurePacket(), ExternalActionEvent, transitions, ExternalActionState

### Community 81 - "schedules.ts"
Cohesion: 0.31
Nodes (7): SourceScheduleRecord, ScheduledJobState, ScheduledJobEvent, transitions, transitionScheduledJob(), scheduledRetryDelayMinutes(), scheduledFailureEvent()

### Community 108 - "store-lock.test.ts"
Cohesion: 0.32
Nodes (6): roots, stores, children, message(), contender(), openChild()

### Community 47 - "roles.ts"
Cohesion: 0.22
Nodes (11): stores, temporaryRoots, v041FixtureSql, classifyRoleFamily(), RoleSource, RoleObservation, roleSnapshotHash(), normalized() (+3 more)

### Community 77 - "database/tsconfig.build.json"
Cohesion: 0.18
Nodes (10): extends, compilerOptions, declaration, noEmit, outDir, rootDir, include, src/**/*.ts (+2 more)

### Community 76 - "database/tsconfig.json"
Cohesion: 0.18
Nodes (10): extends, compilerOptions, module, moduleResolution, types, node, include, src/**/*.ts (+2 more)

### Community 82 - "documents/package.json"
Cohesion: 0.20
Nodes (9): name, version, private, type, exports, scripts, build, test (+1 more)

### Community 41 - "parsers/package.json"
Cohesion: 0.11
Nodes (17): pdf-lib, name, version, private, type, exports, scripts, build (+9 more)

### Community 32 - "documents/src/index.ts"
Cohesion: 0.18
Nodes (17): PacketClaim, PacketComposition, CanonicalPacket, PacketArtifact, packetText(), createDocx(), wrap(), createPdf() (+9 more)

### Community 83 - "compilerOptions"
Cohesion: 0.20
Nodes (9): extends, compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, include (+1 more)

### Community 109 - "documents/tsconfig.json"
Cohesion: 0.25
Nodes (7): extends, compilerOptions, types, node, include, src, test

### Community 78 - "domain/package.json"
Cohesion: 0.18
Nodes (10): name, version, private, type, exports, scripts, build, clean (+2 more)

### Community 65 - "applications.ts"
Cohesion: 0.21
Nodes (9): APPLICATION_STATUSES, legalCandidateTargets, consequentialTargets, CandidateApplicationOption, CandidateApplicationDecision, PacketApplicationEffect, PacketApplicationDecision, isStatus() (+1 more)

### Community 23 - "jobs.ts"
Cohesion: 0.29
Nodes (22): normalizeWorkplaceMode(), JobProviderRequest, Fetcher, assertBoard(), assertSourceJobId(), text(), outboundUrl(), stripMarkup() (+14 more)

### Community 66 - "compilerOptions"
Cohesion: 0.17
Nodes (11): extends, compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, include (+3 more)

### Community 84 - "domain/tsconfig.json"
Cohesion: 0.20
Nodes (9): extends, compilerOptions, module, moduleResolution, types, node, include, src/**/*.ts (+1 more)

### Community 85 - "compilerOptions"
Cohesion: 0.20
Nodes (9): extends, compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, include (+1 more)

### Community 110 - "parsers/tsconfig.json"
Cohesion: 0.25
Nodes (7): extends, compilerOptions, types, node, include, src, test

### Community 86 - "providers/package.json"
Cohesion: 0.20
Nodes (9): name, version, private, type, exports, scripts, build, test (+1 more)

### Community 20 - "ats-routing.ts"
Cohesion: 0.16
Nodes (19): AtsRoutingProvider, AtsRoutingDecision, AtsRoutingInput, RecognizedTarget, ATS_PROVIDERS, CANDIDATE_OWNED_SOURCES, decision(), safeHttpsUrl() (+11 more)

### Community 87 - "providers/src/index.ts"
Cohesion: 0.33
Nodes (6): Address, Response, expandIPv6(), isPrivateAddress(), textFromPage(), fetchAllowlistedJobPage()

### Community 67 - "providers.test.ts"
Cohesion: 0.29
Nodes (7): localModelStatus, LocalModelDescriptor, localModelInventory(), reviewLocalPacket(), draftLocalSummary(), servers, temporaryRoots

### Community 88 - "compilerOptions"
Cohesion: 0.20
Nodes (9): extends, compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, include (+1 more)

### Community 111 - "providers/tsconfig.json"
Cohesion: 0.25
Nodes (7): extends, compilerOptions, types, node, include, src, test

### Community 52 - "local-beta.spec.ts"
Cohesion: 0.14
Nodes (3): webPort, apiPort, playwrightDataDir

### Community 25 - "screenshot-evidence.mjs"
Cohesion: 0.14
Nodes (17): repository, sitePort, apiPort, update, screenshotSourcePaths, screenshotAssetPaths, ignoredDirectoryNames, ignoredSourcePaths (+9 more)

### Community 118 - "render-screenshots.mjs"
Cohesion: 0.29
Nodes (5): root, assets, publicAssets, siteOnly, workbenchOnly

### Community 126 - "render-social-card.mjs"
Cohesion: 0.33
Nodes (4): root, assets, modules, faces

### Community 131 - "sanitize-sbom.mjs"
Cohesion: 0.50
Nodes (3): paths, hasMachineLocalPath(), sanitize()

### Community 59 - "verify-sbom-freshness.mjs"
Cohesion: 0.34
Nodes (12): volatileRegistryProperties, registryPropertyName(), stableRegistryMetadata(), stableOccurrenceMetadata(), sortedPurls(), cyclonedxPurls(), spdxPurls(), comparePurlSets() (+4 more)

### Community 127 - "validate-sbom.mjs"
Cohesion: 0.33
Nodes (4): args, releaseManifest, releaseWorkspaces, requiredPackages

### Community 53 - "version-sync.test.mjs"
Cohesion: 0.25
Nodes (13): workspacePackages, currentSchemaVersion(), schemaVersionTextChecks(), versionTextChecks(), releaseAssetPaths(), countOccurrences(), markdownSection(), validateVersionSync() (+5 more)

### Community 24 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowJs, allowSyntheticDefaultImports, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, ES2024 (+14 more)

### Community 120 - "Nimanto Domain Language"
Cohesion: 0.33
Nodes (5): Nimanto Domain Language, Evidence and explanation, Preparation and action, Role intake, Operations

### Community 71 - "Provider setup and trust boundaries"
Cohesion: 0.18
Nodes (9): Provider setup and trust boundaries, Job discovery providers, Deep link, Local test outbox, Connected accounts, Verification rule, Reconcile an ambiguous action, Government dataset editions (advanced API-only input) (+1 more)

### Community 35 - "Job-source expansion research"
Cohesion: 0.11
Nodes (18): Job-source expansion research, Executive recommendation, Current Nimanto baseline and gaps, Source ranking and access posture, Explicit no-scrape / approval-only list, Canonical work-mode and geography model, Freshness, closure, and verification, Lifecycle schema (+10 more)

### Community 122 - "Durable discovery schedules"
Cohesion: 0.33
Nodes (5): Durable discovery schedules, Outcome, Public seams, State and safety contract, Acceptance

### Community 113 - "First release"
Cohesion: 0.29
Nodes (6): Nimanto v0.1.0 — local beta, First release, Included, Release gates, Locally verified from the release tree, Deliberate beta limits

### Community 102 - "Nimanto user-flow analysis"
Cohesion: 0.25
Nodes (5): Nimanto user-flow analysis, 1. The intended flow, 3. Cross-cutting failure modes, 4. Constraints the fixes must respect, 5. Flow after the change

### Community 103 - "Nimanto v0.2.0 — Colour & Material"
Cohesion: 0.25
Nodes (8): Nimanto v0.2.0 — Colour & Material, The mark, Colour & Material 002, The website, The workbench, Correctness, Verification, Unchanged

### Community 57 - "Nimanto v0.3.0 — Evidence Thread"
Cohesion: 0.14
Nodes (13): Nimanto v0.3.0 — Evidence Thread, What changed, 1. Private role narrowing, 2. Recorded application timelines, 3. Sponsorship provenance and freshness, 4. Match anatomy, 5. Tamper-evident local activity, 6. Packet review (+5 more)

### Community 50 - "Nimanto v0.4.0 — Inspectable History"
Cohesion: 0.13
Nodes (13): v0.4.0 public-surface ledger, Surface inventory, Nimanto v0.4.0 — Inspectable History, What changed, 1. Stored history and export v2, 2. Packet history and assurance comparison, 3. Record-review queue, 4. Literal profile and match comparison (+5 more)

### Community 51 - "Nimanto v0.4.1 — Action Before Analysis"
Cohesion: 0.13
Nodes (13): v0.4.1 public-surface ledger, Surface inventory, Nimanto v0.4.1 — Action Before Analysis, What changed, 1. Manual role drafts survive section changes, 2. Applications opens on the work, 3. Section focus clears the sticky header, 4. No-op profile saves no longer create history (+5 more)

### Community 43 - "What changed"
Cohesion: 0.12
Nodes (15): v0.4.2 public-surface ledger, Surface inventory, Nimanto v0.4.2 — Exact Review, Exact Commit, What changed, Exact-snapshot match publication, Candidate-approved evidence intake, Staged packet and exact assurance lifecycle, Exact-approved external actions (+7 more)

### Community 15 - "Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It"
Cohesion: 0.06
Nodes (27): v0.5.0 public-surface ledger, Surface inventory, Nimanto v0.5.0 — Clear Intent, Current Truth, What changed, One candidate Application transition policy, Consistent current-Role normalization, A UI-only Workbench mutation coordinator, Separate Identity and navigation/focus transitions (+19 more)

### Community 104 - "Nimanto v0.5.2 — Ask Clearly, Return Exactly"
Cohesion: 0.25
Nodes (7): Nimanto v0.5.2 — Ask Clearly, Return Exactly, Improved, Maintenance, Upgrade, Verification, Provenance, Still out of scope

### Community 114 - "Nimanto v0.5.3 — Proof Means Enforced"
Cohesion: 0.29
Nodes (6): Nimanto v0.5.3 — Proof Means Enforced, Fixed, Included from v0.5.2, Verify, Upgrade, Boundaries

### Community 115 - "Nimanto v0.5.4 — Work Stays Yours"
Cohesion: 0.29
Nodes (6): Nimanto v0.5.4 — Work Stays Yours, Improved, Fixed, Verify, Upgrade, Boundaries

### Community 123 - "Nimanto v0.5.5 — Same Boundaries, Fresh Runtime"
Cohesion: 0.33
Nodes (5): Nimanto v0.5.5 — Same Boundaries, Fresh Runtime, Improved, Verify, Upgrade, Boundaries

### Community 116 - "Nimanto v0.6.0 — Follow Up on Your Terms"
Cohesion: 0.29
Nodes (6): Nimanto v0.6.0 — Follow Up on Your Terms, Added, Refined, Verify, Upgrade, Boundaries

### Community 117 - "Nimanto v0.7.0 — One Place for Each Promise"
Cohesion: 0.29
Nodes (6): Nimanto v0.7.0 — One Place for Each Promise, Deepened, Preserved, Verify, Upgrade, Boundaries

### Community 105 - "Nimanto v0.8.0 — Find It, Compare It, Keep It"
Cohesion: 0.25
Nodes (7): Nimanto v0.8.0 — Find It, Compare It, Keep It, Added, Strengthened, Preserved, Verify, Upgrade, Boundaries

### Community 106 - "Nimanto v0.9.0 — Choose the Search, Keep the Evidence"
Cohesion: 0.25
Nodes (7): Nimanto v0.9.0 — Choose the Search, Keep the Evidence, Added, Strengthened, Preserved, Verify, Upgrade, Boundaries

### Community 73 - "Nimanto redesign — Colour & Material 002"
Cohesion: 0.18
Nodes (11): Nimanto redesign — Colour & Material 002, 0. Survey — what comparable open-source tools already ship, 1. Why, 3. Decisions, 5. Website, ⚑ Spacing contract — applies to **both** routes, Motion, 7. Deferred — and what will _not_ change ⚑ (+3 more)

### Community 96 - "2. The palette"
Cohesion: 0.22
Nodes (9): 2. The palette, Ground, Materials, Ramps, ⚑ Type on ink — computed, ⚑ Non-text contrast (WCAG 1.4.11 — borders, chips, focus rings need ≥3:1), Proportion — the governing rule, ⚑ Type stack — verified package names (+1 more)

### Community 134 - "4. The mark"
Cohesion: 0.50
Nodes (4): 4. The mark, 4.1 Concept and provenance, 4.2 Surfaces, 4.3 Hero specification ⚑

### Community 135 - "6. Workbench"
Cohesion: 0.50
Nodes (4): 6. Workbench, 6.1 Restyle — ⚑ layout, not only colour, 6.2 Features, 6.3 Robustness

### Community 107 - "2. Where the candidate actually stalls"
Cohesion: 0.25
Nodes (8): 2. Where the candidate actually stalls, S1 — "I imported. Now what?" (entry cliff), S2 — Blocked match is a terminal screen, S3 — Applications are a flat list with a `<select>`, S4 — The funnel is buried and under-read, S5 — Silence is indistinguishable from nothing-happened, S6 — No way to get anywhere fast, S7 — The app lies when the API is down

### Community 46 - "Nimanto Sources Licenses and Provider Gate"
Cohesion: 0.14
Nodes (16): Observability Allowlist, H-1B Evidence Taxonomy, Source and Action Capability Contract, Dependency License and Security Ledger, Government Dataset Provenance, Slice-1 Greenhouse Source Policy, Provider Compliance Gate, Restricted Provider Policy (+8 more)

### Community 56 - "Nimanto Initial Backend Plan"
Cohesion: 0.20
Nodes (14): Clean-Start Verification, Exact Implementation Approval Gate, Versioned Held-Out Evaluation, Public Repository Gate, Slice 1 Evidence to Match, Slice 2 Transfer Intelligence, Slice 3 Grounded Packet, Product Success Criteria (+6 more)

### Community 61 - "Nimanto Architecture"
Cohesion: 0.22
Nodes (13): Durable Idempotent Jobs, Inward Dependency Direction, PostgreSQL RLS and Application Authorization, Private Object Capability, Provenance-Safe Job Versions, Stable Input Artifact and Receipt Hashing, Versioned JSON Schema Contracts, Private Object Disclosure Defense (+5 more)

### Community 62 - "Nimanto Trust Privacy and Security Plan"
Cohesion: 0.17
Nodes (13): Identity-Invariant Scoring, Accessibility and Trust Controls, Identity-Invariant Fairness Safeguards, Isolated Upload and Parsing Pipeline, Legal and Expert Review Flags, Prompt Injection Defense, Queue Replay and Tenant-Confusion Defense, SSRF Defense (+5 more)

### Community 72 - "Nimanto Product Contract"
Cohesion: 0.22
Nodes (11): Confirmed Evidence Lifecycle, Candidate-Controlled Job Search Operating System, Career Evidence Vault, Evidence States, Frozen Artifact Approval, Hard-Constraint Policy, Product Kill Criteria, Overall Match Bands (+3 more)

### Community 6 - "Fastify API"
Cohesion: 0.05
Nodes (42): Candidate-approved evidence intake, Durable refresh worker, Fastify API, Optional local Ollama model, PGlite PostgreSQL, Static Next.js workbench, Tenant-isolated persistence, Candidate Role disposition (+34 more)

### Community 140 - "Local beta boundary"
Cohesion: 0.67
Nodes (3): Monorepo architecture, Hosted trust layer, Local beta boundary

### Community 5 - "Run and operate the local beta"
Cohesion: 0.05
Nodes (43): Run and operate the local beta, Supported local runtime, Local launch workflow, Loopback deployment boundary, Versioned source upgrade, Hosted identity deployment gates, Digest-pinned Docker self-hosting, Private runtime data root (+35 more)

### Community 142 - "Private email-bound invitations"
Cohesion: 0.67
Nodes (3): Private launch key, Private email-bound invitations, Invitation tombstone retention

### Community 121 - "Sensitive workspace inspection export"
Cohesion: 0.33
Nodes (6): SQLite exclusive database ownership, Stopped ownership protocol upgrade, Legacy lock marker recovery, Stopped full-directory backup, Spreadsheet-safe shown-record export, Sensitive workspace inspection export

### Community 141 - "Candidate follow-up date"
Cohesion: 0.67
Nodes (3): Candidate follow-up date, Local calendar reminder export, Record-review queue

### Community 133 - "Frozen Packet composition"
Cohesion: 0.50
Nodes (4): Frozen Packet composition, Exact reviewed Assurance approval, Current Profile Version rebind, External-action currentness and runtime gate

### Community 95 - "Troubleshooting"
Cohesion: 0.22
Nodes (9): Troubleshooting, The workbench says “Connect the local service”, A packet is blocked, The composer says the Application is on an older Profile Version, A Submission Record is blocked, Execute is disabled, The workbench says the identity changed, An action is ambiguous (+1 more)

### Community 181 - "local-recovery-readiness.md"
Cohesion: 0.33
Nodes (5): Decision and scope, Local recovery readiness, Phase R1: synthetic stopped-copy rehearsal, Phase R2: deletion across older backups, Phase R3: hosted recovery acceptance

### Community 179 - "recovery-drill.ts"
Cohesion: 0.70
Nodes (4): assertOwnership(), recoveryTreeDigest(), runRecoveryDrill(), stableExport()

## Knowledge Gaps
- **830 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+825 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NimantoStore` connect `NimantoStore` to `government-dataset.ts`, `store.ts`, `buildServer`, `answer-history.test.ts`, `parsers/src/index.ts`, `canonicalHash`, `.transaction`, `domain/src/index.ts`, `server.ts`, `.approve`, `dashboard-read.ts`, `EvidenceClaim`, `discovery-cycle.ts`, `roles.ts`, `DeletionCoordinator`, `recovery-drill.ts`, `packet-lifecycle.ts`, `ats-verification.ts`, `schedules.ts`, `acquireDataDirectoryLock`, `store-lock.test.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `buildServer()` connect `buildServer` to `government-dataset.ts`, `NimantoStore`, `providers.test.ts`, `dashboard-read.ts`, `EvidenceClaim`, `parsers/src/index.ts`, `discovery-cycle.ts`, `ats-verification.ts`, `DeletionCoordinator`, `canonicalHash`, `.transaction`, `roles.ts`, `jobs.ts`, `server.ts`, `.approve`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `ApplicationStatus` connect `.transaction` to `applications.ts`, `workspace.tsx`, `application-csv-export.ts`, `career-ledger.tsx`, `packet-lifecycle.ts`, `derive.ts`, `store.ts`, `matching.ts`, `calendar-export.ts`, `career-operations.ts`, `server.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _830 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `@nimanto/domain` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._