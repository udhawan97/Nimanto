# Nimanto redesign — Colour & Material 002

**Date:** 2026-08-05
**Scope:** brand mark, public website, local workbench, README, plus flow-driven feature and robustness work.
**Target release:** `v0.2.0`
**Companion:** [user-flow analysis](2026-08-05-user-flow-analysis.md) · [emblem source](assets/nimanto-emblem.source.js)

> **Revision 2** — incorporates a four-reviewer council round. Every contrast figure below
> is computed, not quoted. Corrections that changed the design are marked ⚑.

---

## 0. Survey — what comparable open-source tools already ship

The user asked for feature inspiration from free, open-source, already-used GitHub
projects. Surveyed:

| Project                                                                                               | What it does that Nimanto did not                                                              | Taken?                                                                |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [Gsync/jobsync](https://github.com/Gsync/jobsync) — self-hosted tracker + career assistant, Next.js   | Application **analytics/funnel** view; **task/activity log**; Greenhouse & Lever board polling | Funnel → **F5**. Board polling already exists in Nimanto (schedules). |
| [kaylaehman/jobtrail](https://github.com/kaylaehman/jobtrail) — self-hosted tracker, JobSpy discovery | Discovery pipeline separated from tracking                                                     | Already covered by `apps/worker`                                      |
| [JobTrac](https://github.com/topics/job-application-tracker) — React/Firebase "command center"        | Single **command center** entry point rather than section-first navigation                     | → **F2**, **F3**                                                      |
| [Resume Matcher](https://resumematcher.fyi/) — open-source ATS matcher                                | Keyword/requirement **gap → what to add** feedback loop                                        | → **F4**                                                              |
| Common to nearly every tracker in the `job-application-tracker` topic                                 | **Kanban pipeline board** over application status                                              | → **F1**                                                              |

Two patterns were surveyed and **rejected**: AI resume rewriting (Nimanto deliberately
labels model output "unverified local draft" and never auto-edits a packet), and email
inbox scraping for auto-status (violates "never infers an outcome from silence").

Six features ship (F1–F6). Five are deferred with reasons in §7. The gap between the
survey and what ships is deliberate, not an oversight.

## 1. Why

Nimanto ships a correct product wearing borrowed clothes: a light cobalt workbench
(`--color-paper: oklch(98.5% …)`, Space Grotesk / IBM Plex Sans / JetBrains Mono) that
predates the brand. The brand now has a finished, sampled identity — **Colour & Material
002** — derived from a real sculptural 3D emblem whose source is vendored at
[`assets/nimanto-emblem.source.js`](assets/nimanto-emblem.source.js).

Three concrete costs:

1. **The mark is a flat blue `N`.** The real mark is a notched invitation card whose
   corner folds back over a vermilion light — the product thesis as an object.
2. **The palette encodes product meaning the UI throws away.** Emerald is "one confirmed
   state, small". Vermilion is "live state, alerts, one link at a time". Nimanto's whole
   product is _confirmed vs pending vs live_. The palette is a state vocabulary.
3. **The workbench dead-ends** — seven stalls, catalogued in the
   [flow analysis](2026-08-05-user-flow-analysis.md).

## 2. The palette

Sampled from the emblem. **⚑ All ratios below are computed (WCAG 2.x relative
luminance), not taken from the source file's labels — four of the source's six were
optimistic and two claimed AAA at sub-7.0 ratios.**

### Ground

| Token      | Hex       | Role                                                                              |
| ---------- | --------- | --------------------------------------------------------------------------------- |
| Ink        | `#0A0908` | The gallery. Every surface the mark sits on.                                      |
| Lacquer    | `#101013` | Raised surfaces, cards, sheets. **1.05:1 vs ink — a field, never a boundary.**    |
| Umber glow | `#241C14` | Atmosphere only. Radial washes behind the mark. **Never a fill, never a border.** |

### Materials

| Token        | Hex       | Role                                                               |
| ------------ | --------- | ------------------------------------------------------------------ |
| Ivory stone  | `#D5CCB9` | The only large light field.                                        |
| Aged brass   | `#B8935A` | Fold edges, hub ring. A line weight, never a fill.                 |
| Inlay brass  | `#9D7C4A` | Recessed rules and hairlines.                                      |
| Deep emerald | `#16543F` | The seed. **Fill only — 2.25:1, never carries text or a glyph.**   |
| Vermilion    | `#D6472C` | The light behind the mark. Live state, alerts, one link at a time. |

### Ramps

| Ramp      | 100       | 200       | 300       | 400       | 500       | 600       | 700       |
| --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| Brass     | `#2E2415` | `#57431F` | `#7C6134` | `#9D7C4A` | `#B8935A` | `#D0AF7E` | `#E4CDA6` |
| Stone     | `#1C1A17` | `#3A362F` | `#6E665C` | `#8B8175` | `#B3AA9C` | `#D5CCB9` | `#E8E1D4` |
| Vermilion | `#3E1610` | `#6B2519` | `#B33A24` | `#D6472C` | `#E8785F` | —         | —         |
| Emerald   | `#0A231B` | `#113E2F` | `#16543F` | `#1F7358` | `#63B69B` | —         | —         |

### ⚑ Type on ink — computed

| Token         | Hex       | Computed    | Level            | Use                                               |
| ------------- | --------- | ----------- | ---------------- | ------------------------------------------------- |
| Bone          | `#E8E1D4` | **15.30:1** | AAA              | Headlines, wordmark, primary reading              |
| Ivory stone   | `#D5CCB9` | **12.47:1** | AAA              | Display type only, never body copy                |
| Stone         | `#B3AA9C` | **8.67:1**  | AAA              | Body copy, long-form paragraphs                   |
| Muted         | `#8B8175` | **5.21:1**  | AA               | Placards, labels, metadata — **never below 14px** |
| Brass         | `#B8935A` | **6.97:1**  | **AA (not AAA)** | Links, quiet emphasis                             |
| Vermilion 500 | `#E8785F` | **6.90:1**  | **AA (not AAA)** | The only red allowed on text                      |
| Brass 600     | `#D0AF7E` | **9.58:1**  | AAA              | ⚑ Use where brass must reach AAA                  |
| Emerald 500   | `#63B69B` | **8.24:1**  | AAA              | ⚑ The only emerald allowed on text                |

### ⚑ Non-text contrast (WCAG 1.4.11 — borders, chips, focus rings need ≥3:1)

Structural strokes must be **brass-300 `#7C6134` (3.43:1) or lighter**.
brass-100 (1.31:1) and brass-200 (2.11:1) are **decorative fills only** — a
brass-100 panel border is invisible and was in revision 1.

| Purpose                                          | Token               | vs ink                                                             |
| ------------------------------------------------ | ------------------- | ------------------------------------------------------------------ |
| Panel / card border                              | brass-300 `#7C6134` | 3.43:1                                                             |
| Emphasised border, focus ring                    | brass-400 `#9D7C4A` | 5.13:1                                                             |
| Table hairline (decorative, paired with spacing) | brass-200 `#57431F` | 2.11:1 — allowed **only** where the row is also separated by ≥12px |
| Divider on lacquer                               | stone-300 `#6E665C` | 3.52:1                                                             |

### Proportion — the governing rule

**Ink 74 · Stone 16 · Brass 7 · Vermilion 2 · Emerald 1.**

> Ink carries almost everything; stone does the reading; brass is a line weight, not a
> fill; vermilion earns its place once per screen. Emerald appears at the seed and
> effectively nowhere else.

### ⚑ Type stack — verified package names

`@fontsource-variable/archivo@5.3.0` (variable) ·
`@fontsource/ibm-plex-mono@5.3.0` (**static** 400 + 500) ·
`@fontsource/instrument-serif@5.3.0` (**static** 400 + italic).

`@fontsource-variable/ibm-plex-mono` and `@fontsource-variable/instrument-serif` **do not
exist on npm** — revision 1 named both. Five faces total, self-hosted, zero external
requests preserved. All OFL-1.1.

### ⚑ Type scale (revision 1 shipped a font list with no system)

| Token                            | Size                            | Line-height | Tracking        | Face             |
| -------------------------------- | ------------------------------- | ----------- | --------------- | ---------------- |
| `--text-display`                 | `clamp(3rem, 7vw, 6.5rem)`      | 1.02        | −0.03em         | Instrument Serif |
| `--text-display-s`               | `clamp(2.25rem, 4.5vw, 3.5rem)` | 1.08        | −0.02em         | Instrument Serif |
| `--text-3xl` … `--text-lg`       | 2.49 / 2.07 / 1.73 / 1.44 rem   | 1.2 → 1.35  | −0.01em         | Archivo 500/600  |
| `--text-base` / `--text-sm`      | 1 / 0.875 rem                   | 1.65        | 0               | Archivo 400      |
| `--text-mono` / `--text-placard` | 0.8125 / 0.6875 rem             | 1.7 / 2.0   | 0.02em / 0.18em | IBM Plex Mono    |

**Instrument Serif appears at `--text-display-s` and above only.** It never sets body
copy, never sets a label, never appears in the workbench outside the wordmark. That rule
is what keeps the serif an event rather than a texture.

## 3. Decisions

**D1 — Dark only.** The palette defines no light ground; every ratio is computed against
ink. A light mode would be a second, unsampled palette. ⚑ Requires `color-scheme: dark`
on `:root` (native selects, scrollbars, autofill would otherwise render light UA chrome
on ink — the e2e journey drives three native `<select>`s), and a
`@media (forced-colors: active)` block restoring borders, since "depth from value"
collapses in Windows High Contrast. ⚑ Stated as a tradeoff in the release notes:
readers who need light-on-dark disabled have no opt-out. There is no light theme today
either, so this is net-neutral, not a regression.

**D2 — Bundle Three.js, pinned.** ⚑ `three@0.185.1`, MIT, **zero runtime dependencies**
(verified against the registry). The emblem source was tuned against r160; r185 uses no
removed API (`outputColorSpace`, `ACESFilmicToneMapping`, `MeshPhysicalMaterial`,
`ExtrudeGeometry` all current) but tone-mapping defaults shifted in that range, so the
lighting rig is re-checked visually after the bump. Never CDN: `output: "export"` plus a
`Content-Security-Policy` meta tag (⚑ new — `apps/api` registers helmet with
`contentSecurityPolicy: false` and a static Pages deploy sends no header, so today the
no-external-request posture is asserted but not enforced).

**D3 — 3D on the website. Not in the workbench.** A tool used for an hour should not run
a render loop. The workbench gets the flat SVG mark.

**D4 — README animation is a hand-authored animated SVG.** GitHub runs no JS. An
animated SVG needs no toolchain, no ffmpeg in CI, stays ~6 KB, and is crisp at any size.
⚑ It must use **SMIL** (`<animateTransform>`), not CSS keyframes — CSS inside an SVG
loaded via `<img>` is inconsistently animated by GitHub's proxy. ⚑ It must have a
**transparent ground**, not an ink plate, or it renders as a black box on GitHub's light
theme.

**D5 — Every shipped feature is frontend-only over the existing API — with one
exception.** ⚑ F1 requires a **server-side domain transition guard**; see §6.2. A
frontend-only gate is not a gate.

**⚑ D6 — Single release, phased internally.** The council proposed splitting into three
releases. The user directed one. Accepted as directed, with the risk bought down by
sequencing: **R3 (tests) lands first**, then tokens, then chrome, then features, with
`pnpm check` green at each phase boundary. Rewriting ~4,700 lines with one e2e journey as
the entire safety net is the real risk, and tests-first is what removes it.

## 4. The mark

### 4.1 Concept and provenance

⚑ The vendored source's file header says "Two marks: A and B" — **its own header is
stale**. The code implements three concepts and defaults to `C`
(`this._concept = 'C'`, `this.fold.visible = k === 'C'`). We ship **`C`, the invitation
fold**: a notched, jaali-pierced card whose corner peels back on a hinge to reveal
vermilion light behind it. `A` and `B` stay behind a prop; they are already written.

⚑ **Provenance:** the emblem is a Nimanto brand artifact supplied by the project owner —
first-party work, not third-party code. `THIRD_PARTY_NOTICES.md:17` ("No third-party
application source code is bundled") therefore stays true. `three` is the only new
third-party runtime dependency and gets a row in the
`docs/planning/sources-and-licenses.md` ledger, per the project's own gate.

### 4.2 Surfaces

| Surface                  | Form                                   | File                                  |
| ------------------------ | -------------------------------------- | ------------------------------------- |
| Website hero             | WebGL, live                            | `emblem.tsx` + `emblem-core.ts`       |
| README                   | Animated SVG, SMIL, transparent ground | `public/assets/emblem-animated.svg`   |
| App icon / favicon / PWA | Static SVG                             | `public/assets/icon.svg`              |
| Workbench chrome         | Static SVG, 20px                       | `components/brand.tsx`                |
| Social card              | Static SVG **and** committed PNG       | `public/assets/social-card.{svg,png}` |

⚑ The PNG is what `layout.tsx` OpenGraph actually points at. No rasterizer is in
`devDependencies` and D4 rules out adding one — the PNG is produced with the Playwright
Chromium already installed for e2e, via `scripts/render-social-card.mjs`, and committed.

### 4.3 Hero specification ⚑

Revision 1 gave the headline surface one sentence. Concretely:

- **Size:** emblem occupies 46% of viewport height, floor 320px, ceiling 620px. Centred
  on the optical axis (52% from top, not 50%).
- **Ground:** ink, with a single umber-glow (`#241C14`) radial wash behind the mark at
  40% viewport width — ⚑ this is umber's only home in the entire system.
- **Lighting rig:** the palette is a material brief. Key `#FFF1E0` at 2.5 from upper
  right; rim `#FFD3A0` at 1.5 from rear left; fill `#93AEC9` at 0.45; a vermilion point
  light behind the fold. Ivory face, brass edge, vermilion behind the notch.
- **Viewport unit:** `100dvh`, not `100vh` — the mobile URL-bar trap.
- **Scroll:** the emblem scales to 0.88 and drifts up as the thesis band arrives, then
  the wordmark locks into the sticky header. It does not simply scroll away; that is
  what makes the page read as dimensional rather than as a picture at the top.
- **Ceremony:** pointer-down runs a 2.9s fold-open-and-close, returns to rest, leaves no
  state. Idempotent, re-triggerable, never a navigation.
- **Reduced motion:** one rendered frame at the assembled rest pose, render loop never
  started (`this.frame(true)`, no `requestAnimationFrame`).
- **Fallback ladder:** WebGL → live. Reduced-motion → one frame. WebGL fails or `three`
  fails → the static SVG mark scaled to the same box. Never a blank hero.
- ⚑ **Budget:** landing-route JS ≤ 700 KB gzipped including `three`; the workbench route
  must not import it at all. Asserted in §9.

## 5. Website

Ink ground, six movements. ⚑ Revision 1 was a re-skin of the existing page with hairline
rules; each band now carries a device that could not appear on another site.

```
00  HERO         Full-bleed ink. The emblem IS the page. Umber wash behind it.
                 Wordmark in Instrument Serif beneath. One line. Scroll cue.
01  THESIS       "Evidence first. Applications second." Display serif, and a
                 vertical brass rule that draws itself as the band enters.
02  METHOD       Collect → Compare → Prepare → Approve. Four plates on a single
                 continuous jaali-pierced brass spine; numerals in mono, offset
                 into the margin so the spine reads as one object, not four cards.
03  RAIL         The live synthetic example on lacquer. Emerald seed = supported,
                 vermilion = blocker. Once each. The requirement→evidence line is
                 drawn, not implied.
04  BOUNDARY     What Nimanto refuses to do. Three statements, ivory-stone display
                 on ink, no card, no box — the only large light field in the system.
05  RUN IT       Install block. IBM Plex Mono on lacquer, brass-300 border,
                 copy-to-clipboard with a mono confirmation placard.
    FOOTER
```

### ⚑ Spacing contract — applies to **both** routes

Revision 1 scoped this to the website; the user said "even in the app". Encoded as
tokens, applied to `/` and `/workspace/`, verified by the Playwright check in §9.3.

**Vertical**

| Relationship | Minimum |
| ------------------------------------- | ----------------------------- | --- |
| Section band block padding | `clamp(88px, 11vh, 168px)` |
| Heading → its own body copy | **20px**, never collapsed |
| Eyebrow / placard → heading | 14px |
| Panel heading → panel body | 18px |
| Card internal padding | 20px (24px ≥768px) |
| List item → list item | 12px |
| Label → input | 8px; input → field note | 6px |
| Any two text elements sharing an edge | ≥16px, or a rule between them |
| Two headings adjacent | forbidden |

**Horizontal**

| Relationship          | Minimum                          |
| --------------------- | -------------------------------- |
| Table cell padding    | 14px inline                      |
| Chip internal padding | 10px inline; chip → chip gap 8px |
| Sidebar nav item      | 12px inline, 10px block          |
| Body measure          | ≤68ch; display measure ≤20ch     |

**Mechanism:** a single `.flow > * + *` owner applying `margin-block-start`, so the rule
is not re-invented per file. Line-height floors: 1.5 body, 1.02–1.08 display, 1.7 mono.

### Motion

Assembly on load, pointer parallax on the emblem, one scroll-linked reveal per band
(opacity + 12px rise, 420ms, `cubic-bezier(.16,1,.3,1)`). All behind
`prefers-reduced-motion`.

## 6. Workbench

### 6.1 Restyle — ⚑ layout, not only colour

Revision 1 changed colour assignments only, which would have shipped the same screens in
different colours. Added:

- **Density pass** across all eight row grammars (`.table-row`, `.schedule-row`,
  `.job-row`, `.packet-row`, `.action-row`, `.evidence-item`, `.requirement`,
  `.signal-list article`) against the horizontal contract above.
- **Panel hierarchy:** one heading level per panel, mono placard above it, never two
  headings adjacent.
- **Empty states** designed rather than defaulted — every one names the next action.
- Sidebar: ink, brass-300 hairline right edge, active item marked by a **vermilion 2px
  spine**, not a filled block.
- Panels: lacquer `#101013`, **brass-300 border** ⚑ (brass-100 was invisible), no drop
  shadows.
- Mono for all IDs, hashes, timestamps.

**State vocabulary — ⚑ exact ramp steps, all ≥3:1 or ≥4.5:1 as required**

| State                      | Fill                    | Text / glyph                         | Border                       |
| -------------------------- | ----------------------- | ------------------------------------ | ---------------------------- |
| Confirmed / supported      | emerald-100 `#0A231B`   | **emerald-500 `#63B69B`** (8.24:1)   | emerald-400                  |
| Live / blocker / needs you | vermilion-100 `#3E1610` | **vermilion-500 `#E8785F`** (6.90:1) | vermilion-300                |
| Pending / neutral          | stone-100 `#1C1A17`     | stone-500 `#B3AA9C` (8.67:1)         | stone-300                    |
| Structure                  | —                       | —                                    | brass-300 `#7C6134` (3.43:1) |

⚑ Deep emerald `#16543F` (2.25:1) is a **fill only** and never carries a glyph. Status is
never colour-alone — every chip keeps its text label (trust model requirement, and the
e2e asserts chip text).

### 6.2 Features

**F1 — Pipeline board.** Five columns over the real `ApplicationStatus` union.

⚑ **This feature adds server-side domain code.** `PUT /v1/applications/:id/status`
validates union membership only; `store.setApplicationStatus` stamps `submitted_at` on
entry to `submitted_externally` and **never clears it**. A drag-to-commit board would let
one mis-drop write a false submission record into a product whose thesis is provenance.
Required:

- `transitionApplication()` in `packages/domain/`, mirroring the existing
  `external-actions.ts` state machine, **enforced in the API route** — not only in the UI.
- `submitted_externally` and `withdrawn` are **confirm-gated**: a drop opens an explicit
  confirm step. Never a bare drag commit. The other three drag freely.
- Leaving `submitted_externally` **clears `submitted_at`**. Retaining a stale timestamp
  silently is the worst of the three options.
- **Keyboard-equivalent movement** (move-to-column menu) — WCAG 2.1.1, and the trust
  model requires keyboard-complete flows. Drag is an enhancement, never the only path.
- **Failure policy:** optimistic move, revert on API error, surface the error. No silent
  desync.
- Table view stays; the board is a toggle.

**F2 — Next-step rail.** Derived, ordered: unconfirmed evidence → unmatched roles →
matches with blockers → packets awaiting assurance → actions awaiting approval. Pure
derived state. Replaces the static review queue.

**F3 — Command palette in the workbench.** ⚑ Honest framing: `command-palette.tsx` is a
three-item static `href` list. This is a **new command-source API on a reused dialog
shell**, not a reuse.

⚑ **Structural safety constraint:** palette entries carry a **navigation target only —
never a callback**, so no future edit can smuggle a gated call in. Explicitly never
reachable: `PUT /v1/actions/runtime`, `POST /v1/actions/:id/{approve,execute}`,
`POST /v1/packets/:id/{assure,approve}`, `POST /v1/evidence/:id/{confirm,reject}`,
`PUT /v1/applications/:id/status`, `DELETE /v1/data`, `DELETE /v1/session`,
`POST /v1/worker/cycle`.

⚑ Two e2e collisions to design around: entries use `role="option"` (never `button`, or
`getByRole("button", {name:"Overview"|"Refresh"})` goes ambiguous), and the index
renders **only while open** (or `getByText("TypeScript").toHaveCount(0)` finds a hidden
unconfirmed claim). The header trigger must be placed inside the existing hand-rolled
mobile focus interception at `workspace.tsx:485`, which the e2e asserts.

**F4 — Requirement → evidence.** Unmet requirements get an "add evidence for this"
affordance, deep-linking to the evidence form. ⚑ Prefills the claim **value only**;
never `sourceName`/`sourceLocator` from posting text (untrusted provider content — that
would attribute a candidate claim to a job ad). Created claim stays `pending`.

**F5 — Funnel on Overview.** ⚑ **Counts and the API's caveat string only. No conversion
rates.** The API ships "not a hiring probability" and the source ledger says no
hiring-probability claim is supportable; percentages off a `sampleSize` of 1–2
manufacture exactly that claim.

**F6 — Follow-up observation.** ⚑ Reframed. Baseline is
`max(createdAt, latest outcome.occurredAt)`; at 14+ days the row reads **"nothing
recorded since ⟨date⟩"** — an observation about the candidate's own record-keeping.
Never "stale", "cold", or any inferred status; the Applications page promises "Nimanto
never infers an outcome from silence." ⚑ Two evidence caveats: `updated_at` is bumped by
`setApplicationStatus` but **not** by `addOutcome`, so it is not an activity timestamp;
and `occurredAt` is caller-supplied and unvalidated. ⚑ Requires widening the web
`Application` type to declare `createdAt` — the API returns it, the type omits it.

### 6.3 Robustness

- **R1 — Error boundary** around the workbench with a recover action.
- **R2 — Connection state.** ⚑ The hardcoded `"Local service connected"` indicator at
  `workspace.tsx:447` is **deleted**, not left beside the real one — it currently claims
  "connected" whether or not anything is. Distinguishes browser-offline from
  API-unreachable. ⚑ `sw.js` falls back to `caches.match("./")` — serving the _landing
  page_ for a failed `/workspace/` navigation — which must be fixed or R2 never renders.
- **R3 — First web tests, landing first (D6).** `apps/web` has zero. Needs a vitest
  config with `happy-dom`. Covers derived logic: next-step precedence, staleness
  baseline, board column mapping, transition legality.
- **R4 — E2E extension** for the board (including keyboard move), the palette, the
  reduced-motion hero, and the API-down state.

## 7. Deferred — and what will _not_ change ⚑

| Candidate                                | Why not                                                        |
| ---------------------------------------- | -------------------------------------------------------------- |
| Follow-up reminders with dates           | Needs schema + endpoint. F6 gets most of it from derived data. |
| Saved views / filters                    | No client persistence layer.                                   |
| Light theme                              | See D1.                                                        |
| Pre-rendered WebP logo from the 3D scene | Needs ffmpeg in CI. D4 covers it.                              |
| AI resume rewriting, inbox scraping      | Surveyed and rejected — see §0.                                |
| Desktop packaging, signing               | Unchanged release gate in the product contract.                |

Release status note (v0.6.0): candidate-controlled follow-up dates are now
implemented as one stored date-only application field plus the existing derived
fallback. No notification, provider, outreach, or employer-state inference was
added. The remaining candidates in this historical table stay deferred.

**Unchanged and visible:** the README mermaid diagram keeps GitHub's default colours
(not themeable). `packages/documents` PDF/DOCX packet branding stays neutral — ATS-safe
variants must not carry brand colour. `prefers-color-scheme: light` users get an ink app
with no opt-out.

## 8. Files ⚑

Revision 1 missed thirteen files that would have shipped the old brand or a false claim.

**Design system & web**

```
tokens.css                                   rewritten (stale Hallmark header removed)
apps/web/app/globals.css                     rewritten — ink, spacing contract, color-scheme, forced-colors
apps/web/app/layout.tsx                      fonts, themeColor, CSP meta, metadata
apps/web/app/page.tsx                        rewritten — six movements
apps/web/components/emblem.tsx               NEW  React wrapper, lazy, fallback ladder
apps/web/components/emblem-core.ts           NEW  Three.js scene (from vendored source)
apps/web/components/brand.tsx                redrawn mark
apps/web/components/command-palette.tsx      command-source API (F3)
apps/web/components/workspace.tsx            restyle + F1,F2,F4,F5,F6; delete fake indicator
apps/web/components/error-boundary.tsx       NEW (R1)
apps/web/components/connection.tsx           NEW (R2)
apps/web/lib/derive.ts                       NEW  pure derived logic
apps/web/vitest.config.ts                    NEW (R3)
apps/web/test/derive.test.ts                 NEW (R3)
```

**Domain / API (F1 guard)**

```
packages/domain/src/applications.ts          NEW  transitionApplication()
packages/domain/test/applications.test.ts    NEW
packages/database/src/store.ts               clear submitted_at on leaving submitted
apps/api/src/server.ts                       enforce guard; version strings 0.1.0→0.2.0 (L458,476,479)
```

**⚑ Brand surfaces revision 1 missed**

```
apps/web/public/assets/icon.svg              redrawn
apps/web/public/assets/emblem-animated.svg   NEW (D4)
apps/web/public/assets/social-card.svg       redrawn
apps/web/public/assets/social-card.png       REGENERATED — OpenGraph points here
apps/web/public/manifest.webmanifest         theme_color #3157d5 → ink; background_color
apps/web/public/sw.js                        cache v1→v2; fix workspace offline fallback
docs/assets/nimanto-landing.png              REGENERATED — README hero, else a stale cobalt lie
docs/assets/nimanto-workbench.png            REGENERATED
scripts/render-social-card.mjs               NEW  Playwright Chromium rasterizer
```

**⚑ Release integrity revision 1 missed**

```
README.md                                    rewritten; badges off #3157d5; v0.1.0 sweep
THIRD_PARTY_NOTICES.md                       remove 3 dead fonts, add three + 3 fonts
ACKNOWLEDGMENTS.md                           SBOM links v0.1.0 → v0.2.0
docs/planning/sources-and-licenses.md        ledger row for three
docs/releases/nimanto-v0.2.0.{cdx,spdx}.json REGENERATED (v0.1.0 pair retained for provenance)
docs/releases/v0.2.0.md                      NEW
package.json                                 sbom:release paths parameterized; version
apps/{api,web,worker}/package.json           0.1.0 → 0.2.0
packages/{database,documents,domain,parsers,providers}/package.json   0.1.0 → 0.2.0
compose.yaml                                 image: nimanto:0.2.0
.github/ISSUE_TEMPLATE/bug.yml               placeholder v0.2.0
pnpm-lock.yaml                               three + fonts (CI runs --frozen-lockfile)
cspell.json                                  Archivo, Fontsource, vermilion, lacquer, umber,
                                             oklch, jaali + three identifiers
tests/e2e/local-beta.spec.ts                 extended (R4)
playwright.config.ts                         viewport projects for the spacing audit
graphify-out/                                refreshed before tag
```

## 9. Verification ⚑

Revision 1 listed five checks; three could not execute. Corrected:

`pnpm check` · `pnpm build` · `pnpm test:e2e`, plus:

1. **Contrast audit** — script over the token file asserting §2's _computed_ values,
   including the **non-text 3:1** rule revision 1 omitted. Runs in vitest.
2. **Spacing audit** — ⚑ **Playwright, not vitest** (vitest has no layout engine;
   `getBoundingClientRect` returns zeros). Walks a named selector list on `/` and
   `/workspace/` at 375 / 768 / 1280 / 1920, asserting the §5 minimums.
3. **Proportion audit** — ⚑ demoted from acceptance test to **stated design judgement**.
   No pixel-histogram tool exists in the repo and inventing one is not in scope. Recorded
   here as a review heuristic, not a gate.
4. **Reduced motion** — hero renders one frame, no loop. E2E.
5. **API-down** — workbench shows R2's state, not a spinner. E2E, warm SW cache.
6. **WebGL hero** — ⚑ CI runs WebKit only, which has no hardware WebGL, so the e2e
   exercises the §4.3 _fallback_, not the hero. Stated plainly: **the live WebGL hero is
   manually verified.** The fallback ladder is what CI proves.
7. ⚑ **Console assertion** — the existing e2e asserts `consoleProblems == []` including
   warnings. New landing-page coverage must scope its allowlist narrowly (Three.js emits
   context warnings under headless WebKit) and never loosen the workspace assertion.
8. ⚑ **Bundle budget** — landing route ≤700 KB gzipped; `/workspace/` must not import
   `three`.
9. ⚑ **E2E selector contract** — `.metric`, `.metric-row`, `.schedule-row` are **test
   contracts**; keep the class names verbatim. `overflow-x: clip` on html/body stays
   (removing it turns pre-existing overflow red); the board gets its own
   `overflow-x: auto` container with `min-width: 0` ancestors and a board-scoped
   overflow assertion.

## 10. Release ⚑

Revision 1 said "merge, tag, publish" and skipped the project's own gate
(`docs/releases/v0.1.0.md:30`). Full sequence:

1. `pnpm check` · `pnpm build` · `pnpm test:e2e` green.
2. `pnpm audit --prod --audit-level high`, `licenses:check` — `three` is MIT with zero
   runtime deps.
3. Version sweep: 9 `package.json` files, `compose.yaml`, API version strings, issue
   template, every `v0.1.0` claim in README and `docs/**`.
4. Regenerate SBOMs as `nimanto-v0.2.0.*`; relink from README, `ACKNOWLEDGMENTS.md`,
   `THIRD_PARTY_NOTICES.md`. ⚑ `docs/releases/` is **not** prettier-ignored — the
   `prettier --write` step inside `sbom:release` is mandatory or `pnpm check` fails.
5. Regenerate both README screenshots against the restyled app.
6. `graphify --update` and one scoped query (repo convention; graph is tracked).
7. Merge to `main`, tag `v0.2.0`, `gh release create`.

⚑ Note: `pages.yml` deploys the public site on **every push to main** — the site goes
live at merge, before the tag. There is no staging step.
