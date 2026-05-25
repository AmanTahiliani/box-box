CREATE TABLE IF NOT EXISTS stints (
    session_key       INTEGER NOT NULL,
    driver_number     INTEGER NOT NULL,
    meeting_key       INTEGER NOT NULL,
    stint_number      INTEGER NOT NULL,
    compound          TEXT    NOT NULL,
    lap_start         INTEGER NOT NULL,
    lap_end           INTEGER NOT NULL,
    tyre_age_at_start INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_key, driver_number, stint_number)
);

CREATE INDEX IF NOT EXISTS idx_stints_session ON stints (session_key);
CREATE INDEX IF NOT EXISTS idx_stints_meeting ON stints (meeting_key);

CREATE TABLE IF NOT EXISTS pit_stops (
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    meeting_key   INTEGER NOT NULL,
    lap_number    INTEGER NOT NULL,
    date          TEXT    NOT NULL,
    pit_duration  REAL,
    lane_duration REAL,
    stop_duration REAL,
    PRIMARY KEY (session_key, driver_number, date)
);

CREATE INDEX IF NOT EXISTS idx_pit_stops_session ON pit_stops (session_key);
CREATE INDEX IF NOT EXISTS idx_pit_stops_meeting ON pit_stops (meeting_key);

CREATE TABLE IF NOT EXISTS positions (
    session_key   INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    meeting_key   INTEGER NOT NULL,
    date          TEXT    NOT NULL,
    position      INTEGER NOT NULL,
    PRIMARY KEY (session_key, driver_number, date)
);

CREATE INDEX IF NOT EXISTS idx_positions_session ON positions (session_key);
CREATE INDEX IF NOT EXISTS idx_positions_meeting ON positions (meeting_key);
CREATE INDEX IF NOT EXISTS idx_positions_session_driver ON positions (session_key, driver_number);

CREATE TABLE IF NOT EXISTS race_control (
    session_key      INTEGER NOT NULL,
    meeting_key      INTEGER NOT NULL,
    date             TEXT    NOT NULL,
    category         TEXT    NOT NULL,
    flag             TEXT,
    message          TEXT    NOT NULL,
    scope            TEXT,
    driver_number    INTEGER,
    lap_number       INTEGER,
    sector           INTEGER,
    qualifying_phase INTEGER,
    PRIMARY KEY (session_key, date, message)
);

CREATE INDEX IF NOT EXISTS idx_race_control_session ON race_control (session_key);
CREATE INDEX IF NOT EXISTS idx_race_control_meeting ON race_control (meeting_key);

CREATE TABLE IF NOT EXISTS weather (
    session_key       INTEGER NOT NULL,
    meeting_key       INTEGER NOT NULL,
    date              TEXT    NOT NULL,
    air_temperature   REAL,
    track_temperature REAL,
    humidity          REAL,
    pressure          REAL,
    rainfall          INTEGER NOT NULL DEFAULT 0,
    wind_direction    INTEGER,
    wind_speed        REAL,
    PRIMARY KEY (session_key, date)
);

CREATE INDEX IF NOT EXISTS idx_weather_session ON weather (session_key);
CREATE INDEX IF NOT EXISTS idx_weather_meeting ON weather (meeting_key);

CREATE TABLE IF NOT EXISTS laps (
    session_key        INTEGER NOT NULL,
    driver_number      INTEGER NOT NULL,
    meeting_key        INTEGER NOT NULL,
    lap_number         INTEGER NOT NULL,
    date_start         TEXT,
    lap_duration       REAL,
    is_pit_out_lap     INTEGER NOT NULL DEFAULT 0,
    duration_sector1   REAL,
    duration_sector2   REAL,
    duration_sector3   REAL,
    PRIMARY KEY (session_key, driver_number, lap_number)
);

CREATE INDEX IF NOT EXISTS idx_laps_session ON laps (session_key);
CREATE INDEX IF NOT EXISTS idx_laps_meeting ON laps (meeting_key);
