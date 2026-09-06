// cspell:ignore scor probabilit
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APPLICATION_MATCH_BUCKETS, bandLabel } from "../lib/derive.js";

/* CONTEXT.md forbids "score", "recommendation", and "probability" in
 * candidate-facing copy: Nimanto explains a deterministic result against
 * confirmed evidence and never ranks a person for anyone. This guards the
 * rendered strings only, and two things stay deliberately outside it:
 *
 *  - Identifiers. A quoted literal with no whitespace in it is a contract with
 *    the API, the database or CSS, not copy: "scoring_rules_v1",
 *    "evidence_strength_unweighted_v1", "not_scored", value="recommended" and
 *    value="excluded" are all persisted and must never be renamed for wording.
 *  - Boundary disclaimers, which exist to name what Nimanto does not do and
 *    cannot say it without saying the word.
 */
const FORBIDDEN = /\b(scor\w*|recommend\w*|probabilit\w*)\b/giu;

/* Phrases CONTEXT.md forbids that are not a single word: "current profile" is
 * the Avoid entry for Profile Version. "current Profile Version" is the defined
 * term and stays allowed, so the lookahead exempts it. */
const FORBIDDEN_PHRASES = /current profile(?! version)/giu;

const DISCLAIMER_MARKERS = ["not a", "are not", "is not an", "never", "no hiring", "does not"];

const here = path.dirname(fileURLToPath(import.meta.url));

function stripComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//gu, " ").replaceAll(/(^|[^:])\/\/.*$/gmu, "$1");
}

/** Quoted literals with no whitespace are identifiers, not copy. */
function stripIdentifierLiterals(source: string): string {
  return source.replaceAll(/(["'`])(\S*?)\1/gu, " ");
}

/* Split on sentence ends and on tag boundaries, so a JSX text node is its own
 * chunk. Without the tag split one disclaimer would clear every other string in
 * the same run of markup. */
function sentences(source: string): string[] {
  return stripIdentifierLiterals(stripComments(source))
    .replaceAll(/\s+/gu, " ")
    .split(/(?<=[.!?])\s|[<>{}]/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

async function scopedFiles(): Promise<string[]> {
  const components = path.join(here, "..", "components");
  const app = path.join(here, "..", "app");
  const [componentNames, appNames] = await Promise.all([readdir(components), readdir(app)]);
  return [
    ...componentNames
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => path.join(components, name)),
    // The public site and every page's social metadata render candidate copy too,
    // and they were the highest-visibility violations the guard could not see.
    ...appNames.filter((name) => name.endsWith(".tsx")).map((name) => path.join(app, name)),
    path.join(here, "..", "lib", "derive.ts"),
    // Copy that the web renders verbatim but that lives outside components/.
    path.join(here, "..", "lib", "packet-composer.ts"),
  ].sort();
}

/* packages/domain/src/matching.ts is a logic file (it computes with a `score`
 * variable), so the sentence scan would false-positive on code identifiers.
 * Its candidate-facing copy lives only in string literals — scan those. */
const domainCopyFile = path.join(here, "..", "..", "..", "packages", "domain", "src", "matching.ts");

function copyLiterals(source: string): string[] {
  const out: string[] = [];
  for (const match of stripComments(source).matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/gsu)) {
    const value = match[2] ?? "";
    if (/\s/u.test(value)) out.push(value);
  }
  return out;
}

describe("candidate-facing vocabulary", () => {
  it("keeps forbidden vocabulary out of domain-authored copy the web renders", async () => {
    const offenders: string[] = [];
    for (const literal of copyLiterals(await readFile(domainCopyFile, "utf8"))) {
      const lowered = literal.toLocaleLowerCase("en-US");
      if (DISCLAIMER_MARKERS.some((marker) => lowered.includes(marker))) continue;
      for (const match of [...literal.matchAll(FORBIDDEN), ...literal.matchAll(FORBIDDEN_PHRASES)]) {
        offenders.push(`matching.ts · ${match[0]} · …${literal.slice(0, 90)}…`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps score, recommendation, and probability out of rendered copy", async () => {
    const offenders: string[] = [];
    for (const file of await scopedFiles()) {
      const source = await readFile(file, "utf8");
      for (const sentence of sentences(source)) {
        const lowered = sentence.toLocaleLowerCase("en-US");
        if (DISCLAIMER_MARKERS.some((marker) => lowered.includes(marker))) continue;
        for (const match of [...sentence.matchAll(FORBIDDEN), ...sentence.matchAll(FORBIDDEN_PHRASES)]) {
          const from = Math.max(0, match.index - 60);
          offenders.push(
            `${path.basename(file)} · ${match[0]} · …${sentence.slice(from, match.index + 60)}…`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps forbidden vocabulary out of the derived match-band labels", async () => {
    // The band label is produced at render time from a persisted enum, so the
    // source-scan above can never see it. Check the map itself.
    const forbidden = new RegExp(FORBIDDEN.source, "iu");
    const offenders = APPLICATION_MATCH_BUCKETS.map((bucket) => bandLabel(bucket)).filter((label) =>
      forbidden.test(label),
    );
    expect(offenders).toEqual([]);
  });
});
