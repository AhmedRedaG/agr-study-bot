export interface Level {
  id: number;
  title: string;
  sort_order: number;
  active: number;
  archive_year_id: number | null;
}

export interface Term {
  id: number;
  level_id: number;
  title: string;
  sort_order: number;
  active: number;
}

export interface Course {
  id: number;
  term_id: number;
  title: string;
  sort_order: number;
  active: number;
}

export interface Folder {
  id: number;
  title: string;
  sort_order: number;
  active: number;
}

export interface Resource {
  id: number;
  course_id: number;
  folder_id: number;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  file_name: string | null;
  mime_type: string | null;
  title: string | null;
  caption: string | null;
}

export interface ArchiveYear {
  id: number;
  title: string;
}

export type AdminState =
  | {
      kind: "text";
      action:
        | "add-level"
        | "add-term"
        | "add-course"
        | "add-folder"
        | "rename"
        | "create-archive";
      parentId?: number;
      entity?: string;
      entityId?: number;
      archiveYearId?: number;
    }
  | { kind: "search" }
  | { kind: "my-level" }
  | { kind: "my-term"; levelId: number }
  | { kind: "feedback" }
  | { kind: "upload"; courseId: number; folderId: number }
  | {
      kind: "broadcast-target";
      target: "all" | "level" | "term";
      targetId?: number;
    }
  | {
      kind: "broadcast-message";
      target: "all" | "level" | "term";
      targetId?: number;
    };
