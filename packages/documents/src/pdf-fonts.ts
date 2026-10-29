import "regenerator-runtime/runtime.js";
import { readFile } from "node:fs/promises";
import fontkit, { type Font, type Glyph, type Subset } from "@pdf-lib/fontkit";
import {
  Cache,
  CustomFontEmbedder,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  PDFString,
  beginText,
  endText,
  setFontAndSize,
  setTextMatrix,
  showText,
  type PDFContext,
  type PDFPage,
  type PDFRef,
} from "pdf-lib";

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
// Stay below the PDF limit and avoid long-destination rejection in common readers.
const maxMappingUnits = 32;
const fontFiles = [
  "NotoSans-Regular.ttf",
  "NotoSansDevanagari-Regular.ttf",
  "NotoSansSC-Regular.ttf",
];
let bundledFonts: Promise<Array<{ bytes: Buffer; font: Font }>> | undefined;

function loadFonts() {
  return (bundledFonts ??= Promise.all(
    fontFiles.map(async (name) => {
      const bytes = await readFile(new URL(`../fonts/${name}`, import.meta.url));
      return { bytes, font: fontkit.create(bytes) };
    }),
  ));
}

/** Preserve bounded logical Unicode mappings independently of glyph reordering. */
class PacketFontEmbedder extends CustomFontEmbedder {
  private readonly subset: Subset;
  private readonly used: Glyph[] = [];
  private readonly glyphIds: number[] = [];
  private readonly encoded = new Map<string, number>();

  constructor(font: Font, bytes: Uint8Array) {
    super(font, bytes);
    this.subset = font.createSubset();
    this.glyphCache = Cache.populatedBy(() => this.used);
  }

  glyph(glyph: Glyph, text: string): PDFHexString {
    if (text.length > maxMappingUnits) throw new Error("PACKET_TEXT_UNSUPPORTED");
    const key = `${glyph.id}:${text}`;
    let cid = this.encoded.get(key);
    if (cid === undefined) {
      cid = this.used.length + 1;
      if (cid > 0xffff) throw new Error("PACKET_TEXT_UNSUPPORTED");
      this.encoded.set(key, cid);
      this.glyphIds.push(this.subset.includeGlyph(glyph));
      const mapped = Object.create(glyph) as Glyph;
      Object.defineProperties(mapped, {
        id: { value: cid },
        codePoints: { value: Array.from(text, (character) => character.codePointAt(0)!) },
      });
      this.used.push(mapped);
      this.glyphCache.invalidate();
    }
    return PDFHexString.of(cid.toString(16).padStart(4, "0"));
  }

  protected override async embedCIDFontDict(context: PDFContext): Promise<PDFRef> {
    const mapping = new Uint8Array((this.glyphIds.length + 1) * 2);
    this.glyphIds.forEach((id, index) => {
      mapping[(index + 1) * 2] = id >> 8;
      mapping[(index + 1) * 2 + 1] = id & 0xff;
    });
    return context.register(
      context.obj({
        Type: "Font",
        Subtype: "CIDFontType2",
        BaseFont: this.baseFontName,
        CIDToGIDMap: context.register(context.flateStream(mapping)),
        CIDSystemInfo: {
          Registry: PDFString.of("Adobe"),
          Ordering: PDFString.of("Identity"),
          Supplement: 0,
        },
        FontDescriptor: await this.embedFontDescriptor(context),
        W: this.computeWidths(),
      }),
    );
  }

  protected override serializeFont(): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const parts: Uint8Array[] = [];
      const stream = this.subset.encodeStream();
      stream.on("data", (part) => parts.push(part));
      stream.on("end", () => resolve(Buffer.concat(parts)));
      // fontkit's declaration omits the Node stream error event.
      (stream as unknown as NodeJS.EventEmitter).on("error", reject);
    });
  }
}

type LoadedFont = { font: Font; embedder: PacketFontEmbedder; ref: PDFRef };
type Run = { font: LoadedFont; text: string };

export class PacketPdfFonts {
  private readonly used = new Map<Font, LoadedFont>();

  private constructor(
    private readonly pdf: PDFDocument,
    private readonly fonts: Awaited<ReturnType<typeof loadFonts>>,
  ) {}

  static async load(pdf: PDFDocument, text: string): Promise<PacketPdfFonts> {
    const fonts = new PacketPdfFonts(pdf, await loadFonts());
    // Reject before rendering or writing any format; never substitute .notdef.
    if (/[\p{Cf}\p{Cc}]/u.test(text.replace(/[\n\r\t]/gu, ""))) {
      throw new Error("PACKET_TEXT_UNSUPPORTED");
    }
    fonts.runs(text.replace(/\s+/gu, " "));
    return fonts;
  }

  private runs(text: string): Run[] {
    const runs: Run[] = [];
    for (const { segment } of graphemes.segment(text)) {
      const candidates = /\p{Script_Extensions=Devanagari}/u.test(segment)
        ? [this.fonts[1]!, this.fonts[0]!, this.fonts[2]!]
        : this.fonts;
      const entry = candidates.find(({ font }) =>
        Array.from(segment).every((character) =>
          font.hasGlyphForCodePoint(character.codePointAt(0)!),
        ),
      );
      if (!entry || /\p{Cf}|\p{Cc}/u.test(segment)) throw new Error("PACKET_TEXT_UNSUPPORTED");
      let loaded = this.used.get(entry.font);
      if (!loaded) {
        loaded = {
          font: entry.font,
          embedder: new PacketFontEmbedder(entry.font, entry.bytes),
          ref: this.pdf.context.nextRef(),
        };
        this.used.set(entry.font, loaded);
      }
      const previous = runs.at(-1);
      if (previous?.font === loaded) previous.text += segment;
      else runs.push({ font: loaded, text: segment });
    }
    return runs;
  }

  width(text: string, size: number): number {
    return this.runs(text).reduce(
      (width, run) =>
        width + (run.font.font.layout(run.text).advanceWidth * size) / run.font.font.unitsPerEm,
      0,
    );
  }

  textMappings(text: string): string[] {
    const chunks: string[] = [];
    let chunk = "";
    for (const { segment } of graphemes.segment(text)) {
      if (segment.length > maxMappingUnits) throw new Error("PACKET_TEXT_UNSUPPORTED");
      if (chunk.length + segment.length > maxMappingUnits) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += segment;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  }

  draw(page: PDFPage, text: string, mappings: string[], x: number, y: number, size: number): void {
    const operators: PDFOperator[] = [];
    let spanText = "";
    const flushSpan = () => {
      if (!operators.length) return;
      page.pushOperators(
        PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
          PDFName.of("Span"),
          this.pdf.context.obj({ ActualText: PDFHexString.fromText(spanText) }).toString(),
        ]),
        ...operators,
        PDFOperator.of(PDFOperatorNames.EndMarkedContent),
      );
      operators.length = 0;
      spanText = "";
    };
    for (const run of this.runs(text)) {
      const layout = run.font.font.layout(run.text);
      const scale = size / run.font.font.unitsPerEm;
      const key = PDFName.of(`Noto${run.font.ref.objectNumber}`);
      page.node.setFontDictionary(key, run.font.ref);
      const emit = (glyph: Glyph, logicalText: string, atX: number, atY: number) => {
        if (glyph.id === 0) throw new Error("PACKET_TEXT_UNSUPPORTED");
        // Format marks keep shaping-only glyphs out of extractors that ignore ActualText.
        const unicode = logicalText || "\u200b";
        // Keep ActualText strings at most 16,386 UTF-16BE bytes, including the BOM.
        if (spanText.length + logicalText.length > 8192) flushSpan();
        spanText += logicalText;
        operators.push(
          beginText(),
          setFontAndSize(key, size),
          setTextMatrix(1, 0, 0, 1, atX, atY),
          showText(run.font.embedder.glyph(glyph, unicode)),
          endText(),
        );
      };
      for (let index = 0; index < layout.glyphs.length; index += 1) {
        const glyph = layout.glyphs[index]!;
        const position = layout.positions[index]!;
        // PDF.js gives any mapping containing a combining mark zero text advance.
        // Put those mappings on an empty outline so the visible glyph keeps its position.
        while (mappings[0] && /\p{Mn}/u.test(mappings[0])) {
          emit(run.font.font.glyphForCodePoint(0x20), mappings.shift()!, x, y);
        }
        // Consume bounded source chunks across physical line fragments.
        emit(
          glyph,
          mappings.shift() ?? "",
          x + position.xOffset * scale,
          y + position.yOffset * scale,
        );
        x += position.xAdvance * scale;
        y += position.yAdvance * scale;
      }
    }
    flushSpan();
  }

  async embed(): Promise<void> {
    await Promise.all(
      Array.from(this.used.values(), ({ embedder, ref }) =>
        embedder.embedIntoContext(this.pdf.context, ref),
      ),
    );
  }
}
