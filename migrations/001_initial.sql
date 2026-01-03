-- Recently used Notion pages for autocomplete
CREATE TABLE recent_pages (
  page_id TEXT PRIMARY KEY,
  page_title TEXT NOT NULL,
  last_used TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_recent_pages_last_used ON recent_pages(last_used DESC);

-- Pages whitelist (direct pages that are searchable)
CREATE TABLE whitelist_pages (
  page_id TEXT PRIMARY KEY,
  page_title TEXT NOT NULL
);

-- Parent pages whitelist (children of these pages are searchable)
CREATE TABLE whitelist_parents (
  page_id TEXT PRIMARY KEY,
  page_title TEXT NOT NULL
);
