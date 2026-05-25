CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS raw_payloads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source          TEXT    NOT NULL,
    endpoint        TEXT    NOT NULL,
    request_key     TEXT    NOT NULL,
    meeting_key     INTEGER,
    session_key     INTEGER,
    payload         TEXT    NOT NULL,
    payload_hash    TEXT    NOT NULL,
    fetched_at      INTEGER NOT NULL,
    provenance_json TEXT,
    UNIQUE (source, request_key, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_raw_payloads_meeting ON raw_payloads (meeting_key);
CREATE INDEX IF NOT EXISTS idx_raw_payloads_session ON raw_payloads (session_key);

CREATE TABLE IF NOT EXISTS ingestion_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_type   TEXT    NOT NULL,
    scope_key    TEXT    NOT NULL,
    started_at   INTEGER NOT NULL,
    finished_at  INTEGER,
    status       TEXT    NOT NULL,
    refresh      INTEGER NOT NULL DEFAULT 0,
    summary_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_scope ON ingestion_runs (scope_type, scope_key);

CREATE TABLE IF NOT EXISTS meetings (
    meeting_key           INTEGER PRIMARY KEY,
    meeting_name          TEXT    NOT NULL,
    meeting_official_name TEXT,
    location              TEXT,
    country_code          TEXT,
    country_name          TEXT,
    circuit_key           INTEGER,
    circuit_short_name    TEXT,
    gmt_offset            TEXT,
    date_start            TEXT,
    date_end              TEXT,
    year                  INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_year ON meetings (year);

CREATE TABLE IF NOT EXISTS sessions (
    session_key  INTEGER PRIMARY KEY,
    meeting_key  INTEGER NOT NULL REFERENCES meetings (meeting_key),
    session_name TEXT    NOT NULL,
    session_type TEXT    NOT NULL,
    circuit_key  INTEGER,
    date_start   TEXT,
    date_end     TEXT,
    gmt_offset   TEXT,
    updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_meeting ON sessions (meeting_key);

CREATE TABLE IF NOT EXISTS drivers (
    driver_number  INTEGER PRIMARY KEY,
    broadcast_name TEXT,
    first_name     TEXT,
    full_name      TEXT    NOT NULL,
    last_name      TEXT,
    name_acronym   TEXT,
    headshot_url   TEXT,
    team_name      TEXT,
    team_colour    TEXT,
    updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_drivers (
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    meeting_key   INTEGER NOT NULL,
    team_name     TEXT,
    team_colour   TEXT,
    PRIMARY KEY (session_key, driver_number)
);

CREATE INDEX IF NOT EXISTS idx_session_drivers_meeting ON session_drivers (meeting_key);

CREATE TABLE IF NOT EXISTS session_results (
    session_key        INTEGER NOT NULL,
    driver_number      INTEGER NOT NULL,
    meeting_key        INTEGER NOT NULL,
    position           INTEGER NOT NULL,
    points             REAL    NOT NULL DEFAULT 0,
    number_of_laps     INTEGER,
    duration_json      TEXT,
    gap_to_leader_json TEXT,
    dnf                INTEGER NOT NULL DEFAULT 0,
    dns                INTEGER NOT NULL DEFAULT 0,
    dsq                INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_key, driver_number)
);

CREATE INDEX IF NOT EXISTS idx_session_results_meeting ON session_results (meeting_key);

CREATE TABLE IF NOT EXISTS starting_grid (
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    meeting_key   INTEGER NOT NULL,
    position      INTEGER NOT NULL,
    lap_duration  REAL,
    PRIMARY KEY (session_key, driver_number)
);

CREATE INDEX IF NOT EXISTS idx_starting_grid_meeting ON starting_grid (meeting_key);
