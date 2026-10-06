CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  name TEXT DEFAULT 'Untitled Design',
  canvas_json TEXT DEFAULT '{}',
  width INTEGER DEFAULT 1080,
  height INTEGER DEFAULT 1080,
  thumbnail_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  canvas_json TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  thumbnail_url TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  design_id TEXT NOT NULL,
  title TEXT DEFAULT 'Page 1',
  canvas_json TEXT DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pages_design ON pages(design_id);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);

-- Starter templates are NOT seeded here. Clawnify applies this file as DDL
-- only — any non-DDL statement (INSERT, UPDATE, PRAGMA, ...) fails the whole
-- deploy — so the template rows live in src/server/seed-templates.ts and are
-- inserted by ensureSeeded() in src/server/index.ts on first request.
