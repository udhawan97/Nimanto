# Nimanto user-flow analysis

**Date:** 2026-08-05
**Method:** traced every route in `apps/api/src/server.ts` against the UI that reaches
it in `apps/web/components/workspace.tsx`, then walked the candidate journey end to end
against the states the domain actually models.
**Purpose:** identify where the candidate stalls, and which of those stalls a frontend
change can close without touching the trust model.

---

## 1. The intended flow

Nimanto's product contract defines one path. Written as states rather than screens:

```
    IMPORT              CONFIRM             DISCOVER            EXPLAIN
  raw evidence  ──▶  claim: pending  ──▶  job tracked  ──▶  match + blockers
   (discarded         candidate                                     │
    after parse)       decides                                      ▼
                                                               TRACK
                                                           application: tracked
                                                                    │
                                                                    ▼
                                            ┌──────────────  PREPARE
                                            │              packet: draft
                                            ▼                       │
                                        ASSURE ◀───────────────────-┘
                                    assurance findings
                                            │
                                            ▼
                                    APPROVE PACKET
                                            │
                                            ▼
                                    APPROVE ACTION
                                            │
                                            ▼
                                  RUNTIME SWITCH (off by default,
                                   resets off on API restart)
                                            │
                                            ▼
                                        EXECUTE ──▶ receipt
```

Every arrow is a deliberate gate. That is the product, and none of it should change.

## 2. Where the candidate actually stalls

Seven stalls, ordered by how early they bite.

### S1 — "I imported. Now what?" (entry cliff)

`Overview` greets with four metric tiles and a review queue. The queue only fires when
`evidence.status === "pending"` exists. A brand-new workspace with zero evidence shows
four zeros and an empty state per panel — four dead ends and no single instruction. The
one nudge that does exist (`focus-strip`, `workspace.tsx:840`) is narrowly conditional:
`jobs.length > 0 && matches.length === 0`. Outside that exact window, the app never tells
the candidate what to do next.

**Cost:** highest-value moment in the product, lowest guidance.
**Closed by:** F2 (next-step rail).

### S2 — Blocked match is a terminal screen

A match renders supported requirements, missing requirements, coverage, and blockers.
When a requirement is unmet, the UI states the fact and stops. The action that would fix
it — add a claim that supports that requirement — lives in a different section, behind
a form the candidate must re-derive the wording for from memory.

**Cost:** the core loop of the product (evidence ⇄ requirement) is not actually a loop.
**Closed by:** F4 (requirement → evidence).

### S3 — Applications are a flat list with a `<select>`

`Applications` renders a table; status changes go through a native dropdown
(`workspace.tsx:1840`). The domain models a genuine five-stage pipeline
(`tracked → prepared → approved_for_export → submitted_externally → withdrawn`) but the
UI presents it as an unordered attribute. A candidate juggling 20 applications cannot
see distribution, cannot see what is stuck, and cannot see what is nearly done.

**Cost:** the one screen a job seeker opens daily is the least legible screen.
**Closed by:** F1 (pipeline board) — with the guards in §4 below.

### S4 — The funnel is buried and under-read

`personalFunnel` ships in every dashboard response with counts and a scope caveat. It is
rendered as a single unstyled strip at the top of `Applications`
(`workspace.tsx:1806-1826`) and never appears on `Overview`. The candidate's own
conversion history — the most motivating data in the product — is the least visible.

**Cost:** wasted signal.
**Closed by:** F5 — counts only. See the constraint in §4.

### S5 — Silence is indistinguishable from nothing-happened

An application submitted eight weeks ago with no recorded outcome looks exactly like one
submitted yesterday. The product correctly refuses to *infer* an outcome from silence,
but it also refuses to *surface* the silence, which is a different thing and is not
required by the contract.

**Cost:** follow-ups get forgotten; the tool that was supposed to hold the thread drops it.
**Closed by:** F6 — framed as a record-keeping observation, never a status. See §4.

### S6 — No way to get anywhere fast

Seven sections, no search, no keyboard route. Finding one application among forty means
navigating to a section and scanning. The public marketing site has a ⌘K palette; the
tool the candidate lives in does not.

**Cost:** every task carries navigation overhead.
**Closed by:** F3 — navigation only. See the hard exclusion list in §4.

### S7 — The app lies when the API is down

`workspace.tsx:447` renders a hardcoded `"Local service connected"` indicator. It is
static markup; it says "connected" whether or not anything is connected. For a
local-first tool where the candidate runs both halves themselves, being told the wrong
half is healthy is worse than being told nothing.

**Cost:** actively misleading during the exact failure this architecture makes likely.
**Closed by:** R2 — and the hardcoded indicator must be **deleted**, not left beside it.

## 3. Cross-cutting failure modes

| # | Mode | Evidence | Fix |
| --- | --- | --- | --- |
| X1 | One render throw blanks the workbench | No error boundary, no `app/error.tsx` | R1 |
| X2 | Zero unit tests in `apps/web` | `vitest run --passWithNoTests` | R3 |
| X3 | Failed mutations have no rollback path | `onAct` sets a notice; optimistic UI would desync | F1 error policy |
| X4 | No keyboard path for any new interaction | Repo already asserts focus order in e2e | F1/F3 keyboard specs |

## 4. Constraints the fixes must respect

These come from the product contract and trust model, and they bound the features above.

1. **F1 may not become an approval surface.** `PUT /v1/applications/:id/status` has *no*
   transition guard today (`server.ts:1149` validates union membership only), and
   `store.ts` stamps `submitted_at` on entry to `submitted_externally` and never clears
   it. A drag-to-commit board would let one mis-drop write a false submission record
   into a product whose entire thesis is provenance. F1 therefore requires a real
   domain-level transition guard, and a confirm step on the two consequential columns.
2. **F5 may not compute conversion rates.** The API ships the caveat
   "not a hiring probability" and the source ledger states no hiring-probability claim is
   supportable. Counts and the caveat string only.
3. **F6 may not read as a status.** The Applications page promises "Nimanto never infers
   an outcome from silence." F6 must say *"nothing recorded since <date>"* — an
   observation about the candidate's own record-keeping — never "stale", "cold", or
   "likely rejected".
4. **F3 may not execute anything gated.** Palette entries carry a navigation target
   only, structurally — never a callback — so no future edit can smuggle an approval,
   execution, runtime-switch, or deletion call into it.
5. **F4 may not launder provenance.** Prefill the claim *value* from the requirement
   text. Never populate `sourceName`/`sourceLocator` from job-posting content: that would
   attribute a candidate's claim to an employer's ad. The created claim stays `pending`.

## 5. Flow after the change

```
  ┌──────────────────────────────────────────────────────────────┐
  │  NEXT STEP RAIL (F2) — always shows the single next action    │  ← S1
  └──────────────────────────────────────────────────────────────┘
            │
   IMPORT ──┴─▶ CONFIRM ──▶ DISCOVER ──▶ EXPLAIN ──┐
                   ▲                                │
                   │      ┌─────────────────────────┘
                   └──────┤ unmet requirement → add evidence (F4)   ← S2
                          └─────────────────────────┐
                                                    ▼
                          PIPELINE BOARD (F1) ── guarded ──▶ submitted   ← S3
                                │                             │
                                │                             ▼
                          FUNNEL (F5, counts)          "nothing recorded
                                                        since ⟨date⟩" (F6)   ← S5
                                                    ← S4

  ⌘K palette (F3, navigation only)  ·  connection state (R2)  ·  error boundary (R1)
      ↑ S6                                ↑ S7                      ↑ X1
```

Every stall S1–S7 has exactly one owner. No stall is closed by a change to a gate.
