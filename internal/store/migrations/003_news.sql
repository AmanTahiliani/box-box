CREATE TABLE IF NOT EXISTS news_sources (
    source      TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    feed_url    TEXT    NOT NULL,
    category    TEXT,
    enabled     INTEGER NOT NULL DEFAULT 1,
    fetched_at  INTEGER,
    expires_at  INTEGER,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS news_items (
    url          TEXT    PRIMARY KEY,
    source      TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    published_at INTEGER,
    summary     TEXT,
    category    TEXT,
    fetched_at  INTEGER NOT NULL,
    FOREIGN KEY (source) REFERENCES news_sources(source)
);

CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_source_published ON news_items (source, published_at DESC);
