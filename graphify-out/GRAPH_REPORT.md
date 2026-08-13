# Graph Report - Nimanto  (2026-08-13)

## Corpus Check
- 145 files · ~2,873,345 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1370 nodes · 2158 edges · 92 communities (81 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ebf58ac5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Nimanto Sources Licenses and Provider Gate
- Nimanto Initial Backend Plan
- Nimanto Architecture
- Nimanto Trust Privacy and Security Plan
- Nimanto Product Contract
- NimantoStore
- store.ts
- packet-lifecycle.ts
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
- web/tsconfig.json
- devDependencies
- sanitize-sbom.mjs
- validate-sbom.mjs
- parsers/src/index.ts
- scripts
- compilerOptions
- matching.ts
- Durable discovery schedules
- database/tsconfig.json
- database/tsconfig.build.json
- domain/tsconfig.json
- compilerOptions
- package.json
- compilerOptions
- ExternalActionLifecycle
- compilerOptions
- compilerOptions
- NimantoEmblem
- NimantoEmblem
- api/tsconfig.json
- derive.test.ts
- derive.ts
- api
- worker/tsconfig.json
- worker/tsconfig.build.json
- documents/tsconfig.json
- parsers/tsconfig.json
- providers/tsconfig.json
- .assure
- worker.ts
- Nimanto v0.3.0 — Evidence Thread
- Nimanto redesign — Colour & Material 002
- layout.tsx
- First release
- keywords
- DeletionCoordinator
- buildServer
- 2. The palette
- applications.ts
- Nimanto v0.4.0 — Inspectable History
- iso
- repository
- Nimanto user-flow analysis
- Nimanto v0.2.0 — Colour & Material
- 2. Where the candidate actually stalls
- domain/src/index.ts
- AGENTS.md
- next.config.ts
- next-env.d.ts
- sw.js
- CODE_OF_CONDUCT.md
- GOVERNANCE.md
- workspace/page.tsx
- EvidenceClaim
- Nimanto v0.4.1 — Action Before Analysis
- render-social-card.mjs
- render-screenshots.mjs
- 4. The mark
- 6. Workbench
- canonicalHash
- external-action-lifecycle.ts
- url.ts
- government-dataset.ts
- DiscoveryCycle
- What changed
- Nimanto Domain Language

## God Nodes (most connected - your core abstractions)
1. `NimantoStore` - 110 edges
2. `buildServer()` - 79 edges
3. `canonicalHash()` - 34 edges
4. `NimantoEmblem` - 23 edges
5. `iso()` - 22 edges
6. `scripts` - 18 edges
7. `compilerOptions` - 18 edges
8. `Applications()` - 15 edges
9. `EvidenceClaim` - 15 edges
10. `NimantoEmblem` - 14 edges

## Surprising Connections (you probably didn't know these)
- `evidenceMatches()` --indirect_call--> `token()`  [INFERRED]
  packages/domain/src/matching.ts → apps/web/test/tokens.test.ts
- `previewHash()` --calls--> `canonicalHash()`  [EXTRACTED]
  apps/api/src/evidence-intake.ts → packages/domain/src/receipts.ts
- `publishMatch()` --calls--> `matchJob()`  [EXTRACTED]
  apps/api/src/match-publication.ts → packages/domain/src/matching.ts
- `seedDemo()` --calls--> `canonicalHash()`  [EXTRACTED]
  apps/api/src/server.ts → packages/domain/src/receipts.ts
- `buildServer()` --calls--> `isApplicationTransitionLegal()`  [EXTRACTED]
  apps/api/src/server.ts → packages/domain/src/applications.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tenant Isolation Defense in Depth** — docs_planning_architecture_postgresql_rls_defense, docs_planning_architecture_single_candidate_tenancy, docs_planning_trust_and_security_tenant_authorization, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Confirmed Evidence to Match Flow** — docs_planning_architecture_confirmed_evidence_lifecycle, docs_planning_product_contract_career_evidence_vault, docs_planning_product_contract_evidence_states, docs_planning_product_contract_overall_match_bands, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Review Before External Action** — docs_planning_architecture_no_external_effects_through_slice_3, docs_planning_product_contract_source_action_contract, docs_planning_product_contract_frozen_artifact_approval, docs_planning_backend_plan_slice_3_grounded_packet [INFERRED 0.95]

## Communities (92 total, 11 thin omitted)

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

### Community 6 - "store.ts"
Cohesion: 0.09
Nodes (25): FastifyRequest, schemaSql, AssuranceHistoryRecord, AssuranceRecord, ClaimedSourceSchedule, DatasetEditionRecord, HistoryPage, InvitationRecord (+17 more)

### Community 7 - "packet-lifecycle.ts"
Cohesion: 0.14
Nodes (20): ArtifactManifest, PacketArtifactInspector, PacketArtifactRenderer, stores, CanonicalPacket, createDocx(), createPdf(), decodeXml() (+12 more)

### Community 8 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui (+38 more)

### Community 9 - "workspace.tsx"
Cohesion: 0.06
Nodes (36): Connection, ConnectionBanner(), ConnectionIndicator(), useConnection(), Action, ActionRunner, ApiError, Application (+28 more)

### Community 10 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, @fontsource/ibm-plex-mono, @fontsource/instrument-serif, @fontsource-variable/archivo, lucide-react, next, @nimanto/domain, react (+38 more)

### Community 11 - "README.md"
Cohesion: 0.05
Nodes (32): Acknowledgments, Contributing, Authentication, Data lifecycle, Durable discovery, External actions, Nimanto system architecture, Package seams (+24 more)

### Community 13 - "documents/package.json"
Cohesion: 0.07
Nodes (27): docx, dependencies, docx, fflate, @nimanto/domain, pdf-lib, pdfjs-dist, devDependencies (+19 more)

### Community 14 - "parsers/package.json"
Cohesion: 0.07
Nodes (27): dependencies, fflate, @nimanto/domain, pdfjs-dist, saxes, devDependencies, pdf-lib, @types/node (+19 more)

### Community 15 - "Run and operate the local beta"
Cohesion: 0.07
Nodes (28): A packet is blocked, An action is ambiguous, Back up and restore, Data locations, Docker self-hosting, Execute is disabled, Gmail or Outlook is unavailable, Inspect a workspace export (+20 more)

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
Cohesion: 0.12
Nodes (17): concurrently, cspell, @cyclonedx/cdxgen, devDependencies, concurrently, cspell, @cyclonedx/cdxgen, @playwright/test (+9 more)

### Community 24 - "sanitize-sbom.mjs"
Cohesion: 0.67
Nodes (3): hasMachineLocalPath(), paths, sanitize()

### Community 25 - "validate-sbom.mjs"
Cohesion: 0.40
Nodes (4): paths, releaseManifest, releaseWorkspaces, requiredPurls

### Community 26 - "parsers/src/index.ts"
Cohesion: 0.15
Nodes (24): EvidenceIntake, parseUpload(), previewHash(), requestObject(), requiredString(), reviewedProjection(), Upload, stores (+16 more)

### Community 27 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, check, clean, dev, dev:all, dev:core, format (+10 more)

### Community 28 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, exclude, extends (+4 more)

### Community 29 - "matching.ts"
Cohesion: 0.11
Nodes (28): channel(), css, luminance(), ratio(), token(), bandFromValue(), blockerText(), evidenceMatches() (+20 more)

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

### Community 37 - "ExternalActionLifecycle"
Cohesion: 0.22
Nodes (4): ExternalActionLifecycle, ExternalActionRecord, transitionExternalAction(), ExternalActionState

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
Cohesion: 0.07
Nodes (21): BOUNDARY, METHOD, Brand(), HUB, Mark(), PETALS, CommandPalette(), PaletteEntry (+13 more)

### Community 42 - "api/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

### Community 43 - "derive.test.ts"
Cohesion: 0.18
Nodes (19): Applications(), dateInputValue(), localDayInstant(), APPLICATION_MATCH_BUCKETS, applicationCohortCounts(), BOARD_COLUMNS, boardColumns(), canMove() (+11 more)

### Community 44 - "derive.ts"
Cohesion: 0.08
Nodes (25): DataControls(), ActionLike, ApplicationLike, ApplicationMatchBucket, ArtifactManifestLike, canonicalProfileInput(), CohortJobLike, CohortMatchLike (+17 more)

### Community 45 - "api"
Cohesion: 0.17
Nodes (19): Actions(), ActivityLedger(), api(), cadenceLabel(), EvidenceVault(), fileBase64(), human(), Jobs() (+11 more)

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

### Community 51 - ".assure"
Cohesion: 0.12
Nodes (4): PacketLifecycle, verifyPacketArtifacts(), PacketRecord, ExecutionReceipt

### Community 52 - "worker.ts"
Cohesion: 0.47
Nodes (6): bootstrapSecret(), cycle(), loopbackApiOrigin(), nextDelay(), runCycle(), WorkerCycleResult

### Community 53 - "Nimanto v0.3.0 — Evidence Thread"
Cohesion: 0.14
Nodes (13): 1. Private role narrowing, 2. Recorded application timelines, 3. Sponsorship provenance and freshness, 4. Match anatomy, 5. Tamper-evident local activity, 6. Packet review, Correctness, Nimanto v0.3.0 — Evidence Thread (+5 more)

### Community 54 - "Nimanto redesign — Colour & Material 002"
Cohesion: 0.18
Nodes (11): 0. Survey — what comparable open-source tools already ship, 10. Release ⚑, 1. Why, 3. Decisions, 5. Website, 7. Deferred — and what will _not_ change ⚑, 8. Files ⚑, 9. Verification ⚑ (+3 more)

### Community 55 - "layout.tsx"
Cohesion: 0.33
Nodes (3): metadata, viewport, ServiceWorker()

### Community 56 - "First release"
Cohesion: 0.29
Nodes (6): Deliberate beta limits, First release, Included, Locally verified from the release tree, Nimanto v0.1.0 — local beta, Release gates

### Community 57 - "keywords"
Cohesion: 0.33
Nodes (6): keywords, career-tools, evidence, h1b, job-search, local-first

### Community 59 - "buildServer"
Cohesion: 0.12
Nodes (22): verifiedArtifactBytes(), buildServer(), fastify, H1B_LABELS, historyOptions(), identity(), JsonObject, messageForError() (+14 more)

### Community 60 - "2. The palette"
Cohesion: 0.22
Nodes (9): 2. The palette, Ground, Materials, ⚑ Non-text contrast (WCAG 1.4.11 — borders, chips, focus rings need ≥3:1), Proportion — the governing rule, Ramps, ⚑ Type on ink — computed, ⚑ Type scale (revision 1 shipped a font list with no system) (+1 more)

### Community 61 - "applications.ts"
Cohesion: 0.33
Nodes (9): ApplicationRecord, APPLICATION_STATUSES, applicationTransitionNeedsConfirmation(), consequential, isApplicationTransitionLegal(), known(), legal, transitionApplication() (+1 more)

### Community 62 - "Nimanto v0.4.0 — Inspectable History"
Cohesion: 0.13
Nodes (13): 1. Stored history and export v2, 2. Packet history and assurance comparison, 3. Record-review queue, 4. Literal profile and match comparison, 5. Application cohort counts, Correctness and privacy, Nimanto v0.4.0 — Inspectable History, Surface inventory (+5 more)

### Community 63 - "iso"
Cohesion: 0.14
Nodes (3): seedDemo(), historyLimit(), iso()

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

### Community 68 - "domain/src/index.ts"
Cohesion: 0.16
Nodes (8): stores, v041FixtureSql, AssuranceFinding, AssuranceFindingCode, assurePacket(), PacketAssuranceResult, ExternalActionEvent, transitions

### Community 79 - "EvidenceClaim"
Cohesion: 0.42
Nodes (3): EvidenceRow, mapEvidence(), EvidenceClaim

### Community 80 - "Nimanto v0.4.1 — Action Before Analysis"
Cohesion: 0.13
Nodes (13): 1. Manual role drafts survive section changes, 2. Applications opens on the work, 3. Section focus clears the sticky header, 4. No-op profile saves no longer create history, 5. Completion copy comes from returned data, Nimanto v0.4.1 — Action Before Analysis, Public surface, Surface inventory (+5 more)

### Community 81 - "render-social-card.mjs"
Cohesion: 0.33
Nodes (4): assets, faces, modules, root

### Community 82 - "render-screenshots.mjs"
Cohesion: 0.29
Nodes (5): assets, publicAssets, root, siteOnly, workbenchOnly

### Community 84 - "4. The mark"
Cohesion: 0.50
Nodes (4): 4.1 Concept and provenance, 4.2 Surfaces, 4.3 Hero specification ⚑, 4. The mark

### Community 85 - "6. Workbench"
Cohesion: 0.50
Nodes (4): 6.1 Restyle — ⚑ layout, not only colour, 6.2 Features, 6.3 Robustness, 6. Workbench

### Community 86 - "canonicalHash"
Cohesion: 0.24
Nodes (11): Provider, ProviderJobsFetcher, publishMatch(), uniqueEvidenceIds(), fixture(), stores, canonicalHash(), canonicalize() (+3 more)

### Community 88 - "external-action-lifecycle.ts"
Cohesion: 0.18
Nodes (10): DeletionRun, RemovePath, ProviderActionExecutor, stores, ExternalActionProvider, ActionPayload, ActionResult, buildDeepLink() (+2 more)

### Community 90 - "url.ts"
Cohesion: 0.43
Nodes (5): Address, fetchAllowlistedJobPage(), isPrivateAddress(), Response, textFromPage()

### Community 91 - "government-dataset.ts"
Cohesion: 0.10
Nodes (27): loadOptions(), localBootstrapSecret(), NimantoApiOptions, GovernmentDatasetIngestion, LABELS, record(), text(), TrustedEvaluation (+19 more)

### Community 95 - "What changed"
Cohesion: 0.12
Nodes (15): Candidate-approved evidence intake, Durable discovery and dataset editions, Exact-approved external actions, Exact-snapshot match publication, Flow and responsive polish, Nimanto v0.4.2 — Exact Review, Exact Commit, One application transition policy, Resumable deletion write fence (+7 more)

### Community 97 - "Nimanto Domain Language"
Cohesion: 0.40
Nodes (4): Evidence and explanation, Nimanto Domain Language, Operations, Preparation and action

## Knowledge Gaps
- **595 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+590 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ApplicationStatus` connect `applications.ts` to `store.ts`, `workspace.tsx`, `derive.test.ts`, `derive.ts`, `.assure`, `buildServer`, `matching.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `NimantoStore` connect `NimantoStore` to `parsers/src/index.ts`, `domain/src/index.ts`, `ExternalActionLifecycle`, `store.ts`, `packet-lifecycle.ts`, `buildServer`, `EvidenceClaim`, `.assure`, `canonicalHash`, `external-action-lifecycle.ts`, `DeletionCoordinator`, `government-dataset.ts`, `DiscoveryCycle`, `iso`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `buildServer()` connect `buildServer` to `DeletionCoordinator`, `ExternalActionLifecycle`, `NimantoStore`, `url.ts`, `EvidenceClaim`, `.assure`, `canonicalHash`, `external-action-lifecycle.ts`, `parsers/src/index.ts`, `government-dataset.ts`, `applications.ts`, `DiscoveryCycle`, `iso`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _595 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Nimanto Sources Licenses and Provider Gate` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._
- **Should `NimantoStore` be split into smaller, more focused modules?**
  _Cohesion score 0.12315270935960591 - nodes in this community are weakly interconnected._
- **Should `store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08870967741935484 - nodes in this community are weakly interconnected._