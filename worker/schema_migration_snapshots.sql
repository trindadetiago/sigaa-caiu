-- Precomputed API payloads + partial indexes for the last-known-layer probes.
-- Additive and idempotent; existing rows remain valid.
--
-- Run with:  npx wrangler d1 execute sigaa-caiu-db --local  --file=schema_migration_snapshots.sql
--            npx wrangler d1 execute sigaa-caiu-db --remote --file=schema_migration_snapshots.sql

-- One row per API payload. The cron writes these; the API only ever reads them,
-- turning a 3k-61k row scan per request into a single-row lookup.
CREATE TABLE IF NOT EXISTS snapshots (
  key        TEXT NOT NULL PRIMARY KEY,
  json       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- getLastKnownLayers() asks for the most recent non-NULL value of each layer
-- column. Without these, SQLite walks idx_checks_timestamp backwards and reads
-- every table row until it finds a match -- a full 85k-row scan whenever a layer
-- has been skipped for a while (or has never run at all). The partial predicate
-- matches the query's WHERE exactly, so each probe becomes a 1-row lookup.
CREATE INDEX IF NOT EXISTS idx_checks_reach_last
  ON checks(timestamp DESC) WHERE reachability_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checks_portal_last
  ON checks(timestamp DESC) WHERE portal_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checks_login_form_last
  ON checks(timestamp DESC) WHERE login_form_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checks_login_e2e_last
  ON checks(timestamp DESC) WHERE login_e2e_status IS NOT NULL;
