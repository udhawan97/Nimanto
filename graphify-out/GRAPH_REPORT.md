# Graph Report - Nimanto  (2026-08-25)

## Corpus Check
- 210 files · ~6,522,338 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1671 nodes · 2629 edges · 116 communities (99 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9f2ab893`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Nimanto Sources Licenses and Provider Gate
- Nimanto Initial Backend Plan
- Nimanto Architecture
- Nimanto Trust Privacy and Security Plan
- Nimanto Product Contract
- iso
- store.ts
- config.ts
- dependencies
- workspace.tsx
- dependencies
- README.md
- v0.1.0 implemented slice matrix
- documents/package.json
- parsers/package.json
- Run and operate the local beta
- database/package.json
- compilerOptions
- worker/package.json
- providers/package.json
- domain/package.json
- local-beta.spec.ts
- web/tsconfig.json
- devDependencies
- sanitize-sbom.mjs
- validate-sbom.mjs
- parsers/src/index.ts
- scripts
- compilerOptions
- NimantoStore
- Durable discovery schedules
- database/tsconfig.json
- database/tsconfig.build.json
- domain/tsconfig.json
- compilerOptions
- package.json
- compilerOptions
- Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It
- compilerOptions
- compilerOptions
- NimantoEmblem
- NimantoEmblem
- api/tsconfig.json
- Workspace
- derive.ts
- api
- worker/tsconfig.json
- worker/tsconfig.build.json
- documents/tsconfig.json
- parsers/tsconfig.json
- providers/tsconfig.json
- Nimanto v0.6.0 — Follow Up on Your Terms
- worker.ts
- Nimanto v0.3.0 — Evidence Thread
- Nimanto redesign — Colour & Material 002
- types.ts
- First release
- keywords
- EvidenceClaim
- buildServer
- 2. The palette
- identity-transitions.ts
- Nimanto v0.4.0 — Inspectable History
- app/page.tsx
- repository
- Nimanto user-flow analysis
- Nimanto v0.2.0 — Colour & Material
- 2. Where the candidate actually stalls
- government-dataset.ts
- AGENTS.md
- next.config.ts
- next-env.d.ts
- sw.js
- CODE_OF_CONDUCT.md
- GOVERNANCE.md
- external-action-lifecycle.ts
- PacketHistoryPanel
- Nimanto v0.5.3 — Proof Means Enforced
- Nimanto v0.4.1 — Action Before Analysis
- render-social-card.mjs
- render-screenshots.mjs
- .transaction
- 4. The mark
- 6. Workbench
- canonicalHash
- version-sync.test.mjs
- write-sbom-checksums.mjs
- database/src/index.ts
- Nimanto v0.5.2 — Ask Clearly, Return Exactly
- applications-workbench.ts
- v0.5.3 public-surface ledger
- What changed
- screenshot-evidence.mjs
- Nimanto Domain Language
- packet-lifecycle.ts
- .execute
- release-assets.test.mjs
- v0.5.2 public-surface ledger
- deletion-coordinator.ts
- v0.6.0 public-surface ledger
- v0.5.5 public-surface ledger
- verify-sbom-freshness.mjs
- workbench-mutations.ts
- migrations.ts
- discovery-cycle.ts
- Nimanto v0.5.4 — Work Stays Yours
- .runWorkerCycle
- Nimanto v0.5.5 — Same Boundaries, Fresh Runtime
- calendar-export.ts
- v0.5.4 public-surface ledger
- Nimanto v0.7.0 — One Place for Each Promise
- v0.7.0 public-surface ledger

## God Nodes (most connected - your core abstractions)
1. `NimantoStore` - 119 edges
2. `buildServer()` - 71 edges
3. `canonicalHash()` - 36 edges
4. `NimantoEmblem` - 23 edges
5. `scripts` - 23 edges
6. `iso()` - 22 edges
7. `Workspace()` - 18 edges
8. `compilerOptions` - 18 edges
9. `Applications()` - 17 edges
10. `EvidenceClaim` - 15 edges

## Surprising Connections (you probably didn't know these)
- `buildServer()` --indirect_call--> `draftLocalSummary()`  [INFERRED]
  apps/api/src/server.ts → packages/providers/src/ollama.ts
- `evidenceMatches()` --indirect_call--> `token()`  [INFERRED]
  packages/domain/src/matching.ts → apps/web/test/tokens.test.ts
- `normalizeProviderRole()` --calls--> `normalizeRoleObservation()`  [EXTRACTED]
  apps/api/src/discovery-cycle.ts → packages/domain/src/roles.ts
- `previewHash()` --calls--> `canonicalHash()`  [EXTRACTED]
  apps/api/src/evidence-intake.ts → packages/domain/src/receipts.ts
- `publishMatch()` --calls--> `matchJob()`  [EXTRACTED]
  apps/api/src/match-publication.ts → packages/domain/src/matching.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tenant Isolation Defense in Depth** — docs_planning_architecture_postgresql_rls_defense, docs_planning_architecture_single_candidate_tenancy, docs_planning_trust_and_security_tenant_authorization, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Confirmed Evidence to Match Flow** — docs_planning_architecture_confirmed_evidence_lifecycle, docs_planning_product_contract_career_evidence_vault, docs_planning_product_contract_evidence_states, docs_planning_product_contract_overall_match_bands, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Review Before External Action** — docs_planning_architecture_no_external_effects_through_slice_3, docs_planning_product_contract_source_action_contract, docs_planning_product_contract_frozen_artifact_approval, docs_planning_backend_plan_slice_3_grounded_packet [INFERRED 0.95]

## Communities (116 total, 17 thin omitted)

### Community 0 - "Nimanto Sources Licenses and Provider Gate"
Cohesion: 0.14
Nodes (16): Observability Allowlist, H-1B Evidence Taxonomy, Source and Action Capability Contract, Defer USAJOBS Ingestion, Dependency License and Security Ledger, Government Dataset Provenance, Greenhouse Job Board API, Slice-1 Greenhouse Source Policy (+8 more)

### Community 1 - "Nimanto Initial Backend Plan"
Cohesion: 0.20
Nodes (14): Clean-Start Verification, Exact Implementation Approval Gate, Versioned Held-Out Evaluation, Nimanto Initial Backend Plan, Public Repository Gate, Slice 1 Evidence to Match, Slice 2 Transfer Intelligence, Slice 3 Grounded Packet (+6 more)

### Community 2 - "Nimanto Architecture"
Cohesion: 0.22
Nodes (13): Durable Idempotent Jobs, Inward Dependency Direction, TypeScript Modular Monolith Decision, Next.js Backend for Frontend Guide, Nimanto Architecture, PostgreSQL RLS and Application Authorization, PostgreSQL Row Security Documentation, Private Object Capability (+5 more)

### Community 3 - "Nimanto Trust Privacy and Security Plan"
Cohesion: 0.17
Nodes (13): Identity-Invariant Scoring, Accessibility and Trust Controls, Identity-Invariant Fairness Safeguards, Isolated Upload and Parsing Pipeline, Legal and Expert Review Flags, Nimanto Trust Privacy and Security Plan, Operator Access Reality, OWASP File Upload Cheat Sheet (+5 more)

### Community 4 - "Nimanto Product Contract"
Cohesion: 0.22
Nodes (11): Confirmed Evidence Lifecycle, No External Effects Through Slice 3, Candidate-Controlled Job Search Operating System, Career Evidence Vault, DOL H-1B Program Guidance, Evidence States, Frozen Artifact Approval, Hard-Constraint Policy (+3 more)

### Community 5 - "iso"
Cohesion: 0.11
Nodes (4): seedDemo(), historyLimit(), iso(), ExecutionReceipt

### Community 6 - "store.ts"
Cohesion: 0.10
Nodes (22): migrateDatabase(), ApplicationNoteRecord, AssuranceHistoryRecord, AssuranceRecord, ClaimedSourceSchedule, DatasetEditionRecord, HistoryPage, InvitationRecord (+14 more)

### Community 7 - "config.ts"
Cohesion: 0.10
Nodes (26): AllowlistedJobPageFetcher, loadOptions(), localBootstrapSecret(), LocalModelAdapter, NimantoApiOptions, options, assertBoard(), digest() (+18 more)

### Community 8 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui (+38 more)

### Community 9 - "workspace.tsx"
Cohesion: 0.05
Nodes (34): Connection, ConnectionBanner(), ConnectionIndicator(), useConnection(), Action, ActionDraft, ActionRunner, ApiError (+26 more)

### Community 10 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, @fontsource/ibm-plex-mono, @fontsource/instrument-serif, @fontsource-variable/archivo, lucide-react, next, @nimanto/domain, react (+38 more)

### Community 11 - "README.md"
Cohesion: 0.04
Nodes (40): Acknowledgments, Contributing, Authentication, Data lifecycle, Durable discovery, External actions, Nimanto system architecture, Package seams (+32 more)

### Community 13 - "documents/package.json"
Cohesion: 0.07
Nodes (27): docx, dependencies, docx, fflate, @nimanto/domain, pdf-lib, pdfjs-dist, devDependencies (+19 more)

### Community 14 - "parsers/package.json"
Cohesion: 0.07
Nodes (27): dependencies, fflate, @nimanto/domain, pdfjs-dist, saxes, devDependencies, pdf-lib, @types/node (+19 more)

### Community 15 - "Run and operate the local beta"
Cohesion: 0.06
Nodes (29): A packet is blocked, An action is ambiguous, Back up and restore, Data locations, Docker self-hosting, Execute is disabled, Gmail or Outlook is unavailable, Inspect a workspace export (+21 more)

### Community 16 - "database/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @electric-sql/pglite, @nimanto/domain, devDependencies, @types/node, typescript, vitest, exports (+14 more)

### Community 17 - "compilerOptions"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2024, compilerOptions, allowJs, allowSyntheticDefaultImports, exactOptionalPropertyTypes, forceConsistentCasingInFileNames (+14 more)

### Community 18 - "worker/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, tsx, @types/node, typescript, vitest, tsx, @types/node, typescript (+11 more)

### Community 19 - "providers/package.json"
Cohesion: 0.10
Nodes (19): dependencies, @nimanto/domain, devDependencies, @types/node, typescript, vitest, exports, @nimanto/domain (+11 more)

### Community 20 - "domain/package.json"
Cohesion: 0.11
Nodes (17): devDependencies, @types/node, typescript, vitest, exports, @types/node, typescript, vitest (+9 more)

### Community 22 - "web/tsconfig.json"
Cohesion: 0.13
Nodes (14): compilerOptions, incremental, jsx, plugins, exclude, extends, include, ../../tsconfig.base.json (+6 more)

### Community 23 - "devDependencies"
Cohesion: 0.11
Nodes (19): concurrently, cspell, @cyclonedx/cdxgen, devDependencies, concurrently, cspell, @cyclonedx/cdxgen, @playwright/test (+11 more)

### Community 24 - "sanitize-sbom.mjs"
Cohesion: 0.50
Nodes (3): hasMachineLocalPath(), paths, sanitize()

### Community 25 - "validate-sbom.mjs"
Cohesion: 0.33
Nodes (4): paths, releaseManifest, releaseWorkspaces, requiredPackages

### Community 26 - "parsers/src/index.ts"
Cohesion: 0.15
Nodes (24): EvidenceIntake, parseUpload(), previewHash(), requestObject(), requiredString(), reviewedProjection(), Upload, stores (+16 more)

### Community 27 - "scripts"
Cohesion: 0.09
Nodes (23): scripts, build, check, clean, dev, dev:all, dev:core, format (+15 more)

### Community 28 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, exclude, extends (+4 more)

### Community 29 - "NimantoStore"
Cohesion: 0.12
Nodes (3): NimantoStore, sha256(), transitionScheduledJob()

### Community 30 - "Durable discovery schedules"
Cohesion: 0.33
Nodes (5): Acceptance, Durable discovery schedules, Outcome, Public seams, State and safety contract

### Community 31 - "database/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 32 - "database/tsconfig.build.json"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, noEmit, outDir, rootDir, exclude, extends, include (+3 more)

### Community 33 - "domain/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, types, extends, include, node, src/**/*.ts (+3 more)

### Community 34 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 35 - "package.json"
Cohesion: 0.14
Nodes (13): author, bugs, url, description, engines, node, pnpm, homepage (+5 more)

### Community 36 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 37 - "Nimanto v0.5.1 — Say What You Need, Ask Before You Burn It"
Cohesion: 0.06
Nodes (27): A UI-only Workbench mutation coordinator, Consistent current-Role normalization, Dependency and verification maintenance, Nimanto v0.5.0 — Clear Intent, Current Truth, One candidate Application transition policy, Separate Identity and navigation/focus transitions, Surface inventory, v0.5.0 public-surface ledger (+19 more)

### Community 38 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 39 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 40 - "NimantoEmblem"
Cohesion: 0.10
Nodes (13): annulusJaali(), barShape(), bracketShape(), diamond(), getTHREE(), glowTexture(), NimantoEmblem, notchPoly() (+5 more)

### Community 41 - "NimantoEmblem"
Cohesion: 0.16
Nodes (9): clamp(), EmblemOptions, glowTexture(), inOutQuint(), lerp(), NimantoEmblem, outQuint(), petalShape() (+1 more)

### Community 42 - "api/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 43 - "Workspace"
Cohesion: 0.18
Nodes (14): emptyManualRoleDraft(), emptyReviewedUrlDraft(), sameActionDraft(), sameManualRoleDraft(), sameReviewedUrlDraft(), Workspace(), createWorkspaceNavigationTransitions(), focusSectionBelowHeader() (+6 more)

### Community 44 - "derive.ts"
Cohesion: 0.08
Nodes (46): Applications(), localDayInstant(), useOverflowFlag(), ActionLike, APPLICATION_MATCH_BUCKETS, applicationCohortCounts(), ApplicationFilters, ApplicationLike (+38 more)

### Community 45 - "api"
Cohesion: 0.12
Nodes (26): Actions(), ActivityLedger(), api(), ApplicationNoteEditor(), cadenceLabel(), DataControls(), emptyActionDraft(), emptyRoleFilters() (+18 more)

### Community 46 - "worker/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 47 - "worker/tsconfig.build.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, outDir, rootDir, extends, include, src, ./tsconfig.json

### Community 48 - "documents/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 49 - "parsers/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 50 - "providers/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 51 - "Nimanto v0.6.0 — Follow Up on Your Terms"
Cohesion: 0.29
Nodes (6): Added, Boundaries, Nimanto v0.6.0 — Follow Up on Your Terms, Refined, Upgrade, Verify

### Community 52 - "worker.ts"
Cohesion: 0.47
Nodes (6): bootstrapSecret(), cycle(), loopbackApiOrigin(), nextDelay(), runCycle(), WorkerCycleResult

### Community 53 - "Nimanto v0.3.0 — Evidence Thread"
Cohesion: 0.14
Nodes (13): 1. Private role narrowing, 2. Recorded application timelines, 3. Sponsorship provenance and freshness, 4. Match anatomy, 5. Tamper-evident local activity, 6. Packet review, Correctness, Nimanto v0.3.0 — Evidence Thread (+5 more)

### Community 54 - "Nimanto redesign — Colour & Material 002"
Cohesion: 0.18
Nodes (11): 0. Survey — what comparable open-source tools already ship, 10. Release ⚑, 1. Why, 3. Decisions, 5. Website, 7. Deferred — and what will _not_ change ⚑, 8. Files ⚑, 9. Verification ⚑ (+3 more)

### Community 55 - "types.ts"
Cohesion: 0.11
Nodes (28): channel(), css, luminance(), ratio(), token(), bandFromValue(), blockerText(), evidenceMatches() (+20 more)

### Community 56 - "First release"
Cohesion: 0.29
Nodes (6): Deliberate beta limits, First release, Included, Locally verified from the release tree, Nimanto v0.1.0 — local beta, Release gates

### Community 57 - "keywords"
Cohesion: 0.33
Nodes (6): keywords, career-tools, evidence, h1b, job-search, local-first

### Community 58 - "EvidenceClaim"
Cohesion: 0.38
Nodes (3): EvidenceRow, mapEvidence(), EvidenceClaim

### Community 59 - "buildServer"
Cohesion: 0.14
Nodes (17): buildServer(), fastify, H1B_LABELS, historyOptions(), identity(), JsonObject, messageForError(), object() (+9 more)

### Community 60 - "2. The palette"
Cohesion: 0.22
Nodes (9): 2. The palette, Ground, Materials, ⚑ Non-text contrast (WCAG 1.4.11 — borders, chips, focus rings need ≥3:1), Proportion — the governing rule, Ramps, ⚑ Type on ink — computed, ⚑ Type scale (revision 1 shipped a font list with no system) (+1 more)

### Community 61 - "identity-transitions.ts"
Cohesion: 0.28
Nodes (7): DeletionReceipt, IdentityTransitionEvent, IdentityTransitionPlan, LocationDisposition, LocationInput, scrubCredential(), workspaceIdentityTransitions

### Community 62 - "Nimanto v0.4.0 — Inspectable History"
Cohesion: 0.13
Nodes (13): 1. Stored history and export v2, 2. Packet history and assurance comparison, 3. Record-review queue, 4. Literal profile and match comparison, 5. Application cohort counts, Correctness and privacy, Nimanto v0.4.0 — Inspectable History, Surface inventory (+5 more)

### Community 63 - "app/page.tsx"
Cohesion: 0.06
Nodes (20): metadata, viewport, BOUNDARY, METHOD, metadata, Brand(), HUB, Mark() (+12 more)

### Community 64 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

### Community 65 - "Nimanto user-flow analysis"
Cohesion: 0.25
Nodes (5): 1. The intended flow, 3. Cross-cutting failure modes, 4. Constraints the fixes must respect, 5. Flow after the change, Nimanto user-flow analysis

### Community 66 - "Nimanto v0.2.0 — Colour & Material"
Cohesion: 0.25
Nodes (8): Colour & Material 002, Correctness, Nimanto v0.2.0 — Colour & Material, The mark, The website, The workbench, Unchanged, Verification

### Community 67 - "2. Where the candidate actually stalls"
Cohesion: 0.25
Nodes (8): 2. Where the candidate actually stalls, S1 — "I imported. Now what?" (entry cliff), S2 — Blocked match is a terminal screen, S3 — Applications are a flat list with a `<select>`, S4 — The funnel is buried and under-read, S5 — Silence is indistinguishable from nothing-happened, S6 — No way to get anywhere fast, S7 — The app lies when the API is down

### Community 68 - "government-dataset.ts"
Cohesion: 0.20
Nodes (13): GovernmentDatasetIngestion, LABELS, record(), text(), TrustedEvaluation, H1bSignalRecord, EmployerResolutionEvaluation, evaluateEmployerResolution() (+5 more)

### Community 77 - "external-action-lifecycle.ts"
Cohesion: 0.20
Nodes (9): ExternalActionLifecycle, ProviderActionExecutor, stores, ExternalActionProvider, ActionPayload, ActionResult, buildDeepLink(), executeProviderAction() (+1 more)

### Community 78 - "PacketHistoryPanel"
Cohesion: 0.29
Nodes (6): packetCanonicalDelta(), PacketHistoryPanel(), packetManifestDelta(), createScopedRequestGate(), ScopedRequestGate, ScopedRequestToken

### Community 79 - "Nimanto v0.5.3 — Proof Means Enforced"
Cohesion: 0.29
Nodes (6): Boundaries, Fixed, Included from v0.5.2, Nimanto v0.5.3 — Proof Means Enforced, Upgrade, Verify

### Community 80 - "Nimanto v0.4.1 — Action Before Analysis"
Cohesion: 0.13
Nodes (13): 1. Manual role drafts survive section changes, 2. Applications opens on the work, 3. Section focus clears the sticky header, 4. No-op profile saves no longer create history, 5. Completion copy comes from returned data, Nimanto v0.4.1 — Action Before Analysis, Public surface, Surface inventory (+5 more)

### Community 81 - "render-social-card.mjs"
Cohesion: 0.33
Nodes (4): assets, faces, modules, root

### Community 82 - "render-screenshots.mjs"
Cohesion: 0.29
Nodes (5): assets, publicAssets, root, siteOnly, workbenchOnly

### Community 83 - ".transaction"
Cohesion: 0.17
Nodes (3): PacketLifecycle, ApplicationRecord, ApplicationStatus

### Community 84 - "4. The mark"
Cohesion: 0.50
Nodes (4): 4.1 Concept and provenance, 4.2 Surfaces, 4.3 Hero specification ⚑, 4. The mark

### Community 85 - "6. Workbench"
Cohesion: 0.50
Nodes (4): 6.1 Restyle — ⚑ layout, not only colour, 6.2 Features, 6.3 Robustness, 6. Workbench

### Community 86 - "canonicalHash"
Cohesion: 0.26
Nodes (9): publishMatch(), uniqueEvidenceIds(), fixture(), stores, stores, v041FixtureSql, canonicalHash(), createReceipt() (+1 more)

### Community 88 - "version-sync.test.mjs"
Cohesion: 0.29
Nodes (10): countOccurrences(), markdownSection(), releaseAssetPaths(), validateVersionSync(), versionTextChecks(), workspacePackages, checks, fixtureFiles (+2 more)

### Community 91 - "database/src/index.ts"
Cohesion: 0.29
Nodes (5): DashboardRead, FastifyRequest, stores, LocalIdentity, SessionIdentity

### Community 92 - "Nimanto v0.5.2 — Ask Clearly, Return Exactly"
Cohesion: 0.25
Nodes (7): Improved, Maintenance, Nimanto v0.5.2 — Ask Clearly, Return Exactly, Provenance, Still out of scope, Upgrade, Verification

### Community 93 - "applications-workbench.ts"
Cohesion: 0.16
Nodes (16): ApplicationNoteDraft, ApplicationsWorkbench, ApplicationsWorkbenchAction, applicationsWorkbenchReducer(), ApplicationsWorkbenchState, ApplicationViewState, closeDraft(), createApplicationsWorkbenchState() (+8 more)

### Community 95 - "What changed"
Cohesion: 0.12
Nodes (15): Candidate-approved evidence intake, Durable discovery and dataset editions, Exact-approved external actions, Exact-snapshot match publication, Flow and responsive polish, Nimanto v0.4.2 — Exact Review, Exact Commit, One application transition policy, Resumable deletion write fence (+7 more)

### Community 96 - "screenshot-evidence.mjs"
Cohesion: 0.13
Nodes (17): apiPort, repository, sitePort, update, assertScreenshotBytesMatch(), assertScreenshotVisuallyMatches(), buildScreenshotEvidence(), collectFiles() (+9 more)

### Community 97 - "Nimanto Domain Language"
Cohesion: 0.33
Nodes (5): Evidence and explanation, Nimanto Domain Language, Operations, Preparation and action, Role intake

### Community 98 - "packet-lifecycle.ts"
Cohesion: 0.08
Nodes (33): ArtifactManifest, PacketArtifactInspector, PacketArtifactRenderer, verifiedArtifactBytes(), verifyPacketArtifacts(), stores, PacketRecord, CanonicalPacket (+25 more)

### Community 99 - ".execute"
Cohesion: 0.17
Nodes (9): ExternalActionRecord, AssuranceFinding, AssuranceFindingCode, assurePacket(), PacketAssuranceResult, ExternalActionEvent, transitionExternalAction(), transitions (+1 more)

### Community 102 - "deletion-coordinator.ts"
Cohesion: 0.18
Nodes (3): DeletionCoordinator, DeletionRun, RemovePath

### Community 105 - "verify-sbom-freshness.mjs"
Cohesion: 0.36
Nodes (11): compareDocuments(), comparePurlSets(), cyclonedxPurls(), registryPropertyName(), sortedPurls(), spdxPurls(), stableCycloneDx(), stableRegistryMetadata() (+3 more)

### Community 106 - "workbench-mutations.ts"
Cohesion: 0.24
Nodes (7): createWorkbenchMutations(), MutationAdapters, RefreshOutcome, WorkbenchMutation, WorkbenchMutationOutcome, WorkbenchMutations, harness()

### Community 107 - "migrations.ts"
Cohesion: 0.33
Nodes (8): backfillIntegrityHashes(), migrations, freshSchemaSql, schemaVersion2Sql, schemaVersion3Sql, schemaVersion4Sql, schemaVersion5Sql, schemaVersion7Sql

### Community 108 - "discovery-cycle.ts"
Cohesion: 0.29
Nodes (8): Provider, ProviderJobsFetcher, CurrentRole, normalized(), normalizeRoleObservation(), required(), RoleObservation, RoleSource

### Community 109 - "Nimanto v0.5.4 — Work Stays Yours"
Cohesion: 0.29
Nodes (6): Boundaries, Fixed, Improved, Nimanto v0.5.4 — Work Stays Yours, Upgrade, Verify

### Community 112 - "Nimanto v0.5.5 — Same Boundaries, Fresh Runtime"
Cohesion: 0.33
Nodes (5): Boundaries, Improved, Nimanto v0.5.5 — Same Boundaries, Fresh Runtime, Upgrade, Verify

### Community 113 - "calendar-export.ts"
Cohesion: 0.20
Nodes (11): buildFollowUpCalendar(), calendarDate(), encoder, escapeCalendarText(), foldCalendarLine(), FollowUpApplication, utcStamp(), RFC-5545 (+3 more)

### Community 117 - "Nimanto v0.7.0 — One Place for Each Promise"
Cohesion: 0.29
Nodes (6): Boundaries, Deepened, Nimanto v0.7.0 — One Place for Each Promise, Preserved, Upgrade, Verify

## Knowledge Gaps
- **717 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+712 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ApplicationStatus` connect `.transaction` to `packet-lifecycle.ts`, `store.ts`, `workspace.tsx`, `derive.ts`, `calendar-export.ts`, `types.ts`, `buildServer`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `NimantoStore` connect `NimantoStore` to `packet-lifecycle.ts`, `.execute`, `government-dataset.ts`, `iso`, `deletion-coordinator.ts`, `store.ts`, `EvidenceClaim`, `buildServer`, `.#mapAction`, `discovery-cycle.ts`, `external-action-lifecycle.ts`, `.runWorkerCycle`, `.transaction`, `canonicalHash`, `parsers/src/index.ts`, `database/src/index.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `Emblem()` connect `app/page.tsx` to `NimantoEmblem`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _717 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Nimanto Sources Licenses and Provider Gate` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._
- **Should `iso` be split into smaller, more focused modules?**
  _Cohesion score 0.11396011396011396 - nodes in this community are weakly interconnected._
- **Should `store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09686609686609686 - nodes in this community are weakly interconnected._