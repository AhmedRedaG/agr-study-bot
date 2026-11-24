PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT NOT NULL,
  level_id INTEGER,
  term_id INTEGER,
  blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_sessions (
  user_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  is_archived INTEGER NOT NULL DEFAULT 0,
  archive_year_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS resource_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  folder_id INTEGER NOT NULL REFERENCES folders(id),
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER REFERENCES resource_groups(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  folder_id INTEGER NOT NULL REFERENCES folders(id),
  part_order INTEGER NOT NULL DEFAULT 1,
  part_label TEXT,
  file_id TEXT NOT NULL,
  file_unique_id TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  title TEXT,
  caption TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS archive_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_levels_archive ON levels(archive_year_id, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_terms_level ON terms(level_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_courses_term ON courses(term_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_resources_course_folder ON resources(course_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_resource_groups_course_folder ON resource_groups(course_id, folder_id, sort_order, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_group_part ON resources(group_id, part_order);
CREATE INDEX IF NOT EXISTS idx_resources_search ON resources(title, file_name);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON user_sessions(expires_at);

INSERT OR IGNORE INTO folders (title, sort_order) VALUES
  ('كتب', 0),
  ('محاضرات', 1),
  ('سكاشن', 2),
  ('ملخصات', 3),
  ('امتحانات سابقة', 4);
