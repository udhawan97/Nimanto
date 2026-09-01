# Large-tenant dashboard budget

Nimanto enforces a deterministic, file-backed PGlite budget for a synthetic long-lived tenant with:

- 1,000 Roles, Applications, status events, and planned activities;
- 1,000 reusable Answer Blocks; and
- 10 immutable revisions per Answer Block, or 10,000 answer revisions in total.

The regression lives in `apps/api/test/dashboard-scale.test.ts`. It requires a coherent Dashboard read to remain below 5,000 ms cold, 2,500 ms warm, and 4 MiB after JSON serialization. The limits are intentionally wide enough for shared CI runners while still rejecting the previous eager-history payload shape.

Run the observation mode with:

```sh
NIMANTO_REPORT_SCALE_BUDGET=1 pnpm --filter @nimanto/api exec vitest run \
  test/dashboard-scale.test.ts --coverage.enabled=false --testTimeout=30000 \
  --no-file-parallelism --reporter=verbose
```

Two 1 September 2026 local observations after the grouped-lookup and lazy-history changes measured 1,036–1,137 ms cold, 729–808 ms warm, and 3,215,900 serialized bytes. These are dated development-machine observations, not a universal hardware claim.

The Dashboard projects only each Answer Block's current revision. A candidate can expand one Answer Block to fetch its complete immutable history through the tenant-scoped `GET /v1/answer-blocks/:id/revisions` route. Export retains all revisions. This bounds the initial response and avoids constructing 10,000 collapsed revision nodes without weakening historical evidence.

This budget covers local database read orchestration and response serialization. It does not claim native Safari or assistive-technology render timing; those remain browser-specific acceptance work.
