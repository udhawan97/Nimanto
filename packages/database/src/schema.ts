/** Latest shape for a brand-new local database. Upgrade-only ALTERs and data
 * backfills live in the ordered migration module instead of running on every
 * open. */
export const freshSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS schema_versions (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  deletion_state text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner')),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitations (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  intended_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_claims (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  value text NOT NULL,
  status text NOT NULL,
  confidence text NOT NULL,
  source_name text NOT NULL,
  locator text NOT NULL,
  user_attested boolean NOT NULL DEFAULT false,
  supersedes_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_claims_tenant_idx ON evidence_claims(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS profile_versions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  claim_ids jsonb NOT NULL,
  authorization_wording text,
  input_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
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
CREATE INDEX IF NOT EXISTS jobs_tenant_idx ON jobs(tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS match_runs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  profile_version_id text REFERENCES profile_versions(id) ON DELETE SET NULL,
  rule_version text NOT NULL,
  result jsonb NOT NULL,
  input_hash text NOT NULL,
  artifact_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_runs_tenant_idx ON match_runs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS h1b_signals (
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

CREATE TABLE IF NOT EXISTS applications (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  profile_version_id text REFERENCES profile_versions(id) ON DELETE SET NULL,
  status text NOT NULL,
  submitted_at timestamptz,
  follow_up_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS applications_tenant_idx ON applications(tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS outcomes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type text NOT NULL,
  note text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS packets_generation_sequence_seq;

CREATE TABLE IF NOT EXISTS packets (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  profile_version_id text REFERENCES profile_versions(id) ON DELETE SET NULL,
  status text NOT NULL,
  canonical_content jsonb NOT NULL,
  artifact_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_hash text NOT NULL,
  manifest_hash text NOT NULL DEFAULT '',
  generation_sequence bigint NOT NULL DEFAULT nextval('packets_generation_sequence_seq'),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS assurance_runs_run_sequence_seq;

CREATE TABLE IF NOT EXISTS assurance_runs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  packet_id text NOT NULL REFERENCES packets(id) ON DELETE CASCADE,
  status text NOT NULL,
  rule_version text NOT NULL,
  findings jsonb NOT NULL,
  packet_artifact_hash text NOT NULL DEFAULT '',
  manifest_hash text NOT NULL DEFAULT '',
  run_sequence bigint NOT NULL DEFAULT nextval('assurance_runs_run_sequence_seq'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_actions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  packet_id text REFERENCES packets(id) ON DELETE SET NULL,
  provider text NOT NULL,
  state text NOT NULL,
  target jsonb NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL,
  intent_hash text NOT NULL DEFAULT '',
  approved_intent_hash text,
  approved_packet_hash text,
  approved_at timestamptz,
  attempted_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS receipts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  input_hash text NOT NULL,
  artifact_hash text NOT NULL,
  receipt_hash text NOT NULL,
  material jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_settings (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, source)
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  state text NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL,
  not_before timestamptz NOT NULL,
  expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  lease_token_hash text,
  lease_expires_at timestamptz,
  last_run_at timestamptz,
  last_result jsonb,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_jobs_due_idx
  ON scheduled_jobs(state, not_before, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_jobs_active_source_idx
  ON scheduled_jobs(tenant_id, type, (payload->>'provider'), (payload->>'board'))
  WHERE type = 'source.refresh' AND state <> 'cancelled';

CREATE TABLE IF NOT EXISTS deletion_runs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL UNIQUE,
  status_token_hash text NOT NULL UNIQUE,
  state text NOT NULL,
  requested_at timestamptz NOT NULL,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  cleanup_inventory jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error_code text
);

CREATE TABLE IF NOT EXISTS dataset_editions (
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
CREATE OR REPLACE FUNCTION nimanto_require_active_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM id FROM tenants
    WHERE id = NEW.tenant_id AND deletion_state = 'active'
    FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_ACTIVE';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'memberships', 'sessions', 'evidence_claims', 'profile_versions', 'jobs',
    'match_runs', 'h1b_signals', 'applications', 'outcomes', 'packets',
    'assurance_runs', 'external_actions', 'receipts', 'source_settings',
    'scheduled_jobs', 'dataset_editions'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS nimanto_active_tenant_write ON %I', table_name);
    EXECUTE format(
      'CREATE TRIGGER nimanto_active_tenant_write BEFORE INSERT OR UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION nimanto_require_active_tenant()',
      table_name
    );
  END LOOP;
END;
$$;

`;

export const schemaVersion2Sql = String.raw`
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5;
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS lease_token_hash text;
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS last_result jsonb;
CREATE INDEX IF NOT EXISTS scheduled_jobs_due_idx
  ON scheduled_jobs(state, not_before, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_jobs_active_source_idx
  ON scheduled_jobs(tenant_id, type, (payload->>'provider'), (payload->>'board'))
  WHERE type = 'source.refresh' AND state <> 'cancelled';
`;

export const schemaVersion3Sql = String.raw`
CREATE SEQUENCE IF NOT EXISTS assurance_runs_run_sequence_seq;
ALTER TABLE assurance_runs ADD COLUMN IF NOT EXISTS run_sequence bigint;
WITH sequence_base AS (
  SELECT COALESCE(MAX(run_sequence), 0) AS value FROM assurance_runs
), ordered_runs AS (
  SELECT id, sequence_base.value + ROW_NUMBER() OVER (ORDER BY created_at, id) AS value
  FROM assurance_runs CROSS JOIN sequence_base
  WHERE run_sequence IS NULL
)
UPDATE assurance_runs
SET run_sequence = ordered_runs.value
FROM ordered_runs
WHERE assurance_runs.id = ordered_runs.id;
ALTER TABLE assurance_runs
  ALTER COLUMN run_sequence SET DEFAULT nextval('assurance_runs_run_sequence_seq');
ALTER TABLE assurance_runs ALTER COLUMN run_sequence SET NOT NULL;
ALTER SEQUENCE assurance_runs_run_sequence_seq OWNED BY assurance_runs.run_sequence;
SELECT setval(
  'assurance_runs_run_sequence_seq',
  GREATEST(COALESCE((SELECT MAX(run_sequence) FROM assurance_runs), 0) + 1, 1),
  false
);
ALTER TABLE packets ADD COLUMN IF NOT EXISTS manifest_hash text NOT NULL DEFAULT '';
ALTER TABLE assurance_runs ADD COLUMN IF NOT EXISTS packet_artifact_hash text NOT NULL DEFAULT '';
ALTER TABLE assurance_runs ADD COLUMN IF NOT EXISTS manifest_hash text NOT NULL DEFAULT '';
ALTER TABLE external_actions ADD COLUMN IF NOT EXISTS intent_hash text NOT NULL DEFAULT '';
ALTER TABLE external_actions ADD COLUMN IF NOT EXISTS approved_intent_hash text;
ALTER TABLE external_actions ADD COLUMN IF NOT EXISTS approved_packet_hash text;
CREATE TABLE IF NOT EXISTS dataset_editions (
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
ALTER TABLE h1b_signals ADD COLUMN IF NOT EXISTS dataset_edition_id text;
CREATE INDEX IF NOT EXISTS h1b_signals_dataset_edition_idx
  ON h1b_signals(tenant_id, dataset_edition_id);
ALTER TABLE deletion_runs ADD COLUMN IF NOT EXISTS cleanup_inventory jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE deletion_runs ADD COLUMN IF NOT EXISTS last_error_code text;
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'memberships', 'sessions', 'evidence_claims', 'profile_versions', 'jobs',
    'match_runs', 'h1b_signals', 'applications', 'outcomes', 'packets',
    'assurance_runs', 'external_actions', 'receipts', 'source_settings',
    'scheduled_jobs', 'dataset_editions'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS nimanto_active_tenant_write ON %I', table_name);
    EXECUTE format(
      'CREATE TRIGGER nimanto_active_tenant_write BEFORE INSERT OR UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION nimanto_require_active_tenant()',
      table_name
    );
  END LOOP;
END;
$$;
`;

export const schemaVersion4Sql = String.raw`
CREATE SEQUENCE IF NOT EXISTS packets_generation_sequence_seq;
ALTER TABLE packets ADD COLUMN IF NOT EXISTS generation_sequence bigint;
WITH sequence_base AS (
  SELECT COALESCE(MAX(generation_sequence), 0) AS value FROM packets
), ordered_packets AS (
  SELECT id, sequence_base.value + ROW_NUMBER() OVER (ORDER BY created_at, id) AS value
  FROM packets CROSS JOIN sequence_base
  WHERE generation_sequence IS NULL
)
UPDATE packets
SET generation_sequence = ordered_packets.value
FROM ordered_packets
WHERE packets.id = ordered_packets.id;
ALTER TABLE packets
  ALTER COLUMN generation_sequence SET DEFAULT nextval('packets_generation_sequence_seq');
ALTER TABLE packets ALTER COLUMN generation_sequence SET NOT NULL;
ALTER SEQUENCE packets_generation_sequence_seq OWNED BY packets.generation_sequence;
SELECT setval(
  'packets_generation_sequence_seq',
  GREATEST(COALESCE((SELECT MAX(generation_sequence) FROM packets), 0) + 1, 1),
  false
);
CREATE UNIQUE INDEX IF NOT EXISTS packets_generation_sequence_unique_idx
  ON packets(generation_sequence);
`;

export const schemaVersion5Sql = String.raw`
ALTER TABLE applications ADD COLUMN IF NOT EXISTS follow_up_on date;
`;
