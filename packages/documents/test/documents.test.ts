import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("packet documents", () => {
  it("renders a stable plain-text packet", () => {
    expect(packetText(packet)).toContain("EVIDENCE-BACKED HIGHLIGHTS");
    expect(packetText(packet)).toContain("H-1B transfer support");
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
