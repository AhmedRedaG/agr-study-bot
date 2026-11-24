import { db } from "./client.js";

const schema = `
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
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  folder_id INTEGER NOT NULL REFERENCES folders(id),
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
CREATE INDEX IF NOT EXISTS idx_resources_search ON resources(title, file_name);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON user_sessions(expires_at);
`;

let initialized: Promise<void> | undefined;

export function ensureSchema(): Promise<void> {
  initialized ??= (async () => {
    await db.executeMultiple(schema);
    for (const [index, title] of [
      "محاضرات / Lectures",
      "سكاشن / Sections",
      "ملخصات / Summaries",
      "امتحانات سابقة / Past Exams",
      "كتب / Books",
    ].entries()) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO folders (title, sort_order) VALUES (?, ?)",
        args: [title, index],
      });
    }
  })().catch((error: unknown) => {
    initialized = undefined;
    throw error;
  });
  return initialized;
}
