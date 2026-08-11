import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { strToU8, zipSync } from "fflate";
import { claimsFromText, parseEvidenceFile } from "../src/index.js";

describe("evidence parser", () => {
  it("keeps imported claims pending with source locators", () => {
    const result = claimsFromText(
      "Skill: TypeScript\nEmployment: Built accessible web products\nSkill: TypeScript",
      "resume.txt",
    );
    expect(result.claims).toHaveLength(2);
    expect(result.claims[0]).toMatchObject({
      kind: "skill",
      status: "pending",
      sourceName: "resume.txt",
      locator: "line:1",
    });
  });

  it("parses a JSON claim collection", async () => {
    const result = await parseEvidenceFile({
      filename: "evidence.json",
      bytes: new TextEncoder().encode(
        JSON.stringify({ claims: [{ kind: "project", value: "Led a migration" }] }),
      ),
    });
    expect(result.claims[0]).toMatchObject({ kind: "project", value: "Led a migration" });
  });

  it("extracts pending claims with deterministic DOCX paragraph locators", async () => {
    const bytes = zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/document.xml": strToU8(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Skill: TypeScript</w:t></w:r></w:p><w:p><w:r><w:t>Project: Built a platform</w:t></w:r></w:p></w:body></w:document>',
      ),
    });
    const result = await parseEvidenceFile({
      filename: "resume.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes,
    });
    expect(result.claims).toMatchObject([
      { kind: "skill", value: "TypeScript", status: "pending", locator: "paragraph:1" },
      {
        kind: "project",
        value: "Built a platform",
        status: "pending",
        locator: "paragraph:2",
      },
    ]);
  });

  it("extracts a text-layer PDF and rejects image-only PDFs", { timeout: 15_000 }, async () => {
    const textPdf = await PDFDocument.create();
    const font = await textPdf.embedFont(StandardFonts.Helvetica);
    textPdf.addPage().drawText("Skill: TypeScript", { x: 72, y: 720, size: 12, font });
    const parsed = await parseEvidenceFile({
      filename: "resume.pdf",
      mimeType: "application/pdf",
      bytes: await textPdf.save(),
    });
    expect(parsed.claims[0]).toMatchObject({
      kind: "skill",
      value: "TypeScript",
      status: "pending",
      locator: "page:1;item:1",
    });

    const imageOnly = await PDFDocument.create();
    imageOnly.addPage();
    await expect(
      parseEvidenceFile({ filename: "scan.pdf", bytes: await imageOnly.save() }),
    ).rejects.toThrow("PDF_TEXT_LAYER_REQUIRED");
  });

  it("previews only approved LinkedIn archive files and fields", async () => {
    const bytes = zipSync({
      "Basic_LinkedInDataExport/Skills.csv": strToU8('Name\n"TypeScript"\n'),
      "Basic_LinkedInDataExport/Positions.csv": strToU8(
        'Company Name,Title,Description,Started On,Finished On\nNorthwind,Engineer,"Built APIs",Jan 2024,Aug 2026\n',
      ),
      "Basic_LinkedInDataExport/Messages.csv": strToU8("From,To,Content\nA,B,Private\n"),
    });
    const result = await parseEvidenceFile({
      filename: "linkedin-export.zip",
      mimeType: "application/zip",
      bytes,
    });
    expect(result.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "skill", value: "TypeScript", status: "pending" }),
        expect.objectContaining({
          kind: "employment",
          value: "Northwind · Engineer · Built APIs · Jan 2024 · Aug 2026",
          status: "pending",
        }),
      ]),
    );
    expect(result.preview).toMatchObject({
      acceptedFiles: expect.arrayContaining([
        "Basic_LinkedInDataExport/Skills.csv",
        "Basic_LinkedInDataExport/Positions.csv",
      ]),
      ignoredFiles: ["Basic_LinkedInDataExport/Messages.csv"],
    });
  });

  it("rejects unsupported and oversized inputs", async () => {
    await expect(
      parseEvidenceFile({ filename: "resume.exe", bytes: new Uint8Array() }),
    ).rejects.toThrow("UNSUPPORTED_FILE_TYPE");
    await expect(
      parseEvidenceFile({ filename: "large.txt", bytes: new Uint8Array(8 * 1024 * 1024 + 1) }),
    ).rejects.toThrow("FILE_TOO_LARGE");
  });

  it("fails closed on active documents, MIME spoofing, forbidden files, and binary text", async () => {
    await expect(
      parseEvidenceFile({
        filename: "resume.pdf",
        mimeType: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.7"),
      }),
    ).rejects.toThrow("INVALID_PDF");
    await expect(
      parseEvidenceFile({
        filename: "resume.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        bytes: Uint8Array.from([0x50, 0x4b, 0x03, 0x04]),
      }),
    ).rejects.toThrow("INVALID_DOCX");
    await expect(
      parseEvidenceFile({
        filename: "macro.docx",
        bytes: zipSync({
          "word/document.xml": strToU8('<w:document xmlns:w="x"><w:body/></w:document>'),
          "word/vbaProject.bin": new Uint8Array([1, 2, 3]),
        }),
      }),
    ).rejects.toThrow("ACTIVE_DOCUMENT_CONTENT");
    await expect(
      parseEvidenceFile({
        filename: "resume.txt",
        mimeType: "application/pdf",
        bytes: new TextEncoder().encode("Skill: TypeScript"),
      }),
    ).rejects.toThrow("FILE_TYPE_MISMATCH");
    await expect(
      parseEvidenceFile({
        filename: "i-797.txt",
        mimeType: "text/plain",
        bytes: new TextEncoder().encode("petition record"),
      }),
    ).rejects.toThrow("PROHIBITED_DOCUMENT_CONTENT");
    await expect(
      parseEvidenceFile({
        filename: "resume.txt",
        mimeType: "text/plain",
        bytes: Uint8Array.from([0xff, 0xfe, 0x00]),
      }),
    ).rejects.toThrow("INVALID_TEXT_ENCODING");
  });

  it("rejects high-ratio DOCX and LinkedIn entries before inflation", async () => {
    const highRatioText = strToU8(`Skill: ${"A".repeat(500_000)}`);
    await expect(
      parseEvidenceFile({
        filename: "bomb.docx",
        bytes: zipSync({ "word/document.xml": highRatioText }, { level: 9 }),
      }),
    ).rejects.toThrow("DOCX_EXPANSION_LIMIT_EXCEEDED");
    await expect(
      parseEvidenceFile({
        filename: "linkedin-export.zip",
        bytes: zipSync({ "Skills.csv": highRatioText }, { level: 9 }),
      }),
    ).rejects.toThrow("LINKEDIN_ARCHIVE_LIMIT_EXCEEDED");
  });
});
