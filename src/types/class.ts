export type ClassStatus = "Active" | "Inactive";

export interface SchoolClass {
  id: string;
  school_id: string;
  class_name: string;
  section: string | null;
  capacity: number;
  class_teacher: string | null;
  teacher_id?: string | null;
  academic_level?: string | null;
  current_students?: number | null;
  available_seats?: number | null;
  subjects_assigned?: string[] | null;
  homeroom_teacher?: string | null;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateClassData {
  class_name: string;
  section: string;
  capacity: number;
  class_teacher: string;
  teacher_id?: string | null;
  status: ClassStatus;
}

export interface UpdateClassData extends CreateClassData {
  id: string;
}