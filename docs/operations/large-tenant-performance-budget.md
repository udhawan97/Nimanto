# Large-tenant dashboard budget

Nimanto enforces a deterministic, file-backed PGlite budget for a synthetic long-lived tenant with:

- 1,000 Roles, Applications, status events, and planned activities;
- 1,000 reusable Answer Blocks; and
- 10 immutable revisions per Answer Block, or 10,000 answer revisions in total.

The regression lives in `apps/api/test/dashboard-scale.test.ts`. Two assertions are hard gates: a coherent Dashboard read must stay below 4 MiB after JSON serialization, and no Answer Block in the Dashboard projection may carry a `revisions` array. Read timings are printed as observations, not asserted: wall-clock read time varies by an order of magnitude between a development machine and a shared CI runner, so a timing threshold wide enough for CI would not reject any realistic regression. The payload budget is what rejects the previous eager-history shape.

The test always prints one observation line. Run it with:

```sh
pnpm --filter @nimanto/api exec vitest run \
  test/dashboard-scale.test.ts --coverage.enabled=false --testTimeout=30000 \
  --no-file-parallelism --reporter=verbose
```

Three consecutive runs of that command on 3 September 2026 (Apple silicon development machine, macOS, Node 22, otherwise idle) measured 136–180 ms cold, 111–153 ms warm, and 3,215,900 serialized bytes in every run. These are dated development-machine observations, not a universal hardware claim, and only the byte count is deterministic: a run competing with a typecheck on the same machine measured 274 ms cold and 210 ms warm.

"Cold" here means the first `DashboardRead.read` after re-opening the store inside an already-warm Node process with a hot operating-system page cache. It is not a cold machine, a cold process, or a cold disk; treat it as "first read of a fresh store handle".

The Dashboard projects only each Answer Block's current revision. A candidate can expand one Answer Block to fetch its complete immutable history through the tenant-scoped `GET /v1/answer-blocks/:id/revisions` route. Export retains all revisions. This bounds the initial response and avoids constructing 10,000 collapsed revision nodes without weakening historical evidence.

This budget covers local database read orchestration and response serialization. It does not claim native Safari or assistive-technology render timing; those remain browser-specific acceptance work.
