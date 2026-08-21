# Nimanto system architecture

## Purpose

Nimanto is a candidate-side evidence and application workbench. Its architecture keeps six trust boundaries explicit:

1. imported material is not confirmed evidence;
2. historical sponsorship evidence is not a current employer promise;
3. a current Role record is not immutable posting history;
4. a match explanation is not a hiring probability;
5. generated text is not an approved packet;
6. an approved packet is not permission to perform an external action.

## Runtime topology

```mermaid
flowchart TB
  Browser["Static Next.js workbench"] -->|"HttpOnly local session"| API["Fastify API"]
  API --> Store["PGlite PostgreSQL"]
  API --> Intake["Candidate-approved evidence intake"]
  Intake --> Parsers["Bounded TXT · MD · JSON · OOXML DOCX · text-layer PDF"]
  API --> Publication["Exact-snapshot match publication"]
  Publication --> Domain["Matching · assurance · transitions · receipts"]
  API --> Packet["Staged packet lifecycle"]
  Packet --> Documents["JSON · TXT · DOCX · PDF renderers"]
  Worker["Durable refresh worker"] -->|"private loopback cycle"| API
  API -. "fixed public hosts" .-> ATS["Greenhouse · Lever · Ashby"]
  API -. "loopback only" .-> Model["Ollama"]
  API --> Gate["Exact-approved action lifecycle"]
  Gate --> Outbox["Deep link · local test outbox"]
```

The website is safe to publish as static files. It does not contain or host a shared candidate backend. A running local API at `127.0.0.1:4310` is required for the workbench.

## Data lifecycle

```mermaid
stateDiagram-v2
  [*] --> Pending: import or manual entry
  Pending --> Confirmed: candidate confirms
  Pending --> Rejected: candidate rejects
  Confirmed --> ProfileVersion: snapshot
  ProfileVersion --> MatchRun: deterministic rules
  MatchRun --> Application: candidate tracks role
  Application --> PacketDraft: deterministic assembly
  PacketDraft --> AssurancePassed: no findings
  PacketDraft --> AssuranceBlocked: required finding
  AssurancePassed --> PacketApproved: candidate approves
  PacketApproved --> ActionPending: exact target and payload
  ActionPending --> ActionApproved: candidate approves
  ActionApproved --> Executing: runtime switch is on
  Executing --> Succeeded
  Executing --> Failed
  Executing --> Ambiguous: provider may have succeeded; never auto-retry
  Succeeded --> Receipt
```

## Package seams

| Seam                 | Owns                                                                        | Must not own                             |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| `@nimanto/domain`    | Pure matching, assurance, Role normalization, hashes, receipts, transitions | Network or database access               |
| `@nimanto/database`  | Tenant-scoped persistence and lifecycle operations                          | Provider requests or UI copy             |
| `@nimanto/parsers`   | Bounded text extraction into pending claims                                 | Confirmation decisions                   |
| `@nimanto/documents` | Canonical packet rendering and artifact hashes                              | Arbitrary model-authored claims          |
| `@nimanto/providers` | Fixed-host ATS, local model, and mail adapters                              | Approval state                           |
| `@nimanto/api`       | Authentication, lifecycle modules, validation, rate limiting, safe errors   | Employer screening or outcome prediction |
| `@nimanto/web`       | Candidate decisions, mutation sequencing, identity, navigation and focus    | Direct provider access or domain effects |

## Persistence

The local beta uses PGlite, which runs PostgreSQL in-process and gives a zero-install local database. The repository boundary uses PostgreSQL SQL and JSONB so a hosted implementation can move to managed PostgreSQL later.

Tenant isolation is enforced in every public repository method and exercised through cross-tenant tests. A database trigger also takes the active tenant row's no-key-update lock before every tenant-owned insert or update. Beginning deletion takes the conflicting row lock, flips the tenant to `deleting`, and captures the external-action cleanup inventory in that same transaction. An authenticated write or provider effect therefore linearizes before deletion or fails `TENANT_NOT_ACTIVE`; it cannot create an untracked packet or outbox artifact after the inventory snapshot. This is defense in depth for the local beta, not a claim of production PostgreSQL row-level security.

Assurance runs carry a database-generated monotonic sequence plus the exact
packet-content and manifest hashes they reviewed. Packet approval compare-and-swaps
the latest passing run against both hashes, so a later run or changed artifact set
cannot inherit an older approval. Packet rendering uses a private staging
directory, revalidates the exact application/profile/job/evidence snapshot while
holding the tenant lock, then promotes the complete artifact set and writes the
packet, application state and receipt atomically. Stored
execution receipts are verified against their canonical hashes on dashboard read;
the workbench exposes those internal hashes without treating them as signatures.

Retained profile, match, packet, and assurance records are exposed through
tenant-scoped, cursor-paginated read seams. The dashboard loads only the latest
match per role and packet per application, plus packets referenced by visible
actions, and the latest assurance per loaded packet; historical pages are
requested only when the candidate opens them. A
cursor is the identifier of a record owned by the same tenant and scope, so a
foreign cursor fails closed. Assurance pages translate the internal global
sequence into an ordinal scoped to one packet and never return the global value.

Match publication reads only the claim IDs frozen by the exact profile version.
Its input hash covers normalized job content, the job content hash, the profile
input hash, frozen claim IDs, and rule version. The match run and receipt commit
together, and the receipt includes evidence IDs from requirements and dimensions.

Profile-version creation is serialized by a tenant-row lock. Confirmed claim IDs
and NFC-trimmed authorization wording are compared with the latest literal
record inside that transaction; unchanged input reuses the latest version. The
client's disabled no-change control is guidance, not the correctness boundary.

Manual role drafts deliberately stay outside persistence. The client holds one
owner-bounded working-state bundle above section routing, clears it at
authentication and deletion boundaries, and writes a role only after an
explicit successful save. Evidence fields, role filters, action fields, outcome
notes, application views, review filters, and cohort inputs use the same
tab-local ownership rule. A mutation clears only the exact snapshot it
submitted, so a delayed response cannot erase text entered while the request was
in flight.

Manual, allowlisted URL, Greenhouse, Lever, and Ashby adapters each own their
source-specific retrieval, parsing, identity, provenance, and content hash. They
then pass a complete Role Observation through the domain normalizer before any
write. Common NFC/trim/default rules therefore stay consistent, and an invalid
provider item rejects the complete bounded batch before its transaction begins.
Persistence still updates or inserts one current mutable row under exact
`(tenant, source, sourceJobId)` identity. It does not retain immutable Role
observations or deduplicate across sources. A Match Publication separately
freezes the exact normalized role input it used. Historical planning documents
describe possible snapshot/history/deduplication systems; those remain future
proposals, not the implemented model documented here.

Candidate Application transitions use the domain legal-edge and confirmation
policy. The database locks the active tenant and current Application row, repeats
the policy decision, and updates status plus `submittedAt` in one transaction.
Packet generation and approval do not impersonate candidate intent: the Packet
lifecycle names them as system consequences and writes `prepared` or
`approved_for_export` inside its larger packet/receipt transaction while the
Application is still in a preparation state. If the candidate has recorded
`submitted_externally` or `withdrawn`, the policy preserves that status and the
lifecycle performs no Application write. Persistence, not the pure policy
module, owns timestamp atomicity.

`nimanto_export_v2` adds complete retained profile-version, match-run,
assurance-run, and government dataset-edition records to the explicit JSON inspection export. It intentionally
omits session and invitation credentials, deletion internals, and generated
packet files. It is not a restore protocol, immutable job-history snapshot, or
execution replay format.

Evidence preview and import share one bounded projection and canonical hash.
The candidate can read every accepted claim before import, the raw upload is not
retained, and the whole pending claim batch commits or rolls back together.

Government imports are stored as source-type/source-edition records with a
checksum, transformation version, evaluation result, and trusted evaluation
provenance. Replaying the same edition and checksum is idempotent; a different
checksum or transformation for an existing edition fails before signal writes.

## Authentication

`POST /v1/auth/local` and the explicitly labeled synthetic-demo route are available only on loopback while local mode is enabled and require the high-entropy launch key stored mode `0600`. The local route records the candidate's own name and email. It creates a local tenant, user, membership, and a random 256-bit session token. Only the SHA-256 token hash is stored. The browser receives an HttpOnly, SameSite=Lax cookie.

There is no public hosted sign-up flow. Email-bound, hashed, single-use invitations create isolated local/self-hosted candidate workspaces. Passkeys, managed recovery, production cookie security, and hosted identity remain hosted-beta gates.

The browser gives Identity transitions first refusal on every URL fragment. An
invitation or bootstrap credential is captured before the address is scrubbed;
unknown key/value fragments are scrubbed and never routed. Authentication loss
clears identity-owned drafts without echoing credential values. A separate
navigation/focus module owns only known section hashes, mobile-dialog focus,
sticky-header scroll correction, and post-render error or success focus. The
Workbench mutation coordinator composes these modules for UI sequencing while
keeping each request opaque; it is not a domain command bus or Action Intent.

Every authenticated browser mutation also carries the exact tab-local session
generation loaded with the dashboard. A Fastify pre-handler rejects missing or
stale generations with `IDENTITY_CHANGED` before the route handler runs. The
client fails closed by removing identity-bound content before it refreshes, and
the workspace subtree remounts at the new identity epoch so child-local import
state cannot cross sessions. The HttpOnly cookie remains the authentication
credential; the generation header is an additional same-tab identity fence,
not a replacement session token.

## Durable discovery

Candidates can schedule Greenhouse, Lever, and Ashby public-board refreshes from the workbench. The `DiscoveryCycle` owns separate direct-import and scheduled-refresh operations. Direct import fetches before its database transaction and commits the role batch without scoring. Scheduled refresh first claims a durable lease, then fetches, then publishes through the same exact-snapshot `MatchPublication` used by manual scoring. Schedules are tenant-owned database records with bounded cadence, a single hashed lease, retry backoff, pause/resume/run-now/cancel controls, and a visible dead-letter state after five consecutive failures. Each job/match/receipt batch and recurring-state advance commits in one lease-locked transaction. A worker cycle claims at most three due schedules, imports at most 500 roles per source, and cannot prepare packets, approve, email, or submit.

## External actions

The database state machine and domain state machine must agree. Action approval binds the immutable target/payload intent hash and the exact approved packet hash. Schema version 4 assigns a monotonic internal generation sequence at packet insertion after acquiring the tenant lock; current-packet selection and history use that sequence rather than timestamp/random-ID tie-breaking. Action creation, approval, and execution share the tenant lock used by packet generation; each boundary transactionally requires that the selected approved packet is still the application's current packet. Execution repeats that check after reacquiring the lock immediately before the provider effect. A historical approved packet therefore cannot create, approve, or execute a handoff after a newer packet exists. Execution also revalidates the intent and packet hashes, requires the in-memory runtime switch, and compare-and-swaps `approved` to `executing`. Provider failure becomes `failed`; a provider success followed by uncertain local persistence becomes `ambiguous`, and an interrupted `executing` record is recovered as ambiguous on restart. Neither state is retried automatically. The switch has no environment override and resets to off with every API restart.

Version 0.5.4 has no connected-account provider. Verification uses only a user-opened deep link and the local test outbox. Gmail, Outlook, form submission, and desktop delivery remain behind the separately approved Slice 4 boundary.

## Scaling path

The next production seam is not another feature. It is a hosted trust layer:

- managed PostgreSQL with row-level security and tested policies;
- WebAuthn/passkeys, invitation lifecycle, and recovery;
- encrypted object storage with short-lived artifact URLs;
- OAuth authorization-code flows with refresh-token protection;
- hosted queue isolation, operational dashboards, and multi-instance worker capacity beyond the local durable lease loop;
- audit-log retention, backup/restore drills, and deletion evidence;
- counsel-reviewed product language and provider terms.

Those gates remain visible so the local beta is not mistaken for a hosted production service.
