import { createHash } from "node:crypto";

export interface ExecutionReceipt {
  schemaVersion: "receipt_v1";
  id: string;
  type: string;
  occurredAt: string;
  inputHash: string;
  artifactHash: string;
  receiptHash: string;
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("Canonical receipt numbers must be safe integers.");
    }
    return value;
  }
  if (value === null || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .toSorted(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, entry]) => [key.normalize("NFC"), canonicalize(entry)]),
    );
  }
  throw new TypeError(`Unsupported canonical value: ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function createReceipt(input: {
  id: string;
  type: string;
  occurredAt: string;
  input: unknown;
  artifact: unknown;
}): ExecutionReceipt {
  const stable = {
    schemaVersion: "receipt_v1" as const,
    id: input.id,
    type: input.type,
    occurredAt: input.occurredAt,
    inputHash: canonicalHash(input.input),
    artifactHash: canonicalHash(input.artifact),
  };
  return { ...stable, receiptHash: canonicalHash(stable) };
}

export function verifyReceipt(receipt: ExecutionReceipt): boolean {
  const { receiptHash, ...stable } = receipt;
  return receiptHash === canonicalHash(stable);
}
