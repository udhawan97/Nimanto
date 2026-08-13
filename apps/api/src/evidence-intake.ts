import type { NimantoStore } from "@nimanto/database";
import { canonicalHash } from "@nimanto/domain";
import { parseEvidenceFile, type ParsedEvidence } from "@nimanto/parsers";

export const EVIDENCE_IMPORT_LIMIT = 500;

type Upload = { filename: string; mimeType?: string; parsed: ParsedEvidence };

function requestObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("INVALID_REQUEST_BODY");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.normalize("NFC").trim() === "") {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return value.normalize("NFC").trim();
}

async function parseUpload(value: unknown): Promise<Upload> {
  const body = requestObject(value);
  const filename = requiredString(body.filename, "filename");
  const contentBase64 = requiredString(body.contentBase64, "content_base64");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(contentBase64)) {
    throw new Error("INVALID_CONTENT_BASE64");
  }
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : undefined;
  const parsed = await parseEvidenceFile({
    filename,
    ...(mimeType ? { mimeType } : {}),
    bytes: Buffer.from(contentBase64, "base64"),
  });
  return { filename, ...(mimeType ? { mimeType } : {}), parsed };
}

function reviewedProjection(upload: Upload) {
  return {
    claims: upload.parsed.claims.slice(0, EVIDENCE_IMPORT_LIMIT),
    warnings: upload.parsed.warnings,
    preview: upload.parsed.preview ?? null,
  };
}

function previewHash(upload: Upload): string {
  return canonicalHash({
    filename: upload.filename,
    mimeType: upload.mimeType ?? "",
    ...reviewedProjection(upload),
  });
}

export class EvidenceIntake {
  constructor(private readonly store: NimantoStore) {}

  async preview(value: unknown): Promise<Record<string, unknown>> {
    const upload = await parseUpload(value);
    const projection = reviewedProjection(upload);
    return {
      claimCount: projection.claims.length,
      parsedCount: upload.parsed.claims.length,
      claims: projection.claims.map((claim) => ({
        kind: claim.kind,
        value: claim.value,
        sourceName: claim.sourceName,
        locator: claim.locator,
      })),
      warnings: projection.warnings,
      preview: projection.preview,
      previewHash: previewHash(upload),
    };
  }

  async commit(tenantId: string, value: unknown): Promise<Record<string, unknown>> {
    const body = requestObject(value);
    const upload = await parseUpload(body);
    if (
      requiredString(body.confirmedPreviewHash, "confirmed_preview_hash") !== previewHash(upload)
    ) {
      throw new Error("EVIDENCE_PREVIEW_CHANGED");
    }
    const projection = reviewedProjection(upload);
    const claims = await this.store.createEvidenceBatch(tenantId, projection.claims);
    return { claims, warnings: projection.warnings, preview: projection.preview };
  }
}
