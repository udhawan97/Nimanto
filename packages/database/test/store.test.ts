import { chmod, mkdir, mkdtemp, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  buildEmployerCandidates,
  canonicalHash,
  createReceipt,
  matchJob,
  resolveEmployer,
} from "@nimanto/domain";
import { CURRENT_SCHEMA_VERSION } from "../src/migrations.js";
import { NimantoStore } from "../src/store.js";

const stores: NimantoStore[] = [];

const v041FixtureSql = String.raw`
CREATE TABLE schema_versions (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  deletion_state text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE profile_versions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  claim_ids jsonb NOT NULL,
  authorization_wording text,
  input_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE jobs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_job_id text,
  title text NOT NULL,
  company text NOT NULL,
  description text NOT NULL,
  location text,
  work_mode text,
  url text,
  requirements jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  capability text NOT NULL DEFAULT 'deep_link',
  source_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, source_job_id)
);
CREATE TABLE applications (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  profile_version_id text REFERENCES profile_versions(id) ON DELETE SET NULL,
  status text NOT NULL,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE packets (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  profile_version_id text REFERENCES profile_versions(id) ON DELETE SET NULL,
  status text NOT NULL,
  canonical_content jsonb NOT NULL,
  artifact_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_hash text NOT NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE assurance_runs_run_sequence_seq;
CREATE TABLE assurance_runs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  packet_id text NOT NULL REFERENCES packets(id) ON DELETE CASCADE,
  status text NOT NULL,
  rule_version text NOT NULL,
  findings jsonb NOT NULL,
  run_sequence bigint NOT NULL DEFAULT nextval('assurance_runs_run_sequence_seq'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE external_actions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  packet_id text REFERENCES packets(id) ON DELETE SET NULL,
  provider text NOT NULL,
  state text NOT NULL,
  target jsonb NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL,
  approved_at timestamptz,
  attempted_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
INSERT INTO schema_versions(version) VALUES (1), (2);
INSERT INTO tenants(id, name) VALUES ('legacy-tenant', 'Legacy workspace');
INSERT INTO jobs(
  id, tenant_id, source, source_job_id, title, company, description,
  requirements, content_hash
) VALUES (
  'legacy-job', 'legacy-tenant', 'manual', 'legacy-job', 'Upgrade Engineer',
  'Northwind', 'Preserve local data', '[]'::jsonb, 'legacy-content'
);
INSERT INTO applications(id, tenant_id, job_id, status)
VALUES ('legacy-application', 'legacy-tenant', 'legacy-job', 'approved_for_export');
INSERT INTO packets(
  id, tenant_id, application_id, status, canonical_content, artifact_manifest,
  artifact_hash, approved_at
) VALUES (
  'legacy-packet', 'legacy-tenant', 'legacy-application', 'approved',
  '{"claims":[]}'::jsonb, '{"artifacts":[]}'::jsonb, 'legacy-artifact-hash', now()
);
INSERT INTO assurance_runs(
  id, tenant_id, packet_id, status, rule_version, findings
) VALUES (
  'legacy-assurance', 'legacy-tenant', 'legacy-packet', 'passed',
  'application_assurance_v1', '[]'::jsonb
);
INSERT INTO external_actions(
  id, tenant_id, packet_id, provider, state, target, payload,
  idempotency_key, approved_at
) VALUES (
  'legacy-action', 'legacy-tenant', 'legacy-packet', 'test_outbox', 'approved',
  '{"to":"jobs@example.test"}'::jsonb,
  '{"subject":"Application","body":"Hello"}'::jsonb,
  'legacy-action', now()
);
`;

async function expectPrivateTree(directory: string): Promise<void> {
  expect((await stat(directory)).mode & 0o777).toBe(0o700);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) await expectPrivateTree(target);
    else if (entry.isFile()) expect((await stat(target)).mode & 0o777).toBe(0o600);
  }
}

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

describe("tenant-scoped persistence public seam", () => {
  it("creates private database paths and tightens an existing permissive directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-permissions-"));
    const data = join(root, "data");
    await mkdir(data, { mode: 0o755 });
    await chmod(data, 0o755);
    const store = await NimantoStore.open(data);
    stores.push(store);
    await expectPrivateTree(data);
  });

  it("never returns another tenant's evidence even when a foreign ID is supplied", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);

    const alpha = await store.createLocalTenant("alpha@example.test", "Alpha");
    const beta = await store.createLocalTenant("beta@example.test", "Beta");
    const claim = await store.createEvidence(alpha.tenantId, {
      kind: "skill",
      value: "TypeScript",
      sourceName: "Synthetic resume",
      locator: "Skills, line 1",
      confidence: "high",
      status: "confirmed",
    });

    expect(await store.getEvidence(alpha.tenantId, claim.id)).toMatchObject({
      value: "TypeScript",
    });
    expect(await store.getEvidence(beta.tenantId, claim.id)).toBeNull();
    expect(await store.listEvidence(beta.tenantId)).toEqual([]);
  });

  it("creates a profile version only when normalized tenant input changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-profile-version-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const alpha = await store.createLocalTenant("profile-alpha@example.test", "Profile Alpha");
    const beta = await store.createLocalTenant("profile-beta@example.test", "Profile Beta");
    const alphaClaim = await store.createEvidence(alpha.tenantId, {
      kind: "skill",
      value: "TypeScript",
      sourceName: "Synthetic resume",
      locator: "Skills",
      confidence: "high",
      status: "confirmed",
    });
    await store.createEvidence(beta.tenantId, {
      kind: "skill",
      value: "Private beta claim",
      sourceName: "Synthetic resume",
      locator: "Skills",
      confidence: "high",
      status: "confirmed",
    });

    const [first, equivalent] = await Promise.all([
      store.saveProfileVersion(alpha.tenantId, "Caf\u00e9 eligible"),
      store.saveProfileVersion(alpha.tenantId, "  Cafe\u0301 eligible  "),
    ]);
    expect([first.created, equivalent.created].toSorted()).toEqual([false, true]);
    expect(first.version.id).toBe(equivalent.version.id);
    expect(first.version.authorizationWording).toBe("Caf\u00e9 eligible");
    expect(first.version.claimIds).toEqual([alphaClaim.id]);
    expect((await store.listProfileVersions(alpha.tenantId)).items).toHaveLength(1);

    const addedClaim = await store.createEvidence(alpha.tenantId, {
      kind: "skill",
      value: "PostgreSQL",
      sourceName: "Synthetic resume",
      locator: "Skills, line 2",
      confidence: "high",
      status: "pending",
    });
    await store.confirmEvidence(alpha.tenantId, addedClaim.id);
    const changedClaims = await store.saveProfileVersion(alpha.tenantId, "Caf\u00e9 eligible");
    expect(changedClaims.created).toBe(true);
    expect(changedClaims.version.claimIds).toEqual([alphaClaim.id, addedClaim.id].toSorted());
    expect((await store.listProfileVersions(alpha.tenantId)).items).toHaveLength(2);

    const changedWording = await store.saveProfileVersion(alpha.tenantId, "Different wording");
    expect(changedWording.created).toBe(true);
    expect((await store.listProfileVersions(alpha.tenantId)).items).toHaveLength(3);

    const betaVersion = await store.saveProfileVersion(beta.tenantId, "Caf\u00e9 eligible");
    expect(betaVersion.created).toBe(true);
    expect(betaVersion.version.id).not.toBe(first.version.id);
    expect((await store.listProfileVersions(beta.tenantId)).items).toHaveLength(1);
  });

  it("serializes profile saves with tenant deletion and rejects every later save", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-profile-deletion-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("profile-delete@example.test", "Profile Delete");

    const [deletion, save] = await Promise.allSettled([
      store.beginTenantDeletion(identity.tenantId, []),
      store.saveProfileVersion(identity.tenantId, "Concurrent wording"),
    ]);
    expect(deletion.status).toBe("fulfilled");
    if (save.status === "rejected") {
      expect(save.reason).toMatchObject({ message: "TENANT_NOT_ACTIVE" });
    } else {
      // The save acquired the tenant lock first and therefore linearized while
      // the workspace was still active. Deletion then acquired the same lock.
      expect(save.value.created).toBe(true);
    }
    await expect(
      store.saveProfileVersion(identity.tenantId, "After deletion began"),
    ).rejects.toThrow("TENANT_NOT_ACTIVE");
  });

  it("revokes a local session and never stores its raw token", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);

    const identity = await store.createLocalTenant("session@example.test", "Session");
    const session = await store.createSession(identity.userId, identity.tenantId);
    expect(await store.resolveSession(session.token)).toMatchObject({
      tenantId: identity.tenantId,
    });
    expect(await store.databaseContains(session.token)).toBe(false);

    await store.revokeSession(session.token);
    expect(await store.resolveSession(session.token)).toBeNull();
  });

  it("accepts only a matching single-use, unexpired, unrevoked invitation", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);

    const invite = await store.issueInvitation("invited@example.test");
    await expect(
      store.acceptInvitation(invite.token, "substitute@example.test", "Substitute"),
    ).rejects.toThrow("INVITATION_EMAIL_MISMATCH");
    const identity = await store.acceptInvitation(
      invite.token,
      "invited@example.test",
      "Invited Candidate",
    );
    expect(identity).toMatchObject({ email: "invited@example.test" });
    await expect(
      store.acceptInvitation(invite.token, "invited@example.test", "Again"),
    ).rejects.toThrow("INVITATION_USED");

    const expired = await store.issueInvitation("expired@example.test", -1);
    await expect(
      store.acceptInvitation(expired.token, "expired@example.test", "Expired"),
    ).rejects.toThrow("INVITATION_EXPIRED");

    const revoked = await store.issueInvitation("revoked@example.test");
    expect(await store.revokeInvitation(revoked.id)).toBe(true);
    await expect(
      store.acceptInvitation(revoked.token, "revoked@example.test", "Revoked"),
    ).rejects.toThrow("INVITATION_REVOKED");
  });

  it("revokes tenant access as soon as resumable deletion begins", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);

    const identity = await store.createLocalTenant("delete@example.test", "Delete");
    const session = await store.createSession(identity.userId, identity.tenantId);
    expect(await store.resolveSession(session.token)).not.toBeNull();

    await store.beginTenantDeletion(identity.tenantId, []);
    expect(await store.resolveSession(session.token)).toBeNull();
  });

  it("captures cleanup inventory atomically and fences every later tenant write", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-deletion-fence-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("fence@example.test", "Fence");
    const action = await store.createExternalAction(identity.tenantId, {
      packetId: null,
      provider: "test_outbox",
      target: { to: "jobs@example.test" },
      payload: { subject: "Application", body: "Hello" },
      idempotencyKey: "before-deletion",
    });
    const run = await store.beginTenantDeletion(identity.tenantId);
    expect(run.actionIds).toEqual([action.id]);
    await expect(
      store.createExternalAction(identity.tenantId, {
        packetId: null,
        provider: "test_outbox",
        target: { to: "jobs@example.test" },
        payload: { subject: "Late", body: "Must not persist" },
        idempotencyKey: "after-deletion",
      }),
    ).rejects.toThrow("TENANT_NOT_ACTIVE");
  });

  it("waits for an in-flight tenant write before capturing deletion cleanup inventory", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-deletion-race-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("race@example.test", "Race");
    let releaseWrite!: () => void;
    let reportInserted!: () => void;
    const writeMayCommit = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const inserted = new Promise<void>((resolve) => {
      reportInserted = resolve;
    });
    const actionPromise = store.transaction(async (database) => {
      const action = await database.createExternalAction(identity.tenantId, {
        packetId: null,
        provider: "test_outbox",
        target: { to: "jobs@example.test" },
        payload: { subject: "Racing action", body: "Must be inventoried" },
        idempotencyKey: "in-flight-before-deletion",
      });
      reportInserted();
      await writeMayCommit;
      return action;
    });
    await inserted;

    let deletionSettled = false;
    const deletionPromise = store.beginTenantDeletion(identity.tenantId).then((run) => {
      deletionSettled = true;
      return run;
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(deletionSettled).toBe(false);

    releaseWrite();
    const [action, run] = await Promise.all([actionPromise, deletionPromise]);
    expect(run.actionIds).toEqual([action.id]);
  });
});

describe("beta workflow persistence", () => {
  it("records the complete migration ledger for a fresh database exactly once", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-fresh-migrations-"));
    const data = join(root, "data");

    const fresh = await NimantoStore.open(data);
    await fresh.close();
    const firstInspection = await PGlite.create(data);
    const firstLedger = await firstInspection.query<{ version: number; applied_at: string | Date }>(
      "SELECT version, applied_at FROM schema_versions ORDER BY version",
    );
    await firstInspection.close();
    expect(firstLedger.rows.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(firstLedger.rows.at(-1)?.version).toBe(CURRENT_SCHEMA_VERSION);

    const reopened = await NimantoStore.open(data);
    await reopened.close();
    const secondInspection = await PGlite.create(data);
    const secondLedger = await secondInspection.query<{
      version: number;
      applied_at: string | Date;
    }>("SELECT version, applied_at FROM schema_versions ORDER BY version");
    await secondInspection.close();
    expect(secondLedger.rows).toEqual(firstLedger.rows);
  });

  it("upgrades a genuine v0.4.1 schema twice without losing data or approval safety", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-v041-upgrade-"));
    const data = join(root, "data");
    const legacy = await PGlite.create(data);
    await legacy.exec(v041FixtureSql);
    await legacy.close();

    const upgraded = await NimantoStore.open(data);
    expect(await upgraded.getPacket("legacy-tenant", "legacy-packet")).toMatchObject({
      manifestHash: canonicalHash({ artifacts: [] }),
      status: "approved",
    });
    expect(await upgraded.getExternalAction("legacy-tenant", "legacy-action")).toMatchObject({
      state: "pending_approval",
      intentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      approvedIntentHash: null,
      approvedPacketHash: null,
    });
    expect(await upgraded.listJobs("legacy-tenant")).toEqual([
      expect.objectContaining({ id: "legacy-job", title: "Upgrade Engineer" }),
    ]);
    await upgraded.close();

    const migrated = await PGlite.create(data);
    const schemaVersions = await migrated.query<{ version: number }>(
      "SELECT version FROM schema_versions ORDER BY version",
    );
    expect(schemaVersions.rows.map((row) => row.version)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(schemaVersions.rows.at(-1)?.version).toBe(CURRENT_SCHEMA_VERSION);
    const packetSequences = await migrated.query<{ generation_sequence: string | number }>(
      "SELECT generation_sequence FROM packets WHERE id = 'legacy-packet'",
    );
    expect(Number(packetSequences.rows[0]?.generation_sequence)).toBeGreaterThan(0);
    await migrated.close();

    const reopened = await NimantoStore.open(data);
    stores.push(reopened);
    expect(await reopened.getPacket("legacy-tenant", "legacy-packet")).toMatchObject({
      manifestHash: canonicalHash({ artifacts: [] }),
      status: "approved",
    });
    expect(await reopened.getExternalAction("legacy-tenant", "legacy-action")).toMatchObject({
      state: "pending_approval",
      approvedIntentHash: null,
      approvedPacketHash: null,
    });
    expect(await reopened.listDatasetEditions("legacy-tenant")).toEqual([]);
  });

  it("records an integrity migration only after its backfill commits and resumes safely", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-interrupted-migration-"));
    const data = join(root, "data");
    const legacy = await PGlite.create(data);
    await legacy.exec(v041FixtureSql);
    await legacy.exec(String.raw`
      CREATE FUNCTION interrupt_integrity_migration()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'INTERRUPT_V6';
      END;
      $$;
      CREATE TRIGGER interrupt_v6
      BEFORE UPDATE ON external_actions
      FOR EACH ROW EXECUTE FUNCTION interrupt_integrity_migration();
    `);
    await legacy.close();

    await expect(NimantoStore.open(data)).rejects.toThrow(/INTERRUPT_V6/u);
    const interrupted = await PGlite.create(data);
    expect(
      (
        await interrupted.query<{ version: number }>(
          "SELECT version FROM schema_versions ORDER BY version",
        )
      ).rows.map((row) => row.version),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(
      (
        await interrupted.query<{ manifest_hash: string }>(
          "SELECT manifest_hash FROM packets WHERE id = 'legacy-packet'",
        )
      ).rows[0]?.manifest_hash,
    ).toBe("");
    expect(
      (
        await interrupted.query<{ state: string }>(
          "SELECT state FROM external_actions WHERE id = 'legacy-action'",
        )
      ).rows[0]?.state,
    ).toBe("approved");
    await interrupted.exec(String.raw`
      DROP TRIGGER interrupt_v6 ON external_actions;
      DROP FUNCTION interrupt_integrity_migration();
    `);
    await interrupted.close();

    const resumed = await NimantoStore.open(data);
    stores.push(resumed);
    expect(await resumed.getPacket("legacy-tenant", "legacy-packet")).toMatchObject({
      manifestHash: canonicalHash({ artifacts: [] }),
    });
    expect(await resumed.getExternalAction("legacy-tenant", "legacy-action")).toMatchObject({
      state: "pending_approval",
      intentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it("fails closed before opening a database from a newer runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-future-schema-"));
    const data = join(root, "data");
    const future = await PGlite.create(data);
    await future.exec(String.raw`
      CREATE TABLE schema_versions (
        version integer PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO schema_versions(version) VALUES (12);
    `);
    await future.close();
    await expect(NimantoStore.open(data)).rejects.toThrow("DATABASE_SCHEMA_NEWER_THAN_RUNTIME");
  });

  it("backfills the exact source employer when upgrading a schema-9 H-1B signal", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-h1b-source-company-upgrade-"));
    const data = join(root, "data");
    const legacy = await PGlite.create(data);
    await legacy.exec(String.raw`
      CREATE TABLE schema_versions (
        version integer PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO schema_versions(version) VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9);
      CREATE TABLE tenants (
        id text PRIMARY KEY,
        name text NOT NULL,
        deletion_state text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE h1b_signals (
        id text PRIMARY KEY,
        tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company text NOT NULL,
        label text NOT NULL,
        source_type text NOT NULL,
        source_locator text NOT NULL,
        source_period text NOT NULL,
        observed_at timestamptz NOT NULL,
        confidence text NOT NULL,
        limitations text NOT NULL,
        dataset_edition_id text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO tenants(id, name) VALUES ('legacy-h1b-tenant', 'Legacy H-1B workspace');
      INSERT INTO h1b_signals(
        id, tenant_id, company, label, source_type, source_locator,
        source_period, observed_at, confidence, limitations
      ) VALUES (
        'legacy-h1b-signal', 'legacy-h1b-tenant', 'Northwind Systems',
        'recent_positive_history', 'dol_oflc_bulk', 'legacy-edition:row:1',
        'FY2025', '2025-10-01T00:00:00.000Z', 'low', 'Legacy historical context'
      );
    `);
    await legacy.close();

    const upgraded = await NimantoStore.open(data);
    stores.push(upgraded);
    expect(await upgraded.listH1bSignals("legacy-h1b-tenant")).toEqual([
      expect.objectContaining({
        id: "legacy-h1b-signal",
        company: "Northwind Systems",
        sourceCompany: "Northwind Systems",
      }),
    ]);
  });

  it("preserves a schema-10 dataset edition as explicitly unverified provenance", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-dataset-provenance-upgrade-"));
    const data = join(root, "data");
    const legacy = await PGlite.create(data);
    await legacy.exec(String.raw`
      CREATE TABLE schema_versions (
        version integer PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO schema_versions(version) VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10);
      CREATE TABLE tenants (
        id text PRIMARY KEY,
        name text NOT NULL,
        deletion_state text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE dataset_editions (
        id text PRIMARY KEY,
        tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        source_type text NOT NULL,
        source_edition text NOT NULL,
        checksum text NOT NULL,
        transformation_version text NOT NULL,
        evaluation jsonb NOT NULL,
        evaluation_provenance jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, source_type, source_edition)
      );
      INSERT INTO tenants(id, name) VALUES ('legacy-dataset-tenant', 'Legacy dataset workspace');
      INSERT INTO dataset_editions(
        id, tenant_id, source_type, source_edition, checksum,
        transformation_version, evaluation
      ) VALUES (
        'legacy-dataset-edition', 'legacy-dataset-tenant', 'dol_oflc_bulk',
        'legacy-fy2025', '${"c".repeat(64)}', 'government_ingest_v1', '{}'::jsonb
      );
    `);
    await legacy.close();

    const upgraded = await NimantoStore.open(data);
    stores.push(upgraded);
    expect(await upgraded.listDatasetEditions("legacy-dataset-tenant")).toEqual([
      expect.objectContaining({
        id: "legacy-dataset-edition",
        provenance: null,
        provenanceChecksum: null,
      }),
    ]);
  });

  it("persists only checksum-consistent government provenance with its edition", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-dataset-provenance-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("provenance@example.test", "Provenance Owner");
    const provenance = {
      version: "government_dataset_provenance_v1",
      sourceEdition: "synthetic-fy2026q2",
      layoutVersion: "synthetic-layout-v1",
    };
    const input = {
      sourceType: "dol_oflc_bulk",
      sourceEdition: "synthetic-fy2026q2",
      checksum: "c".repeat(64),
      transformationVersion: "government_ingest_v1",
      provenance,
      provenanceChecksum: canonicalHash(provenance),
      evaluation: {},
      evaluationProvenance: null,
      signals: [
        {
          company: "Northwind Systems",
          sourceCompany: "Northwind Systems LLC",
          label: "possible" as const,
          sourceType: "dol_oflc_bulk",
          sourceLocator: "synthetic-fy2026q2:H-1B:row:17",
          sourcePeriod: "FY2026 Q2",
          observedAt: "2026-07-15T00:00:00.000Z",
          confidence: "low" as const,
          limitations: "Synthetic historical context. Not legal advice.",
        },
      ],
    };
    await expect(
      store.importH1bDatasetEdition(owner.tenantId, {
        ...input,
        provenanceChecksum: "d".repeat(64),
      }),
    ).rejects.toThrow("DATASET_PROVENANCE_CHECKSUM_MISMATCH");

    const created = await store.importH1bDatasetEdition(owner.tenantId, input);
    expect(created.edition).toMatchObject({
      provenance,
      provenanceChecksum: canonicalHash(provenance),
    });
    expect(await store.listDatasetEditions(owner.tenantId)).toEqual([created.edition]);
  });

  it("pages tenant-owned history without exposing another tenant or a global assurance sequence", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-history-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const alpha = await store.createLocalTenant("alpha-history@example.test", "Alpha History");
    const beta = await store.createLocalTenant("beta-history@example.test", "Beta History");

    const alphaProfile1 = await store.createProfileVersion(alpha.tenantId, "Wording one");
    const alphaProfile2 = await store.createProfileVersion(alpha.tenantId, "Wording two");
    const betaProfile = await store.createProfileVersion(beta.tenantId, "Private beta wording");
    const job = await store.upsertJob(alpha.tenantId, {
      source: "manual",
      sourceJobId: "history-job",
      title: "History Engineer",
      company: "Northwind",
      description: "Build history views",
      location: "Remote",
      workMode: "remote",
      url: "",
      requirements: [],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "history-job-content",
    });
    const matchResult = matchJob({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: [],
      },
      evidence: [],
    });
    await store.saveMatch(alpha.tenantId, job.id, alphaProfile1.id, matchResult);
    await store.saveMatch(alpha.tenantId, job.id, alphaProfile2.id, matchResult);
    const application = await store.createApplication(alpha.tenantId, job.id, alphaProfile2.id);
    const packet1 = await store.createPacket(alpha.tenantId, {
      applicationId: application.id,
      profileVersionId: alphaProfile1.id,
      canonicalContent: { version: 1 },
      artifactManifest: { artifacts: [] },
    });
    const packet2 = await store.createPacket(alpha.tenantId, {
      applicationId: application.id,
      profileVersionId: alphaProfile2.id,
      canonicalContent: { version: 2 },
      artifactManifest: { artifacts: [] },
    });
    await store.saveAssurance(alpha.tenantId, packet2.id, {
      status: "blocked",
      ruleVersion: "application_assurance_v1",
      findings: [{ code: "SYNTHETIC_BLOCK" }],
    });
    await store.saveAssurance(
      beta.tenantId,
      (
        await store.createPacket(beta.tenantId, {
          applicationId: (
            await store.createApplication(
              beta.tenantId,
              (
                await store.upsertJob(beta.tenantId, {
                  source: "manual",
                  sourceJobId: "beta-job",
                  title: "Beta",
                  company: "Private",
                  description: "Private",
                  location: "",
                  workMode: "unspecified",
                  url: "",
                  requirements: [],
                  capability: "deep_link",
                  sourceMeta: {},
                  contentHash: "beta",
                })
              ).id,
              betaProfile.id,
            )
          ).id,
          profileVersionId: betaProfile.id,
          canonicalContent: { private: true },
          artifactManifest: {},
        })
      ).id,
      { status: "passed", ruleVersion: "application_assurance_v1", findings: [] },
    );
    await store.saveAssurance(alpha.tenantId, packet2.id, {
      status: "passed",
      ruleVersion: "application_assurance_v1",
      findings: [],
    });

    const profiles = await store.listProfileVersions(alpha.tenantId, { limit: 1 });
    expect(profiles.items).toHaveLength(1);
    expect(profiles.nextCursor).toBeTruthy();
    const nextProfiles = await store.listProfileVersions(alpha.tenantId, {
      cursor: profiles.nextCursor!,
      limit: 1,
    });
    expect(new Set([profiles.items[0]!.id, nextProfiles.items[0]!.id])).toEqual(
      new Set([alphaProfile1.id, alphaProfile2.id]),
    );
    await expect(
      store.listProfileVersions(alpha.tenantId, { cursor: betaProfile.id }),
    ).rejects.toThrow("INVALID_CURSOR");

    expect((await store.listMatchRuns(alpha.tenantId, { jobId: job.id })).items).toHaveLength(2);
    expect(await store.listJobsByIds(alpha.tenantId, [job.id, "missing-job"])).toEqual([
      expect.objectContaining({ id: job.id }),
    ]);
    const expectedPacketOrder = [packet2.id, packet1.id];
    expect(
      (await store.listApplicationPackets(alpha.tenantId, application.id)).items.map(
        (item) => item.id,
      ),
    ).toEqual(expectedPacketOrder);
    const assuranceHistory = await store.listAssuranceRuns(alpha.tenantId, packet2.id);
    expect(assuranceHistory.items.map((item) => item.packetOrdinal)).toEqual([2, 1]);
    expect(assuranceHistory.items.every((item) => !("runSequence" in item))).toBe(true);
    expect(await store.listLatestPackets(alpha.tenantId)).toEqual([
      expect.objectContaining({ id: expectedPacketOrder[0] }),
    ]);
    expect(
      (
        await store.listPacketsByIds(alpha.tenantId, [packet1.id, packet2.id, "missing-packet"])
      ).map((packet) => packet.id),
    ).toEqual(expectedPacketOrder);
    expect(await store.listLatestAssurancesForPackets(alpha.tenantId, [packet2.id])).toEqual([
      expect.objectContaining({ packetId: packet2.id, status: "passed" }),
    ]);

    const exported = await store.exportTenant(alpha.tenantId);
    expect(exported).toMatchObject({ schemaVersion: "nimanto_export_v6" });
    expect(exported.profileVersions).toHaveLength(2);
    expect(exported.matchRuns).toHaveLength(2);
    expect(exported.assuranceRuns).toHaveLength(2);
    expect(JSON.stringify(exported)).not.toContain("Private beta wording");
    expect(JSON.stringify(exported)).not.toContain("runSequence");
  });

  it("backfills assurance order when reopening a pre-sequence workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-upgrade-"));
    const data = join(root, "data");
    const store = await NimantoStore.open(data);
    stores.push(store);
    const identity = await store.createLocalTenant("upgrade@example.test", "Upgrade");
    const job = await store.upsertJob(identity.tenantId, {
      source: "manual",
      sourceJobId: "upgrade-job",
      title: "Engineer",
      company: "Northwind",
      description: "Build services",
      location: "",
      workMode: "unspecified",
      url: "",
      requirements: [],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "upgrade-content",
    });
    const application = await store.createApplication(identity.tenantId, job.id, null);
    const packet = await store.createPacket(identity.tenantId, {
      applicationId: application.id,
      profileVersionId: null,
      canonicalContent: { schemaVersion: "packet_v1", claims: [{ text: "Preserved" }] },
      artifactManifest: { artifacts: [] },
    });
    const older = await store.saveAssurance(identity.tenantId, packet.id, {
      status: "blocked",
      ruleVersion: "application_assurance_v0",
      findings: [{ code: "OLDER_FINDING" }],
    });
    const newer = await store.saveAssurance(identity.tenantId, packet.id, {
      status: "passed",
      ruleVersion: "application_assurance_v1",
      findings: [],
    });
    await store.close();
    stores.splice(stores.indexOf(store), 1);

    const legacy = await PGlite.create(data);
    await legacy.query(
      `UPDATE assurance_runs
       SET created_at = CASE id
         WHEN $1 THEN '2026-08-01T00:00:00.000Z'::timestamptz
         WHEN $2 THEN '2026-08-02T00:00:00.000Z'::timestamptz
       END`,
      [older.id, newer.id],
    );
    await legacy.exec("ALTER TABLE assurance_runs DROP COLUMN run_sequence");
    await legacy.exec("DROP SEQUENCE IF EXISTS assurance_runs_run_sequence_seq");
    await legacy.exec("DELETE FROM schema_versions WHERE version IN (3, 4, 5, 6, 7)");
    await legacy.close();

    const reopened = await NimantoStore.open(data);
    stores.push(reopened);
    expect(await reopened.listLatestAssurances(identity.tenantId)).toEqual([
      expect.objectContaining({
        id: newer.id,
        status: "passed",
        ruleVersion: "application_assurance_v1",
      }),
    ]);
    expect(await reopened.getPacket(identity.tenantId, packet.id)).toMatchObject({
      canonicalContent: { schemaVersion: "packet_v1", claims: [{ text: "Preserved" }] },
      artifactManifest: { artifacts: [] },
    });
    const currentPacket = await reopened.getPacket(identity.tenantId, packet.id);
    const currentAssurance = await reopened.latestAssurance(identity.tenantId, packet.id);
    expect(currentPacket).not.toBeNull();
    expect(currentAssurance).not.toBeNull();
    expect(
      (
        await reopened.approvePacketExact(
          identity.tenantId,
          packet.id,
          currentAssurance!.id,
          currentPacket!.artifactHash,
          currentPacket!.manifestHash,
        )
      ).status,
    ).toBe("approved");
  });

  it("upgrades v0.5.3 packet history and makes every later generation exact", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-packet-sequence-upgrade-"));
    const data = join(root, "data");
    const store = await NimantoStore.open(data);
    stores.push(store);
    const identity = await store.createLocalTenant("packet-upgrade@example.test", "Packet Upgrade");
    const job = await store.upsertJob(identity.tenantId, {
      source: "manual",
      sourceJobId: "packet-upgrade-job",
      title: "Engineer",
      company: "Northwind",
      description: "Preserve packet history",
      location: "",
      workMode: "unspecified",
      url: "",
      requirements: [],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "packet-upgrade-content",
    });
    const application = await store.createApplication(identity.tenantId, job.id, null);
    const first = await store.createPacket(identity.tenantId, {
      id: "zzzz-legacy-first",
      applicationId: application.id,
      profileVersionId: null,
      canonicalContent: { generation: "first" },
      artifactManifest: { artifacts: [{ filename: "first.txt" }] },
    });
    const second = await store.createPacket(identity.tenantId, {
      id: "aaaa-legacy-second",
      applicationId: application.id,
      profileVersionId: null,
      canonicalContent: { generation: "second" },
      artifactManifest: { artifacts: [{ filename: "second.txt" }] },
    });
    await store.close();
    stores.splice(stores.indexOf(store), 1);

    const legacy = await PGlite.create(data);
    await legacy.query(
      `UPDATE packets SET created_at = '2026-08-20T00:00:00.000Z'::timestamptz
       WHERE id = ANY($1::text[])`,
      [[first.id, second.id]],
    );
    await legacy.exec("ALTER TABLE packets DROP COLUMN generation_sequence");
    await legacy.exec("ALTER TABLE applications DROP COLUMN follow_up_on");
    await legacy.exec("DROP SEQUENCE IF EXISTS packets_generation_sequence_seq");
    await legacy.exec("DELETE FROM schema_versions WHERE version IN (4, 5, 6, 7)");
    await legacy.close();

    const upgraded = await NimantoStore.open(data);
    expect((await upgraded.listApplications(identity.tenantId))[0]).toMatchObject({
      id: application.id,
      followUpOn: null,
    });
    expect(
      (await upgraded.listApplicationPackets(identity.tenantId, application.id)).items.map(
        (packet) => packet.id,
      ),
    ).toEqual([first.id, second.id]);
    expect(await upgraded.getPacket(identity.tenantId, first.id)).toMatchObject({
      canonicalContent: { generation: "first" },
      artifactManifest: { artifacts: [{ filename: "first.txt" }] },
    });
    const postUpgrade = await upgraded.createPacket(identity.tenantId, {
      id: "0000-post-upgrade",
      applicationId: application.id,
      profileVersionId: null,
      canonicalContent: { generation: "post-upgrade" },
      artifactManifest: { artifacts: [{ filename: "post-upgrade.txt" }] },
    });
    expect(await upgraded.getLatestPacketForApplication(identity.tenantId, application.id)).toEqual(
      postUpgrade,
    );
    await upgraded.close();

    const reopened = await NimantoStore.open(data);
    stores.push(reopened);
    expect(
      (await reopened.listApplicationPackets(identity.tenantId, application.id)).items.map(
        (packet) => packet.id,
      ),
    ).toEqual([postUpgrade.id, first.id, second.id]);
  });

  it("rejects a schedule that its provider adapter could never execute", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("invalid-board@example.test", "Owner");

    await expect(
      store.createSourceSchedule(owner.tenantId, {
        provider: "greenhouse",
        board: "not.valid.for-provider",
        cadenceMinutes: 60,
      }),
    ).rejects.toThrow("INVALID_BOARD");
  });

  it("deduplicates concurrent creation of the same active source schedule", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("duplicate-schedule@example.test", "Owner");
    const input = {
      provider: "greenhouse" as const,
      board: "northwind",
      cadenceMinutes: 60,
    };

    const [first, second] = await Promise.all([
      store.createSourceSchedule(owner.tenantId, input),
      store.createSourceSchedule(owner.tenantId, input),
    ]);
    expect(second.id).toBe(first.id);
    expect(await store.listSourceSchedules(owner.tenantId)).toHaveLength(1);
  });

  it("leases each tenant schedule once and returns it to its recurring cadence", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const data = join(root, "data");
    const store = await NimantoStore.open(data);
    stores.push(store);
    const alpha = await store.createLocalTenant("alpha-schedule@example.test", "Alpha");
    const beta = await store.createLocalTenant("beta-schedule@example.test", "Beta");

    const scheduled = await store.createSourceSchedule(alpha.tenantId, {
      provider: "greenhouse",
      board: "northwind",
      cadenceMinutes: 60,
      notBefore: "2020-01-01T00:00:00.000Z",
    });
    expect(await store.listSourceSchedules(alpha.tenantId)).toEqual([scheduled]);
    expect(await store.listSourceSchedules(beta.tenantId)).toEqual([]);
    expect(await store.pauseSourceSchedule(beta.tenantId, scheduled.id)).toBeNull();

    const claimed = await store.claimDueSourceSchedule();
    expect(claimed).toMatchObject({
      schedule: { id: scheduled.id, tenantId: alpha.tenantId, state: "running", attempts: 1 },
    });
    expect(claimed?.leaseToken).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
    expect(await store.claimDueSourceSchedule()).toBeNull();

    const completed = await store.completeSourceSchedule(
      scheduled.id,
      claimed!.leaseToken,
      { imported: 12, matched: 12 },
      "2026-08-05T12:00:00.000Z",
    );
    expect(completed).toMatchObject({
      state: "queued",
      attempts: 0,
      lastResult: { imported: 12, matched: 12 },
      lastRunAt: "2026-08-05T12:00:00.000Z",
      notBefore: "2026-08-05T13:00:00.000Z",
    });
    await store.close();
    stores.splice(stores.indexOf(store), 1);
    const reopened = await NimantoStore.open(data);
    stores.push(reopened);
    expect(await reopened.listSourceSchedules(alpha.tenantId)).toEqual([completed]);
    expect((await reopened.exportTenant(alpha.tenantId)).schedules).toEqual([completed]);
  });

  it("lets the owning tenant recover retries while cancellation remains terminal", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("schedule-owner@example.test", "Owner");
    const schedule = await store.createSourceSchedule(owner.tenantId, {
      provider: "lever",
      board: "northwind",
      cadenceMinutes: 120,
      notBefore: "2020-01-01T00:00:00.000Z",
    });

    expect(await store.pauseSourceSchedule(owner.tenantId, schedule.id)).toMatchObject({
      state: "paused",
    });
    expect(await store.claimDueSourceSchedule()).toBeNull();
    expect(await store.resumeSourceSchedule(owner.tenantId, schedule.id)).toMatchObject({
      state: "queued",
      attempts: 0,
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await store.runSourceScheduleNow(owner.tenantId, schedule.id);
      const claim = await store.claimDueSourceSchedule();
      expect(claim?.schedule.attempts).toBe(attempt);
      const failed = await store.failSourceSchedule(
        schedule.id,
        claim!.leaseToken,
        "PROVIDER_REFRESH_FAILED",
        "2026-08-05T12:00:00.000Z",
      );
      expect(failed.state).toBe(attempt === 5 ? "dead_letter" : "retry_wait");
    }

    expect(await store.resumeSourceSchedule(owner.tenantId, schedule.id)).toMatchObject({
      state: "queued",
      attempts: 0,
      lastErrorCode: null,
    });
    expect(await store.cancelSourceSchedule(owner.tenantId, schedule.id)).toMatchObject({
      state: "cancelled",
    });
    expect(await store.resumeSourceSchedule(owner.tenantId, schedule.id)).toBeNull();
    expect(await store.claimDueSourceSchedule()).toBeNull();
  });

  it("recovers an expired lease without allowing a duplicate active claim", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("lease-owner@example.test", "Lease owner");
    await store.createSourceSchedule(owner.tenantId, {
      provider: "ashby",
      board: "northwind",
      cadenceMinutes: 60,
      notBefore: "2026-08-05T09:00:00.000Z",
    });

    const first = await store.claimDueSourceSchedule(30, "2026-08-05T10:00:00.000Z");
    expect(first?.schedule.attempts).toBe(1);
    expect(await store.claimDueSourceSchedule(30, "2026-08-05T10:00:20.000Z")).toBeNull();
    await expect(
      store.completeSourceSchedule(
        first!.schedule.id,
        first!.leaseToken,
        { imported: 1, matched: 1 },
        "2026-08-05T10:00:31.000Z",
      ),
    ).rejects.toThrow("SCHEDULE_LEASE_INVALID");
    await expect(
      store.failSourceSchedule(
        first!.schedule.id,
        first!.leaseToken,
        "PROVIDER_REFRESH_FAILED",
        "2026-08-05T10:00:31.000Z",
      ),
    ).rejects.toThrow("SCHEDULE_LEASE_INVALID");
    const recovered = await store.claimDueSourceSchedule(30, "2026-08-05T10:00:31.000Z");
    expect(recovered?.schedule).toMatchObject({
      id: first?.schedule.id,
      state: "running",
      attempts: 2,
      lastErrorCode: "LEASE_EXPIRED",
    });
  });

  it("holds the lease row while scheduled writes commit so an expiry recovery cannot overlap", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("lease-lock@example.test", "Lease lock");
    const schedule = await store.createSourceSchedule(owner.tenantId, {
      provider: "greenhouse",
      board: "northwind",
      cadenceMinutes: 60,
      notBefore: "2026-08-05T09:00:00.000Z",
    });
    const claim = await store.claimDueSourceSchedule(30, "2026-08-05T10:00:00.000Z");
    let markWriteStarted: (() => void) | undefined;
    let releaseWrite: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    const writeReleased = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });

    const execution = store.executeSourceSchedule(
      schedule.id,
      claim!.leaseToken,
      async () => {
        markWriteStarted?.();
        await writeReleased;
        return { imported: 0, matched: 0 };
      },
      "2026-08-05T10:00:20.000Z",
    );
    await writeStarted;
    const overlappingClaim = store.claimDueSourceSchedule(30, "2026-08-05T10:00:31.000Z");
    releaseWrite?.();

    await expect(execution).resolves.toMatchObject({ schedule: { state: "queued" } });
    await expect(overlappingClaim).resolves.toBeNull();
  });

  it("rejects a receipt whose integrity hash does not match its canonical fields", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const data = join(root, "data");
    const store = await NimantoStore.open(data);
    stores.push(store);
    const identity = await store.createLocalTenant("receipt@example.test", "Receipt");
    const receipt = createReceipt({
      id: "receipt-1",
      type: "match.published",
      occurredAt: "2026-08-05T12:00:00.000Z",
      input: { jobId: "job-1" },
      artifact: { band: "mixed" },
    });

    await expect(
      store.saveReceipt(identity.tenantId, { ...receipt, receiptHash: "tampered" }, {}),
    ).rejects.toThrow("RECEIPT_INTEGRITY_INVALID");

    await store.saveReceipt(identity.tenantId, receipt, {});
    await store.close();
    stores.splice(stores.indexOf(store), 1);
    const raw = await PGlite.create(data);
    await raw.query("UPDATE receipts SET artifact_hash = 'tampered' WHERE id = $1", [receipt.id]);
    await raw.close();
    const reopened = await NimantoStore.open(data);
    stores.push(reopened);
    await expect(reopened.listReceipts(identity.tenantId)).rejects.toThrow(
      "RECEIPT_INTEGRITY_INVALID",
    );
  });

  it("stores jobs, deterministic matches, applications, and outcomes", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("priya@example.test", "Priya");
    const claim = await store.createEvidence(identity.tenantId, {
      kind: "skill",
      value: "TypeScript platform delivery",
      status: "confirmed",
      confidence: "high",
      sourceName: "manual",
      locator: "claim:1",
    });
    const profile = await store.createProfileVersion(
      identity.tenantId,
      "I would require H-1B transfer support.",
    );
    const job = await store.upsertJob(identity.tenantId, {
      source: "manual",
      sourceJobId: "job-1",
      title: "Platform Engineer",
      company: "Northwind",
      description: "Build TypeScript services",
      location: "Remote",
      workMode: "remote",
      url: "https://example.test/jobs/1",
      requirements: ["TypeScript"],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "content-1",
    });
    const result = matchJob({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      },
      evidence: [claim],
    });
    const match = await store.saveMatch(identity.tenantId, job.id, profile.id, result);
    const application = await store.createApplication(identity.tenantId, job.id, profile.id);
    const outcome = await store.addOutcome(identity.tenantId, application.id, {
      type: "screen",
      note: "Recruiter screen scheduled",
      occurredAt: "2026-08-05T12:00:00.000Z",
    });
    expect(match.result.requirements[0]?.evidenceIds).toEqual([claim.id]);
    expect(outcome.type).toBe("screen");
    expect((await store.listApplications(identity.tenantId))[0]?.outcomes).toHaveLength(1);
  });

  it("binds candidate wording review to the latest exact role snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-role-wording-review-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("wording@example.test", "Wording Owner");
    const other = await store.createLocalTenant("other-wording@example.test", "Other Owner");
    const input = {
      source: "manual",
      sourceJobId: "wording-role-1",
      title: "Product Engineer",
      company: "Contoso",
      description: "No sponsorship of any kind is available for this role.",
      location: "Chicago",
      workMode: "hybrid",
      url: "https://example.test/roles/wording-1",
      requirements: ["TypeScript"],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "wording-v1",
    };
    const job = await store.upsertJob(owner.tenantId, input);
    const result = matchJob({
      job: {
        ...job,
        descriptionLocator: job.url,
        observedAt: job.availability.lastSeenAt,
      },
      evidence: [],
    });
    const firstMatch = await store.saveMatch(owner.tenantId, job.id, null, result);
    expect(firstMatch.jobContentHash).toBe("wording-v1");
    await expect(
      store.setRoleWordingReviewed(
        other.tenantId,
        job.id,
        firstMatch.id,
        "no_sponsorship_of_any_kind",
        true,
      ),
    ).rejects.toThrow("MATCH_RUN_NOT_FOUND");

    const refreshed = await store.upsertJob(owner.tenantId, {
      ...input,
      description: "Updated posting. No sponsorship of any kind is available for this role.",
      contentHash: "wording-v2",
    });
    await expect(
      store.setRoleWordingReviewed(
        owner.tenantId,
        refreshed.id,
        firstMatch.id,
        "no_sponsorship_of_any_kind",
        true,
      ),
    ).rejects.toThrow("ROLE_WORDING_REVIEW_STALE");

    const currentResult = matchJob({
      job: {
        ...refreshed,
        descriptionLocator: refreshed.url,
        observedAt: refreshed.availability.lastSeenAt,
      },
      evidence: [],
    });
    const currentMatch = await store.saveMatch(owner.tenantId, refreshed.id, null, currentResult);
    const review = await store.setRoleWordingReviewed(
      owner.tenantId,
      refreshed.id,
      currentMatch.id,
      "no_sponsorship_of_any_kind",
      true,
    );
    expect(review).toMatchObject({
      jobId: refreshed.id,
      matchRunId: currentMatch.id,
      blockerCode: "no_sponsorship_of_any_kind",
      sourceText: "No sponsor",
      evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect((await store.listRoleWordingReviews(owner.tenantId))[0]).toEqual(review);
    expect(await store.listRoleWordingReviews(other.tenantId)).toEqual([]);
    expect(await store.exportTenant(owner.tenantId)).toMatchObject({
      schemaVersion: "nimanto_export_v6",
      roleWordingReviews: [review],
    });

    expect(
      await store.setRoleWordingReviewed(
        owner.tenantId,
        refreshed.id,
        currentMatch.id,
        "no_sponsorship_of_any_kind",
        false,
      ),
    ).toBeNull();
    expect(await store.listRoleWordingReviews(owner.tenantId)).toEqual([]);
  });

  it("persists reviewed employer aliases, preserves collisions, and removes them explicitly", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-employer-aliases-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("aliases@example.test", "Alias Owner");
    const other = await store.createLocalTenant("other-aliases@example.test", "Other Owner");
    const role = {
      source: "manual",
      title: "Platform Engineer",
      description: "Build services",
      location: "Chicago",
      workMode: "hybrid" as const,
      requirements: ["TypeScript"],
      capability: "deep_link" as const,
      sourceMeta: {},
      contentHash: "alias-role-v1",
    };
    await store.upsertJob(owner.tenantId, {
      ...role,
      sourceJobId: "northwind-alias-role",
      company: "Northwind Systems",
      url: "https://candidate.example.test/northwind-alias-role",
    });
    await store.upsertJob(owner.tenantId, {
      ...role,
      sourceJobId: "contoso-alias-role",
      company: "Contoso",
      url: "https://candidate.example.test/contoso-alias-role",
    });

    const northwind = await store.setEmployerAliasReviewed(owner.tenantId, {
      canonicalCompany: "Northwind Systems, Inc.",
      alias: "Shared DBA",
      sourceLocator: "https://northwind.example.test/legal",
      observedAt: "2026-08-28T00:00:00.000Z",
      reviewed: true,
    });
    const repeated = await store.setEmployerAliasReviewed(owner.tenantId, {
      canonicalCompany: "Northwind Systems",
      alias: "Shared DBA",
      sourceLocator: "https://northwind.example.test/legal",
      observedAt: "2026-08-28T00:00:00.000Z",
      reviewed: true,
    });
    expect(repeated).toEqual(northwind);
    await expect(
      store.setEmployerAliasReviewed(owner.tenantId, {
        canonicalCompany: "Northwind Systems",
        alias: "Shared DBA",
        sourceLocator: "https://northwind.example.test/changed",
        observedAt: "2026-08-28T00:00:00.000Z",
        reviewed: true,
      }),
    ).rejects.toThrow("EMPLOYER_ALIAS_CONFLICT");
    await store.setEmployerAliasReviewed(owner.tenantId, {
      canonicalCompany: "Contoso",
      alias: "Shared DBA",
      sourceLocator: "https://contoso.example.test/legal",
      observedAt: "2026-08-28T00:00:00.000Z",
      reviewed: true,
    });

    const aliases = await store.listEmployerAliases(owner.tenantId);
    expect(aliases).toHaveLength(2);
    expect(aliases[0]).toMatchObject({
      canonicalCompany: "Contoso",
      normalizedName: "contoso",
      alias: "Shared DBA",
      normalizedAlias: "shared dba",
      evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(await store.listEmployerAliases(other.tenantId)).toEqual([]);
    await expect(
      store.setEmployerAliasReviewed(other.tenantId, {
        canonicalCompany: "Northwind Systems",
        alias: "Other tenant must not attach",
        sourceLocator: "fixture:cross-tenant",
        observedAt: "2026-08-28T00:00:00.000Z",
        reviewed: true,
      }),
    ).rejects.toThrow("EMPLOYER_CANONICAL_NOT_FOUND");
    expect(
      resolveEmployer(
        "Shared DBA",
        buildEmployerCandidates(
          ["Northwind Systems", "Contoso"],
          aliases.map((review) => ({
            canonicalCompany: review.canonicalCompany,
            alias: review.alias,
          })),
        ),
      ),
    ).toEqual({ state: "ambiguous" });
    expect(await store.exportTenant(owner.tenantId)).toMatchObject({
      schemaVersion: "nimanto_export_v6",
      employerEntities: expect.arrayContaining([
        expect.objectContaining({ normalizedName: "northwind systems" }),
        expect.objectContaining({ normalizedName: "contoso" }),
      ]),
      employerAliases: aliases,
    });

    expect(
      await store.setEmployerAliasReviewed(owner.tenantId, {
        canonicalCompany: "Northwind Systems",
        alias: "Shared DBA",
        reviewed: false,
      }),
    ).toBeNull();
    expect(await store.listEmployerAliases(owner.tenantId)).toHaveLength(1);
    expect(await store.listEmployerEntities(owner.tenantId)).toEqual([
      expect.objectContaining({ normalizedName: "contoso" }),
    ]);
  });

  it("keeps candidate role disposition separate from refreshed source facts", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-role-disposition-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("archive@example.test", "Archive Owner");
    const other = await store.createLocalTenant("other-archive@example.test", "Other Owner");
    const input = {
      source: "greenhouse",
      sourceJobId: "role-17",
      title: "Platform Engineer",
      company: "Northwind",
      description: "Build services",
      location: "Remote",
      workMode: "remote",
      url: "https://example.test/roles/17",
      requirements: ["TypeScript"],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "role-17-v1",
    };
    const job = await store.upsertJob(owner.tenantId, input);
    expect(await store.setRoleArchived(other.tenantId, job.id, true)).toBeNull();
    expect(await store.setRoleArchived(owner.tenantId, job.id, true)).toMatchObject({
      candidateDisposition: { state: "archived", archivedAt: expect.any(String) },
    });

    const refreshed = await store.upsertJob(owner.tenantId, {
      ...input,
      description: "Build refreshed services",
      contentHash: "role-17-v2",
    });
    expect(refreshed).toMatchObject({
      description: "Build refreshed services",
      candidateDisposition: { state: "archived" },
    });
    expect(await store.setRoleArchived(owner.tenantId, job.id, false)).toMatchObject({
      candidateDisposition: { state: "active", archivedAt: null },
    });
  });

  it("groups only unambiguous cross-source role variants without merging records", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-role-clusters-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("clusters@example.test", "Cluster Owner");
    const shared = {
      title: "Platform Engineer",
      company: "Northwind",
      description: "Build services",
      location: "Chicago",
      workMode: "hybrid" as const,
      requirements: ["TypeScript"],
      capability: "deep_link" as const,
    };
    await store.upsertJob(owner.tenantId, {
      ...shared,
      source: "manual",
      sourceJobId: "manual-role",
      url: "https://candidate.example.test/manual-role",
      sourceMeta: {},
      contentHash: "manual-role-v1",
    });
    await store.upsertJob(owner.tenantId, {
      ...shared,
      source: "greenhouse",
      sourceJobId: "greenhouse-role",
      url: "https://boards.example.test/greenhouse-role",
      sourceMeta: { board: "northwind" },
      contentHash: "greenhouse-role-v1",
    });
    expect(await store.listJobs(owner.tenantId)).toEqual([
      expect.objectContaining({
        cluster: { id: expect.any(String), size: 2, sources: ["greenhouse", "manual"] },
      }),
      expect.objectContaining({
        cluster: { id: expect.any(String), size: 2, sources: ["greenhouse", "manual"] },
      }),
    ]);
    await store.upsertJob(owner.tenantId, {
      ...shared,
      source: "greenhouse",
      sourceJobId: "greenhouse-role-2",
      url: "https://boards.example.test/greenhouse-role-2",
      sourceMeta: { board: "northwind" },
      contentHash: "greenhouse-role-v2",
    });
    expect((await store.listJobs(owner.tenantId)).every((job) => job.cluster.size === 1)).toBe(
      true,
    );
  });

  it("records method-qualified source observations and closes only after spaced complete misses", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-role-verification-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("verification@example.test", "Verification Owner");
    const input = {
      source: "greenhouse",
      sourceJobId: "verified-role",
      title: "Machine Learning Engineer",
      company: "Northwind",
      description: "Build models",
      location: "Chicago, IL",
      workMode: "hybrid" as const,
      url: "https://example.test/verified-role",
      requirements: ["Python"],
      capability: "deep_link" as const,
      sourceMeta: { board: "northwind" },
      contentHash: "verified-role-v1",
      observedAt: "2026-08-26T00:05:00.000Z",
      sourcePostedAt: "2026-08-25T00:00:00.000Z",
      rawPayload: { id: "verified-role", confidentialField: "discarded" },
    };
    const initial = await store.recordSourceObservation(
      owner.tenantId,
      {
        source: "greenhouse",
        boardId: "northwind",
        startedAt: "2026-08-26T00:00:00.000Z",
        completedAt: "2026-08-26T00:05:00.000Z",
        complete: true,
        pagesRead: 1,
        sourceItemCount: 1,
        responseFingerprint: "run-1",
        retryAfterObserved: false,
        sourcePolicyVersion: "source_registry_v1",
      },
      [input],
    );
    expect(initial.jobs[0]).toMatchObject({
      roleFamily: "ai_ml",
      availability: {
        publicationState: "active",
        verificationHealth: expect.stringMatching(/^(verified|overdue)$/u),
        verificationAuthority: "employer_ats",
        verificationMethod: "complete_list",
      },
    });

    const baseRun = {
      source: "greenhouse",
      boardId: "northwind",
      pagesRead: 1,
      sourceItemCount: 0,
      retryAfterObserved: false,
      sourcePolicyVersion: "source_registry_v1",
    };
    await store.recordSourceObservation(
      owner.tenantId,
      {
        ...baseRun,
        startedAt: "2026-08-26T01:00:00.000Z",
        completedAt: "2026-08-26T01:01:00.000Z",
        complete: false,
        responseFingerprint: "partial-run",
      },
      [],
    );
    expect(
      (await store.getJob(owner.tenantId, initial.jobs[0]!.id))?.availability.publicationState,
    ).toBe("active");
    await store.recordSourceObservation(
      owner.tenantId,
      {
        ...baseRun,
        startedAt: "2026-08-26T02:00:00.000Z",
        completedAt: "2026-08-26T02:01:00.000Z",
        complete: true,
        responseFingerprint: "complete-miss-1",
      },
      [],
    );
    expect((await store.getJob(owner.tenantId, initial.jobs[0]!.id))?.availability).toMatchObject({
      publicationState: "possibly_closed",
      consecutiveCompleteMisses: 1,
    });
    const closedRun = await store.recordSourceObservation(
      owner.tenantId,
      {
        ...baseRun,
        startedAt: "2026-08-26T08:05:00.000Z",
        completedAt: "2026-08-26T08:06:00.000Z",
        complete: true,
        responseFingerprint: "complete-miss-2",
      },
      [],
    );
    expect((await store.getJob(owner.tenantId, initial.jobs[0]!.id))?.availability).toMatchObject({
      publicationState: "closed",
      consecutiveCompleteMisses: 2,
      closureReason: "source_removed_after_two_complete_runs",
    });
    expect(await store.listSourceRuns(owner.tenantId)).toHaveLength(4);
    expect(await store.listRoleObservations(owner.tenantId)).toEqual([
      expect.objectContaining({ sourcePayloadHash: expect.stringMatching(/^[a-f0-9]{64}$/u) }),
    ]);
    expect(await store.listVerificationAttempts(owner.tenantId)).toHaveLength(3);
    expect(await store.listLatestRoleObservations(owner.tenantId)).toEqual([
      expect.objectContaining({
        jobId: initial.jobs[0]!.id,
        sourceRunId: initial.sourceRun.id,
        normalizerVersion: "role_normalizer_v2",
      }),
    ]);
    expect(await store.listLatestVerificationAttempts(owner.tenantId)).toEqual([
      expect.objectContaining({
        jobId: initial.jobs[0]!.id,
        sourceRunId: closedRun.sourceRun.id,
        result: "absent_from_complete_list",
      }),
    ]);
    expect(JSON.stringify(await store.exportTenant(owner.tenantId))).not.toContain(
      "confidentialField",
    );
  });

  it("records candidate-requested ATS checks without weakening closure evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-ats-recheck-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("ats-recheck@example.test", "ATS Recheck Owner");
    const detailJob = await store.upsertJob(owner.tenantId, {
      source: "manual",
      sourceJobId: "candidate-detail",
      title: "Platform Engineer",
      company: "Northwind",
      description: "Build services",
      location: "Chicago",
      url: "https://job-boards.greenhouse.io/northwind/jobs/17001",
      requirements: [],
      capability: "deep_link",
      sourceMeta: { manual: true },
      contentHash: "candidate-detail-v1",
    });
    await store.recordRoleVerification(owner.tenantId, detailJob.id, {
      attemptedAt: "2026-08-26T00:00:00.000Z",
      method: "detail_get",
      result: "present",
      evidence: { provider: "greenhouse", responseFingerprint: "present-1" },
    });
    await store.recordRoleVerification(owner.tenantId, detailJob.id, {
      attemptedAt: "2026-08-26T01:00:00.000Z",
      method: "detail_get",
      result: "blocked",
      evidence: { provider: "greenhouse", errorCode: "PROVIDER_HTTP_503" },
    });
    expect((await store.getJob(owner.tenantId, detailJob.id))?.availability).toMatchObject({
      publicationState: "active",
      verificationHealth: "blocked",
      lastVerifiedAt: "2026-08-26T00:00:00.000Z",
    });
    await store.recordRoleVerification(owner.tenantId, detailJob.id, {
      attemptedAt: "2026-08-26T02:00:00.000Z",
      method: "detail_get",
      result: "not_found",
      evidence: { provider: "greenhouse", responseFingerprint: "missing-1" },
    });
    expect((await store.getJob(owner.tenantId, detailJob.id))?.availability).toMatchObject({
      publicationState: "closed",
      verificationHealth: "verified",
      closureReason: "detail_not_found",
    });

    const boardJob = await store.upsertJob(owner.tenantId, {
      source: "manual",
      sourceJobId: "candidate-board",
      title: "Product Engineer",
      company: "Contoso",
      description: "Build products",
      location: "Remote",
      url: "https://jobs.ashbyhq.com/contoso/ashby-7",
      requirements: [],
      capability: "deep_link",
      sourceMeta: { manual: true },
      contentHash: "candidate-board-v1",
    });
    await store.recordRoleVerification(owner.tenantId, boardJob.id, {
      attemptedAt: "2026-08-26T00:00:00.000Z",
      method: "complete_list",
      result: "absent_from_complete_list",
      evidence: { provider: "ashby", responseFingerprint: "board-miss-1" },
    });
    expect((await store.getJob(owner.tenantId, boardJob.id))?.availability).toMatchObject({
      publicationState: "possibly_closed",
      consecutiveCompleteMisses: 1,
    });
    await store.recordRoleVerification(owner.tenantId, boardJob.id, {
      attemptedAt: "2026-08-26T06:01:00.000Z",
      method: "complete_list",
      result: "absent_from_complete_list",
      evidence: { provider: "ashby", responseFingerprint: "board-miss-2" },
    });
    expect((await store.getJob(owner.tenantId, boardJob.id))?.availability).toMatchObject({
      publicationState: "closed",
      consecutiveCompleteMisses: 2,
      closureReason: "source_removed_after_two_complete_runs",
    });
    expect(await store.listVerificationAttempts(owner.tenantId)).toHaveLength(5);
  }, 30_000);

  it("stores only candidate-approved, idempotent discovery profile versions", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-discovery-profile-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("discovery@example.test", "Discovery Owner");
    const input = {
      profileVersionId: null,
      roleFamilies: ["ai_ml", "software_technical"] as const,
      includeTitles: [" Machine Learning Engineer "],
      excludeTitles: [],
      seniorityLevels: [],
      industries: [],
      mustHaveSkills: ["Python"],
      preferredSkills: [],
      acceptedPhysicalAreas: [
        {
          displayLabel: "Chicago, IL",
          countryCode: "us",
          subdivisionCode: "US-IL",
          metroId: null,
          timeZone: "America/Chicago",
          resolution: "confirmed" as const,
        },
      ],
      commuteRadiusMiles: 30,
      relocationPreference: "consider" as const,
      workModes: ["remote", "hybrid"] as const,
      eligibleRemoteAreas: [],
      minimumCompensation: { amount: 120_000, currency: "USD" },
      currentPostingSponsorshipFilter: "show_all" as const,
      authorizationStatementVersionId: null,
      authorizationStatementExpiresAt: null,
      freshnessMaximumHours: 168,
      sourceIds: ["greenhouse", "lever"],
      matcherVersion: "scoring_rules_v1" as const,
      normalizerVersion: "discovery_profile_v1" as const,
    };
    const first = await store.saveDiscoveryProfile(owner.tenantId, input);
    const second = await store.saveDiscoveryProfile(owner.tenantId, input);
    expect(first.created).toBe(true);
    expect(second).toEqual({ profile: first.profile, created: false });
    expect(first.profile.input.acceptedPhysicalAreas[0]).toMatchObject({
      countryCode: "US",
      subdivisionCode: "US-IL",
    });
    expect(await store.listDiscoveryProfiles(owner.tenantId)).toHaveLength(1);
    const emptyStatement = await store.createProfileVersion(owner.tenantId, "");
    await expect(
      store.saveDiscoveryProfile(owner.tenantId, {
        ...input,
        authorizationStatementVersionId: emptyStatement.id,
        authorizationStatementExpiresAt: "2027-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("DISCOVERY_AUTHORIZATION_STATEMENT_REQUIRED");
    const statement = await store.createProfileVersion(
      owner.tenantId,
      "I require employer-sponsored work authorization.",
    );
    const withStatement = await store.saveDiscoveryProfile(owner.tenantId, {
      ...input,
      authorizationStatementVersionId: statement.id,
      authorizationStatementExpiresAt: "2027-01-01T00:00:00.000Z",
    });
    expect(withStatement.profile.input).toMatchObject({
      authorizationStatementVersionId: statement.id,
      authorizationStatementExpiresAt: "2027-01-01T00:00:00.000Z",
    });
    const other = await store.createLocalTenant("other-discovery@example.test", "Other Discovery");
    const foreignProfile = await store.createProfileVersion(other.tenantId, "Foreign wording");
    await expect(
      store.saveDiscoveryProfile(owner.tenantId, {
        ...input,
        profileVersionId: foreignProfile.id,
      }),
    ).rejects.toThrow("PROFILE_VERSION_NOT_FOUND");
  });

  it("stores private application notes without creating outcomes or changing status", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-application-note-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("notes@example.test", "Notes Owner");
    const other = await store.createLocalTenant("other-notes@example.test", "Other Notes");
    const job = await store.upsertJob(owner.tenantId, {
      source: "manual",
      sourceJobId: "notes-role",
      title: "Platform Engineer",
      company: "Northwind",
      description: "Build services",
      location: "Remote",
      workMode: "remote",
      url: "",
      requirements: [],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "notes-role-v1",
    });
    const application = await store.createApplication(owner.tenantId, job.id, null);
    await expect(
      store.addApplicationNote(other.tenantId, application.id, {
        text: "Must remain tenant private",
        recordedAt: "2026-08-25T12:00:00.000Z",
      }),
    ).rejects.toThrow("APPLICATION_NOT_FOUND");
    const note = await store.addApplicationNote(owner.tenantId, application.id, {
      text: "  Recruiter mentioned a September start.  ",
      recordedAt: "2026-08-25T12:00:00.000Z",
    });
    expect(note.text).toBe("Recruiter mentioned a September start.");
    expect((await store.listApplications(owner.tenantId))[0]).toMatchObject({
      status: "tracked",
      outcomes: [],
      notes: [note],
    });
  });

  it("stores and clears a candidate follow-up date without changing application state", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("reminder@example.test", "Reminder Owner");
    const other = await store.createLocalTenant("other-reminder@example.test", "Other Owner");
    const job = await store.upsertJob(owner.tenantId, {
      source: "manual",
      sourceJobId: "reminder-job",
      title: "Platform Engineer",
      company: "Northwind",
      description: "Build services",
      location: "Remote",
      workMode: "remote",
      url: "",
      requirements: [],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "reminder-job-content",
    });
    const application = await store.createApplication(owner.tenantId, job.id, null);

    const scheduled = await store.setApplicationFollowUp(
      owner.tenantId,
      application.id,
      "2026-08-29",
    );
    expect(scheduled).toMatchObject({
      id: application.id,
      status: "tracked",
      followUpOn: "2026-08-29",
    });
    expect(await store.setApplicationFollowUp(other.tenantId, application.id, "2026-08-30")).toBe(
      null,
    );
    expect((await store.listApplications(owner.tenantId))[0]).toMatchObject({
      followUpOn: "2026-08-29",
      status: "tracked",
    });

    const withdrawn = await store.transitionCandidateApplicationStatus(
      owner.tenantId,
      application.id,
      "withdrawn",
      true,
    );
    expect(withdrawn).toMatchObject({ status: "withdrawn", followUpOn: "2026-08-29" });
    await expect(
      store.setApplicationFollowUp(owner.tenantId, application.id, "2026-09-01"),
    ).rejects.toThrow("FOLLOW_UP_UNAVAILABLE");

    const cleared = await store.setApplicationFollowUp(owner.tenantId, application.id, null);
    expect(cleared).toMatchObject({ followUpOn: null, status: "withdrawn" });
    expect(
      await store.transitionCandidateApplicationStatus(
        owner.tenantId,
        application.id,
        "tracked",
        false,
      ),
    ).toMatchObject({ followUpOn: null, status: "tracked" });
  });

  it("clears the submission timestamp when an application leaves submitted_externally", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("dev@example.test", "Dev");
    const profile = await store.createProfileVersion(identity.tenantId, "H-1B transfer support.");
    const job = await store.upsertJob(identity.tenantId, {
      source: "manual",
      sourceJobId: "job-sub",
      title: "Platform Engineer",
      company: "Northwind",
      description: "Build services",
      location: "Remote",
      workMode: "remote",
      url: "https://example.test/jobs/sub",
      requirements: ["TypeScript"],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "content-sub",
    });
    const application = await store.createApplication(identity.tenantId, job.id, profile.id);

    const submitted = await store.setApplicationStatus(
      identity.tenantId,
      application.id,
      "submitted_externally",
    );
    expect(submitted?.submittedAt).toBeTruthy();

    // A mis-recorded submission must not leave a permanent false claim that the
    // candidate submitted something. Previously this timestamp was never cleared.
    const corrected = await store.setApplicationStatus(
      identity.tenantId,
      application.id,
      "approved_for_export",
    );
    expect(corrected?.status).toBe("approved_for_export");
    expect(corrected?.submittedAt).toBeNull();
  });

  it("owns candidate policy and timestamp changes in one persistence transaction", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("candidate@example.test", "Candidate");
    const job = await store.upsertJob(identity.tenantId, {
      source: "manual",
      sourceJobId: "candidate-policy",
      title: "Engineer",
      company: "Northwind",
      description: "Build services",
      location: "",
      workMode: "unspecified",
      url: "",
      requirements: [],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "candidate-policy-hash",
    });
    const application = await store.createApplication(identity.tenantId, job.id, null);

    await expect(
      store.transitionCandidateApplicationStatus(
        identity.tenantId,
        application.id,
        "withdrawn",
        false,
      ),
    ).rejects.toThrow("APPLICATION_TRANSITION_CONFIRMATION_REQUIRED");
    await expect(
      store.transitionCandidateApplicationStatus(
        identity.tenantId,
        application.id,
        "submitted_externally",
        true,
      ),
    ).rejects.toThrow("INVALID_APPLICATION_TRANSITION");

    const withdrawn = await store.transitionCandidateApplicationStatus(
      identity.tenantId,
      application.id,
      "withdrawn",
      true,
    );
    expect(withdrawn?.status).toBe("withdrawn");
  });

  it("keeps the packet persistence primitive separate from candidate intent", async () => {
    // PacketLifecycle decides its named system consequence inside its owning
    // transaction. This low-level write deliberately does not run candidate
    // confirmation policy or own the lifecycle's authority decision.
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("ops@example.test", "Ops");
    const profile = await store.createProfileVersion(identity.tenantId, "H-1B transfer support.");
    const job = await store.upsertJob(identity.tenantId, {
      source: "manual",
      sourceJobId: "job-sys",
      title: "Platform Engineer",
      company: "Northwind",
      description: "Build services",
      location: "Remote",
      workMode: "remote",
      url: "https://example.test/jobs/sys",
      requirements: ["TypeScript"],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "content-sys",
    });
    const application = await store.createApplication(identity.tenantId, job.id, profile.id);
    const prepared = await store.setApplicationStatus(
      identity.tenantId,
      application.id,
      "prepared",
    );
    expect(prepared?.status).toBe("prepared");
  });

  it("requires assurance before packet approval and records action transitions", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("owner@example.test", "Owner");
    const job = await store.upsertJob(identity.tenantId, {
      source: "manual",
      sourceJobId: "job-2",
      title: "Engineer",
      company: "Northwind",
      description: "Build services",
      location: "",
      workMode: "unspecified",
      url: "",
      requirements: [],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "content-2",
    });
    const application = await store.createApplication(identity.tenantId, job.id, null);
    const packet = await store.createPacket(identity.tenantId, {
      applicationId: application.id,
      profileVersionId: null,
      canonicalContent: { claims: [] },
      artifactManifest: {},
    });
    const olderPassing = await store.saveAssurance(identity.tenantId, packet.id, {
      status: "passed",
      ruleVersion: "application_assurance_v1",
      findings: [],
    });
    await store.saveAssurance(identity.tenantId, packet.id, {
      status: "blocked",
      ruleVersion: "application_assurance_v2",
      findings: [{ code: "SYNTHETIC_REVIEW_FINDING" }],
    });
    expect(await store.listLatestAssurances(identity.tenantId)).toEqual([
      expect.objectContaining({
        packetId: packet.id,
        status: "blocked",
        ruleVersion: "application_assurance_v2",
      }),
    ]);
    const passing = await store.saveAssurance(identity.tenantId, packet.id, {
      status: "passed",
      ruleVersion: "application_assurance_v1",
      findings: [],
    });
    expect(passing).toMatchObject({
      packetArtifactHash: packet.artifactHash,
      manifestHash: packet.manifestHash,
    });
    await expect(
      store.approvePacketExact(
        identity.tenantId,
        packet.id,
        olderPassing.id,
        packet.artifactHash,
        packet.manifestHash,
      ),
    ).rejects.toThrow("PACKET_APPROVAL_STALE");
    expect(
      (
        await store.approvePacketExact(
          identity.tenantId,
          packet.id,
          passing.id,
          packet.artifactHash,
          packet.manifestHash,
        )
      ).status,
    ).toBe("approved");
    expect(
      await store.updatePacketManifest(identity.tenantId, packet.id, { changed: true }),
    ).toBeNull();

    const action = await store.createExternalAction(identity.tenantId, {
      packetId: packet.id,
      provider: "test_outbox",
      target: { to: "jobs@example.test" },
      payload: { subject: "Application", body: "Hello" },
      idempotencyKey: "action-1",
    });
    expect(action.state).toBe("pending_approval");
    await expect(
      store.transitionExternalAction(identity.tenantId, action.id, "pending_approval", "approved"),
    ).rejects.toThrow("EXACT_ACTION_APPROVAL_REQUIRED");
    expect(await store.getExternalAction(identity.tenantId, action.id)).toMatchObject({
      state: "pending_approval",
      approvedIntentHash: null,
      approvedPacketHash: null,
    });
    expect(await store.approveExternalActionExact(identity.tenantId, action.id)).toMatchObject({
      state: "approved",
      approvedIntentHash: action.intentHash,
      approvedPacketHash: packet.artifactHash,
    });
  });
});
