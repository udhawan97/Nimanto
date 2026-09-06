import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { NimantoStore } from "@nimanto/database";
import { EvidenceIntake } from "../src/evidence-intake.js";

const stores: NimantoStore[] = [];
const temporaryRoots: string[] = [];
async function mkdtempTracked(prefix: string): Promise<string> {
  const root = await mkdtemp(prefix);
  temporaryRoots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await mkdtempTracked(path.join(tmpdir(), "nimanto-evidence-intake-"));
  const store = await NimantoStore.open(path.join(root, "database"));
  stores.push(store);
  const identity = await store.createLocalTenant("intake@example.test", "Intake");
  const request = {
    filename: "resume.txt",
    mimeType: "text/plain",
    contentBase64: Buffer.from("Skill: TypeScript\nProject: Local-first workspace").toString(
      "base64",
    ),
  };
  return { store, identity, intake: new EvidenceIntake(store), request };
}

describe("candidate-approved evidence intake", () => {
  it("persists exactly the visible pending projection only after its hash is confirmed", async () => {
    const { store, identity, intake, request } = await fixture();
    const preview = (await intake.preview(request)) as { previewHash: string; claims: unknown[] };
    expect(await store.listEvidence(identity.tenantId)).toEqual([]);
    const imported = (await intake.commit(identity.tenantId, {
      ...request,
      confirmedPreviewHash: preview.previewHash,
    })) as { claims: Array<{ status: string }> };
    expect(imported.claims).toHaveLength(preview.claims.length);
    expect(imported.claims.every((claim) => claim.status === "pending")).toBe(true);
  });

  it("writes nothing when the reviewed content changes or deletion has begun", async () => {
    const { store, identity, intake, request } = await fixture();
    const preview = (await intake.preview(request)) as { previewHash: string };
    await expect(
      intake.commit(identity.tenantId, {
        ...request,
        contentBase64: Buffer.from("Skill: Rust").toString("base64"),
        confirmedPreviewHash: preview.previewHash,
      }),
    ).rejects.toThrow("EVIDENCE_PREVIEW_CHANGED");
    expect(await store.listEvidence(identity.tenantId)).toEqual([]);
    await store.beginTenantDeletion(identity.tenantId, []);
    await expect(
      intake.commit(identity.tenantId, { ...request, confirmedPreviewHash: preview.previewHash }),
    ).rejects.toThrow("TENANT_NOT_ACTIVE");
  });

  it("rolls back the entire reviewed batch when a later claim insert fails", async () => {
    const root = await mkdtempTracked(path.join(tmpdir(), "nimanto-evidence-intake-fault-"));
    const data = path.join(root, "database");
    const setupStore = await NimantoStore.open(data);
    const faultIdentity = await setupStore.createLocalTenant("fault@example.test", "Fault");
    await setupStore.close();
    const raw = await PGlite.create(data);
    await raw.exec(String.raw`
      CREATE FUNCTION nimanto_inject_evidence_failure()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.value = 'ROLLBACK_SENTINEL' THEN
          RAISE EXCEPTION 'INJECTED_EVIDENCE_FAILURE';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER nimanto_test_evidence_failure
      BEFORE INSERT ON evidence_claims
      FOR EACH ROW EXECUTE FUNCTION nimanto_inject_evidence_failure();
    `);
    await raw.close();
    const reopened = await NimantoStore.open(data);
    stores.push(reopened);
    const intake = new EvidenceIntake(reopened);
    const request = {
      filename: "resume.txt",
      mimeType: "text/plain",
      contentBase64: Buffer.from(
        "Skill: TypeScript\nProject: ROLLBACK_SENTINEL\nSkill: PostgreSQL",
      ).toString("base64"),
    };
    const preview = (await intake.preview(request)) as { previewHash: string };

    await expect(
      intake.commit(faultIdentity.tenantId, {
        ...request,
        confirmedPreviewHash: preview.previewHash,
      }),
    ).rejects.toThrow("INJECTED_EVIDENCE_FAILURE");
    expect(await reopened.listEvidence(faultIdentity.tenantId)).toEqual([]);
  });
});
