# Nimanto trust, privacy, and security plan

**Status:** Proposed controls and release gates; not implemented or audited  
**Snapshot:** 2026-08-05  
**Security posture:** Fail closed for tenant access, evidence confirmation, deletion, and application assurance

## Data classification and minimization

| Class | Examples | Rule |
|---|---|---|
| Restricted career data | Résumé content, employment history, compensation preferences, work-authorization wording, application artifacts | Tenant-private; encrypt in transit/at rest; field-scoped use; no telemetry or training |
| Authentication secret | Passkey public credential metadata, session token hash, recovery/invite token hash | Separate access policy; rotate/revoke; never log raw values |
| Private source content | User-supplied postings from restricted providers, LinkedIn export/PDF | Tenant-private; no shared index, fixtures, redistribution, or training |
| Public evidence | Approved ATS jobs, DOL/USCIS/BLS/O*NET data | Preserve edition, source, rights, checksum, dates, and limitations |
| Operational metadata | Request IDs, rule versions, counts, durations, error codes | Allowlist only; exclude content, URLs with query strings, emails, names, tokens, hashes tied to a profile |

Nimanto v1 does not accept passports, SSNs, visa stamps, I-797/I-94 records, attorney documents, or raw immigration identity/legal files. Work-authorization facts are separate user-confirmed fields with locked approved wording. The system does not infer protected traits or legal eligibility.

## Threat model

| Threat | Boundary / abuse | Required controls | Verification gate |
|---|---|---|---|
| Cross-tenant access | ID guessing, missing filter, worker/job confusion | Explicit authorization plus PostgreSQL `FORCE RLS`; non-owner/non-`BYPASSRLS` roles; tenant context set transaction-locally; 404 on foreign resource | Negative tests for every row/object/job/export/receipt/background path and raw SQL fixtures |
| Admin overreach | Platform operator reads vault or impersonates candidate | Platform admin outside tenant membership; no content-read or impersonation permission; privileged actions separately audited | Permission-matrix tests and admin abuse fixtures |
| Invite/account takeover | Token reuse, email substitution, stolen session | 256-bit random single-use token stored hashed; 72-hour expiry; fixed intended email; transactional consume; passkey/WebAuthn; throttling; session revocation; recent reauth for export/delete | Acceptance, expiry, reuse, revoke, race, throttling and revoked-session tests ([WebAuthn](https://www.w3.org/TR/webauthn-3/)) |
| Malicious upload | Parser exploit, active content, archive/ZIP bomb, spoofed MIME | Allowlisted types; magic-byte sniffing; size/page/file-count/compression limits; generated names; quarantine outside webroot; no inline serving; isolated no-egress parser; reject active content. Malware scanning is an explicit Slice-1 accepted risk rather than an unnamed control | Adversarial PDF/DOCX/archive corpus and resource-limit tests ([OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)) |
| Outbound request / SSRF | Greenhouse token/path injection in Slice 1; arbitrary URL, loopback, metadata, private/link-local or redirect escape in Slice 2 | Slice 1 permits only fixed-host HTTPS to `boards-api.greenhouse.io`, validated board tokens, no credentials, off-allowlist redirects, or uncapped bodies. Slice 2 adds approved domains, DNS/IP revalidation, private/reserved-range blocking and alternate-encoding tests | Token-fuzz, redirect, size/time/content-type tests in Slice 1; IPv4/IPv6/DNS-rebinding suite before URL intake ([OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)) |
| Prompt injection | Posting/résumé text asks model or agent to act | Imported content is data; structured delimiters; tool-free model calls by default; allowlisted tools and fields; no action authority from content; human approval | Adversarial fixture suite must trigger no instruction following or tool call |
| Queue replay/confusion | Duplicate or stale job executes under wrong tenant | Minimal identifier-only payload; tenant/actor/purpose; current-state and authorization recheck; inbox/idempotency key; expiry; cancellation; per-tenant concurrency; DLQ | Duplicate, delayed, cancelled, poison and cross-tenant worker tests |
| Object disclosure | Public bucket, guessed key, replayed upload/download capability | Private buckets; app-proxied streaming; single-use two-minute capability token bound to object, method, actor and version; DB authorization before consume; storage URL/key never reaches browser or logs | Anonymous/foreign/replay/expiry tests, repeated PUT denial and immutable object-version tests |
| Receipt shadow profile | Hashes or logs reconstruct deleted tenant | Receipts are tenant data and deleted with tenant; no raw content; pseudonymous operational records are purpose-limited and expire; no permanent tenant-linked deletion hash | Export/deletion inventory and restore tests |
| Supply-chain compromise | Dependency/action/image replacement or malicious PR | Lockfile; SPDX/SBOM; license/advisory/secret scan; Actions pinned to full SHA; images by digest; least workflow permissions; no fork secrets; untrusted artifacts | Clean CI, provenance and policy checks ([GitHub Actions pinning](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)) |
| Telemetry leakage | Résumé, posting, model output, token or signed URL enters logs/traces | Schema-allowlisted event fields; redaction at boundary; query/fragment stripping; no body logging; restricted debug mode disabled in hosted beta | Canary-secret and synthetic-PII log scans ([OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)) |
| Model/provider disclosure | Whole vault or secrets sent to cloud | Local first; task-specific minimum fields; provider/purpose/retention disclosure and explicit consent; redaction; no silent cloud fallback; keys in OS/secret store, not DB | Provider-denial/outage tests and egress fixture inspection |
| Local Ollama companion (Slice 3) | Malicious webpage drives unauthenticated local model or reads output through rebinding/origin confusion | Loopback-only bind; per-install bearer token exchanged outside webpage content; exact `Origin` and `Host` allowlists; reject absent/untrusted values; restrictive Ollama origins; no direct browser access to port 11434 | Host/origin spoof, absent-origin, DNS-rebinding and token replay tests |

The threat model must be extended before later slices for DOL/USCIS archives, document rendering, local Ollama companion/DNS rebinding, cloud model providers, OAuth mail, external connectors, Tauri IPC, signing, updater, and compromised-key recovery.

## Authorization and tenant isolation

Authorization is a domain policy, not an authentication side effect. Every protected resource has a tenant owner and every use case receives a trusted actor from the session, never from a request body. A transaction sets `app.tenant_id`, `app.actor_id`, and purpose from server context; RLS policies use those settings and fail when absent. Connection-pool release resets transaction-local context.

Migrations run as a schema owner unavailable to runtime. API and worker roles cannot disable RLS, own tenant tables, create roles, or access another tenant through maintenance functions. Security-definer functions are avoided; any exception fixes `search_path`, validates tenant, revokes `PUBLIC`, and receives dedicated tests.

The test matrix includes same-tenant owner, unauthenticated, foreign tenant, platform admin, worker for correct tenant, worker with forged payload tenant, revoked user/session, deletion-locked tenant, and direct SQL. It covers select/insert/update/delete, joins, aggregates, object metadata, queue state, receipts, exports, and backups restored into a test environment.

### Operator access reality

Tenant roles and platform-admin APIs cannot read candidate content, but a hosted operator with database, object-store or backup infrastructure access can technically access it. Slice 1 therefore promises provider/volume-level encryption at rest and TLS in transit—not end-to-end or per-tenant envelope encryption. Hosted access requires time-bounded break-glass credentials, two-person approval where the operator count permits it, a reason, and access logs kept outside the application data store. Self-hosting is the option for a user unwilling to trust the hosted operator. Application-level field encryption is deferred until a key owner, KMS, rotation, recovery and deletion design is approved.

## Authentication and invitations

Slice 1 is passkey-first. An invitation is delivered manually by the beta operator; Nimanto does not send email. Pre-auth passkey registration is permitted only with the valid single-use invitation context. Recovery codes are generated once, pasteable, stored as slow hashes, and individually consumed; an admin cannot reveal, reset, replace, or bypass them. Recovery codes or another already-registered passkey are the only Slice-1 recovery methods. If all are lost, access is unrecoverable; the operator may lock and later delete the account under the published process but cannot grant access. Any support-assisted credential recovery requires a separate reviewed design.

Cookie sessions are `Secure`, `HttpOnly`, `SameSite=Lax` or stricter, origin-checked, rotated after authentication/privilege change, and revocable. The initial absolute lifetime is 12 hours, idle lifetime 30 minutes, and recent-auth window 10 minutes; changes require a versioned security decision. Authentication and recovery routes have per-IP and per-account throttles without revealing whether an email exists. Export, deletion, recovery-code regeneration, and passkey changes require recent WebAuthn reauthentication. Better Auth supplies authentication primitives; Nimanto owns invite and resource authorization policies.

## Upload and parsing pipeline

1. Authorize an upload intent with declared type and strict limits: résumé/PDF/DOCX <=15 MiB and 50 pages; LinkedIn archive <=100 MiB compressed, <=25 MiB allowlisted decompressed content, <=50 files, and <=20:1 expansion; tenant stored objects <=500 MiB in Slice 1.
2. Stream to a random quarantine object while hashing; never trust filename or `Content-Type`.
3. Detect type, archive structure and active content; reject mismatch or resource bombs. Only the positive LinkedIn file allowlist is staged; a full-archive fixture must yield zero third-party records. Forbidden/rejected uploads use a quarantine bucket excluded from backups and are purged—DB metadata, all object versions, temporary copies and queued work—within 24 hours; only a non-identifying rejection code remains.
4. The worker stages one immutable input for a disposable per-job sandbox. It sees exactly one read-only input mount and one bounded output tmpfs, never a parent or sibling directory; it uses `network_mode: none`, read-only root, dropped capabilities, `no-new-privileges`, seccomp, and hard CPU/memory/wall limits. Mounts are wiped after completion, including interrupted runs. The worker never exposes a Docker socket to the application process.
5. Store a structured preview with source locators and diagnostics; delete transient extracted files.
6. Require field-by-field confirmation before facts enter a profile version or matching.
7. Delete a LinkedIn raw archive/PDF after confirmation or 24 hours, whichever comes first, unless the user explicitly selects the documented 30-day retention option.

DOCX extraction uses reviewed OOXML ZIP/XML parsing (`fflate` plus `saxes`) and produces paragraph/table-cell plus character-range locators; unsupported constructs are diagnosed, not guessed. PDF.js extraction disables evaluation and remote font/CMap fetching. PDFs with no usable text layer are rejected with accessible guidance; OCR is not included in v1 and rejected files are excluded from locator-fidelity denominators.

Parser output is untrusted. HTML is sanitized and rendered with a restrictive content security policy; office/PDF files are never served inline with active behavior. Any detected forbidden immigration document is quarantined for deletion and no contents are extracted.

## Privacy, retention, export, and deletion

Default retention is intentionally short:

| Data | Default retention |
|---|---|
| Unconfirmed/raw LinkedIn archive or PDF | Until confirmation/rejection or 24 hours; optional explicit 30-day retention |
| Résumé source deliberately stored in vault | Until replaced or user/account deletion |
| Normalized evidence, jobs, match runs, artifacts, tenant receipts | Until user/account deletion; user may delete earlier where integrity permits |
| Completed queue bodies | Delete immediately or retain identifiers/status only; failed minimal payloads at most 7 days |
| Temporary render/parse/cache files | 24 hours maximum |
| PII-safe application logs/traces | 30 days |
| Minimal security events | 90 days, then aggregate or delete |
| Primary/database/object versions after account deletion | 7 days maximum |
| Encrypted backups | 30-day rolling maximum; deleted tenant is suppressed on any restore |

The export is a documented, portable archive of source inventory, normalized facts and locators, preferences, profile versions, job snapshots/provenance, match rules/results, generated artifacts, approvals, receipts, and retention/deletion status. Secrets, internal security detections, other tenants, and licensed content that cannot be redistributed are excluded with an explanation.

Deletion first reauthenticates and enters `requested`, then `locked`. Cancellation requires recent reauthentication and is allowed only in those two states before the atomic point-of-no-return sets `purging`; it is rejected afterward. Purging cancels queued jobs, revokes sessions/capabilities, and idempotently removes rows, objects/versions, derivatives, caches, model traces, receipts, idempotency/inbox rows, and temporary files within 7 days. A failed purge remains locked and resumes; cancellation can never resurrect partially removed data. Encrypted backups expire within 30 days.

For exactly that backup window, an append-only suppression ledger outside the backed-up PostgreSQL/object datasets retains only a key-separated salted deletion identifier and expiry. Production restores must replay this external ledger before service opens; the ledger entry is destroyed after the last containing backup expires. This is a documented, narrow exception to full erasure and is disclosed in the privacy notice. The user receives an unguessable, single-purpose deletion-status URL valid for 30 days that returns only `pending | complete | failed` and no tenant data. Incident and deletion-completion contact uses the published out-of-band operator channel. After expiry, only unlinked aggregate operational counts may remain.

Hosted beta prerequisites are a privacy notice, hosted-service terms separate from Apache-2.0, controller/contact identity, retention defaults, subprocessor list, incident/breach process, data-request procedure, and legal applicability review. The planning docs are not legal advice.

## Fairness and employment safeguards

Scoring inputs exclude names, pronouns, photos, age/graduation-year cues not required by a posting, nationality/country of birth, disability, and employment-gap presence. Work authorization is an explicit candidate-controlled hard-constraint input, not a proxy or Qualification Match component.

Deterministic features are computed only from a normalized projection of confirmed facts after removing name, pronoun, institution identity, country/name cues, age cues, disability disclosure and gap-presence fields. Metamorphic fixtures require this feature vector to be byte-identical when those identity cues change and job-relevant evidence—including explicit work authorization and credential level—stays constant. `institution_identity` must not change output; a genuinely different `credential_level` may. Any unexplained difference blocks release. Separate tests ensure model extraction cannot smuggle excluded fields into deterministic features.

Nimanto is candidate-side only. Its scoring and evidence must not be repurposed for employer screening, ranking, eligibility decisions, or protected-trait inference.

## Availability, backup, and incident controls

PostgreSQL backups are encrypted, restore-tested, access-logged, and isolated from runtime credentials. A monthly automated restore and quarterly operator drill verify schema migration, RLS, object reconciliation, deletion suppression, queue cancellation, and recovery time; targets are proposed as RPO <=24 hours and RTO <=8 hours for invite-only beta and must be published as targets, not guarantees.

Workers use bounded retries, exponential backoff, per-tenant/source concurrency, cancellation, quarantine/DLQ, and circuit breakers. A shared rule/template/parser failure blocks the affected batch; an item-specific failure quarantines only that item. There is no silent bypass of a required check.

Incident response must cover detection, containment, credential/session revocation, source/connector kill switches, evidence preservation without copying vault content, user notification through the published operator channel, remediation, and post-incident review. Production access is least privilege and time bounded.

## Accessibility and trust presentation

The minimal web harness targets WCAG 2.2 AA from the first slice ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)). Every status has text and programmatic semantics, not color alone. Evidence and warnings are keyboard navigable; errors focus and identify fields; tables reflow or provide an accessible alternative; motion honors `prefers-reduced-motion`; 200% zoom and narrow reflow preserve content; and destructive/export flows use plain language and accessible confirmations.

Automated axe checks are necessary but insufficient. Release evidence includes keyboard-only, VoiceOver/Safari, focus order, zoom/reflow, contrast, reduced-motion, and error-recovery checks. Exported documents receive their own accessibility plan in Slice 3; successful file generation is not a conformance claim.

Before hosted public beta, add NVDA with Firefox or Edge on Windows to the manual matrix. The web response policy starts from `default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`, permits scripts only from self with per-response nonces, and restricts `connect-src`, images and styles to reviewed needs. The closed excluded-proxy list for scoring v1 is: name, pronouns, photo, birth date/age, graduation year except an explicit posting requirement, nationality/country of birth, disability/medical disclosure, institution identity, and employment-gap presence.

## Legal and expert-review flags

Qualified review is required before hosted beta for immigration-language boundaries, employment/fairness use, privacy-law applicability and notices, provider and data-source terms, DOL/USCIS redistribution/retention, open-source/data license obligations, security-incident duties, and accessibility claims. A flagged feature remains disabled until resolved; counsel uncertainty is never converted into product guidance.
