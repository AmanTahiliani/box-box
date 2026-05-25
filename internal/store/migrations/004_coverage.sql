CREATE TABLE IF NOT EXISTS session_coverage (
    session_key  INTEGER NOT NULL,
    dataset      TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'pending',
    row_count    INTEGER NOT NULL DEFAULT 0,
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    error_msg    TEXT,
    PRIMARY KEY (session_key, dataset)
);
