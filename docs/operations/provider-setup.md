# Provider setup and trust boundaries

## Job discovery providers

Nimanto supports public job-board APIs with fixed hosts:

| Provider   | Fixed host                 | Input              |
| ---------- | -------------------------- | ------------------ |
| Greenhouse | `boards-api.greenhouse.io` | public board token |
| Lever      | `api.lever.co`             | public site name   |
| Ashby      | `api.ashbyhq.com`          | public board name  |

Requests use a 10-second timeout, reject redirects, require JSON, and import at most 500 jobs per refresh. Provider data remains subject to the provider and employer's terms. See the [source and license ledger](../planning/sources-and-licenses.md).

An operator may separately enable exact-host HTTPS page intake with `NIMANTO_URL_ALLOWLIST` and the mandatory `NIMANTO_URL_TERMS_REVIEWED_AT=YYYY-MM-DD`. The fetcher rejects credentials, non-default ports, redirects, private/reserved DNS answers, mixed public/private answers, non-text bodies, responses over 1 MB, and requests longer than 10 seconds. It pins the reviewed DNS result for the TLS connection and stores only bounded tenant-private normalized text plus provenance; the transient response body is discarded. The allowlist is empty by default.

## Deep link

The deep-link provider returns a `mailto:` URL. It does not send. The user remains responsible for opening the mail client, reviewing attachments, and pressing Send.

## Local test outbox

The test-outbox provider is the release verification path. After packet approval, action approval, and runtime activation, it writes one mode-0600 JSON file to `.nimanto-data/outbox/`.

No network request is made.

## Connected accounts

Gmail and Microsoft Outlook sending are not implemented or configurable in v0.4.0. No access-token environment variable is read. Connected-account effects require the separately reviewed Slice 4 plan and exact approval before code or onboarding documentation is added.

## Verification rule

Project tests and release verification never call an email provider. The local test outbox is the only execution path; the deep link leaves the final send in the user's mail client.

## Optional Ollama companion

Nimanto checks only `http://127.0.0.1:11434`. The summary endpoint sends the selected role, company, and confirmed evidence to that loopback process. It accepts a bounded draft, rejects obvious outcome promises, labels the result `unverified_local_draft`, and never edits or approves a packet.

Packet approval does not require a model by default. If `NIMANTO_ASSURANCE_MODEL` names an exact installed Ollama tag, the local structured evidence-risk review becomes required: Nimanto records the installed digest, uses an 8K context cap, sends no tools, and resolves an unavailable, malformed, timed-out, or blocking review to `blocked_unavailable`/blocked with no cloud fallback. Deterministic and document checks remain authoritative and always run.

Treat the local model installation and model file as a separate trust domain. Review its license and data behavior yourself.
