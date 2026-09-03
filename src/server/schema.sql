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

-- Seed templates if table is empty
INSERT OR IGNORE INTO templates (id, name, category, canvas_json, width, height, sort_order) VALUES
('quote-card', 'Quote Card', 'linkedin', '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1080,"fill":"#1a1a2e"},{"type":"textbox","left":80,"top":300,"width":920,"text":"Your inspiring quote goes here","fontSize":48,"fontFamily":"Playfair Display","fontWeight":"700","fill":"#ffffff","textAlign":"center"},{"type":"textbox","left":80,"top":900,"width":920,"text":"— Author Name","fontSize":24,"fontFamily":"Inter","fontWeight":"500","fill":"#a0a0b0","textAlign":"center"}]}', 1080, 1080, 1),
('stats-highlight', 'Stats Highlight', 'linkedin', '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1080,"fill":"#0f172a"},{"type":"textbox","left":80,"top":200,"width":920,"text":"87%","fontSize":120,"fontFamily":"Montserrat","fontWeight":"900","fill":"#3b82f6","textAlign":"center"},{"type":"textbox","left":80,"top":400,"width":920,"text":"of professionals agree that AI\nwill transform their industry","fontSize":36,"fontFamily":"Inter","fontWeight":"500","fill":"#e2e8f0","textAlign":"center"},{"type":"textbox","left":80,"top":900,"width":920,"text":"Source: Industry Report 2026","fontSize":18,"fontFamily":"Inter","fontWeight":"400","fill":"#64748b","textAlign":"center"}]}', 1080, 1080, 2),
('announcement', 'Announcement', 'linkedin', '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1200,"height":627,"fill":"#ffffff"},{"type":"rect","left":0,"top":0,"width":8,"height":627,"fill":"#2563eb"},{"type":"textbox","left":60,"top":80,"width":400,"text":"NEW","fontSize":16,"fontFamily":"Montserrat","fontWeight":"800","fill":"#2563eb","letterSpacing":4},{"type":"textbox","left":60,"top":120,"width":1080,"text":"We are excited to announce\nsomething big","fontSize":48,"fontFamily":"Montserrat","fontWeight":"700","fill":"#0f172a"},{"type":"textbox","left":60,"top":500,"width":1080,"text":"Learn more at yourcompany.com","fontSize":20,"fontFamily":"Inter","fontWeight":"500","fill":"#64748b"}]}', 1200, 627, 3),
('tips-list', 'Tips List', 'linkedin', '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1080,"fill":"#fafaf9"},{"type":"textbox","left":80,"top":80,"width":920,"text":"5 Tips for Better\nProductivity","fontSize":44,"fontFamily":"Montserrat","fontWeight":"800","fill":"#1c1917"},{"type":"textbox","left":80,"top":280,"width":920,"text":"1. Start with the hardest task\n\n2. Time-block your calendar\n\n3. Limit notifications\n\n4. Take regular breaks\n\n5. Review and reflect daily","fontSize":28,"fontFamily":"Inter","fontWeight":"400","fill":"#44403c","lineHeight":1.6}]}', 1080, 1080, 4),
('profile-card', 'Profile Card', 'linkedin', '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1080,"fill":"#18181b"},{"type":"circle","left":440,"top":180,"radius":100,"fill":"#3f3f46"},{"type":"textbox","left":80,"top":420,"width":920,"text":"Jane Smith","fontSize":40,"fontFamily":"Montserrat","fontWeight":"700","fill":"#fafafa","textAlign":"center"},{"type":"textbox","left":80,"top":490,"width":920,"text":"Product Designer @ TechCo","fontSize":22,"fontFamily":"Inter","fontWeight":"400","fill":"#a1a1aa","textAlign":"center"},{"type":"textbox","left":140,"top":600,"width":800,"text":"Passionate about creating intuitive user experiences that make complex tools feel simple.","fontSize":20,"fontFamily":"Inter","fontWeight":"400","fill":"#d4d4d8","textAlign":"center"}]}', 1080, 1080, 5),
('minimal-text', 'Minimal Text', 'linkedin', '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1080,"fill":"#f8fafc"},{"type":"textbox","left":120,"top":380,"width":840,"text":"Less is more.","fontSize":64,"fontFamily":"Playfair Display","fontWeight":"600","fill":"#0f172a","textAlign":"center"},{"type":"textbox","left":120,"top":520,"width":840,"text":"Sometimes the simplest message\nhas the biggest impact.","fontSize":22,"fontFamily":"Inter","fontWeight":"400","fill":"#64748b","textAlign":"center"}]}', 1080, 1080, 6);

CREATE TABLE IF NOT EXISTS brand_kits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  name TEXT NOT NULL DEFAULT 'My Brand',
  -- JSON arrays/objects, kept as TEXT so the whole kit round-trips through
  -- export/import as one portable blob.
  colors TEXT NOT NULL DEFAULT '[]',
  heading_font TEXT NOT NULL DEFAULT 'Montserrat',
  body_font TEXT NOT NULL DEFAULT 'Inter',
  logos TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
