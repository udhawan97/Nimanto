# Local recovery readiness

## Decision and scope

The marketplace expansion's remaining execution depends on source rights and
qualified reviews. The architecture's next production direction is the hosted
trust layer, including backup/restore drills and deletion evidence. Start with
a bounded rehearsal of the existing stopped local backup procedure, using the
same database and lifecycle services as the application.

This work is a local operational tool. It does not enable a provider, change
scoring or candidate approvals, publish a release, or qualify hosted recovery.

## Phase R1: synthetic stopped-copy rehearsal

Implemented as `pnpm recovery:drill`. The command builds the API and its workspace
dependencies and runs entirely inside a fresh temporary directory. It accepts
no data-directory argument and does not load runtime environment configuration.
It opens no server listener, starts no worker, and performs no provider action.
Its JSON result includes source version, schema version, elapsed time, passed
checks, and explicit limitations. A failure exits nonzero; temporary data is
removed after all database handles close.

The rehearsal must demonstrate:

1. A separate process cannot acquire the open database's SQLite ownership lock.
2. A closed database and its packet files survive two complete directory copies
   with identical paths and SHA-256 file contents, including empty directories.
3. The reopened tenant export preserves every fixture record. Only the export's
   newly generated `exportedAt` is omitted from the comparison.
4. All six actual generated packet artifacts still match their stored hashes.
5. A foreign active tenant cannot read the owner's packet or evidence.
6. The runtime approval switch resets off and rejects action execution.
7. An interrupted action becomes ambiguous exactly once, without provider retry.
8. A deletion already recorded in the backup resumes, clears its residual files
   and schedules, and leaves the unrelated tenant intact.
9. A subsequent stopped copy retains completed deletion and the surviving
   tenant's records. The original stopped source and backup stay unchanged.

Regression tests also detect altered, missing, and unexpected files/directories
and reject links. `pnpm check` runs the rehearsal as an API integration test; the
standalone command additionally exercises the compiled runtime.

## Phase R2: deletion across older backups

Not implemented. A backup taken before a deletion request has no knowledge of
that request. Restoring it can resurrect the deleted workspace. R1 only proves
recovery of deletion state already present in a backup; it does not prove
external restore suppression.

Before a managed restore or hosted backup feature, define and implement the
external suppression ledger described in the trust plan: separate ownership,
retention/expiry, key lifecycle, offline replay before service startup, revoked
sessions, cancelled work, object cleanup, and interruption tests. Approve that
security and privacy design before changing the startup boundary. Until then,
operators must discard older copies containing data that has been erased and
must not restore those copies.

## Phase R3: hosted recovery acceptance

Deferred. Managed database policies, encrypted object storage and backups,
credential recovery, retention enforcement, backup age limits, operator drills,
and measured recovery targets need their own deployment-specific evidence.
The synthetic drill supplies no hosted readiness, encryption, online backup,
point-in-time recovery, schema downgrade, or recovery-time guarantee.
