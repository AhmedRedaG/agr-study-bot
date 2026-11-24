import { StudyRepository } from "../repositories/study-repository.js";

export class StudyService {
  constructor(private readonly content = new StudyRepository()) {}

  async createLevel(title: string, archiveYearId: number | null): Promise<number> {
    this.validateTitle(title);
    if (archiveYearId !== null && !(await this.content.archiveYear(archiveYearId))) {
      throw new Error("The selected archive year does not exist.");
    }
    return this.content.createLevel(title.trim(), archiveYearId);
  }

  async createTerm(levelId: number, title: string): Promise<number> {
    this.validateTitle(title);
    if (!(await this.content.level(levelId))) throw new Error("The selected level does not exist.");
    return this.content.createTerm(levelId, title.trim());
  }

  async createCourse(termId: number, title: string): Promise<number> {
    this.validateTitle(title);
    if (!(await this.content.term(termId))) throw new Error("The selected term does not exist.");
    return this.content.createCourse(termId, title.trim());
  }

  async createFolder(title: string): Promise<number> {
    this.validateTitle(title);
    return this.content.createFolder(title.trim());
  }

  async createArchiveYear(title: string): Promise<number> {
    this.validateTitle(title);
    return this.content.createArchiveYear(title.trim());
  }

  async rename(entity: "level" | "term" | "course" | "folder", id: number, title: string): Promise<void> {
    this.validateTitle(title);
    await this.content.rename(entity, id, title.trim());
  }

  async snapshotLevel(levelId: number, archiveYearId: number): Promise<number> {
    const level = await this.content.level(levelId);
    if (!level || level.archive_year_id !== null) throw new Error("Only an existing current level can be archived.");
    if (!(await this.content.archiveYear(archiveYearId))) throw new Error("The selected archive year does not exist.");
    return this.content.snapshotLevel(levelId, archiveYearId);
  }

  async toggleLevel(id: number): Promise<void> {
    const level = await this.content.level(id);
    if (!level || level.archive_year_id !== null) throw new Error("The selected current level does not exist.");
    await this.content.toggleLevel(id);
  }

  async toggleTerm(id: number): Promise<void> {
    if (!(await this.content.term(id))) throw new Error("The selected term does not exist.");
    await this.content.toggleTerm(id);
  }

  async toggleCourse(id: number): Promise<void> {
    if (!(await this.content.course(id))) throw new Error("The selected course does not exist.");
    await this.content.toggleCourse(id);
  }

  async toggleFolder(id: number): Promise<void> {
    if (!(await this.content.folders(false)).some((folder) => folder.id === id)) {
      throw new Error("The selected folder does not exist.");
    }
    await this.content.toggleFolder(id);
  }

  async moveFolder(id: number, direction: -1 | 1): Promise<void> {
    if (!(await this.content.folders(false)).some((folder) => folder.id === id)) {
      throw new Error("The selected folder does not exist.");
    }
    await this.content.moveFolder(id, direction);
  }

  async addResource(resource: Parameters<StudyRepository["addResource"]>[0]): Promise<void> {
    if (!(await this.content.course(resource.courseId))) throw new Error("The selected course does not exist.");
    if (!(await this.content.folders(false)).some((folder) => folder.id === resource.folderId)) {
      throw new Error("The selected folder does not exist.");
    }
    await this.content.addResource(resource);
  }

  private validateTitle(title: string): void {
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > 100) throw new Error("Names must contain between 1 and 100 characters.");
  }
}
