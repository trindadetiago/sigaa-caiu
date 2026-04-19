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
  portal_error        TEXT,
  login_form_status   TEXT,
  login_form_error    TEXT,
  login_e2e_status    TEXT,
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
