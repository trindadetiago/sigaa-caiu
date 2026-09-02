CREATE TABLE IF NOT EXISTS checks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  status          TEXT    NOT NULL CHECK (status IN ('online', 'degraded', 'offline')),
  http_code       INTEGER,
  response_time_ms INTEGER,
  error           TEXT,
  -- Per-layer breakdown; each column is nullable because not every layer runs every tick.
  reachability_status TEXT,
  reachability_http   INTEGER,
  reachability_ms     INTEGER,
  reachability_error  TEXT,
  portal_status       TEXT,
  portal_ms           INTEGER,
  portal_error        TEXT,
  login_form_status   TEXT,
  login_form_ms       INTEGER,
  login_form_error    TEXT,
  login_e2e_status    TEXT,
  login_e2e_ms        INTEGER,
  login_e2e_error     TEXT
);

CREATE INDEX IF NOT EXISTS idx_checks_timestamp ON checks(timestamp DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT    NOT NULL,
  ended_at   TEXT,
  duration_s INTEGER
);

CREATE INDEX IF NOT EXISTS idx_incidents_started ON incidents(started_at DESC);

-- Precomputed API payloads. The cron writes these; the API only reads them, so a
-- request costs a single-row lookup instead of scanning the checks table.
CREATE TABLE IF NOT EXISTS snapshots (
  key        TEXT NOT NULL PRIMARY KEY,
  json       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Partial indexes for getLastKnownLayers(): without them, "most recent non-NULL
-- value of this layer" degrades into a full table scan once a layer has been
-- skipped for a while. The predicates match those queries' WHERE exactly.
CREATE INDEX IF NOT EXISTS idx_checks_reach_last
  ON checks(timestamp DESC) WHERE reachability_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checks_portal_last
  ON checks(timestamp DESC) WHERE portal_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checks_login_form_last
  ON checks(timestamp DESC) WHERE login_form_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checks_login_e2e_last
  ON checks(timestamp DESC) WHERE login_e2e_status IS NOT NULL;
