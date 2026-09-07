export type AssignmentFrequency = "One-time" | "Daily" | "Weekly";

export interface AssignmentFile {
  id: string;
  assignment_id: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  created_at: string;
}

export interface Assignment {
  id: string;
  class_id: string;
  subject_id: string;
  title: string;
  instructions: string;
  due_date: string;
  frequency: AssignmentFrequency;
  published: boolean;
  published_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  class_name?: string;
  subject_name?: string;
  files: AssignmentFile[];
}

export interface CreateAssignmentInput {
  class_id: string;
  subject_id: string;
  title: string;
  instructions: string;
  due_date: string;
  frequency: AssignmentFrequency;
  notify_parents: boolean;
  files: File[];
}

export interface UpdateAssignmentInput {
  class_id: string;
  subject_id: string;
  title: string;
  instructions: string;
  due_date: string;
  frequency: AssignmentFrequency;
  files: File[];
}

export interface AssignmentNotificationStatus {
  assignment_id: string;
  notified: boolean;
  status: "accepted" | "reserved" | "failed" | null;
  accepted_count: number;
  recipient_count: number;
  created_at: string | null;
}
