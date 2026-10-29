import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectPacketArtifacts,
  packetText,
  renderPacketArtifacts,
  type CanonicalPacket,
} from "../src/index.js";

const packet: CanonicalPacket = {
  schemaVersion: "packet_v1",
  candidateName: "Priya Shah",
  destination: { company: "Northwind", role: "Platform Engineer" },
  summary: "Platform engineer with evidence-backed TypeScript delivery experience.",
  claims: [{ text: "Led a typed service migration.", evidenceIds: ["e1"] }],
  authorizationWording: "I am authorized to work and would require H-1B transfer support.",
  generatedAt: "2026-08-05T12:00:00.000Z",
};

const temporaryRoots: string[] = [];
async function mkdtempTracked(prefix: string): Promise<string> {
  const root = await mkdtemp(prefix);
  temporaryRoots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function checkPdfMappingsAndOutlines(filename: string, expectedText?: string): Promise<void> {
  const bytes = await readFile(filename);
  const pdf = await PDFDocument.load(bytes);
  let embeddedFonts = 0;
  let unicodeMaps = 0;
  let actualTextMappings = 0;
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream) {
      const source = Buffer.from(decodePDFRawStream(object).decode()).toString("latin1");
      for (const match of source.matchAll(/\/ActualText\s+<([0-9a-f]*)>/giu)) {
        expect(match[1]!.length / 2).toBeLessThanOrEqual(16386);
        actualTextMappings += 1;
      }
    }
    if (!(object instanceof PDFDict)) continue;
    const unicodeMap = object.get(PDFName.of("ToUnicode"));
    if (unicodeMap) {
      const stream = pdf.context.lookup(unicodeMap);
      if (!(stream instanceof PDFRawStream)) throw new Error("Expected a Unicode map stream");
      const source = Buffer.from(decodePDFRawStream(stream).decode()).toString("ascii");
      for (const match of source.matchAll(/<[0-9a-f]+>\s+<([0-9a-f]*)>/giu)) {
        const target = Buffer.from(match[1]!, "hex");
        // PDF 32000-1 §9.10.3 limits each ToUnicode destination to 512 bytes.
        expect(target.length).toBeLessThanOrEqual(64);
        expect(() => new TextDecoder("utf-16be", { fatal: true }).decode(target)).not.toThrow();
      }
      unicodeMaps += 1;
    }
    const fontFile = object.get(PDFName.of("FontFile2"));
    if (!fontFile) continue;
    const stream = pdf.context.lookup(fontFile);
    if (!(stream instanceof PDFRawStream)) throw new Error("Expected an embedded font stream");
    const embedded = fontkit.create(decodePDFRawStream(stream).decode());
    // A correct text layer must not hide malformed embedded glyph outlines.
    for (let id = 0; id < embedded.numGlyphs; id += 1) {
      expect(() => embedded.getGlyph(id).path.toSVG()).not.toThrow();
    }
    embeddedFonts += 1;
  }
  expect(embeddedFonts).toBeGreaterThan(0);
  expect(unicodeMaps).toBe(embeddedFonts);
  expect(actualTextMappings).toBeGreaterThan(0);
  if (expectedText) {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: Uint8Array.from(bytes), disableFontFace: true, verbosity: 0 });
    try {
      const document = await task.promise;
      let extracted = "";
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent({ disableNormalization: true });
        extracted += content.items
          .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : ""}` : ""))
          .join("");
      }
      expect(extracted).toContain(expectedText);
    } finally {
      await task.destroy();
    }
  }
}

describe("packet documents", () => {
  it.each([
    { candidateName: "张伟", claim: "设计可靠的数据平台。" },
    { candidateName: "अनन्या शर्मा", claim: "अनुभव: विश्वसनीय प्रणालियों का निर्माण।" },
    { candidateName: "Zoë García — 张伟", claim: "Résumé: café, naïve; अनुभव और TypeScript." },
  ])("preserves accepted Unicode text in all six formats: $candidateName", async (input) => {
    const directory = await mkdtempTracked(path.join(tmpdir(), "nimanto-unicode-packet-"));
    const unicodePacket: CanonicalPacket = {
      ...packet,
      candidateName: input.candidateName,
      claims: [{ text: input.claim, evidenceIds: ["e1"] }],
    };
    const artifacts = await renderPacketArtifacts("unicode", unicodePacket, directory);
    expect(artifacts).toHaveLength(6);
    expect((await inspectPacketArtifacts("unicode", unicodePacket, artifacts)).status).toBe(
      "passed",
    );
    for (const artifact of artifacts.filter((artifact) => artifact.format.endsWith("pdf"))) {
      await checkPdfMappingsAndOutlines(artifact.path, input.claim);
    }
  });

  it.each([
    { script: "Latin", text: "TypeScript".repeat(40) },
    { script: "CJK", text: "可靠的数据平台".repeat(45) },
    { script: "Devanagari", text: "विश्वसनीय".repeat(40) },
    { script: "astral and combining Latin", text: "A".repeat(255) + "𐞀e\u0301" + "B".repeat(260) },
  ])("bounds Unicode mappings without losing long $script words", async ({ text }) => {
    expect(text.length).toBeGreaterThan(256);
    const directory = await mkdtempTracked(path.join(tmpdir(), "nimanto-bounded-mapping-"));
    const longPacket: CanonicalPacket = { ...packet, claims: [{ text, evidenceIds: ["e1"] }] };
    const artifacts = await renderPacketArtifacts("bounded", longPacket, directory);
    expect((await inspectPacketArtifacts("bounded", longPacket, artifacts)).status).toBe("passed");
    for (const artifact of artifacts.filter((artifact) => artifact.format.endsWith("pdf"))) {
      await checkPdfMappingsAndOutlines(artifact.path, text);
    }
  });

  it.each([32, 256])(
    "refuses an oversized indivisible grapheme without writing partial artifacts",
    async (marks) => {
      const directory = await mkdtempTracked(path.join(tmpdir(), "nimanto-oversized-grapheme-"));
      const text = "A" + "\u0301".repeat(marks);
      await expect(
        renderPacketArtifacts("grapheme", { ...packet, candidateName: text }, directory),
      ).rejects.toThrow("PACKET_TEXT_UNSUPPORTED");
      expect(await readdir(directory)).toEqual([]);
    },
  );

  it("refuses unavailable glyphs without writing a partial packet", async () => {
    const directory = await mkdtempTracked(path.join(tmpdir(), "nimanto-unsupported-packet-"));
    await expect(
      renderPacketArtifacts("unsupported", { ...packet, candidateName: "Synthetic 🦄" }, directory),
    ).rejects.toThrow("PACKET_TEXT_UNSUPPORTED");
    expect(await readdir(directory)).toEqual([]);
  });

  it("wraps wide CJK and long unbroken text without changing extractable wording", async () => {
    const directory = await mkdtempTracked(path.join(tmpdir(), "nimanto-wrapped-packet-"));
    const widePacket: CanonicalPacket = {
      ...packet,
      candidateName: "Cafe\u0301 García",
      claims: [
        { text: "可靠的数据平台".repeat(20), evidenceIds: ["e1"] },
        { text: "https://synthetic.example.test/" + "TypeScript".repeat(18), evidenceIds: ["e2"] },
      ],
    };
    const artifacts = await renderPacketArtifacts("wrapped", widePacket, directory);
    const inspection = await inspectPacketArtifacts("wrapped", widePacket, artifacts);
    expect(inspection.status).toBe("passed");
  });

  it.each(["Synthetic\u200bName", "Synthetic\u0000Name", "Synthetic\uFEFFName"])(
    "refuses invisible format/control characters without altering source text",
    async (candidateName) => {
      const directory = await mkdtempTracked(path.join(tmpdir(), "nimanto-control-packet-"));
      await expect(
        renderPacketArtifacts("control", { ...packet, candidateName }, directory),
      ).rejects.toThrow("PACKET_TEXT_UNSUPPORTED");
      expect(await readdir(directory)).toEqual([]);
    },
  );

  it("renders a stable plain-text packet", () => {
    expect(packetText(packet)).toContain("EVIDENCE-BACKED HIGHLIGHTS");
    expect(packetText(packet)).toContain("H-1B transfer support");
  });

  it("blocks changed PDF wording even if its artifact hash is recomputed", async () => {
    const directory = await mkdtempTracked(path.join(tmpdir(), "nimanto-pdf-content-drift-"));
    const artifacts = await renderPacketArtifacts(
      "drift",
      packet,
      path.join(directory, "original"),
    );
    const changed = await renderPacketArtifacts(
      "drift",
      {
        ...packet,
        claims: [{ text: "An unapproved replacement statement.", evidenceIds: ["e1"] }],
      },
      path.join(directory, "changed"),
    );
    const target = artifacts.find((artifact) => artifact.format === "modern_pdf")!;
    const bytes = await readFile(
      changed.find((artifact) => artifact.format === "modern_pdf")!.path,
    );
    await writeFile(target.path, bytes, { mode: 0o600 });
    target.sha256 = createHash("sha256").update(bytes).digest("hex");
    const inspection = await inspectPacketArtifacts("drift", packet, artifacts);
    expect(inspection.status).toBe("blocked");
    expect(inspection.checks).toContainEqual(
      expect.objectContaining({
        code: "CRITICAL_CONTENT_PARITY",
        format: "modern_pdf",
        status: "blocked",
      }),
    );
  });

  it("writes shared JSON/text plus synchronized modern and ATS-safe DOCX/PDF artifacts", async () => {
    const directory = await mkdtempTracked(path.join(tmpdir(), "nimanto-packet-"));
    const artifacts = await renderPacketArtifacts("p1", packet, directory);
    expect(artifacts.map((artifact) => artifact.format)).toEqual([
      "json",
      "txt",
      "modern_docx",
      "modern_pdf",
      "ats_docx",
      "ats_pdf",
    ]);
    expect((await readFile(artifacts[2]!.path)).subarray(0, 2).toString()).toBe("PK");
    expect((await readFile(artifacts[3]!.path)).subarray(0, 4).toString()).toBe("%PDF");
    expect((await readFile(artifacts[4]!.path)).subarray(0, 2).toString()).toBe("PK");
    expect((await readFile(artifacts[5]!.path)).subarray(0, 4).toString()).toBe("%PDF");
    for (const artifact of artifacts) {
      const bytes = await readFile(artifact.path);
      expect(artifact.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    }
    const inspection = await inspectPacketArtifacts("p1", packet, artifacts);
    expect(inspection.status).toBe("passed");
    expect(inspection.checks.filter((check) => check.status === "blocked")).toEqual([]);
  });
});
