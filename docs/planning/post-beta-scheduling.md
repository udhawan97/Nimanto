# Durable discovery schedules

**Phase:** post-v0.1.0 hardening inside approved Slice 2
**Boundary:** discovery, refresh, deduplication, and deterministic scoring only

## Outcome

Replace the environment-only single-board worker with candidate-controlled, durable schedules for the already supported Greenhouse, Lever, and Ashby adapters. A schedule belongs to exactly one tenant, records only provider/board identifiers, survives API and worker restarts, and exposes its state without revealing another tenant's work.

This phase cannot prepare, approve, email, submit, or perform any other external action. It does not open Slice 4.

## Public seams

The approved backend plan already fixes the observable seams used by the tests:

1. `@nimanto/domain` owns legal schedule-state transitions and retry limits.
2. `NimantoStore` owns tenant-scoped creation, listing, pause/resume/cancel/run-now, and an internal lease-based claim/complete/fail lifecycle.
3. The authenticated HTTP API owns candidate schedule controls; the bootstrap-authenticated worker endpoint owns bounded execution.
4. The workbench shows each schedule's source, cadence, next run, last result, and recovery controls.

Tests observe only these public interfaces. They do not query private methods or mock repository internals.

## State and safety contract

`queued -> running -> queued` is the successful recurring path. A sanitized provider failure becomes `retry_wait`; the fifth consecutive failure becomes `dead_letter`. A candidate can pause, resume, run now, or cancel their own schedule. Expired leases are recoverable, duplicate claims are rejected, and a foreign tenant receives a not-found response.

Provider data is fetched before the write phase. The imported jobs, deterministic matches, receipts, and recurring-state advance then commit inside one transaction that holds and validates the hashed lease row. A cancellation during the fetch invalidates the lease and leaves no new local artifacts; an expiry recovery cannot overlap a transaction already holding that row.

Cadence is bounded to 60 minutes through seven days. A worker cycle claims at most three due schedules and imports at most 500 jobs per source. Imported roles are deduplicated through the existing provider/source-job key and scored with the current confirmed profile. Queue payloads contain no résumé, evidence, packet, or contact content.

## Acceptance

- Cross-tenant schedule reads and mutations fail closed.
- Two workers cannot claim the same active lease.
- Pause/cancel prevents a claim; resume/run-now makes an eligible schedule claimable.
- Provider failures retry with bounded backoff and surface a non-content error code; exhaustion is visible and recoverable.
- Successful cycles preserve provenance, deduplicate, and publish deterministic matches and receipts.
- The worker accepts only the private bootstrap secret and talks only to the validated loopback API origin.
- API integration uses a provider fixture to prove execution/import/matching; WebKit covers creating, pausing, resuming, and responsive workbench controls without relying on a live provider.
