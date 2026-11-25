export interface Level {
  id: number;
  title: string;
  sort_order: number;
  active: number;
  is_archived: number;
  archive_year_id: number | null;
}

export interface Term {
  id: number;
  level_id: number;
  title: string;
  sort_order: number;
  active: number;
}

export interface Department {
  id: number;
  level_id: number;
  title: string;
  sort_order: number;
  active: number;
}

export interface Course {
  id: number;
  term_id: number;
  department_id: number | null;
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
  group_id: number;
  course_id: number;
  folder_id: number;
  part_order: number;
  part_label: string | null;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  file_name: string | null;
  mime_type: string | null;
  title: string | null;
  caption: string | null;
}

export interface ResourceGroup {
  id: number;
  course_id: number;
  folder_id: number;
  title: string;
  sort_order: number;
  created_by: number;
}

export interface ResourceGroupSummary extends ResourceGroup {
  part_count: number;
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
        | "add-department"
        | "add-course"
        | "add-folder"
        | "rename-resource-group"
        | "rename-resource-part"
        | "rename"
        | "create-archive";
      parentId?: number;
      entity?: string;
      entityId?: number;
      archiveYearId?: number;
      departmentId?: number | null;
      resourceGroupId?: number;
      resourcePage?: number;
      partPage?: number;
    }
  | { kind: "search" }
  | { kind: "my-level" }
  | { kind: "my-term"; levelId: number }
  | { kind: "feedback" }
  | {
      kind: "upload-title";
      courseId: number;
      folderId: number;
      mode: "single" | "multipart";
      groupId?: number;
    }
  | {
      kind: "upload";
      courseId: number;
      folderId: number;
      groupId?: number;
      groupTitle?: string;
      mode?: "single" | "multipart";
      uploadedCount?: number;
      returnToManage?: boolean;
      returnPage?: number;
      returnPartPage?: number;
    }
  | {
      kind: "replace-resource";
      groupId: number;
      resourceId: number;
      page: number;
      partPage?: number;
    }
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
