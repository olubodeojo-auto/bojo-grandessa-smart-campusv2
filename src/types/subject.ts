export type SubjectStatus = "Active" | "Inactive";

export type SubjectDepartment =
  | "General"
  | "Science"
  | "Commercial"
  | "Arts"
  | "Vocational"
  | "Languages"
  | "ICT"
  | "Creative Arts";

export type SubjectAcademicLevel =
  | "Creche"
  | "Nursery"
  | "Primary"
  | "Junior Secondary"
  | "Senior Secondary";

export interface Subject {
  id: string;
  school_id: string;
  subject_code: string;
  subject_name: string;
  department: SubjectDepartment | null;
  academic_level: SubjectAcademicLevel | null;
  description: string | null;
  status: SubjectStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectData {
  subject_code: string;
  subject_name: string;
  department: SubjectDepartment;
  academic_level: SubjectAcademicLevel;
  description: string;
  status: SubjectStatus;
}

export interface UpdateSubjectData extends CreateSubjectData {
  id: string;
}
