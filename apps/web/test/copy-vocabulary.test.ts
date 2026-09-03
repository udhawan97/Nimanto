// cspell:ignore scor probabilit
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
  const names = await readdir(components);
  return [
    ...names.filter((name) => name.endsWith(".tsx")).map((name) => path.join(components, name)),
    path.join(here, "..", "lib", "derive.ts"),
  ].sort();
}

describe("candidate-facing vocabulary", () => {
  it("keeps score, recommendation, and probability out of rendered copy", async () => {
    const offenders: string[] = [];
    for (const file of await scopedFiles()) {
      const source = await readFile(file, "utf8");
      for (const sentence of sentences(source)) {
        const lowered = sentence.toLocaleLowerCase("en-US");
        if (DISCLAIMER_MARKERS.some((marker) => lowered.includes(marker))) continue;
        for (const match of sentence.matchAll(FORBIDDEN)) {
          const from = Math.max(0, match.index - 60);
          offenders.push(
            `${path.basename(file)} · ${match[0]} · …${sentence.slice(from, match.index + 60)}…`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
