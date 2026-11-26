import { db } from "../db/client.js";
import type {
  ArchiveYear,
  Course,
  CourseScopeRef,
  Department,
  Folder,
  Level,
  Resource,
  ResourceGroup,
  ResourceGroupSummary,
  Term,
} from "../types/domain.js";

function idOf(value: bigint | number | undefined): number {
  if (value === undefined)
    throw new Error("The database did not return the inserted row ID.");
  return Number(value);
}

export class StudyRepository {
  async currentLevels(activeOnly = true): Promise<Level[]> {
    const result = await db.execute({
      sql: `SELECT id, title, sort_order, active, is_archived, archive_year_id FROM levels
            WHERE archive_year_id IS NULL AND is_archived = 0
              ${activeOnly ? "AND active = 1" : ""} ORDER BY sort_order, id`,
    });
    return result.rows as unknown as Level[];
  }

  async archivedLevels(
    archiveYearId: number,
    activeOnly = true,
  ): Promise<Level[]> {
    const result = await db.execute({
      sql: `SELECT id, title, sort_order, active, is_archived, archive_year_id FROM levels
            WHERE archive_year_id = ? AND is_archived = 1
              ${activeOnly ? "AND active = 1" : ""} ORDER BY sort_order, id`,
      args: [archiveYearId],
    });
    return result.rows as unknown as Level[];
  }

  async currentCourseRefs(): Promise<CourseScopeRef[]> {
    const result = await db.execute({
      sql: `SELECT c.id AS course_id, c.term_id, t.level_id, c.department_id
            FROM courses c
            JOIN terms t ON t.id = c.term_id
            JOIN levels l ON l.id = t.level_id
            WHERE l.archive_year_id IS NULL AND l.is_archived = 0
              AND l.active = 1 AND t.active = 1 AND c.active = 1
            ORDER BY l.sort_order, t.sort_order, c.sort_order, c.id`,
    });
    return result.rows as unknown as CourseScopeRef[];
  }

  async searchCourses(keyword: string): Promise<
    Array<
      Course & {
        level_title: string;
        term_title: string;
        archive_title: string | null;
      }
    >
  > {
    const result = await db.execute({
      sql: `SELECT c.id, c.term_id, c.department_id, c.title, c.sort_order, c.active,
                   l.title AS level_title,
                   t.title AS term_title, a.title AS archive_title
            FROM courses c JOIN terms t ON t.id = c.term_id
            JOIN levels l ON l.id = t.level_id
            LEFT JOIN archive_years a ON a.id = l.archive_year_id
            LEFT JOIN departments d ON d.id = c.department_id
            WHERE l.archive_year_id IS NULL AND l.is_archived = 0
              AND l.active = 1 AND t.active = 1 AND c.active = 1
              AND (c.department_id IS NULL OR d.active = 1)
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

  async departments(levelId: number, activeOnly = true): Promise<Department[]> {
    const result = await db.execute({
      sql: `SELECT id, level_id, title, sort_order, active FROM departments
            WHERE level_id = ? ${activeOnly ? "AND active = 1" : ""}
            ORDER BY sort_order, id`,
      args: [levelId],
    });
    return result.rows as unknown as Department[];
  }

  async department(id: number): Promise<Department | undefined> {
    const result = await db.execute({
      sql: "SELECT id, level_id, title, sort_order, active FROM departments WHERE id = ?",
      args: [id],
    });
    return result.rows[0] as unknown as Department | undefined;
  }

  async level(id: number): Promise<Level | undefined> {
    const result = await db.execute({
      sql: "SELECT id, title, sort_order, active, is_archived, archive_year_id FROM levels WHERE id = ?",
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
      sql: `SELECT id, term_id, department_id, title, sort_order, active FROM courses
            WHERE term_id = ? ${activeOnly ? "AND active = 1" : ""} ORDER BY sort_order, id`,
      args: [termId],
    });
    return result.rows as unknown as Course[];
  }

  async coursesForDepartment(
    termId: number,
    departmentId: number,
    activeOnly = true,
  ): Promise<Course[]> {
    const result = await db.execute({
      sql: `SELECT c.id, c.term_id, c.department_id, c.title, c.sort_order, c.active
            FROM courses c
            WHERE c.term_id = ?
              AND c.department_id = ?
              ${activeOnly ? "AND c.active = 1" : ""}
            ORDER BY c.sort_order, c.id`,
      args: [termId, departmentId],
    });
    return result.rows as unknown as Course[];
  }

  async course(id: number): Promise<Course | undefined> {
    const result = await db.execute({
      sql: "SELECT id, term_id, department_id, title, sort_order, active FROM courses WHERE id = ?",
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

  async resourceGroups(
    courseId: number,
    folderId: number,
    limit = 8,
    offset = 0,
  ): Promise<ResourceGroupSummary[]> {
    const result = await db.execute({
      sql: `SELECT g.id, g.course_id, g.folder_id, g.title, g.sort_order, g.created_by,
                   COUNT(r.id) AS part_count
            FROM resource_groups g
            LEFT JOIN resources r ON r.group_id = g.id
            WHERE g.course_id = ? AND g.folder_id = ?
            GROUP BY g.id
            ORDER BY g.sort_order, g.id LIMIT ? OFFSET ?`,
      args: [courseId, folderId, limit, offset],
    });
    return result.rows as unknown as ResourceGroupSummary[];
  }

  async countResourceGroups(
    courseId: number,
    folderId: number,
  ): Promise<number> {
    const result = await db.execute({
      sql: "SELECT COUNT(*) AS count FROM resource_groups WHERE course_id = ? AND folder_id = ?",
      args: [courseId, folderId],
    });
    return Number(result.rows[0]?.count ?? 0);
  }

  async resourceGroup(id: number): Promise<ResourceGroup | undefined> {
    const result = await db.execute({
      sql: `SELECT id, course_id, folder_id, title, sort_order, created_by
            FROM resource_groups WHERE id = ?`,
      args: [id],
    });
    return result.rows[0] as unknown as ResourceGroup | undefined;
  }

  async resourcesInGroup(groupId: number): Promise<Resource[]> {
    const result = await db.execute({
      sql: `SELECT id, group_id, course_id, folder_id, part_order, part_label,
                   file_id, file_unique_id, file_type, url, file_name, mime_type,
                   title, caption
            FROM resources WHERE group_id = ? ORDER BY part_order, id`,
      args: [groupId],
    });
    return result.rows as unknown as Resource[];
  }

  async resource(id: number): Promise<Resource | undefined> {
    const result = await db.execute({
      sql: `SELECT id, group_id, course_id, folder_id, part_order, part_label,
                   file_id, file_unique_id, file_type, url, file_name, mime_type,
                   title, caption
            FROM resources WHERE id = ?`,
      args: [id],
    });
    return result.rows[0] as unknown as Resource | undefined;
  }

  async createLevel(
    title: string,
    archiveYearId: number | null = null,
  ): Promise<number> {
    const result = await db.execute({
      sql: `INSERT INTO levels (title, archive_year_id, is_archived, sort_order) VALUES (?, ?, ?, COALESCE(
        (SELECT MAX(sort_order) + 1 FROM levels WHERE archive_year_id IS ?), 0))`,
      args: [
        title,
        archiveYearId,
        archiveYearId === null ? 0 : 1,
        archiveYearId,
      ],
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

  async createDepartment(levelId: number, title: string): Promise<number> {
    const result = await db.execute({
      sql: `INSERT INTO departments (level_id, title, sort_order)
            VALUES (?, ?, COALESCE(
              (SELECT MAX(sort_order) + 1 FROM departments WHERE level_id = ?), 0))`,
      args: [levelId, title, levelId],
    });
    return idOf(result.lastInsertRowid);
  }

  async createCourse(
    termId: number,
    title: string,
    departmentId: number | null,
  ): Promise<number> {
    const result = await db.execute({
      sql: `INSERT INTO courses (term_id, department_id, title, sort_order)
            VALUES (?, ?, ?, COALESCE(
              (SELECT MAX(sort_order) + 1 FROM courses
               WHERE term_id = ? AND department_id IS ?), 0))`,
      args: [termId, departmentId, title, termId, departmentId],
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
    entity: "level" | "term" | "course" | "folder" | "department",
    id: number,
    title: string,
  ): Promise<void> {
    const table = {
      level: "levels",
      term: "terms",
      course: "courses",
      folder: "folders",
      department: "departments",
    }[entity];
    await db.execute({
      sql: `UPDATE ${table} SET title = ? WHERE id = ?`,
      args: [title, id],
    });
  }

  async toggleLevel(id: number): Promise<void> {
    await db.execute({
      sql: "UPDATE levels SET active = 1 - active WHERE id = ? AND archive_year_id IS NULL AND is_archived = 0",
      args: [id],
    });
  }

  async unarchiveLevel(id: number): Promise<number> {
    const tx = await db.transaction("write");
    try {
      const selected = await tx.execute({
        sql: "SELECT archive_year_id FROM levels WHERE id = ? AND is_archived = 1 AND archive_year_id IS NOT NULL",
        args: [id],
      });
      const archiveYearId = selected.rows[0]?.archive_year_id;
      if (typeof archiveYearId !== "number") {
        throw new Error("The selected level is not in an archive.");
      }
      await tx.execute({
        sql: `UPDATE levels SET archive_year_id = NULL, is_archived = 0, active = 1
              WHERE id = ? AND archive_year_id = ? AND is_archived = 1`,
        args: [id, archiveYearId],
      });
      await tx.commit();
      return archiveYearId;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async toggleTerm(id: number): Promise<void> {
    await db.execute({
      sql: "UPDATE terms SET active = 1 - active WHERE id = ?",
      args: [id],
    });
  }

  async toggleDepartment(id: number): Promise<void> {
    await db.execute({
      sql: "UPDATE departments SET active = 1 - active WHERE id = ?",
      args: [id],
    });
  }

  async toggleCourse(id: number): Promise<void> {
    await db.execute({
      sql: "UPDATE courses SET active = 1 - active WHERE id = ?",
      args: [id],
    });
  }

  async assignCourseDepartment(
    courseId: number,
    departmentId: number | null,
  ): Promise<void> {
    const result = await db.execute({
      sql: "UPDATE courses SET department_id = ? WHERE id = ?",
      args: [departmentId, courseId],
    });
    if (Number(result.rowsAffected) === 0) {
      throw new Error("The selected course no longer exists.");
    }
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
        sql: "INSERT INTO levels (title, sort_order, active, is_archived, archive_year_id) VALUES (?, 0, 1, 1, ?)",
        args: [sourceTitle, archiveYearId],
      });
      const newLevelId = idOf(newLevel.lastInsertRowid);
      const sourceDepartments = await tx.execute({
        sql: "SELECT id, title, sort_order FROM departments WHERE level_id = ?",
        args: [levelId],
      });
      const departmentIds = new Map<number, number>();
      for (const department of sourceDepartments.rows as unknown as Array<{
        id: number;
        title: string;
        sort_order: number;
      }>) {
        const inserted = await tx.execute({
          sql: `INSERT INTO departments (level_id, title, sort_order, active)
                VALUES (?, ?, ?, 1)`,
          args: [newLevelId, department.title, department.sort_order],
        });
        departmentIds.set(department.id, idOf(inserted.lastInsertRowid));
      }
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
          sql: "SELECT id, department_id, title, sort_order FROM courses WHERE term_id = ?",
          args: [term.id],
        });
        for (const course of courses.rows as unknown as Array<{
          id: number;
          department_id: number | null;
          title: string;
          sort_order: number;
        }>) {
          const departmentId =
            course.department_id === null
              ? null
              : (departmentIds.get(course.department_id) ?? null);
          const newCourse = await tx.execute({
            sql: `INSERT INTO courses
                    (term_id, department_id, title, sort_order, active)
                  VALUES (?, ?, ?, ?, 1)`,
            args: [newTermId, departmentId, course.title, course.sort_order],
          });
          const oldCourseId = course.id;
          const newCourseId = idOf(newCourse.lastInsertRowid);
          const groups = await tx.execute({
            sql: `SELECT id, folder_id, title, sort_order, created_by
                  FROM resource_groups WHERE course_id = ? ORDER BY sort_order, id`,
            args: [oldCourseId],
          });
          for (const group of groups.rows as unknown as Array<{
            id: number;
            folder_id: number;
            title: string;
            sort_order: number;
            created_by: number;
          }>) {
            const newGroup = await tx.execute({
              sql: `INSERT INTO resource_groups
                      (course_id, folder_id, title, sort_order, created_by)
                    VALUES (?, ?, ?, ?, ?)`,
              args: [
                newCourseId,
                group.folder_id,
                group.title,
                group.sort_order,
                group.created_by,
              ],
            });
            const newGroupId = idOf(newGroup.lastInsertRowid);
            await tx.execute({
              sql: `INSERT INTO resources
                      (group_id, course_id, folder_id, part_order, part_label,
                           file_id, file_unique_id, file_type, url, file_name, mime_type,
                       title, caption, created_by)
                    SELECT ?, ?, folder_id, part_order, part_label,
                           file_id, file_unique_id, file_type, url, file_name, mime_type,
                           title, caption, created_by
                    FROM resources WHERE group_id = ? ORDER BY part_order, id`,
              args: [newGroupId, newCourseId, group.id],
            });
          }
        }
      }
      await tx.execute({
        sql: "UPDATE levels SET active = 0, is_archived = 1 WHERE id = ? AND archive_year_id IS NULL AND is_archived = 0",
        args: [levelId],
      });
      await tx.commit();
      return newLevelId;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async createResourceGroup(
    courseId: number,
    folderId: number,
    title: string,
    createdBy: number,
  ): Promise<number> {
    const result = await db.execute({
      sql: `INSERT INTO resource_groups
              (course_id, folder_id, title, sort_order, created_by)
            VALUES (?, ?, ?, COALESCE(
              (SELECT MAX(sort_order) + 1 FROM resource_groups
               WHERE course_id = ? AND folder_id = ?), 0), ?)`,
      args: [courseId, folderId, title, courseId, folderId, createdBy],
    });
    return idOf(result.lastInsertRowid);
  }

  async appendResource(resource: {
    groupId: number;
    fileType: string;
    fileId?: string;
    fileUniqueId?: string;
    url?: string;
    fileName?: string;
    mimeType?: string;
    partLabel?: string;
    caption?: string;
    createdBy: number;
  }): Promise<number> {
    if (
      resource.fileType === "link"
        ? !resource.url || resource.fileId || resource.fileUniqueId
        : !resource.fileId ||
          !resource.fileUniqueId ||
          resource.url !== undefined
    ) {
      throw new Error("A resource must contain either a valid link or a file.");
    }
    const tx = await db.transaction("write");
    try {
      const group = await tx.execute({
        sql: "SELECT course_id, folder_id FROM resource_groups WHERE id = ?",
        args: [resource.groupId],
      });
      const row = group.rows[0];
      if (!row) throw new Error("The resource group no longer exists.");
      const last = await tx.execute({
        sql: "SELECT COALESCE(MAX(part_order), 0) AS last_order FROM resources WHERE group_id = ?",
        args: [resource.groupId],
      });
      const partOrder = Number(last.rows[0]?.last_order ?? 0) + 1;
      const result = await tx.execute({
        sql: `INSERT INTO resources
                (group_id, course_id, folder_id, part_order, part_label,
                 file_id, file_unique_id, file_type, url, file_name, mime_type,
                 title, caption, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        args: [
          resource.groupId,
          Number(row.course_id),
          Number(row.folder_id),
          partOrder,
          resource.partLabel ?? null,
          resource.fileId ?? null,
          resource.fileUniqueId ?? null,
          resource.fileType,
          resource.url ?? null,
          resource.fileName ?? null,
          resource.mimeType ?? null,
          resource.caption ?? null,
          resource.createdBy,
        ],
      });
      await tx.commit();
      return idOf(result.lastInsertRowid);
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async renameResourceGroup(id: number, title: string): Promise<void> {
    const result = await db.execute({
      sql: "UPDATE resource_groups SET title = ? WHERE id = ?",
      args: [title, id],
    });
    if (Number(result.rowsAffected) === 0) {
      throw new Error("The resource group no longer exists.");
    }
  }

  async renameResourcePart(id: number, partLabel: string): Promise<void> {
    const result = await db.execute({
      sql: "UPDATE resources SET part_label = ? WHERE id = ?",
      args: [partLabel, id],
    });
    if (Number(result.rowsAffected) === 0) {
      throw new Error("The resource part no longer exists.");
    }
  }

  async replaceResourceFile(
    groupId: number,
    resourceId: number,
    file: {
      fileId: string;
      fileUniqueId: string;
      fileType: string;
      fileName?: string;
      mimeType?: string;
    },
  ): Promise<void> {
    const result = await db.execute({
      sql: `UPDATE resources
            SET file_id = ?, file_unique_id = ?, file_type = ?, file_name = ?,
                mime_type = ?, url = NULL
            WHERE id = ? AND group_id = ?`,
      args: [
        file.fileId,
        file.fileUniqueId,
        file.fileType,
        file.fileName ?? null,
        file.mimeType ?? null,
        resourceId,
        groupId,
      ],
    });
    if (Number(result.rowsAffected) === 0) {
      throw new Error("The selected resource part no longer exists.");
    }
  }

  async deleteResourceGroup(id: number): Promise<void> {
    const tx = await db.transaction("write");
    try {
      const group = await tx.execute({
        sql: "SELECT id FROM resource_groups WHERE id = ?",
        args: [id],
      });
      if (!group.rows[0])
        throw new Error("The resource group no longer exists.");
      await tx.execute({
        sql: "DELETE FROM resources WHERE group_id = ?",
        args: [id],
      });
      await tx.execute({
        sql: "DELETE FROM resource_groups WHERE id = ?",
        args: [id],
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async deleteResourcePart(groupId: number, resourceId: number): Promise<void> {
    const tx = await db.transaction("write");
    try {
      const part = await tx.execute({
        sql: "SELECT id FROM resources WHERE id = ? AND group_id = ?",
        args: [resourceId, groupId],
      });
      if (!part.rows[0])
        throw new Error("The selected resource part no longer exists.");
      await tx.execute({
        sql: "DELETE FROM resources WHERE id = ? AND group_id = ?",
        args: [resourceId, groupId],
      });
      const remaining = await tx.execute({
        sql: "SELECT id FROM resources WHERE group_id = ? ORDER BY part_order, id",
        args: [groupId],
      });
      if (remaining.rows.length === 0) {
        await tx.execute({
          sql: "DELETE FROM resource_groups WHERE id = ?",
          args: [groupId],
        });
      } else {
        for (const [index, row] of remaining.rows.entries()) {
          await tx.execute({
            sql: "UPDATE resources SET part_order = ? WHERE id = ?",
            args: [-(index + 1), Number(row.id)],
          });
        }
        for (const [index, row] of remaining.rows.entries()) {
          await tx.execute({
            sql: "UPDATE resources SET part_order = ? WHERE id = ?",
            args: [index + 1, Number(row.id)],
          });
        }
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async searchResourceGroups(keyword: string): Promise<
    Array<
      ResourceGroupSummary & {
        course_title: string;
        level_title: string;
      }
    >
  > {
    const result = await db.execute({
      sql: `SELECT g.id, g.course_id, g.folder_id, g.title, g.sort_order, g.created_by,
                   COUNT(DISTINCT r.id) AS part_count, c.title AS course_title,
                   l.title AS level_title
            FROM resource_groups g
            JOIN resources r ON r.group_id = g.id
            JOIN courses c ON c.id = g.course_id
            JOIN terms t ON t.id = c.term_id
            JOIN levels l ON l.id = t.level_id
            LEFT JOIN departments d ON d.id = c.department_id
            WHERE l.archive_year_id IS NULL AND l.is_archived = 0 AND l.active = 1
              AND t.active = 1 AND c.active = 1
              AND (c.department_id IS NULL OR d.active = 1)
              AND (g.title LIKE ? OR r.file_name LIKE ? OR r.part_label LIKE ?
                   OR r.url LIKE ? OR c.title LIKE ?)
            GROUP BY g.id
            ORDER BY g.sort_order DESC, g.id DESC LIMIT 10`,
      args: [
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
      ],
    });
    return result.rows as unknown as Array<
      ResourceGroupSummary & {
        course_title: string;
        level_title: string;
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
