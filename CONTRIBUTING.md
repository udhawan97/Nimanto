# Contributing

Nimanto is intentionally conservative around candidate data, job-provider terms,
employment claims, and external actions.

1. Use only synthetic fixtures. Never commit personal résumés or restricted-provider data.
2. Open an issue before adding a source, model provider, or external-action adapter.
3. Add a failing test at a public seam before changing behavior.
4. Run `pnpm check` and `pnpm test:e2e` for browser-facing changes.
5. Sign commits with the Developer Certificate of Origin: `git commit -s`.

Dependency changes also change generated verification evidence. After resolving
manifest changes with pnpm and confirming `pnpm install --frozen-lockfile`, run
`pnpm sbom:current` and `pnpm screenshots:render` before the full checks. Review
the generated diff, then run `pnpm check`, `pnpm test:e2e`,
`pnpm screenshots:check`, `pnpm audit --audit-level high`, `pnpm licenses:check`,
`pnpm sbom:check`, and `pnpm release:check`. Keep inventories for already
published versions immutable; refresh only the current candidate. A successful
CodeQL workflow is distinct from resolving or reviewing its remaining findings.

Contributions are licensed under Apache-2.0. A contribution must preserve source
provenance, human approval, deterministic scoring, and the candidate-side boundary.
