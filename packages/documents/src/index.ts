import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalJson } from "@nimanto/domain";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { unzipSync } from "fflate";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface PacketClaim {
  text: string;
  evidenceIds: string[];
}

export interface CanonicalPacket {
  schemaVersion: "packet_v1";
  candidateName: string;
  destination: { company: string; role: string; contactEmail?: string };
  summary: string;
  claims: PacketClaim[];
  authorizationWording: string;
  generatedAt: string;
}

export interface PacketArtifact {
  format: "json" | "txt" | "modern_docx" | "modern_pdf" | "ats_docx" | "ats_pdf";
  filename: string;
  path: string;
  sha256: string;
}

export interface DocumentInspection {
  ruleVersion: "document_assurance_v1";
  status: "passed" | "blocked";
  checks: Array<{
    code: string;
    status: "passed" | "blocked";
    format?: PacketArtifact["format"];
    detail: string;
  }>;
}

export function packetText(packet: CanonicalPacket): string {
  return [
    packet.candidateName,
    `${packet.destination.role} — ${packet.destination.company}`,
    "",
    "SUMMARY",
    packet.summary,
    "",
    "EVIDENCE-BACKED HIGHLIGHTS",
    ...packet.claims.map((claim) => `• ${claim.text}`),
    "",
    "WORK AUTHORIZATION",
    packet.authorizationWording,
  ].join("\n");
}

async function createDocx(packet: CanonicalPacket, variant: "modern" | "ats"): Promise<Buffer> {
  const font = variant === "modern" ? "Aptos" : "Arial";
  const document = new Document({
    creator: "Nimanto",
    title: `${packet.destination.role} ${variant === "modern" ? "modern" : "ATS-safe"} application packet`,
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: packet.candidateName,
                bold: true,
                size: variant === "modern" ? 32 : 28,
                font,
              }),
            ],
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            text: `${packet.destination.role} — ${packet.destination.company}`,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ children: [new TextRun({ text: packet.summary, font })] }),
          new Paragraph({ text: "Evidence-backed highlights", heading: HeadingLevel.HEADING_2 }),
          ...packet.claims.map(
            (claim) =>
              new Paragraph({
                children: [new TextRun({ text: claim.text, font })],
                ...(variant === "modern" ? { bullet: { level: 0 } } : {}),
              }),
          ),
          new Paragraph({ text: "Work authorization", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [new TextRun({ text: packet.authorizationWording, font })],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}

function wrap(text: string, max = 88): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      if (`${line} ${word}`.trim().length > max && line) {
        lines.push(line);
        line = word;
      } else line = `${line} ${word}`.trim();
    }
    lines.push(line);
  }
  return lines;
}

async function createPdf(packet: CanonicalPacket, variant: "modern" | "ats"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 742;
  if (variant === "modern") {
    page.drawRectangle({ x: 48, y: 760, width: 516, height: 4, color: rgb(0.12, 0.24, 0.55) });
  }
  const draw = (line: string, emphasized = false) => {
    if (y < 52) {
      page = pdf.addPage([612, 792]);
      y = 742;
    }
    page.drawText(line || " ", {
      x: 56,
      y,
      size: emphasized ? 13 : 10.5,
      font: emphasized ? bold : font,
      color: emphasized && variant === "modern" ? rgb(0.12, 0.24, 0.55) : rgb(0.08, 0.11, 0.16),
    });
    y -= emphasized ? 22 : 15;
  };
  for (const line of wrap(packetText(packet))) {
    draw(line, line === line.toUpperCase() && line.length > 2);
  }
  pdf.setTitle(
    `${packet.destination.role} ${variant === "modern" ? "modern" : "ATS-safe"} application packet`,
  );
  pdf.setAuthor("Nimanto");
  return pdf.save();
}

export async function renderPacketArtifacts(
  packetId: string,
  packet: CanonicalPacket,
  outputDirectory: string,
): Promise<PacketArtifact[]> {
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await chmod(outputDirectory, 0o700);
  const stem = `nimanto-packet-${packetId}`;
  const values: Array<{ format: PacketArtifact["format"]; bytes: Uint8Array }> = [
    { format: "json", bytes: new TextEncoder().encode(`${canonicalJson(packet)}\n`) },
    { format: "txt", bytes: new TextEncoder().encode(`${packetText(packet)}\n`) },
    { format: "modern_docx", bytes: await createDocx(packet, "modern") },
    { format: "modern_pdf", bytes: await createPdf(packet, "modern") },
    { format: "ats_docx", bytes: await createDocx(packet, "ats") },
    { format: "ats_pdf", bytes: await createPdf(packet, "ats") },
  ];
  const artifacts: PacketArtifact[] = [];
  for (const value of values) {
    const extension = value.format.endsWith("docx")
      ? "docx"
      : value.format.endsWith("pdf")
        ? "pdf"
        : value.format;
    const filename = `${stem}-${value.format}.${extension}`;
    const artifactPath = path.join(outputDirectory, filename);
    await writeFile(artifactPath, value.bytes, { mode: 0o600 });
    artifacts.push({
      format: value.format,
      filename,
      path: artifactPath,
      sha256: createHash("sha256").update(value.bytes).digest("hex"),
    });
  }
  return artifacts;
}

function normalizedContent(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function docxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (entry) => entry.name === "word/document.xml" });
  const document = files["word/document.xml"];
  if (!document) throw new Error("DOCUMENT_INSPECTION_DOCX_INVALID");
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(document);
  return Array.from(xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gu), (match) =>
    decodeXml(match[1] ?? ""),
  ).join(" ");
}

async function pdfInspection(bytes: Uint8Array): Promise<{
  text: string;
  pages: number;
  letterSized: boolean;
  noBlankPages: boolean;
  metadata: boolean;
}> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: Uint8Array.from(bytes),
    useWorkerFetch: false,
    useWasm: false,
    stopAtErrors: true,
    disableFontFace: true,
    enableXfa: false,
    verbosity: 0,
  });
  const document = await loadingTask.promise;
  const text: string[] = [];
  let letterSized = true;
  let noBlankPages = true;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    letterSized &&= Math.abs(viewport.width - 612) <= 1 && Math.abs(viewport.height - 792) <= 1;
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    noBlankPages &&= pageText.length > 0;
    text.push(pageText);
  }
  const metadata = await document.getMetadata();
  const info = metadata.info as { Title?: unknown; Author?: unknown };
  await loadingTask.destroy();
  return {
    text: text.join(" "),
    pages: document.numPages,
    letterSized,
    noBlankPages,
    metadata: typeof info.Title === "string" && info.Author === "Nimanto",
  };
}

export async function inspectPacketArtifacts(
  packetId: string,
  packet: CanonicalPacket,
  artifacts: PacketArtifact[],
): Promise<DocumentInspection> {
  const checks: DocumentInspection["checks"] = [];
  const expectedFormats: PacketArtifact["format"][] = [
    "json",
    "txt",
    "modern_docx",
    "modern_pdf",
    "ats_docx",
    "ats_pdf",
  ];
  const criticalText = [
    packet.candidateName,
    packet.destination.company,
    packet.destination.role,
    packet.summary,
    packet.authorizationWording,
    ...packet.claims.map((claim) => claim.text),
  ]
    .map(normalizedContent)
    .filter(Boolean);
  const extracted = new Map<PacketArtifact["format"], string>();

  for (const format of expectedFormats) {
    const artifact = artifacts.find((candidate) => candidate.format === format);
    if (!artifact) {
      checks.push({
        code: "ARTIFACT_REQUIRED",
        status: "blocked",
        format,
        detail: "Missing format.",
      });
      continue;
    }
    const bytes = await readFile(artifact.path);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const expectedFilename = `nimanto-packet-${packetId}-${format}.${
      format.endsWith("docx") ? "docx" : format.endsWith("pdf") ? "pdf" : format
    }`;
    checks.push({
      code: "ARTIFACT_HASH_AND_FILENAME",
      status:
        hash === artifact.sha256 && artifact.filename === expectedFilename ? "passed" : "blocked",
      format,
      detail: "SHA-256 and generated filename match the manifest.",
    });
    if (format === "json") {
      const text = new TextDecoder().decode(bytes).trim();
      checks.push({
        code: "CANONICAL_JSON_PARITY",
        status: text === canonicalJson(packet) ? "passed" : "blocked",
        format,
        detail: "JSON matches the frozen canonical packet.",
      });
      continue;
    }
    if (format === "txt") {
      extracted.set(format, new TextDecoder().decode(bytes));
      continue;
    }
    if (format.endsWith("docx")) {
      extracted.set(format, docxText(bytes));
      continue;
    }
    const pdf = await pdfInspection(bytes);
    extracted.set(format, pdf.text);
    checks.push({
      code: "PDF_STRUCTURE",
      status:
        pdf.pages >= 1 && pdf.pages <= 4 && pdf.letterSized && pdf.noBlankPages && pdf.metadata
          ? "passed"
          : "blocked",
      format,
      detail: `${pdf.pages} Letter page(s), nonblank text layer, and Nimanto metadata required.`,
    });
  }

  for (const format of ["txt", "modern_docx", "modern_pdf", "ats_docx", "ats_pdf"] as const) {
    const text = normalizedContent(extracted.get(format) ?? "");
    checks.push({
      code: "CRITICAL_CONTENT_PARITY",
      status: criticalText.every((value) => text.includes(value)) ? "passed" : "blocked",
      format,
      detail:
        "Candidate, destination, summary, evidence, and authorization text remain extractable.",
    });
  }

  return {
    ruleVersion: "document_assurance_v1",
    status: checks.every((check) => check.status === "passed") ? "passed" : "blocked",
    checks,
  };
}
