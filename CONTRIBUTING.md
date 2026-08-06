# Contributing

Nimanto is intentionally conservative around candidate data, job-provider terms,
employment claims, and external actions.

1. Use only synthetic fixtures. Never commit personal résumés or restricted-provider data.
2. Open an issue before adding a source, model provider, or external-action adapter.
3. Add a failing test at a public seam before changing behavior.
4. Run `pnpm check` and the relevant browser flow.
5. Sign commits with the Developer Certificate of Origin: `git commit -s`.

Contributions are licensed under Apache-2.0. A contribution must preserve source
provenance, human approval, deterministic scoring, and the candidate-side boundary.
