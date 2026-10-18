import type { Result } from "../types/result";

export type ResultBatchDraftResume = {
  studentId: string;
  academicYear: string;
  term: Result["term"];
  reportType: "Midterm" | "End-of-Term";
  calculationMode: "Manual" | "Automatic";
  subjectId: string;
  entry: {
    continuousAssessment: string;
    examination: string;
    totalScore: string;
    grade: string;
    remark: string;
    maximumScore: string;
    dirty: false;
  };
};

export type SavedResultDraftGroup = {
  key: string;
  studentId: string;
  classId: string;
  academicYear: string;
  term: Result["term"];
  assessmentType: Result["assessment_type"];
  results: Result[];
};

export function getSavedResultDrafts(results: Result[]): Result[] {
  return results
    .filter((result) => result.status === "Draft" && Boolean(result.class_id && result.subject_id))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export function groupSavedResultDrafts(results: Result[]): SavedResultDraftGroup[] {
  const groups = new Map<string, SavedResultDraftGroup>();
  for (const result of getSavedResultDrafts(results)) {
    if (!result.class_id) continue;
    const key = JSON.stringify([
      result.student_id,
      result.class_id,
      result.academic_year,
      result.term,
      result.assessment_type,
    ]);
    const group = groups.get(key);
    if (group) {
      group.results.push(result);
    } else {
      groups.set(key, {
        key,
        studentId: result.student_id,
        classId: result.class_id,
        academicYear: result.academic_year,
        term: result.term,
        assessmentType: result.assessment_type,
        results: [result],
      });
    }
  }
  return [...groups.values()];
}

export function getResultBatchDraftResume(result: Result): ResultBatchDraftResume | null {
  if (!result.class_id || !result.subject_id) return null;

  return {
    studentId: result.student_id,
    academicYear: result.academic_year,
    term: result.term,
    reportType: result.assessment_type === "CA" ? "Midterm" : "End-of-Term",
    calculationMode: result.calculation_mode ?? "Manual",
    subjectId: result.subject_id,
    entry: {
      continuousAssessment: result.continuous_assessment === null ? "" : String(result.continuous_assessment),
      examination: result.examination === null ? "" : String(result.examination),
      totalScore: result.total_score === null ? "" : String(result.total_score),
      grade: result.grade ?? "",
      remark: result.remark ?? "",
      maximumScore: result.maximum_score === null || result.maximum_score === undefined ? "" : String(result.maximum_score),
      dirty: false,
    },
  };
}
