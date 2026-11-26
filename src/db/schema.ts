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
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
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
  file_id TEXT,
  file_unique_id TEXT,
  file_type TEXT NOT NULL,
  url TEXT,
  file_name TEXT,
  mime_type TEXT,
  title TEXT,
  caption TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (file_type = 'link' AND url IS NOT NULL AND file_id IS NULL AND file_unique_id IS NULL)
    OR
    (file_type <> 'link' AND url IS NULL AND file_id IS NOT NULL AND file_unique_id IS NOT NULL)
  )
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
CREATE TABLE IF NOT EXISTS admin_roles (
  user_id INTEGER PRIMARY KEY,
  all_courses INTEGER NOT NULL DEFAULT 1,
  granted_by INTEGER NOT NULL,
  full_name TEXT,
  phone TEXT,
  telegram_username TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_role_scopes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES admin_roles(user_id) ON DELETE CASCADE,
  level_id INTEGER REFERENCES levels(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES terms(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((level_id IS NOT NULL) + (term_id IS NOT NULL) +
         (department_id IS NOT NULL) + (course_id IS NOT NULL) = 1)
);
CREATE INDEX IF NOT EXISTS idx_admin_role_scopes_user ON admin_role_scopes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_role_scopes_unique
  ON admin_role_scopes(user_id, COALESCE(level_id, -1), COALESCE(term_id, -1),
                       COALESCE(department_id, -1), COALESCE(course_id, -1));
CREATE INDEX IF NOT EXISTS idx_levels_archive ON levels(archive_year_id, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_terms_level ON terms(level_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_courses_term ON courses(term_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_courses_term_department ON courses(term_id, department_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_departments_level ON departments(level_id, active, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_resources_course_folder ON resources(course_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_resources_search ON resources(title, file_name);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_resource_groups_course_folder ON resource_groups(course_id, folder_id, sort_order, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_group_part ON resources(group_id, part_order);
`;

let initialized: Promise<void> | undefined;

export function ensureSchema(): Promise<void> {
  initialized ??= (async () => {
    await db.executeMultiple(schema);
  })().catch((error: unknown) => {
    initialized = undefined;
    throw error;
  });
  return initialized;
}
