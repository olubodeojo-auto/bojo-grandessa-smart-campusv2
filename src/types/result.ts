export type ResultStatus =
  | "Draft"
  | "Published"
  | "Approved";

export interface Result {
  id: string;

  student_id: string;

  class_id?: string;

  subject_id?: string;

  class_name?: string;

  subject_name?: string;

  teacher_name?: string;

  academic_year: string;

  term: "First" | "Second" | "Third";

  continuous_assessment: number;

  examination: number;

  total_score: number;

  grade: string;

  remark: string;

  teacher_id?: string;

  status: ResultStatus;

  created_at: string;

  updated_at: string;
}