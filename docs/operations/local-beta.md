# Run and operate the local beta

## Requirements

- Node.js 24, 25, or 26
- pnpm 11.20.0 through Corepack
- 1 GB of free disk space for dependencies, local data, and packet artifacts

## Start

On macOS, double-click `START-NIMANTO.command`.

Or run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open:

- workbench: `http://127.0.0.1:4300/workspace/`
- product website: `http://127.0.0.1:4300/`
- API health: `http://127.0.0.1:4310/health`
- OpenAPI explorer: `http://127.0.0.1:4310/docs`

Both ways into the workbench need the private launch key. The macOS launcher
opens Nimanto with it already supplied, and `pnpm dev` prints the same URL on
startup. Opening the bare workbench URL — or returning to it after signing out —
shows the entry screen with its controls disabled until the key is supplied; the
screen names `.nimanto-data/launch-secret` as the file that holds it.

The API binds to loopback by default. Do not change `NIMANTO_API_HOST` to a public interface without adding production authentication, secure cookies, TLS, and a reviewed deployment configuration.

## Upgrade to v0.9.0

Stop the API, copy the complete `.nimanto-data/` directory, update to the exact
v0.9.0 source, and reinstall the locked graph before restarting:

```bash
git fetch --tags origin
git checkout v0.9.0
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Current main advances the database to schema version 15. Version 6
transactionally backfills canonical hashes for legacy Packet manifests and
Action Intents; version 7 adds tenant-scoped role dispositions and private
Application notes. Versions 8–12 retain the discovery and government-evidence
trust records described below. Version 13 adds the candidate Career Ledger and
one clearly labeled current-status migration marker for each existing
Application without reconstructing earlier transitions. Version 14 adds
tenant-owned, append-only Submission Records with optional exact approved-Packet
and artifact-format bindings. Version 15 adds a manual-role operation ledger so
a repeated manual Role creation resolves to the Role it already created, flags
manual Roles whose identity came from a legacy partial content hash for
candidate identity review, records the topic and prompt on each Answer Block
revision, and corrects the version 13 migration markers to their own observation
time instead of the Application's creation time. That operation ledger is
internal idempotency bookkeeping: it is not part of export v10. A
migration version is recorded only after its work commits, so an interrupted
upgrade resumes from the last complete step. Startup refuses a database created
by a newer Nimanto runtime rather than guessing how to open it. On every open,
Nimanto transactionally replays idempotent base and tenant-trigger definitions
to repair an incomplete local-beta fixture; only missing migration versions run
one-time schema or data mutations.

Keep the stopped full-directory copy. The beta has no schema downgrade
guarantee, so restore that copy or fix forward rather than running older source
against a newer-schema database.

## Private invitations

Public signup is disabled. A local administrator can issue a 72-hour, email-bound, single-use invitation with the private launch key:

```bash
nimanto_launch_key=$(tr -d '\n' < .nimanto-data/launch-secret)
curl --fail-with-body --silent --show-error \
  -H "content-type: application/json" \
  -H "x-nimanto-bootstrap-secret: $nimanto_launch_key" \
  -d '{"email":"candidate@example.com"}' \
  http://127.0.0.1:4310/v1/auth/invitations
```

Give only the intended candidate a URL shaped like `http://127.0.0.1:4300/workspace/#invite=RETURNED_TOKEN`. Nimanto removes the token from the address bar immediately. Acceptance creates an empty tenant-isolated workspace; the exact email must match. The admin API can revoke an unused invitation with `DELETE /v1/auth/invitations/{id}` and the same private-key header. Acceptance immediately removes the stored token hash and intended email. Accepted, revoked, and expired tombstones are retained for at most 30 days for bounded local audit and pruned at API startup; live unused invitations are never pruned before expiry.

This beta uses invitation tokens and local cookie sessions. Passkeys, account recovery, TLS termination, and production hosted identity remain deployment gates.

## Docker self-hosting

The digest-pinned container runs the same static web workbench and API with public signup and demo login disabled:

```bash
docker compose up --build
```

Open `http://127.0.0.1:4300/`. Retrieve the generated admin key with `docker compose exec nimanto sh -c 'cat /data/launch-secret'`, then issue a private invitation as above. The named `nimanto-data` volume holds the database and artifacts. The image is built in CI; v0.9.0 has not been certified for internet exposure and should remain bound to loopback.

## Data locations

The default root is `.nimanto-data/`:

| Path                                         | Contents                                  |
| -------------------------------------------- | ----------------------------------------- |
| `.nimanto-data/database/`                    | PGlite PostgreSQL files                   |
| `.nimanto-data/artifacts/<tenant>/<packet>/` | JSON, TXT, DOCX, and PDF packet artifacts |
| `.nimanto-data/outbox/`                      | Explicitly executed local test messages   |
| `.nimanto-data/launch-secret`                | Mode-0600 private local launch key        |

Change the root with `NIMANTO_DATA_DIR=/absolute/path`. Do not place it inside a cloud-synced directory unless you accept that provider's retention and access model.

On POSIX systems Nimanto tightens runtime directories to `0700` and content files to `0600`, including an existing permissive database directory. Windows does not interpret POSIX mode bits as a complete ACL policy; keep the data root inside a private user profile and treat a reviewed Windows ACL installer as a future desktop-delivery gate.

## Back up and restore

Stop the API before copying `.nimanto-data/`. Restore by replacing the entire directory while the API is stopped. The beta does not claim online backups, point-in-time recovery, or schema downgrade support.

## Reset the synthetic workspace

Use **Data controls → Delete all data** and type the exact confirmation phrase. The deletion transaction first fences later tenant writes and captures the exact outbox cleanup inventory, then removes database tenant rows, packet artifacts, local outbox files, and the session. An authenticated write or provider effect either finishes before that fence or fails; it cannot create an untracked file afterward.

Deletion signs you out, so the receipt appears on the sign-in screen that follows. It states which outcome was reached and shows a seven-day status token with a copy control. Keep the token: it is the only candidate-facing, public way to check or resume this deletion, and it works without a session, so treat it like a password.

Copy it before you leave that screen. Nimanto deliberately stores nothing after deleting your workspace, so the token is held in the page only — reloading or closing the tab loses it. Keep it out of shell history too; the status route takes it as a query parameter.

Two outcomes are possible, and the receipt distinguishes them:

| Receipt                                                            | Meaning                                                                                 | What to do                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------- |
| **Workspace deleted**                                              | Database records and local files are gone.                                              | Nothing.                     |
| **Database records removed — local file cleanup is still pending** | Tenant rows and your session are gone; packet or outbox files could not be removed yet. | Resume with the token below. |

```bash
curl --fail-with-body --silent --show-error \
  "http://127.0.0.1:4310/v1/deletion/status?token=YOUR_STATUS_TOKEN"
```

```bash
curl --fail-with-body --silent --show-error \
  -H "content-type: application/json" \
  -d '{"token":"YOUR_STATUS_TOKEN"}' \
  http://127.0.0.1:4310/v1/deletion/resume
```

Both routes are deliberately reachable without a session, because deletion has already removed yours. Separately, API startup and the authenticated internal worker reconciliation autonomously finish incomplete database and filesystem cleanup without a candidate bearer token. That internal recovery path does not expose status or a public resume capability. Completed deletion tombstones remain through the seven-day public token window, then are pruned; running or cleanup-pending work is never age-pruned.

Starting a new local session after deletion creates a fresh labeled synthetic workspace.

## Scheduled public-board refresh

Open **Role discovery → Schedule source** to add a Greenhouse, Lever, or Ashby public-board identifier and choose an hourly, six-hour, daily, or weekly cadence. The normal `pnpm dev` and macOS launcher start the worker with the API and website.

Each schedule can be run now, paused, resumed, or cancelled. A worker cycle claims at most three due schedules, imports at most 500 roles per source, deduplicates by provider job ID, and publishes deterministic explanations. Failures use bounded retry delays and become a visible dead letter after the fifth consecutive failure; **Resume** resets that retry budget.

The queue stores only provider and board identifiers. Scheduled work cannot prepare packets, approve, email, submit, or open any Slice 4 action. `pnpm dev:core` or `pnpm start` intentionally runs only the API and web processes for deterministic testing; `pnpm start:all` includes the worker.

## Inspect the evidence thread

- **Evidence vault → Private evidence lens** searches literal claim text,
  source names, and locators, then filters by evidence type, decision, and
  source. The lens stays in the signed-in tab, changes no claim, and is cleared
  at reload or an identity boundary.
- **Role discovery** search and source/match-state/tracking/archive filters remain in the
  current signed-in tab while the candidate moves between workbench sections.
  Reload, sign-out, deletion, or an identity change clears them; the API never
  receives a filter preference.
- **Role discovery → Compare** keeps up to two Role IDs in the signed-in tab and
  lays out current Role values beside each role's latest stored explanation.
  The folio shows literal coverage, requirements needing evidence, blockers,
  compensation, and benefits. It does not rank roles or infer an employer
  outcome.
- **Role discovery → View match anatomy → Evidence lens** shows fit coverage,
  the separate Evidence Strength ordinal, the exact supported/source-linked/
  candidate-attested-only counts stored by new Match Publications, and both
  rule versions. The current source-linkage calculation is explicitly
  unweighted and cannot change the fit band. Historical matches show their
  stored ordinal without inventing missing counts; explain the role again to
  create a current inspectable basis.
- **Role discovery → Archive** stores a candidate disposition beside the source
  Role. A provider refresh cannot erase it; restoring reverses it, and neither
  action changes a tracked Application.
- **Role discovery → Import reviewed URL** appears only when an exact host
  allowlist and terms-review date enable that capability. The candidate supplies
  the URL and normalized fields explicitly; redirects and unsafe destinations
  still fail closed.
- **Role discovery → Review H-1B evidence** separates current role wording,
  current employer-authored policy, and historical government records. An exact
  quote can be acknowledged or cleared; the review is invalidated by newer role
  content or a newer Match Publication and never changes fit or hides the role.
- **H-1B evidence signals → Source and freshness** retains the full stored
  locator, period, observation time, confidence, freshness, downgraded original
  label, and stated limits. This is historical context, not legal advice or a
  current employer promise.
- **Applications → Recorded timeline** lists retained status events, completed
  candidate activities, explicit candidate-reported outcomes, and literal
  private notes. A migration marker is a current snapshot, not earlier history;
  missing dates and silence create no inferred stage.
- **Applications → Career ledger** keeps typed activities, structured interview
  rounds, manual people/referral links, versioned candidate-authored answers,
  named review views, sample-sized duration observations, and candidate-entered
  offer terms in one Application-adjacent folio. It performs no scraping,
  messaging, autofill, notification, prediction, or provider sync.
- **Applications** places the board/table work surface before funnel, review,
  and cohort counts. Board and table use the same deliberate outcome editor;
  recording an outcome does not change application status.
- **Applications → Set follow-up** stores one strict date-only value on the
  application. Board and table show the same literal date. A due date enters
  Review due; a future date suppresses the 336-hour fallback until that day.
  Saving does not contact anyone, change application status, schedule a
  background job, or infer an employer response. Clear the date to return to
  fallback behavior. Withdrawing an application retains its saved date visibly
  but marks it inactive and removes it from Review due. The candidate can clear
  it while withdrawn, or return the application to Tracked to reactivate it;
  setting or changing the date while withdrawn fails closed.
- **Applications → Export reminders (.ics)** downloads active candidate-set
  dates as a local all-day calendar file. It creates no notification or job in
  Nimanto.
- **Applications → Private decision lens** searches role/company plus literal
  private-note and outcome text, filters by status, current role source, and
  literal follow-up state, and sorts the working view by one explicit stored
  field. These controls remain tab-local and do not alter funnel or cohort
  counts.
- **Applications → Export shown (.csv)** downloads only the records in the
  current working view. The spreadsheet-safe summary contains tracker fields
  and note/outcome counts but excludes private note and outcome bodies. Use the
  Data controls JSON export for the complete candidate-owned record.
- **Role discovery → Add role** keeps a draft only in the current signed-in tab
  while the candidate moves between workbench sections. Reload, sign-out,
  identity change, successful save, or confirmed discard clears it.
- **Evidence vault**, **Role discovery**, **Approved actions**, and
  **Applications** keep their
  unfinished fields in that same signed-in tab across section changes. A
  successful save clears only the exact submitted snapshot, so newer typing is
  preserved when a response returns later. Explicit discard controls clear the
  relevant local draft; reload and identity boundaries clear all of them.
- **Applications** also keeps the selected board/table view, record-review
  filter, sort, and cohort inputs while the candidate checks another section.
  These controls remain local to the tab and are never written as candidate
  facts.
- **Applications → Record-review queue** prefers a stored candidate-set date
  when present. Without one, it derives review due after 336 elapsed hours from
  the latest literal application creation, candidate status event, completed
  activity, or candidate-recorded outcome. The
  queue labels which basis it used, excludes withdrawn records, and neither
  infers an employer response nor contacts anyone.
- **Applications → Application cohort counts** uses an explicit local-time
  creation window. Optional role-source and match-band filters use current stored
  values. Unmatched means no stored match; unknown preserves a stored band this
  client does not recognize. Results are raw counts, never rates or predictions.
- **Applications → Open dossier** shows one Application-owned read-only case
  file: current role and Match, packet and assurance history, candidate ledger,
  Match Evidence Lens, external-action history, and Submission Records. It does
  not infer an employer timeline or treat a candidate record as an employer
  acknowledgment.
- **Applications → Submitted externally** requires a candidate-authored
  Submission Record. Record the actual channel, destination, and time, then
  either select the exact current approved composed Packet and formats used or
  explicitly choose **Materials were not captured**. Nimanto does not perform
  the submission and does not call this record a receipt.
- **Review packets → Compose packet** selects and orders one to eight confirmed
  claims from the Application's exact Profile Version and shows their current
  Match requirement links. Creation fails closed when the Profile, role, Match,
  or evidence changes. The frozen composition is shared by every generated
  format, and identical inputs reproduce the same canonical packet hash.
- **Review packets → Inspect content, formats, and assurance** shows canonical
  content, `document_assurance_v1` checks, artifact hashes, and the latest stored
  assurance run. Inspection verifies structure and configured rules; it does not
  verify claim truth, writing quality, employer acceptance, or delivery.
  Assurance is bound to the exact packet and manifest hashes, and approval fails
  if either changed or a newer assurance superseded the reviewed run.
- **Review packets → Draft from selected evidence** is available only when a
  local Ollama model answers. The candidate checks the exact confirmed claims
  sent to loopback; the unverified result is copy-only and never becomes Packet
  content without a separate candidate action outside this panel.
- **Review packets → History** loads retained packet generations for one
  application on demand. The comparison lists literal changed canonical fields
  and artifact-manifest entries; it is history, not lineage. Status and manifests
  are current mutable fields. Assurance runs use packet-local ordinals and do not
  expose the store's global ordering sequence.
- **Stored history** loads cursor-paginated profile versions and match runs only
  when opened. Profile diffs compare exact claim IDs and authorization wording.
  Neutral A/B labels permit same or reverse-ordered selections without misstating
  chronology. Same-role match comparisons disclose their rule, blocker values,
  stored reference hash, and result hash but do not claim causality, replay
  guarantees, or immutable job history.
- **Local activity** verifies each internal receipt hash while loading the
  dashboard, then exposes the input, artifact, and receipt hashes. These records
  are tamper-evident but unsigned and are not external acknowledgments.

## Inspect a workspace export

Open **Data controls**, read the sensitive-data warning, and confirm it before
downloading JSON. `nimanto-local-beta-v10` wraps `nimanto_export_v10`, including
retained discovery profiles, source runs, normalized posting observations,
verification attempts, availability, profile versions, match runs, assurance
runs, exact role-wording reviews, packet manifests, dataset editions and their
trusted provenance and qualified-language-review manifests, reviewed employer
entities/aliases, applications, immutable Submission Records, complete Answer
revision history, activities, interview rounds, contacts, saved views, offers,
and receipts. It
excludes discarded raw provider bodies, sessions, invitation secrets, deletion
internals, and generated packet files.

Treat the file as sensitive candidate data. It is an inspection export—not a
restore archive, immutable role history, online backup, or replay proof. Continue
to stop the API and copy the complete `.nimanto-data/` directory for the bounded
offline backup procedure above.

## Verify

```bash
pnpm check
pnpm build
pnpm test:e2e
```

For a downloaded v0.9.0 release, place the CycloneDX inventory, SPDX inventory,
and checksum manifest in one directory and verify the two inventories with:

```bash
shasum -a 256 --check nimanto-v0.9.0-SHA256SUMS.txt
```

This verifies the published inventory assets. GitHub generates the source ZIP
and tar archive from the tag; Nimanto does not publish a signed installer or
desktop binary.

For a clean production-like static run:

```bash
pnpm build
pnpm start
```

## Troubleshooting

### The workbench says “Connect the local service”

Confirm `http://127.0.0.1:4310/health` returns `{"status":"ok"}`. A burst of
requests no longer produces this message: the API answers `429 RATE_LIMITED`
with a wait-and-retry message of its own rather than reporting itself as a
failed service. If a different process owns port 4310, stop it or set matching `NIMANTO_API_PORT` and `NEXT_PUBLIC_NIMANTO_API_ORIGIN` values before rebuilding the web app.

### A packet is blocked

Run assurance and read its required findings. Common causes are no confirmed evidence, missing authorization wording, changed locked wording, or a prohibited outcome promise.

### The composer says the Application is on an older Profile Version

An Application is bound to the exact Profile Version it was created against, so
saving a newer one closes packet composition, action creation, and Submission
Records for that Application until you rebind it. The packet row names both
versions and offers **Use current Profile Version**, which rebinds that one
Application and nothing else. An Application already at Approved for export
returns to Prepared, because the approval its old Packet earned no longer
applies; a candidate-recorded external submission or withdrawal is preserved.
Explain the role again to publish a current Match, then compose, assure, and
approve a new Packet. The earlier Packet stays historical and is still refused
for actions and Submission Records.

### A Submission Record is blocked

Refresh the dossier. If materials were captured, the selected Packet must still
be the latest approved `packet_v2`, and its Profile, Match, role, evidence,
manifest, and hashes must remain current. Create, assure, and approve a current
Packet before recording those formats. If you genuinely did not capture the
materials, choose that explicit option instead of inventing a Packet binding.

### Execute is disabled

The application's current packet must be approved, the action must be created
from that exact packet and separately approved, and the runtime switch must be
on. Creation, approval, and execution each recheck packet currentness under the
packet-generation lock. Generating a newer packet makes an older approved packet
historical; review and approve the current packet before creating a replacement
action. The switch resets off whenever the API restarts.

### The workbench says the identity changed

The tab tried to write after its loaded session was replaced or revoked. Nimanto
rejects the mutation before the route handler runs and clears the old workspace
before refreshing. Reopen or sign in to the intended workspace and review the
current stored state before repeating the decision; do not assume the rejected
write committed.

### An action is ambiguous

Do not retry it. The provider effect may have completed before local outcome
persistence became uncertain. Copy the action ID, inspect the local outbox file
or mail-client state, and follow the provider-specific reconciliation procedure
in [provider boundaries](provider-setup.md#reconcile-an-ambiguous-action). v0.9.0
keeps the ambiguous record as a do-not-retry audit trail.

### Gmail or Outlook is unavailable

Connected-account sending is not part of v0.9.0. Use the local test outbox or a user-opened deep link. See [provider boundaries](provider-setup.md).
