export type ClassStatus = "Active" | "Inactive";

export interface SchoolClass {
  id: string;
  class_name: string;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateClassData {
  class_name: string;
  status: ClassStatus;
}

export interface UpdateClassData extends CreateClassData {
  id: string;
}