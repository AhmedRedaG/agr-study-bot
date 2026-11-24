import { db } from "../db/client.js";
import type {
  ArchiveYear,
  Course,
  Folder,
  Level,
  Resource,
  Term,
} from "../types/domain.js";

type BindValue = string | number | bigint | null;
function idOf(value: bigint | number | undefined): number {
  if (value === undefined)
    throw new Error("The database did not return the inserted row ID.");
  return Number(value);
}

export class StudyRepository {
  async levels(
    archiveYearId: number | null = null,
    activeOnly = true,
  ): Promise<Level[]> {
    const activeClause = activeOnly ? "AND active = 1" : "";
    const result = await db.execute({
      sql: `SELECT id, title, sort_order, active, archive_year_id FROM levels
            WHERE archive_year_id IS ? ${activeClause} ORDER BY sort_order, id`,
      args: [archiveYearId],
    });
    return result.rows as unknown as Level[];
  }

  async searchCourses(
    keyword: string,
  ): Promise<
    Array<
      Course & {
        level_title: string;
        term_title: string;
        archive_title: string | null;
      }
    >
  > {
    const result = await db.execute({
      sql: `SELECT c.id, c.term_id, c.title, c.sort_order, c.active, l.title AS level_title,
                   t.title AS term_title, a.title AS archive_title
            FROM courses c JOIN terms t ON t.id = c.term_id
            JOIN levels l ON l.id = t.level_id
            LEFT JOIN archive_years a ON a.id = l.archive_year_id
            WHERE l.active = 1 AND t.active = 1 AND c.active = 1
              AND c.title LIKE ?
            ORDER BY l.sort_order, t.sort_order, c.sort_order LIMIT 5`,
      args: [`%${keyword}%`],
    });
    return result.rows as unknown as Array<
      Course & {
        level_title: string;
        term_title: string;
        archive_title: string | null;
      }
    >;
  }

  async terms(levelId: number, activeOnly = true): Promise<Term[]> {
    const result = await db.execute({
      sql: `SELECT id, level_id, title, sort_order, active FROM terms
            WHERE level_id = ? ${activeOnly ? "AND active = 1" : ""} ORDER BY sort_order, id`,
      args: [levelId],
    });
    return result.rows as unknown as Term[];
  }

  async level(id: number): Promise<Level | undefined> {
    const result = await db.execute({
      sql: "SELECT id, title, sort_order, active, archive_year_id FROM levels WHERE id = ?",
      args: [id],
    });
    return result.rows[0] as unknown as Level | undefined;
  }

  async term(id: number): Promise<Term | undefined> {
    const result = await db.execute({
      sql: "SELECT id, level_id, title, sort_order, active FROM terms WHERE id = ?",
      args: [id],
    });
    return result.rows[0] as unknown as Term | undefined;
  }

  async courses(termId: number, activeOnly = true): Promise<Course[]> {
    const result = await db.execute({
      sql: `SELECT id, term_id, title, sort_order, active FROM courses
            WHERE term_id = ? ${activeOnly ? "AND active = 1" : ""} ORDER BY sort_order, id`,
      args: [termId],
    });
    return result.rows as unknown as Course[];
  }

  async course(id: number): Promise<Course | undefined> {
    const result = await db.execute({
      sql: "SELECT id, term_id, title, sort_order, active FROM courses WHERE id = ?",
      args: [id],
    });
    return result.rows[0] as unknown as Course | undefined;
  }

  async folders(activeOnly = true): Promise<Folder[]> {
    const result = await db.execute({
      sql: `SELECT id, title, sort_order, active FROM folders ${activeOnly ? "WHERE active = 1" : ""} ORDER BY sort_order, id`,
    });
    return result.rows as unknown as Folder[];
  }

  async resources(courseId: number, folderId: number): Promise<Resource[]> {
    const result = await db.execute({
      sql: `SELECT id, course_id, folder_id, file_id, file_unique_id, file_type, file_name,
                   mime_type, title, caption
            FROM resources WHERE course_id = ? AND folder_id = ? ORDER BY id DESC`,
      args: [courseId, folderId],
    });
    return result.rows as unknown as Resource[];
  }

  async resource(id: number): Promise<Resource | undefined> {
    const result = await db.execute({
      sql: `SELECT id, course_id, folder_id, file_id, file_unique_id, file_type, file_name,
                   mime_type, title, caption FROM resources WHERE id = ?`,
      args: [id],
    });
    return result.rows[0] as unknown as Resource | undefined;
  }

  async createLevel(
    title: string,
    archiveYearId: number | null = null,
  ): Promise<number> {
    const result = await db.execute({
      sql: `INSERT INTO levels (title, archive_year_id, sort_order) VALUES (?, ?, COALESCE(
        (SELECT MAX(sort_order) + 1 FROM levels WHERE archive_year_id IS ?), 0))`,
      args: [title, archiveYearId, archiveYearId],
    });
    return idOf(result.lastInsertRowid);
  }

  async createTerm(levelId: number, title: string): Promise<number> {
    const result = await db.execute({
      sql: "INSERT INTO terms (level_id, title, sort_order) VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM terms WHERE level_id = ?), 0))",
      args: [levelId, title, levelId],
    });
    return idOf(result.lastInsertRowid);
  }

  async createCourse(termId: number, title: string): Promise<number> {
    const result = await db.execute({
      sql: "INSERT INTO courses (term_id, title, sort_order) VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM courses WHERE term_id = ?), 0))",
      args: [termId, title, termId],
    });
    return idOf(result.lastInsertRowid);
  }

  async createFolder(title: string): Promise<number> {
    const result = await db.execute({
      sql: "INSERT INTO folders (title, sort_order) VALUES (?, COALESCE((SELECT MAX(sort_order) + 1 FROM folders), 0))",
      args: [title],
    });
    return idOf(result.lastInsertRowid);
  }

  async rename(
    entity: "level" | "term" | "course" | "folder",
    id: number,
    title: string,
  ): Promise<void> {
    const table = {
      level: "levels",
      term: "terms",
      course: "courses",
      folder: "folders",
    }[entity];
    await db.execute({
      sql: `UPDATE ${table} SET title = ? WHERE id = ?`,
      args: [title, id],
    });
  }

  async toggleLevel(id: number): Promise<void> {
    await db.execute({
      sql: "UPDATE levels SET active = 1 - active WHERE id = ? AND archive_year_id IS NULL",
      args: [id],
    });
  }

  async toggleTerm(id: number): Promise<void> {
    await db.execute({
      sql: "UPDATE terms SET active = 1 - active WHERE id = ?",
      args: [id],
    });
  }

  async toggleCourse(id: number): Promise<void> {
    await db.execute({
      sql: "UPDATE courses SET active = 1 - active WHERE id = ?",
      args: [id],
    });
  }

  async toggleFolder(id: number): Promise<void> {
    await db.execute({
      sql: "UPDATE folders SET active = 1 - active WHERE id = ?",
      args: [id],
    });
  }

  async moveFolder(id: number, direction: -1 | 1): Promise<void> {
    const rows = await db.execute({
      sql: "SELECT id, sort_order FROM folders WHERE active = 1 ORDER BY sort_order, id",
    });
    const folders = rows.rows as unknown as Array<{
      id: number;
      sort_order: number;
    }>;
    const index = folders.findIndex((folder) => folder.id === id);
    const other = folders[index + direction];
    const current = folders[index];
    if (!current || !other) return;
    const tx = await db.transaction("write");
    try {
      await tx.execute({
        sql: "UPDATE folders SET sort_order = ? WHERE id = ?",
        args: [-1, current.id],
      });
      await tx.execute({
        sql: "UPDATE folders SET sort_order = ? WHERE id = ?",
        args: [current.sort_order, other.id],
      });
      await tx.execute({
        sql: "UPDATE folders SET sort_order = ? WHERE id = ?",
        args: [other.sort_order, current.id],
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async archiveYears(): Promise<ArchiveYear[]> {
    const result = await db.execute(
      "SELECT id, title FROM archive_years ORDER BY title DESC",
    );
    return result.rows as unknown as ArchiveYear[];
  }

  async archiveYear(id: number): Promise<ArchiveYear | undefined> {
    const result = await db.execute({
      sql: "SELECT id, title FROM archive_years WHERE id = ?",
      args: [id],
    });
    return result.rows[0] as unknown as ArchiveYear | undefined;
  }

  async createArchiveYear(title: string): Promise<number> {
    const result = await db.execute({
      sql: "INSERT INTO archive_years (title) VALUES (?)",
      args: [title],
    });
    return idOf(result.lastInsertRowid);
  }

  async snapshotLevel(levelId: number, archiveYearId: number): Promise<number> {
    const tx = await db.transaction("write");
    try {
      const source = await tx.execute({
        sql: "SELECT title FROM levels WHERE id = ?",
        args: [levelId],
      });
      const sourceTitle = source.rows[0]?.title;
      if (typeof sourceTitle !== "string")
        throw new Error("The selected level no longer exists.");
      const newLevel = await tx.execute({
        sql: "INSERT INTO levels (title, sort_order, archive_year_id) VALUES (?, 0, ?)",
        args: [sourceTitle, archiveYearId],
      });
      const newLevelId = idOf(newLevel.lastInsertRowid);
      const terms = await tx.execute({
        sql: "SELECT id, title, sort_order FROM terms WHERE level_id = ?",
        args: [levelId],
      });
      for (const term of terms.rows as unknown as Array<{
        id: number;
        title: string;
        sort_order: number;
      }>) {
        const newTerm = await tx.execute({
          sql: "INSERT INTO terms (level_id, title, sort_order, active) VALUES (?, ?, ?, 1)",
          args: [newLevelId, term.title, term.sort_order],
        });
        const newTermId = idOf(newTerm.lastInsertRowid);
        const courses = await tx.execute({
          sql: "SELECT id, title, sort_order FROM courses WHERE term_id = ?",
          args: [term.id],
        });
        for (const course of courses.rows as unknown as Array<{
          id: number;
          title: string;
          sort_order: number;
        }>) {
          const newCourse = await tx.execute({
            sql: "INSERT INTO courses (term_id, title, sort_order, active) VALUES (?, ?, ?, 1)",
            args: [newTermId, course.title, course.sort_order],
          });
          const oldCourseId = course.id;
          const newCourseId = idOf(newCourse.lastInsertRowid);
          await tx.execute({
            sql: `INSERT INTO resources
              (course_id, folder_id, file_id, file_unique_id, file_type, file_name, mime_type, title, caption, created_by)
              SELECT ?, folder_id, file_id, file_unique_id, file_type, file_name, mime_type, title, caption, created_by
              FROM resources WHERE course_id = ?`,
            args: [newCourseId, oldCourseId],
          });
        }
      }
      await tx.execute({
        sql: "UPDATE levels SET active = 0 WHERE id = ? AND archive_year_id IS NULL",
        args: [levelId],
      });
      await tx.commit();
      return newLevelId;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async addResource(resource: {
    courseId: number;
    folderId: number;
    fileId: string;
    fileUniqueId: string;
    fileType: string;
    fileName?: string;
    mimeType?: string;
    title?: string;
    caption?: string;
    createdBy: number;
  }): Promise<void> {
    const values: BindValue[] = [
      resource.courseId,
      resource.folderId,
      resource.fileId,
      resource.fileUniqueId,
      resource.fileType,
      resource.fileName ?? null,
      resource.mimeType ?? null,
      resource.title ?? null,
      resource.caption ?? null,
      resource.createdBy,
    ];
    await db.execute({
      sql: `INSERT INTO resources
        (course_id, folder_id, file_id, file_unique_id, file_type, file_name, mime_type, title, caption, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: values,
    });
  }

  async search(
    keyword: string,
  ): Promise<
    Array<
      Resource & {
        course_title: string;
        folder_title: string;
        level_title: string;
        term_title: string;
        archive_title: string | null;
      }
    >
  > {
    const result = await db.execute({
      sql: `SELECT r.id, r.course_id, r.folder_id, r.file_id, r.file_unique_id, r.file_type, r.file_name,
                   r.mime_type, r.title, r.caption, c.title AS course_title, f.title AS folder_title,
                   l.title AS level_title, t.title AS term_title, a.title AS archive_title
            FROM resources r
            JOIN courses c ON c.id = r.course_id
            JOIN terms t ON t.id = c.term_id
            JOIN levels l ON l.id = t.level_id
            JOIN folders f ON f.id = r.folder_id
            LEFT JOIN archive_years a ON a.id = l.archive_year_id
            WHERE l.active = 1
              AND t.active = 1 AND c.active = 1
              AND (r.title LIKE ? OR r.file_name LIKE ? OR c.title LIKE ?)
            ORDER BY r.id DESC LIMIT 10`,
      args: [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`],
    });
    return result.rows as unknown as Array<
      Resource & {
        course_title: string;
        folder_title: string;
        level_title: string;
        term_title: string;
        archive_title: string | null;
      }
    >;
  }

  async usersForBroadcast(
    target: "all" | "level" | "term",
    targetId?: number,
  ): Promise<number[]> {
    if (target === "all") {
      const result = await db.execute("SELECT id FROM users WHERE blocked = 0");
      return result.rows.map((row) => Number(row.id));
    }
    const sql =
      target === "level"
        ? "SELECT id FROM users WHERE blocked = 0 AND level_id = ?"
        : "SELECT u.id FROM users u JOIN terms t ON t.id = u.term_id WHERE u.blocked = 0 AND t.id = ?";
    const result = await db.execute({ sql, args: [targetId ?? 0] });
    return result.rows.map((row) => Number(row.id));
  }

  async saveSetting(key: string, value: string): Promise<void> {
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [key, value],
    });
  }
}
