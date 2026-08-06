export const schemaSql = String.raw`
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
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  profile_version_id text REFERENCES profile_versions(id) ON DELETE SET NULL,
  status text NOT NULL,
  submitted_at timestamptz,
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

CREATE TABLE IF NOT EXISTS packets (
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

CREATE TABLE IF NOT EXISTS assurance_runs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  packet_id text NOT NULL REFERENCES packets(id) ON DELETE CASCADE,
  status text NOT NULL,
  rule_version text NOT NULL,
  findings jsonb NOT NULL,
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

ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5;
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS lease_token_hash text;
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS last_result jsonb;

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

ALTER TABLE deletion_runs ADD COLUMN IF NOT EXISTS cleanup_inventory jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE deletion_runs ADD COLUMN IF NOT EXISTS last_error_code text;

INSERT INTO schema_versions(version) VALUES (1) ON CONFLICT (version) DO NOTHING;
INSERT INTO schema_versions(version) VALUES (2) ON CONFLICT (version) DO NOTHING;
`;
