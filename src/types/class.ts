export type ClassStatus = "Active" | "Inactive";

export interface SchoolClass {
  id: string;
  class_name: string;
  class_teacher_id?: string | null;
  class_teacher?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    status: string | null;
  } | null;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateClassData {
  class_name: string;
  class_teacher_id?: string | null;
  status: ClassStatus;
}

export interface UpdateClassData extends CreateClassData {
  id: string;
}