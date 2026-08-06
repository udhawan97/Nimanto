import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* The palette sheet this design system was sampled from shipped six contrast
 * labels, and two of them claimed AAA below the 7.0 floor. This file is the
 * reason that class of error cannot ship again: every ratio the token file
 * relies on is computed here rather than asserted in a comment. */

// Resolved from the vitest root (apps/web) rather than import.meta.url, which
// is not a file: URL under the happy-dom environment.
const css = readFileSync(path.resolve(process.cwd(), "../../tokens.css"), "utf8");

/** Resolves a token to a literal hex, following var() indirection. Roles point
 *  at ramp steps on purpose, so the audit has to walk the chain the browser
 *  walks — otherwise it silently checks nothing. */
function token(name: string, seen: string[] = []): string {
  if (seen.includes(name)) throw new Error(`token --${name} is circular: ${seen.join(" -> ")}`);
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`token --${name} is not defined in tokens.css`);
  const value = match[1].trim();
  const hex = value.match(/^#[0-9a-fA-F]{6}$/);
  if (hex) return value.toLowerCase();
  const indirect = value.match(/^var\(\s*--([\w-]+)\s*\)$/);
  if (indirect) return token(indirect[1], [...seen, name]);
  throw new Error(`token --${name} is neither a hex nor a var(): ${value}`);
}

function channel(value: number): number {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const INK = "#0a0908";
const LACQUER = "#101013";

describe("ground", () => {
  it("pins ink and lacquer to the sampled values", () => {
    expect(token("ink")).toBe(INK);
    expect(token("lacquer")).toBe(LACQUER);
  });

  it("records that lacquer is a field and not a boundary", () => {
    // 1.05:1 — a panel drawn in lacquer alone is invisible against ink, which is
    // why --edge exists and why the panel rule pairs the two.
    expect(ratio(token("lacquer"), INK)).toBeLessThan(1.5);
  });
});

describe("text roles clear WCAG AA on both grounds", () => {
  const roles = [
    ["text", 15.3],
    ["text-display", 12.4],
    ["text-body", 8.6],
    ["text-muted", 5.2],
    ["text-link", 6.9],
  ] as const;

  for (const [role, expected] of roles) {
    it(`--${role} is at least ${expected}:1 on ink and still AA on lacquer`, () => {
      const hex = token(role);
      expect(ratio(hex, INK)).toBeGreaterThanOrEqual(expected);
      // Workbench panels are lacquer, not ink, so every text role has to clear
      // AA there too — muted drops from 5.21 to 4.97 and is the tight one.
      expect(ratio(hex, LACQUER)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("state chips are measured against their own fill", () => {
  // The ratio that matters for a chip is text-on-chip-fill, not text-on-page.
  // Quoting the on-ink number would overstate every one of these by ~1.4.
  for (const state of ["ok", "live", "idle"]) {
    it(`--${state}-text clears AA on --${state}-fill`, () => {
      expect(ratio(token(`${state}-text`), token(`${state}-fill`))).toBeGreaterThanOrEqual(4.5);
    });

    it(`--${state}-edge clears 1.4.11 against both grounds it can sit on`, () => {
      expect(ratio(token(`${state}-edge`), INK)).toBeGreaterThanOrEqual(3);
      expect(ratio(token(`${state}-edge`), LACQUER)).toBeGreaterThanOrEqual(3);
    });
  }

  it("keeps chip fills quiet enough to read as fills", () => {
    for (const state of ["ok", "live", "idle"]) {
      expect(ratio(token(`${state}-fill`), INK)).toBeLessThan(3);
    }
  });
});

describe("the placard is legible at its own size", () => {
  // --text-placard is 11px. Muted is specified as never below 14px, so the
  // placard cannot use it; stone-500 is the smallest role that carries it.
  it("placard text does not fall back to muted", () => {
    expect(ratio(token("idle-text"), LACQUER)).toBeGreaterThanOrEqual(7);
    expect(token("text-muted")).not.toBe(token("idle-text"));
  });
});

describe("structural roles clear WCAG 1.4.11 non-text contrast", () => {
  // Revision 1 of this design used brass-100 as the panel border. It computes to
  // 1.31:1 — the border was invisible. Every role below is checked on both
  // grounds so that cannot recur.
  for (const role of ["edge", "edge-strong", "edge-quiet", "focus"]) {
    it(`--${role} is at least 3:1 on ink and lacquer`, () => {
      expect(ratio(token(role), INK)).toBeGreaterThanOrEqual(3);
      expect(ratio(token(role), LACQUER)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("fill-only roles are never mistaken for text roles", () => {
  it("the emerald seed is genuinely illegible and so can only ever be a fill", () => {
    // 2.25:1. Not a policy choice — deep emerald cannot carry a glyph at all.
    expect(ratio(token("ok-seed"), INK)).toBeLessThan(3);
  });

  it("the vermilion core is reserved by design rather than by legibility", () => {
    // 4.54:1 — it would technically pass AA, which is exactly why this needs
    // asserting: the palette reserves vermilion-500 as "the only red allowed on
    // text", so the core must never be wired up as a text role by accident.
    expect(ratio(token("live-core"), INK)).toBeGreaterThanOrEqual(4.5);
    expect(token("live-text")).not.toBe(token("live-core"));
    expect(ratio(token("live-text"), INK)).toBeGreaterThan(ratio(token("live-core"), INK));
  });

  it("decorative brass fills are below the structural floor", () => {
    expect(ratio(token("brass-100"), INK)).toBeLessThan(3);
    expect(ratio(token("brass-200"), INK)).toBeLessThan(3);
  });

  it("brass-300 is the lightest brass that may carry a stroke", () => {
    expect(ratio(token("brass-300"), INK)).toBeGreaterThanOrEqual(3);
    expect(token("edge")).toBe(token("brass-300"));
  });
});

describe("spacing contract", () => {
  it("keeps heading-to-body at the 20px the design promises", () => {
    expect(css).toMatch(/--gap-heading-body:\s*var\(--space-xl\)/);
    expect(css).toMatch(/--space-xl:\s*1\.25rem/);
  });

  it("defines every relationship the audit walks", () => {
    for (const name of [
      "gap-heading-body",
      "gap-eyebrow-heading",
      "gap-panel-heading-body",
      "pad-card",
      "pad-cell-inline",
      "pad-chip-inline",
      "band-block",
      "measure-body",
    ]) {
      expect(css).toContain(`--${name}:`);
    }
  });
});

describe("dark-only decision", () => {
  it("declares color-scheme so native controls do not render light on ink", () => {
    expect(css).toMatch(/color-scheme:\s*dark/);
  });

  it("restores real borders under forced colours", () => {
    expect(css).toMatch(/@media \(forced-colors: active\)/);
  });
});
