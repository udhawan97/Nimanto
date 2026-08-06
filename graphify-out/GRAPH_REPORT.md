# Graph Report - Nimanto  (2026-08-05)

## Corpus Check
- 96 files · ~502,362 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 915 nodes · 1282 edges · 63 communities (54 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c73b00bb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Nimanto Sources Licenses and Provider Gate
- Nimanto Initial Backend Plan
- Nimanto Architecture
- Nimanto Trust Privacy and Security Plan
- Nimanto Product Contract
- buildServer
- store.ts
- server.ts
- dependencies
- workspace.tsx
- dependencies
- README.md
- v0.1.0-slice-matrix.md
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
- documents/src/index.ts
- scripts
- compilerOptions
- matching.ts
- types.ts
- database/tsconfig.json
- database/tsconfig.build.json
- domain/tsconfig.json
- compilerOptions
- package.json
- compilerOptions
- parsers/src/index.ts
- compilerOptions
- compilerOptions
- external-actions.ts
- domain/src/index.ts
- api/tsconfig.json
- store.test.ts
- worker/tsconfig.json
- worker/tsconfig.build.json
- documents/tsconfig.json
- parsers/tsconfig.json
- providers/tsconfig.json
- worker/src/main.ts
- layout.tsx
- First release
- keywords
- engines
- repository
- AGENTS.md
- next.config.ts
- next-env.d.ts
- sw.js
- CODE_OF_CONDUCT.md
- GOVERNANCE.md

## God Nodes (most connected - your core abstractions)
1. `buildServer()` - 81 edges
2. `NimantoStore` - 57 edges
3. `compilerOptions` - 18 edges
4. `iso()` - 17 edges
5. `scripts` - 16 edges
6. `matchJob()` - 14 edges
7. `canonicalHash()` - 14 edges
8. `Nimanto Trust Privacy and Security Plan` - 14 edges
9. `EvidenceClaim` - 13 edges
10. `Nimanto Architecture` - 13 edges

## Surprising Connections (you probably didn't know these)
- `parseEvidenceUpload()` --calls--> `parseEvidenceFile()`  [EXTRACTED]
  apps/api/src/server.ts → packages/parsers/src/index.ts
- `buildServer()` --calls--> `inspectPacketArtifacts()`  [EXTRACTED]
  apps/api/src/server.ts → packages/documents/src/index.ts
- `buildServer()` --calls--> `renderPacketArtifacts()`  [EXTRACTED]
  apps/api/src/server.ts → packages/documents/src/index.ts
- `buildServer()` --calls--> `assurePacket()`  [EXTRACTED]
  apps/api/src/server.ts → packages/domain/src/assurance.ts
- `buildServer()` --calls--> `transitionExternalAction()`  [EXTRACTED]
  apps/api/src/server.ts → packages/domain/src/external-actions.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tenant Isolation Defense in Depth** — docs_planning_architecture_postgresql_rls_defense, docs_planning_architecture_single_candidate_tenancy, docs_planning_trust_and_security_tenant_authorization, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Confirmed Evidence to Match Flow** — docs_planning_architecture_confirmed_evidence_lifecycle, docs_planning_product_contract_career_evidence_vault, docs_planning_product_contract_evidence_states, docs_planning_product_contract_overall_match_bands, docs_planning_backend_plan_slice_1_evidence_to_match [INFERRED 0.85]
- **Review Before External Action** — docs_planning_architecture_no_external_effects_through_slice_3, docs_planning_product_contract_source_action_contract, docs_planning_product_contract_frozen_artifact_approval, docs_planning_backend_plan_slice_3_grounded_packet [INFERRED 0.95]

## Communities (63 total, 9 thin omitted)

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

### Community 5 - "buildServer"
Cohesion: 0.08
Nodes (18): buildServer(), evidencePreviewHash(), seedDemo(), apps, setup(), EvidenceRow, iso(), mapEvidence() (+10 more)

### Community 6 - "store.ts"
Cohesion: 0.10
Nodes (21): FastifyRequest, schemaSql, ApplicationRecord, AssuranceRecord, ExternalActionRecord, H1bSignalRecord, InvitationRecord, JobRecord (+13 more)

### Community 7 - "server.ts"
Cohesion: 0.06
Nodes (45): loadOptions(), localBootstrapSecret(), NimantoApiOptions, options, ArtifactManifest, fastify, H1B_LABELS, identity() (+37 more)

### Community 8 - "dependencies"
Cohesion: 0.04
Nodes (44): dependencies, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui (+36 more)

### Community 9 - "workspace.tsx"
Cohesion: 0.07
Nodes (30): metadata, Brand(), baseCommands, CommandPalette(), Action, ActionRunner, Actions(), api() (+22 more)

### Community 10 - "dependencies"
Cohesion: 0.05
Nodes (38): dependencies, @fontsource-variable/ibm-plex-sans, @fontsource-variable/jetbrains-mono, @fontsource-variable/space-grotesk, lucide-react, next, react, react-dom (+30 more)

### Community 11 - "README.md"
Cohesion: 0.05
Nodes (37): Acknowledgments, Contributing, Authentication, Data lifecycle, External actions, Nimanto system architecture, Package seams, Persistence (+29 more)

### Community 13 - "documents/package.json"
Cohesion: 0.07
Nodes (27): docx, dependencies, docx, fflate, @nimanto/domain, pdf-lib, pdfjs-dist, devDependencies (+19 more)

### Community 14 - "parsers/package.json"
Cohesion: 0.07
Nodes (27): dependencies, fflate, @nimanto/domain, pdfjs-dist, saxes, devDependencies, pdf-lib, @types/node (+19 more)

### Community 15 - "Run and operate the local beta"
Cohesion: 0.13
Nodes (15): A packet is blocked, Back up and restore, Data locations, Docker self-hosting, Execute is disabled, Gmail or Outlook is unavailable, Private invitations, Requirements (+7 more)

### Community 16 - "database/package.json"
Cohesion: 0.09
Nodes (22): @electric-sql/pglite, dependencies, @electric-sql/pglite, @nimanto/domain, devDependencies, @types/node, typescript, vitest (+14 more)

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

### Community 26 - "documents/src/index.ts"
Cohesion: 0.21
Nodes (15): CanonicalPacket, createDocx(), createPdf(), decodeXml(), DocumentInspection, docxText(), inspectPacketArtifacts(), normalizedContent() (+7 more)

### Community 27 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, build, check, clean, dev, dev:all, format, format:check (+8 more)

### Community 28 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, exclude, extends (+4 more)

### Community 29 - "matching.ts"
Cohesion: 0.29
Nodes (13): bandFromValue(), blockerText(), evidenceMatches(), evidenceStrength(), IDENTITY_PATTERNS, locationBlockers(), matchJob(), normalizedCandidateProjection() (+5 more)

### Community 30 - "types.ts"
Cohesion: 0.18
Nodes (10): CoverageState, EvidenceConfidence, EvidenceState, EvidenceStatus, EvidenceStrength, JobForMatching, MatchBand, MatchBlocker (+2 more)

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
Cohesion: 0.18
Nodes (10): author, bugs, url, description, homepage, license, name, packageManager (+2 more)

### Community 36 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 37 - "parsers/src/index.ts"
Cohesion: 0.32
Nodes (15): assertArchiveEntryLimits(), assertMimeType(), assertNoProhibitedDocumentContent(), claimsFromText(), cleanLine(), csvRows(), decodeSafeText(), EvidenceFileInput (+7 more)

### Community 38 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 39 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, extends, include (+2 more)

### Community 40 - "external-actions.ts"
Cohesion: 0.24
Nodes (7): AssuranceFinding, AssuranceFindingCode, assurePacket(), PacketAssuranceResult, ExternalActionEvent, transitionExternalAction(), transitions

### Community 41 - "domain/src/index.ts"
Cohesion: 0.44
Nodes (6): EmployerResolutionEvaluation, evaluateEmployerResolution(), freshH1bLabel(), normalizeEmployerName(), resolveEmployer(), wilson()

### Community 42 - "api/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, src, test, ../../tsconfig.base.json

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

### Community 52 - "worker/src/main.ts"
Cohesion: 0.50
Nodes (6): bootstrapSecret(), cycle(), loopbackApiOrigin(), nextDelay(), runCycle(), WorkerSource

### Community 55 - "layout.tsx"
Cohesion: 0.33
Nodes (3): metadata, viewport, ServiceWorker()

### Community 56 - "First release"
Cohesion: 0.29
Nodes (6): Deliberate beta limits, First release, Included, Locally verified from the release tree, Nimanto v0.1.0 — local beta, Release gates

### Community 57 - "keywords"
Cohesion: 0.33
Nodes (6): keywords, career-tools, evidence, h1b, job-search, local-first

### Community 63 - "engines"
Cohesion: 0.67
Nodes (3): engines, node, pnpm

### Community 64 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

## Knowledge Gaps
- **424 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+419 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildServer()` connect `buildServer` to `server.ts`, `external-actions.ts`, `domain/src/index.ts`, `documents/src/index.ts`, `matching.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `NimantoStore` connect `buildServer` to `store.test.ts`, `store.ts`, `server.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `matchJob()` connect `matching.ts` to `store.test.ts`, `buildServer`, `server.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _424 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Nimanto Sources Licenses and Provider Gate` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._
- **Should `buildServer` be split into smaller, more focused modules?**
  _Cohesion score 0.07589781562384303 - nodes in this community are weakly interconnected._
- **Should `store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10333333333333333 - nodes in this community are weakly interconnected._