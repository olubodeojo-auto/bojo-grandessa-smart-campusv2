export type ResultStatus = "Draft" | "Submitted" | "Returned" | "Published" | "Approved";
export type ResultAssessmentType = "CA" | "Examination" | "Combined";
export type ResultCalculationMode = "Manual" | "Automatic";

export interface Result {
  id: string;

  student_id: string;

  class_id?: string;

  subject_id?: string;

  class_name?: string;

  subject_name?: string;

  teacher_name?: string;
  assessment_type: ResultAssessmentType;
  calculation_mode?: ResultCalculationMode;

  academic_year: string;

  term: "First" | "Second" | "Third";

  continuous_assessment: number | null;

  maximum_score?: number | null;

  examination: number | null;

  total_score: number | null;

  grade: string | null;

  remark: string | null;

  teacher_id?: string;

  status: ResultStatus;

  created_by?: string | null;
  submitted_by?: string | null;
  submitted_by_name?: string | null;
  submitted_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  published_by?: string | null;
  published_at?: string | null;
  review_reason?: string | null;
  returned_assessment_snapshot?: Array<string | number | null> | null;

  created_at: string;

  updated_at: string;
}