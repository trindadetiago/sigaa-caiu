CREATE TABLE IF NOT EXISTS checks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  status          TEXT    NOT NULL CHECK (status IN ('online', 'degraded', 'offline')),
  http_code       INTEGER,
  response_time_ms INTEGER,
  error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_checks_timestamp ON checks(timestamp DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT    NOT NULL,
  ended_at   TEXT,
  duration_s INTEGER
);

CREATE INDEX IF NOT EXISTS idx_incidents_started ON incidents(started_at DESC);
