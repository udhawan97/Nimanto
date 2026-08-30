import type { PGlite } from "@electric-sql/pglite";
import {
  canonicalHash,
  type ExternalActionProvider,
  type ExternalActionState,
} from "@nimanto/domain";
import {
  freshSchemaSql,
  schemaVersion2Sql,
  schemaVersion3Sql,
  schemaVersion4Sql,
  schemaVersion5Sql,
  schemaVersion7Sql,
  schemaVersion8Sql,
  schemaVersion9Sql,
  schemaVersion10Sql,
  schemaVersion11Sql,
  schemaVersion12Sql,
} from "./schema.js";

export const CURRENT_SCHEMA_VERSION = 12;

async function backfillIntegrityHashes(database: PGlite): Promise<void> {
  const legacyPackets = await database.query<{
    id: string;
    artifact_manifest: Record<string, unknown>;
  }>(
    `SELECT packet.id, packet.artifact_manifest
     FROM packets AS packet
     JOIN tenants AS tenant ON tenant.id = packet.tenant_id
     WHERE packet.manifest_hash = '' AND tenant.deletion_state = 'active'`,
  );
  for (const packet of legacyPackets.rows) {
    await database.query("UPDATE packets SET manifest_hash = $2 WHERE id = $1", [
      packet.id,
      canonicalHash(packet.artifact_manifest),
    ]);
  }

  const legacyActions = await database.query<{
    id: string;
    packet_id: string | null;
    provider: ExternalActionProvider;
    target: Record<string, unknown>;
    payload: Record<string, unknown>;
    state: ExternalActionState;
  }>(
    `SELECT action.id, action.packet_id, action.provider, action.target,
       action.payload, action.state
     FROM external_actions AS action
     JOIN tenants AS tenant ON tenant.id = action.tenant_id
     WHERE action.intent_hash = '' AND tenant.deletion_state = 'active'`,
  );
  for (const action of legacyActions.rows) {
    const intentHash = canonicalHash({
      packetId: action.packet_id,
      provider: action.provider,
      target: action.target,
      payload: action.payload,
    });
    await database.query(
      `UPDATE external_actions
       SET intent_hash = $2,
         state = CASE WHEN state = 'approved' THEN 'pending_approval' ELSE state END,
         approved_at = CASE WHEN state = 'approved' THEN NULL ELSE approved_at END
       WHERE id = $1`,
      [action.id, intentHash],
    );
  }
}

const migrations: ReadonlyArray<{
  version: number;
  sql?: string;
  run?: (database: PGlite) => Promise<void>;
}> = [
  { version: 1 },
  { version: 2, sql: schemaVersion2Sql },
  { version: 3, sql: schemaVersion3Sql },
  { version: 4, sql: schemaVersion4Sql },
  { version: 5, sql: schemaVersion5Sql },
  { version: 6, run: backfillIntegrityHashes },
  { version: 7, sql: schemaVersion7Sql },
  { version: 8, sql: schemaVersion8Sql },
  { version: 9, sql: schemaVersion9Sql },
  { version: 10, sql: schemaVersion10Sql },
  { version: 11, sql: schemaVersion11Sql },
  { version: 12, sql: schemaVersion12Sql },
];

/** Ordered, resumable PGlite migration seam. Base CREATE statements are safe
 * to replay and fill partial local-beta schemas. Each upgrade runs in its own
 * transaction and records its version only after schema work and data
 * backfills commit. */
export async function migrateDatabase(database: PGlite): Promise<number[]> {
  await database.exec(String.raw`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  const recorded = await database.query<{ version: number }>(
    "SELECT version FROM schema_versions ORDER BY version",
  );
  const applied = new Set(recorded.rows.map((row) => Number(row.version)));
  if ([...applied].some((version) => version > CURRENT_SCHEMA_VERSION)) {
    throw new Error("DATABASE_SCHEMA_NEWER_THAN_RUNTIME");
  }

  // No ALTERs or data rewrites: this only creates missing base objects and is
  // safe to resume if an older local-beta fixture was incomplete.
  await database.transaction(async (transaction) => {
    await transaction.exec(freshSchemaSql);
  });

  const newlyApplied: number[] = [];
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    await database.transaction(async (transaction) => {
      const scoped = transaction as unknown as PGlite;
      if (migration.sql) await scoped.exec(migration.sql);
      if (migration.run) await migration.run(scoped);
      await scoped.query(
        "INSERT INTO schema_versions(version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
        [migration.version],
      );
    });
    newlyApplied.push(migration.version);
  }
  return newlyApplied;
}
