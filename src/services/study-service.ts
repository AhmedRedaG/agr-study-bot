import { StudyRepository } from "../repositories/study-repository.js";

export class StudyService {
  constructor(private readonly content = new StudyRepository()) {}

  async createLevel(
    title: string,
    archiveYearId: number | null,
  ): Promise<number> {
    this.validateTitle(title);
    if (
      archiveYearId !== null &&
      !(await this.content.archiveYear(archiveYearId))
    ) {
      throw new Error("The selected archive year does not exist.");
    }
    return this.content.createLevel(title.trim(), archiveYearId);
  }

  async createTerm(levelId: number, title: string): Promise<number> {
    this.validateTitle(title);
    if (!(await this.content.level(levelId)))
      throw new Error("The selected level does not exist.");
    return this.content.createTerm(levelId, title.trim());
  }

  async createDepartment(levelId: number, title: string): Promise<number> {
    this.validateTitle(title);
    if (!(await this.content.level(levelId))) {
      throw new Error("The selected level does not exist.");
    }
    return this.content.createDepartment(levelId, title.trim());
  }

  async createCourse(
    termId: number,
    title: string,
    departmentId: number | null = null,
  ): Promise<number> {
    this.validateTitle(title);
    const term = await this.content.term(termId);
    if (!term)
      throw new Error("The selected term does not exist.");
    if (departmentId !== null) {
      const department = await this.content.department(departmentId);
      if (!department || department.level_id !== term.level_id) {
        throw new Error(
          "The selected department must belong to the course's level.",
        );
      }
    }
    return this.content.createCourse(termId, title.trim(), departmentId);
  }

  async createFolder(title: string): Promise<number> {
    this.validateTitle(title);
    return this.content.createFolder(title.trim());
  }

  async createArchiveYear(title: string): Promise<number> {
    this.validateTitle(title);
    return this.content.createArchiveYear(title.trim());
  }

  async rename(
    entity: "level" | "term" | "course" | "folder" | "department",
    id: number,
    title: string,
  ): Promise<void> {
    this.validateTitle(title);
    await this.content.rename(entity, id, title.trim());
  }

  async snapshotLevel(levelId: number, archiveYearId: number): Promise<number> {
    const level = await this.content.level(levelId);
    if (!level || level.archive_year_id !== null || level.is_archived)
      throw new Error("Only an existing current level can be archived.");
    if (!(await this.content.archiveYear(archiveYearId)))
      throw new Error("The selected archive year does not exist.");
    return this.content.snapshotLevel(levelId, archiveYearId);
  }

  async unarchiveLevel(id: number): Promise<number> {
    const level = await this.content.level(id);
    if (!level || level.archive_year_id === null || !level.is_archived) {
      throw new Error("The selected level is not in an archive.");
    }
    return this.content.unarchiveLevel(id);
  }

  async toggleLevel(id: number): Promise<void> {
    const level = await this.content.level(id);
    if (!level || level.archive_year_id !== null || level.is_archived)
      throw new Error("The selected current level does not exist.");
    await this.content.toggleLevel(id);
  }

  async toggleTerm(id: number): Promise<void> {
    if (!(await this.content.term(id)))
      throw new Error("The selected term does not exist.");
    await this.content.toggleTerm(id);
  }

  async toggleDepartment(id: number): Promise<void> {
    if (!(await this.content.department(id))) {
      throw new Error("The selected department does not exist.");
    }
    await this.content.toggleDepartment(id);
  }

  async assignCourseDepartment(
    courseId: number,
    departmentId: number | null,
  ): Promise<void> {
    const course = await this.content.course(courseId);
    const term = course ? await this.content.term(course.term_id) : undefined;
    if (!course || !term) {
      throw new Error("The selected course does not exist.");
    }
    if (departmentId !== null) {
      const department = await this.content.department(departmentId);
      if (!department || department.level_id !== term.level_id) {
        throw new Error(
          "The selected department must belong to the course's level.",
        );
      }
    }
    await this.content.assignCourseDepartment(courseId, departmentId);
  }

  async toggleCourse(id: number): Promise<void> {
    if (!(await this.content.course(id)))
      throw new Error("The selected course does not exist.");
    await this.content.toggleCourse(id);
  }

  async toggleFolder(id: number): Promise<void> {
    if (
      !(await this.content.folders(false)).some((folder) => folder.id === id)
    ) {
      throw new Error("The selected folder does not exist.");
    }
    await this.content.toggleFolder(id);
  }

  async moveFolder(id: number, direction: -1 | 1): Promise<void> {
    if (
      !(await this.content.folders(false)).some((folder) => folder.id === id)
    ) {
      throw new Error("The selected folder does not exist.");
    }
    await this.content.moveFolder(id, direction);
  }

  async createResourceGroup(
    courseId: number,
    folderId: number,
    title: string,
    createdBy: number,
  ): Promise<number> {
    this.validateTitle(title);
    const course = await this.content.course(courseId);
    if (!course?.active)
      throw new Error("The selected course does not exist.");
    const term = await this.content.term(course.term_id);
    const level = term ? await this.content.level(term.level_id) : undefined;
    if (
      !term?.active ||
      !level?.active ||
      level.is_archived ||
      level.archive_year_id !== null
    ) {
      throw new Error("Resources can only be uploaded to active current courses.");
    }
    if (
      !(await this.content.folders(false)).some(
        (folder) => folder.id === folderId,
      )
    ) {
      throw new Error("The selected folder does not exist.");
    }
    return this.content.createResourceGroup(
      courseId,
      folderId,
      title.trim(),
      createdBy,
    );
  }

  async appendResource(
    resource: Parameters<StudyRepository["appendResource"]>[0],
  ): Promise<number> {
    if (!(await this.content.resourceGroup(resource.groupId))) {
      throw new Error("The resource group no longer exists.");
    }
    return this.content.appendResource(resource);
  }

  async renameResourceGroup(id: number, title: string): Promise<void> {
    this.validateTitle(title);
    await this.content.renameResourceGroup(id, title.trim());
  }

  async renameResourcePart(id: number, partLabel: string): Promise<void> {
    this.validateTitle(partLabel);
    await this.content.renameResourcePart(id, partLabel.trim());
  }

  async replaceResourceFile(
    groupId: number,
    resourceId: number,
    file: Parameters<StudyRepository["replaceResourceFile"]>[2],
  ): Promise<void> {
    await this.content.replaceResourceFile(groupId, resourceId, file);
  }

  async deleteResourceGroup(id: number): Promise<void> {
    await this.content.deleteResourceGroup(id);
  }

  async deleteResourcePart(groupId: number, resourceId: number): Promise<void> {
    await this.content.deleteResourcePart(groupId, resourceId);
  }

  private validateTitle(title: string): void {
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > 100)
      throw new Error("Names must contain between 1 and 100 characters.");
  }
}
