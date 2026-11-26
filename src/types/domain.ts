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
  file_id: string | null;
  file_unique_id: string | null;
  file_type: string;
  url: string | null;
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

export interface AdminRole {
  user_id: number;
  all_courses: number;
  granted_by: number;
  full_name: string | null;
  phone: string | null;
  telegram_username: string | null;
  notes: string | null;
  created_at: string;
}

export interface AdminRoleSummary extends AdminRole {
  first_name: string | null;
  username: string | null;
  scope_count: number;
}

export interface AdminScope {
  id: number;
  user_id: number;
  level_id: number | null;
  term_id: number | null;
  department_id: number | null;
  course_id: number | null;
}

export interface AdminScopeDetail extends AdminScope {
  level_title: string | null;
  term_title: string | null;
  department_title: string | null;
  course_title: string | null;
}

export interface CourseScopeRef {
  course_id: number;
  term_id: number;
  level_id: number;
  department_id: number | null;
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
  | {
      kind: "grant-admin";
      step: "id" | "name" | "phone" | "telegram" | "notes";
      targetUserId?: number;
      fullName?: string;
      phone?: string;
      telegramUsername?: string;
      notes?: string;
    }
  | { kind: "my-term"; levelId: number }
  | {
      kind: "feedback";
      category: "suggestion" | "resource" | "other";
    }
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
