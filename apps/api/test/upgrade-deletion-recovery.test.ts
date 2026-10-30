import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { NimantoStore } from "@nimanto/database";
import { DeletionCoordinator } from "../src/deletion-coordinator.js";

const roots: string[] = [];
const databases = new Set<PGlite>();
const stores = new Set<NimantoStore>();

async function rawDatabase(data: string) {
  const database = await PGlite.create(data);
  databases.add(database);
  return database;
}

async function closeDatabase(database: PGlite) {
  await database.close();
  databases.delete(database);
}

async function openStore(data: string) {
  const store = await NimantoStore.open(data);
  stores.add(store);
  return store;
}

async function closeStore(store: NimantoStore) {
  await store.close();
  stores.delete(store);
}

afterEach(async () => {
  await Promise.all([...stores].map((store) => store.close()));
  await Promise.all([...databases].map((database) => database.close()));
  stores.clear();
  databases.clear();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it.each(["legacy_identity", "initial_event", "both"])(
  "upgrades stopped v14 with %s backfill rows and recovers database and file deletion",
  async (backfill) => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-v14-deletion-upgrade-"));
    roots.push(root);
    const data = join(root, "data");
    const artifacts = join(root, "artifacts");
    const outbox = join(root, "outbox");
    const legacy = await rawDatabase(data);
    await legacy.exec(
      await readFile(
        new URL("../../../packages/database/test/fixtures/schema-v14.sql", import.meta.url),
        "utf8",
      ),
    );
    expect(
      (
        await legacy.query<{ version: number }>(
          "SELECT max(version) AS version FROM schema_versions",
        )
      ).rows[0]?.version,
    ).toBe(14);
    expect(
      (
        await legacy.query(
          "SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'identity_review_required'",
        )
      ).rows,
    ).toEqual([]);

    for (const tenant of ["active", "deleting"]) {
      await legacy.query("INSERT INTO tenants(id, name) VALUES ($1, $1)", [tenant]);
      await legacy.query(
        `INSERT INTO jobs(id, tenant_id, source, source_job_id, title, company, description,
          requirements, content_hash, created_at, updated_at)
         VALUES ($1,$2,'manual',$3,'Synthetic Engineer','Synthetic Works','Build systems',
          '[]'::jsonb,'preserved-content','2026-01-01','2026-01-02')`,
        [
          `${tenant}-job`,
          tenant,
          backfill === "initial_event" ? `${tenant}-opaque` : "0123456789abcdef01234567",
        ],
      );
      await legacy.query(
        "INSERT INTO applications(id, tenant_id, job_id, status) VALUES ($1,$2,$3,'draft')",
        [`${tenant}-application`, tenant, `${tenant}-job`],
      );
      await legacy.query(
        `INSERT INTO application_status_events(id, tenant_id, application_id, from_status,
          to_status, source, occurred_at, created_at)
         VALUES ($1,$2,$3,NULL,'draft',$4,'2026-01-01','2026-02-01')`,
        [
          backfill === "legacy_identity" ? `${tenant}-event` : `initial:${tenant}-application`,
          tenant,
          `${tenant}-application`,
          backfill === "legacy_identity" ? "candidate" : "migration",
        ],
      );
      await legacy.query(
        `INSERT INTO external_actions(id, tenant_id, provider, state, target, payload,
          idempotency_key) VALUES ($1,$2,'test_outbox','pending_approval','{}','{}',$1)`,
        [`${tenant}-action`, tenant],
      );
      await mkdir(join(artifacts, tenant), { recursive: true });
      await writeFile(join(artifacts, tenant, "synthetic.txt"), tenant);
    }
    await mkdir(outbox, { recursive: true });
    for (const tenant of ["active", "deleting"]) {
      await writeFile(join(outbox, `${tenant}-action.json`), tenant);
    }
    await legacy.exec(`
      UPDATE tenants SET deletion_state = 'deleting' WHERE id = 'deleting';
      INSERT INTO deletion_runs(id, tenant_id, status_token_hash, state, requested_at,
        expires_at, cleanup_inventory)
      VALUES ('interrupted-v14','deleting','synthetic-token-hash','running',now(),
        now() + interval '30 days','{"actionIds":["deleting-action"]}');
    `);
    const preservedRole = (
      await legacy.query(
        "SELECT id, title, company, description, content_hash, source_job_id, created_at, updated_at FROM jobs WHERE tenant_id = 'active'",
      )
    ).rows;
    await closeDatabase(legacy);

    const upgraded = await openStore(data);
    await expect(
      upgraded.createEvidence("deleting", {
        kind: "skill",
        value: "TypeScript",
        status: "confirmed",
        confidence: "high",
        sourceName: "Synthetic",
        locator: "line:1",
      }),
    ).rejects.toThrow("TENANT_NOT_FOUND");
    await closeStore(upgraded);
    const inspection = await rawDatabase(data);
    expect(
      (
        await inspection.query(
          "SELECT id, title, company, description, content_hash, source_job_id, created_at, updated_at FROM jobs WHERE tenant_id = 'active'",
        )
      ).rows,
    ).toEqual(preservedRole);
    const flags = await inspection.query<{ tenant_id: string; identity_review_required: boolean }>(
      "SELECT tenant_id, identity_review_required FROM jobs ORDER BY tenant_id",
    );
    expect(flags.rows).toEqual([
      { tenant_id: "active", identity_review_required: backfill !== "initial_event" },
      { tenant_id: "deleting", identity_review_required: false },
    ]);
    const chronology = await inspection.query<{ tenant_id: string; corrected: boolean }>(
      "SELECT tenant_id, occurred_at = created_at AS corrected FROM application_status_events ORDER BY tenant_id",
    );
    expect(chronology.rows).toEqual([
      { tenant_id: "active", corrected: backfill !== "legacy_identity" },
      { tenant_id: "deleting", corrected: false },
    ]);
    await expect(
      inspection.exec("UPDATE jobs SET title = 'forbidden' WHERE tenant_id = 'deleting'"),
    ).rejects.toThrow("TENANT_NOT_ACTIVE");
    await expect(
      inspection.exec(
        "UPDATE application_status_events SET occurred_at = now() WHERE tenant_id = 'deleting'",
      ),
    ).rejects.toThrow("TENANT_NOT_ACTIVE");
    const ledger = (await inspection.query("SELECT * FROM schema_versions ORDER BY version")).rows;
    await closeDatabase(inspection);

    const recovering = await openStore(data);
    const coordinator = new DeletionCoordinator(recovering, artifacts, outbox);
    expect(await coordinator.recoverPending()).toEqual({ recovered: 1, pending: 0 });
    expect(await coordinator.recoverPending()).toEqual({ recovered: 0, pending: 0 });
    await closeStore(recovering);
    await expect(access(join(artifacts, "deleting"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(outbox, "deleting-action.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(artifacts, "active", "synthetic.txt"), "utf8")).toBe("active");
    expect(await readFile(join(outbox, "active-action.json"), "utf8")).toBe("active");

    const reopened = await openStore(data);
    expect(await new DeletionCoordinator(reopened, artifacts, outbox).recoverPending()).toEqual({
      recovered: 0,
      pending: 0,
    });
    await closeStore(reopened);
    const final = await rawDatabase(data);
    expect((await final.query("SELECT * FROM schema_versions ORDER BY version")).rows).toEqual(
      ledger,
    );
    expect((await final.query("SELECT id FROM tenants ORDER BY id")).rows).toEqual([
      { id: "active" },
    ]);
    const tenantTables = await final.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenant_id' AND table_name <> 'deletion_runs'",
    );
    for (const { table_name: table } of tenantTables.rows) {
      expect(
        (await final.query(`SELECT 1 FROM "${table}" WHERE tenant_id = 'deleting'`)).rows,
      ).toEqual([]);
    }
    expect((await final.query("SELECT state FROM deletion_runs")).rows).toEqual([
      { state: "completed" },
    ]);
    expect(
      (
        await final.query(
          "SELECT id, title, company, description, content_hash, source_job_id, created_at, updated_at FROM jobs WHERE tenant_id = 'active'",
        )
      ).rows,
    ).toEqual(preservedRole);
    await closeDatabase(final);
  },
);
