import { isSuperAdmin } from "../config/env.js";
import {
  AdminRoleRepository,
  type AdminRoleDetails,
  type AdminScopeTarget,
} from "../repositories/admin-role-repository.js";
import { StudyRepository } from "../repositories/study-repository.js";
import type {
  AdminRole,
  AdminRoleSummary,
  AdminScopeDetail,
  Course,
  CourseScopeRef,
  Level,
  Term,
} from "../types/domain.js";

export type ScopeTargetType = "level" | "term" | "department" | "course";

export interface ScopeTarget {
  type: ScopeTargetType;
  id: number;
}

export class AccessService {
  constructor(
    private readonly roles = new AdminRoleRepository(),
    private readonly content = new StudyRepository(),
  ) {}

  async canAccessAdmin(userId: number | undefined): Promise<boolean> {
    if (userId === undefined) return false;
    if (isSuperAdmin(userId)) return true;
    return Boolean(await this.roles.role(userId));
  }

  async canManageCourse(
    userId: number | undefined,
    courseId: number,
  ): Promise<boolean> {
    if (userId === undefined) return false;
    if (isSuperAdmin(userId)) return true;
    const role = await this.roles.role(userId);
    if (!role) return false;
    if (role.all_courses === 1) return true;
    return this.roles.courseAllowed(userId, courseId);
  }

  async canManageLevel(
    userId: number | undefined,
    levelId: number,
  ): Promise<boolean> {
    if (userId === undefined) return false;
    if (isSuperAdmin(userId)) return true;
    const refs = await this.manageableCourseRefs(userId);
    return refs.some((ref) => ref.level_id === levelId);
  }

  async canManageTerm(
    userId: number | undefined,
    termId: number,
  ): Promise<boolean> {
    if (userId === undefined) return false;
    if (isSuperAdmin(userId)) return true;
    const refs = await this.manageableCourseRefs(userId);
    return refs.some((ref) => ref.term_id === termId);
  }

  async manageableCourseRefs(userId: number): Promise<CourseScopeRef[]> {
    if (isSuperAdmin(userId)) return this.content.currentCourseRefs();
    const role = await this.roles.role(userId);
    if (!role) return [];
    if (role.all_courses === 1) return this.content.currentCourseRefs();
    return this.roles.scopedCourseRefs(userId);
  }

  async manageableLevels(userId: number): Promise<Level[]> {
    if (isSuperAdmin(userId)) return this.content.currentLevels();
    const refs = await this.manageableCourseRefs(userId);
    const levelIds = new Set(refs.map((ref) => ref.level_id));
    return (await this.content.currentLevels()).filter((level) =>
      levelIds.has(level.id),
    );
  }

  async manageableTerms(userId: number, levelId: number): Promise<Term[]> {
    if (isSuperAdmin(userId)) return this.content.terms(levelId);
    const refs = await this.manageableCourseRefs(userId);
    const termIds = new Set(
      refs.filter((ref) => ref.level_id === levelId).map((ref) => ref.term_id),
    );
    return (await this.content.terms(levelId)).filter((term) =>
      termIds.has(term.id),
    );
  }

  async manageableCourses(userId: number, termId: number): Promise<Course[]> {
    if (isSuperAdmin(userId)) return this.content.courses(termId);
    const refs = await this.manageableCourseRefs(userId);
    const courseIds = new Set(
      refs.filter((ref) => ref.term_id === termId).map((ref) => ref.course_id),
    );
    return (await this.content.courses(termId)).filter((course) =>
      courseIds.has(course.id),
    );
  }

  async listContentAdmins(): Promise<AdminRoleSummary[]> {
    return this.roles.listRoles();
  }

  async contentAdmin(
    userId: number,
  ): Promise<{ role: AdminRole; scopes: AdminScopeDetail[] } | undefined> {
    const role = await this.roles.role(userId);
    if (!role) return undefined;
    return { role, scopes: await this.roles.scopes(userId) };
  }

  async grantContentAdmin(
    userId: number,
    grantedBy: number,
    details: AdminRoleDetails,
  ): Promise<void> {
    if (isSuperAdmin(userId)) {
      throw new Error("Super admins already have full access.");
    }
    const fullName = details.fullName.trim();
    if (!fullName || fullName.length > 100) {
      throw new Error("A valid full name is required.");
    }
    const phone = details.phone?.trim();
    if (phone && phone.length > 32) {
      throw new Error("The phone number is too long.");
    }
    const telegramUsername = details.telegramUsername?.trim().replace(/^@/, "");
    if (
      telegramUsername &&
      !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(telegramUsername)
    ) {
      throw new Error("The Telegram username is invalid.");
    }
    const notes = details.notes?.trim();
    if (notes && notes.length > 500) {
      throw new Error("The notes are too long.");
    }
    await this.roles.grant(userId, grantedBy, {
      fullName,
      ...(phone ? { phone } : {}),
      ...(telegramUsername ? { telegramUsername } : {}),
      ...(notes ? { notes } : {}),
    });
  }

  async revokeContentAdmin(userId: number): Promise<void> {
    await this.roles.revoke(userId);
  }

  async setAllCourses(userId: number, allCourses: boolean): Promise<void> {
    if (!(await this.roles.role(userId))) {
      throw new Error("The selected content admin no longer exists.");
    }
    await this.roles.setAllCourses(userId, allCourses);
  }

  async addScope(userId: number, target: ScopeTarget): Promise<void> {
    if (!(await this.roles.role(userId))) {
      throw new Error("The selected content admin no longer exists.");
    }
    if (!(await this.isCurrentTarget(target))) {
      throw new Error("The selected scope is not part of current content.");
    }
    await this.roles.addScope(userId, this.scopeTarget(target));
  }

  async removeScope(userId: number, scopeId: number): Promise<void> {
    await this.roles.removeScope(userId, scopeId);
  }

  private scopeTarget(target: ScopeTarget): AdminScopeTarget {
    switch (target.type) {
      case "level":
        return { levelId: target.id };
      case "term":
        return { termId: target.id };
      case "department":
        return { departmentId: target.id };
      case "course":
        return { courseId: target.id };
    }
  }

  private async isCurrentTarget(target: ScopeTarget): Promise<boolean> {
    if (target.type === "level") {
      return (await this.currentLevel(target.id)) !== undefined;
    }
    if (target.type === "term") {
      const term = await this.content.term(target.id);
      return Boolean(term?.active && (await this.currentLevel(term.level_id)));
    }
    if (target.type === "department") {
      const department = await this.content.department(target.id);
      return Boolean(
        department?.active && (await this.currentLevel(department.level_id)),
      );
    }
    const course = await this.content.course(target.id);
    if (!course?.active) return false;
    const term = await this.content.term(course.term_id);
    return Boolean(term?.active && (await this.currentLevel(term.level_id)));
  }

  private async currentLevel(levelId: number): Promise<Level | undefined> {
    const level = await this.content.level(levelId);
    return level?.active && !level.is_archived && level.archive_year_id === null
      ? level
      : undefined;
  }
}
