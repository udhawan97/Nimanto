import type { EvidenceClaim } from "@nimanto/domain";
import { unzipSync } from "fflate";
import { SaxesParser } from "saxes";

export interface EvidenceFileInput {
  filename: string;
  mimeType?: string;
  bytes: Uint8Array;
}

export interface ParsedEvidence {
  claims: Array<Omit<EvidenceClaim, "id">>;
  warnings: string[];
  preview?: {
    acceptedFiles: string[];
    ignoredFiles: string[];
    acceptedFields: Array<{ file: string; fields: string[] }>;
  };
}

const kinds = new Map<string, EvidenceClaim["kind"]>([
  ["skill", "skill"],
  ["skills", "skill"],
  ["employment", "employment"],
  ["experience", "employment"],
  ["education", "education"],
  ["project", "project"],
  ["certification", "certification"],
  ["accomplishment", "accomplishment"],
  ["achievement", "accomplishment"],
  ["preference", "preference"],
  ["authorization", "authorization_wording"],
]);

function cleanLine(line: string): string {
  return line
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/\s+/g, " ")
    .normalize("NFC")
    .trim();
}

export function claimsFromText(text: string, sourceName: string): ParsedEvidence {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const claims: ParsedEvidence["claims"] = [];

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = cleanLine(rawLine);
    if (line.length < 3) continue;
    const match = /^([A-Za-z ]{2,24}):\s*(.+)$/.exec(line);
    const kind = kinds.get(match?.[1]?.toLocaleLowerCase("en-US") ?? "") ?? "accomplishment";
    const value = cleanLine(match?.[2] ?? line);
    const dedupeKey = value.toLocaleLowerCase("en-US");
    if (value.length < 3 || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    claims.push({
      kind,
      value,
      status: "pending",
      confidence: "medium",
      sourceName,
      locator: `line:${index + 1}`,
      userAttested: false,
    });
  }

  if (claims.length === 0) warnings.push("No evidence-like lines were found.");
  return { claims, warnings };
}

function parseJson(bytes: Uint8Array, sourceName: string): ParsedEvidence {
  const text = decodeSafeText(bytes);
  assertNoProhibitedDocumentContent(sourceName, text);
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
  const values = Array.isArray(decoded)
    ? decoded
    : typeof decoded === "object" &&
        decoded !== null &&
        Array.isArray((decoded as { claims?: unknown }).claims)
      ? (decoded as { claims: unknown[] }).claims
      : [];
  const claimText = values
    .map((value) => {
      if (typeof value === "string") return value;
      if (typeof value !== "object" || value === null) return "";
      const item = value as { kind?: unknown; value?: unknown };
      return `${typeof item.kind === "string" ? item.kind : "Accomplishment"}: ${typeof item.value === "string" ? item.value : ""}`;
    })
    .join("\n");
  return claimsFromText(claimText, sourceName);
}

const PROHIBITED_DOCUMENT_PATTERN =
  /(?:\bpassport\b|social security (?:number|card)|\bssn\b|\bi[- ]?797\b|\bi[- ]?94\b|visa stamp|attorney[- ]client|immigration (?:petition|document))/iu;

function decodeSafeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("INVALID_TEXT_ENCODING");
  }
  if (text.length > 500_000 || text.includes("\0")) throw new Error("TEXT_LIMIT_EXCEEDED");
  return text;
}

function assertNoProhibitedDocumentContent(filename: string, text: string): void {
  if (PROHIBITED_DOCUMENT_PATTERN.test(filename) || PROHIBITED_DOCUMENT_PATTERN.test(text)) {
    throw new Error("PROHIBITED_DOCUMENT_CONTENT");
  }
}

function assertMimeType(actual: string | undefined, allowed: string[]): void {
  if (actual && !allowed.includes(actual)) throw new Error("FILE_TYPE_MISMATCH");
}

const MAX_ARCHIVE_ENTRIES = 50;
const MAX_ARCHIVE_EXPANDED_BYTES = 25 * 1024 * 1024;
const MAX_ARCHIVE_RATIO = 20;

function assertArchiveEntryLimits(input: {
  entries: number;
  expandedBytes: number;
  compressedBytes: number;
}): void {
  if (
    input.entries > MAX_ARCHIVE_ENTRIES ||
    input.expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES ||
    input.expandedBytes > Math.max(1, input.compressedBytes) * MAX_ARCHIVE_RATIO
  ) {
    throw new Error("ARCHIVE_EXPANSION_LIMIT_EXCEEDED");
  }
}

function parseDocx(bytes: Uint8Array, sourceName: string): ParsedEvidence {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("FILE_TYPE_MISMATCH");
  let files: Record<string, Uint8Array>;
  let entries = 0;
  let expandedBytes = 0;
  let compressedBytes = 0;
  let activeContent = false;
  try {
    files = unzipSync(bytes, {
      filter: (entry) => {
        entries += 1;
        expandedBytes += entry.originalSize;
        compressedBytes += entry.size;
        assertArchiveEntryLimits({ entries, expandedBytes, compressedBytes });
        if (entry.name.startsWith("word/embeddings/") || entry.name.endsWith("vbaProject.bin")) {
          activeContent = true;
          return false;
        }
        return entry.name === "word/document.xml";
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ARCHIVE_EXPANSION_LIMIT_EXCEEDED") {
      throw new Error("DOCX_EXPANSION_LIMIT_EXCEEDED");
    }
    throw new Error("INVALID_DOCX");
  }
  if (activeContent) throw new Error("ACTIVE_DOCUMENT_CONTENT");
  const document = files["word/document.xml"];
  if (!document) throw new Error("INVALID_DOCX");

  const paragraphs: string[] = [];
  let current = "";
  let inText = false;
  const parser = new SaxesParser({ xmlns: false });
  parser.on("opentag", (node) => {
    if (node.name === "w:t" || node.name === "t") inText = true;
    if (node.name === "w:tab" || node.name === "tab") current += "\t";
    if (node.name === "w:br" || node.name === "br") current += "\n";
  });
  parser.on("text", (value) => {
    if (inText) current += value;
  });
  parser.on("closetag", (node) => {
    if (node.name === "w:t" || node.name === "t") inText = false;
    if (node.name === "w:p" || node.name === "p") {
      const value = cleanLine(current);
      if (value) paragraphs.push(value);
      current = "";
    }
  });
  try {
    parser.write(decodeSafeText(document)).close();
  } catch {
    throw new Error("INVALID_DOCX_XML");
  }
  const text = paragraphs.join("\n");
  assertNoProhibitedDocumentContent(sourceName, text);
  const parsed = claimsFromText(text, sourceName);
  parsed.claims = parsed.claims.map((claim, index) => ({
    ...claim,
    locator: `paragraph:${index + 1}`,
  }));
  if (paragraphs.length === 0) throw new Error("DOCX_TEXT_REQUIRED");
  return parsed;
}

const LINKEDIN_FIELDS = new Map<string, Array<{ names: string[]; kind: EvidenceClaim["kind"] }>>([
  [
    "profile.csv",
    [
      { names: ["Headline"], kind: "accomplishment" },
      { names: ["Summary"], kind: "accomplishment" },
      { names: ["Industry"], kind: "preference" },
    ],
  ],
  [
    "positions.csv",
    [
      {
        names: ["Company Name", "Title", "Description", "Started On", "Finished On"],
        kind: "employment",
      },
    ],
  ],
  ["education.csv", [{ names: ["School Name", "Degree Name", "Notes"], kind: "education" }]],
  ["skills.csv", [{ names: ["Name"], kind: "skill" }]],
  [
    "certifications.csv",
    [{ names: ["Name", "Authority", "Started On", "Finished On"], kind: "certification" }],
  ],
  ["projects.csv", [{ names: ["Title", "Description"], kind: "project" }]],
]);

function csvRows(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("INVALID_LINKEDIN_CSV");
  if (field || row.length) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  return rows;
}

function parseLinkedInArchive(bytes: Uint8Array, sourceName: string): ParsedEvidence {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("FILE_TYPE_MISMATCH");
  const observed: Array<{ name: string; originalSize: number; size: number }> = [];
  let expandedBytes = 0;
  let compressedBytes = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (entry) => {
        observed.push({ name: entry.name, originalSize: entry.originalSize, size: entry.size });
        expandedBytes += entry.originalSize;
        compressedBytes += entry.size;
        assertArchiveEntryLimits({
          entries: observed.length,
          expandedBytes,
          compressedBytes,
        });
        const base = entry.name.split("/").at(-1)?.toLocaleLowerCase("en-US") ?? "";
        return LINKEDIN_FIELDS.has(base);
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ARCHIVE_EXPANSION_LIMIT_EXCEEDED") {
      throw new Error("LINKEDIN_ARCHIVE_LIMIT_EXCEEDED");
    }
    throw new Error("INVALID_LINKEDIN_ARCHIVE");
  }
  const acceptedFiles: string[] = [];
  const ignoredFiles = observed
    .map((entry) => entry.name)
    .filter(
      (name) => !LINKEDIN_FIELDS.has(name.split("/").at(-1)?.toLocaleLowerCase("en-US") ?? ""),
    );
  const acceptedFields: Array<{ file: string; fields: string[] }> = [];
  const claims: ParsedEvidence["claims"] = [];
  const seenBasenames = new Set<string>();

  for (const [archiveName, content] of Object.entries(files)) {
    const basename = archiveName.split("/").at(-1) ?? archiveName;
    const key = basename.toLocaleLowerCase("en-US");
    const groups = LINKEDIN_FIELDS.get(key);
    if (!groups) continue;
    if (seenBasenames.has(key)) throw new Error("AMBIGUOUS_LINKEDIN_ARCHIVE");
    seenBasenames.add(key);
    const rows = csvRows(decodeSafeText(content));
    const headers = rows[0]?.map((header) => header.normalize("NFC").trim()) ?? [];
    const indexes = new Map(headers.map((header, index) => [header, index]));
    const fields = [...new Set(groups.flatMap((group) => group.names))].filter((field) =>
      indexes.has(field),
    );
    acceptedFiles.push(archiveName);
    acceptedFields.push({ file: archiveName, fields });
    for (const [rowIndex, row] of rows.slice(1).entries()) {
      for (const group of groups) {
        const used = group.names.filter((field) => indexes.has(field));
        const value = used
          .map((field) => cleanLine(row[indexes.get(field)!] ?? ""))
          .filter(Boolean)
          .join(" · ");
        if (value.length < 3) continue;
        assertNoProhibitedDocumentContent(sourceName, value);
        claims.push({
          kind: group.kind,
          value,
          status: "pending",
          confidence: "medium",
          sourceName,
          locator: `file:${archiveName};row:${rowIndex + 2};fields:${used.join("|")}`,
          userAttested: false,
        });
      }
    }
  }
  if (acceptedFiles.length === 0) throw new Error("LINKEDIN_ALLOWLIST_EMPTY");
  return {
    claims,
    warnings: ignoredFiles.map((file) => `Ignored unapproved LinkedIn archive file: ${file}`),
    preview: { acceptedFiles, ignoredFiles, acceptedFields },
  };
}

async function parsePdf(bytes: Uint8Array, sourceName: string): Promise<ParsedEvidence> {
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error("FILE_TYPE_MISMATCH");
  }
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let document: Awaited<ReturnType<typeof getDocument>["promise"]>;
  let loadingTask: ReturnType<typeof getDocument> | undefined;
  try {
    loadingTask = getDocument({
      data: bytes.slice(),
      useWorkerFetch: false,
      useWasm: false,
      stopAtErrors: true,
      disableFontFace: true,
      enableXfa: false,
      verbosity: 0,
    });
    document = await loadingTask.promise;
  } catch {
    throw new Error("INVALID_PDF");
  }
  if (document.numPages > 50) throw new Error("PDF_PAGE_LIMIT_EXCEEDED");
  const claims: ParsedEvidence["claims"] = [];
  const warnings: string[] = [];
  let extracted = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""))
      .join("")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim();
    if (!text) continue;
    extracted += `${text}\n`;
    const pageClaims = claimsFromText(text, sourceName);
    claims.push(
      ...pageClaims.claims.map((claim, index) => ({
        ...claim,
        locator: `page:${pageNumber};item:${index + 1}`,
      })),
    );
    warnings.push(...pageClaims.warnings.map((warning) => `Page ${pageNumber}: ${warning}`));
  }
  await loadingTask?.destroy();
  if (!extracted.trim()) throw new Error("PDF_TEXT_LAYER_REQUIRED");
  assertNoProhibitedDocumentContent(sourceName, extracted);
  return { claims, warnings };
}

export async function parseEvidenceFile(input: EvidenceFileInput): Promise<ParsedEvidence> {
  if (input.bytes.byteLength > 8 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  const lower = input.filename.toLocaleLowerCase("en-US");
  if (lower.endsWith(".docx")) {
    assertMimeType(input.mimeType, [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    return parseDocx(input.bytes, input.filename);
  }
  if (lower.endsWith(".pdf")) {
    assertMimeType(input.mimeType, ["application/pdf"]);
    return parsePdf(input.bytes, input.filename);
  }
  if (lower.endsWith(".zip")) {
    assertMimeType(input.mimeType, ["application/zip", "application/x-zip-compressed"]);
    return parseLinkedInArchive(input.bytes, input.filename);
  }
  if (lower.endsWith(".json")) {
    if (input.mimeType && !["application/json", "text/json"].includes(input.mimeType)) {
      throw new Error("FILE_TYPE_MISMATCH");
    }
    return parseJson(input.bytes, input.filename);
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    if (input.mimeType && !input.mimeType.startsWith("text/")) {
      throw new Error("FILE_TYPE_MISMATCH");
    }
    const text = decodeSafeText(input.bytes);
    assertNoProhibitedDocumentContent(input.filename, text);
    return claimsFromText(text, input.filename);
  }
  throw new Error("UNSUPPORTED_FILE_TYPE");
}
