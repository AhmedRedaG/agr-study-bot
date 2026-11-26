import { db } from "../db/client.js";
import type {
  AdminRole,
  AdminRoleSummary,
  AdminScopeDetail,
  CourseScopeRef,
} from "../types/domain.js";

export interface AdminScopeTarget {
  levelId?: number;
  termId?: number;
  departmentId?: number;
  courseId?: number;
}

export interface AdminRoleDetails {
  fullName: string;
  phone?: string;
  telegramUsername?: string;
  notes?: string;
}

export class AdminRoleRepository {
  async role(userId: number): Promise<AdminRole | undefined> {
    const result = await db.execute({
      sql: `SELECT user_id, all_courses, granted_by, full_name, phone,
                   telegram_username, notes, created_at
            FROM admin_roles WHERE user_id = ?`,
      args: [userId],
    });
    return result.rows[0] as unknown as AdminRole | undefined;
  }

  async listRoles(): Promise<AdminRoleSummary[]> {
    const result = await db.execute({
      sql: `SELECT ar.user_id, ar.all_courses, ar.granted_by, ar.full_name,
                   ar.phone, ar.telegram_username, ar.notes, ar.created_at,
                   u.first_name, u.username,
                   (SELECT COUNT(*) FROM admin_role_scopes s WHERE s.user_id = ar.user_id) AS scope_count
            FROM admin_roles ar
            LEFT JOIN users u ON u.id = ar.user_id
            ORDER BY ar.created_at, ar.user_id`,
    });
    return result.rows as unknown as AdminRoleSummary[];
  }

  async grant(
    userId: number,
    grantedBy: number,
    details: AdminRoleDetails,
  ): Promise<void> {
    await db.execute({
      sql: `INSERT INTO admin_roles
              (user_id, all_courses, granted_by, full_name, phone, telegram_username, notes)
            VALUES (?, 1, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              full_name = excluded.full_name,
              phone = excluded.phone,
              telegram_username = excluded.telegram_username,
              notes = excluded.notes`,
      args: [
        userId,
        grantedBy,
        details.fullName,
        details.phone ?? null,
        details.telegramUsername ?? null,
        details.notes ?? null,
      ],
    });
  }

  async revoke(userId: number): Promise<void> {
    const tx = await db.transaction("write");
    try {
      await tx.execute({
        sql: "DELETE FROM admin_role_scopes WHERE user_id = ?",
        args: [userId],
      });
      await tx.execute({
        sql: "DELETE FROM admin_roles WHERE user_id = ?",
        args: [userId],
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async setAllCourses(userId: number, allCourses: boolean): Promise<void> {
    const tx = await db.transaction("write");
    try {
      await tx.execute({
        sql: "UPDATE admin_roles SET all_courses = ? WHERE user_id = ?",
        args: [allCourses ? 1 : 0, userId],
      });
      if (allCourses) {
        await tx.execute({
          sql: "DELETE FROM admin_role_scopes WHERE user_id = ?",
          args: [userId],
        });
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async scopes(userId: number): Promise<AdminScopeDetail[]> {
    const result = await db.execute({
      sql: `SELECT s.id, s.user_id, s.level_id, s.term_id, s.department_id,
                   s.course_id, l.title AS level_title,
                   COALESCE(st.title, ct.title) AS term_title,
                   d.title AS department_title, c.title AS course_title
            FROM admin_role_scopes s
            LEFT JOIN terms st ON st.id = s.term_id
            LEFT JOIN courses c ON c.id = s.course_id
            LEFT JOIN terms ct ON ct.id = c.term_id
            LEFT JOIN departments d ON d.id = s.department_id
            LEFT JOIN levels l ON l.id = COALESCE(
              s.level_id, st.level_id, ct.level_id, d.level_id
            )
            WHERE s.user_id = ?
            ORDER BY s.id`,
      args: [userId],
    });
    return result.rows as unknown as AdminScopeDetail[];
  }

  async addScope(userId: number, target: AdminScopeTarget): Promise<void> {
    const tx = await db.transaction("write");
    try {
      await tx.execute({
        sql: "UPDATE admin_roles SET all_courses = 0 WHERE user_id = ?",
        args: [userId],
      });
      await tx.execute({
        sql: `INSERT OR IGNORE INTO admin_role_scopes
                (user_id, level_id, term_id, department_id, course_id)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          userId,
          target.levelId ?? null,
          target.termId ?? null,
          target.departmentId ?? null,
          target.courseId ?? null,
        ],
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async removeScope(userId: number, scopeId: number): Promise<void> {
    await db.execute({
      sql: "DELETE FROM admin_role_scopes WHERE id = ? AND user_id = ?",
      args: [scopeId, userId],
    });
  }

  async courseAllowed(userId: number, courseId: number): Promise<boolean> {
    const result = await db.execute({
      sql: `SELECT 1 AS allowed
            FROM admin_roles ar
            JOIN courses c ON c.id = ?
            JOIN terms t ON t.id = c.term_id
            WHERE ar.user_id = ?
              AND (
                ar.all_courses = 1
                OR EXISTS (
                  SELECT 1 FROM admin_role_scopes s
                  WHERE s.user_id = ar.user_id
                    AND (
                      s.course_id = c.id
                      OR s.term_id = c.term_id
                      OR s.level_id = t.level_id
                      OR s.department_id = c.department_id
                    )
                )
              )`,
      args: [courseId, userId],
    });
    return result.rows.length > 0;
  }

  async scopedCourseRefs(userId: number): Promise<CourseScopeRef[]> {
    const result = await db.execute({
      sql: `SELECT c.id AS course_id, c.term_id, t.level_id, c.department_id
            FROM courses c
            JOIN terms t ON t.id = c.term_id
            JOIN levels l ON l.id = t.level_id
            JOIN admin_roles ar ON ar.user_id = ?
            WHERE l.archive_year_id IS NULL AND l.is_archived = 0
              AND l.active = 1 AND t.active = 1 AND c.active = 1
              AND (
                ar.all_courses = 1
                OR EXISTS (
                  SELECT 1 FROM admin_role_scopes s
                  WHERE s.user_id = ar.user_id
                    AND (
                      s.course_id = c.id
                      OR s.term_id = c.term_id
                      OR s.level_id = t.level_id
                      OR s.department_id = c.department_id
                    )
                )
              )
            ORDER BY l.sort_order, t.sort_order, c.sort_order, c.id`,
      args: [userId],
    });
    return result.rows as unknown as CourseScopeRef[];
  }
}
