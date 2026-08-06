# Third-party notices

Nimanto uses open-source packages under their own licenses. The release lockfile is the install authority; the exact v0.2.0 machine-readable inventories are the [CycloneDX SBOM](docs/releases/nimanto-v0.2.0.cdx.json) and [SPDX SBOM](docs/releases/nimanto-v0.2.0.spdx.json). Authoritative copyright and license texts remain with each package and its source distribution.

Notable runtime families include:

| Purpose                | Projects                                                                    | Primary license family         |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| Web and API            | Next.js, React, Fastify and Fastify plugins                                 | MIT                            |
| Local data             | PGlite                                                                      | Apache-2.0                     |
| Evidence and documents | PDF.js, pdf-lib, docx, fflate, saxes                                        | Apache-2.0, MIT, ISC           |
| Interface              | Lucide; Fontsource packages for Archivo, IBM Plex Mono and Instrument Serif | ISC; SIL Open Font License 1.1 |
| Brand rendering        | three.js                                                                    | MIT                            |
| Verification           | Vitest, Playwright, CSpell, CycloneDX cdxgen                                | MIT, Apache-2.0                |

Some transitive optional/native packages expose alternative or weak-copyleft license choices. Consult the SBOM and the package's distributed license before redistributing a modified binary bundle. Nimanto v0.2.0 publishes source and does not redistribute a signed native binary.

No third-party application source code, proprietary job data, personal résumé,
model weights, Ollama runtime, or government dataset is bundled in this repository.
The brand emblem in `apps/web/components/emblem-core.ts` and the vendored source
it was adapted from are first-party Nimanto work; three.js is consumed as an
ordinary npm dependency and is not vendored.

The Apache-2.0 license covers Nimanto's original source only; it does not replace third-party licenses. See [sources and licenses](docs/planning/sources-and-licenses.md) for reviewed data-source and provider boundaries.
