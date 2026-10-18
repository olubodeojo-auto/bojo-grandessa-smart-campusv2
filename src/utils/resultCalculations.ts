import grandessaGradingScale from "../config/grandessaGrading";
import type { ResultAssessmentType } from "../types/result";

export type CalculatedResult = {
  total: number | null;
  grade: string | null;
  remark: string | null;
};

export type AssessmentFields = {
  assessment_type: ResultAssessmentType;
  continuous_assessment: number | null;
  maximum_score: number | null;
  examination: number | null;
  total_score: number | null;
  grade: string;
  remark: string;
};

export function transitionAssessmentType(
  previous: AssessmentFields,
  assessmentType: ResultAssessmentType,
): AssessmentFields {
  return {
    ...previous,
    assessment_type: assessmentType,
    continuous_assessment: assessmentType === "Examination" ? null : previous.continuous_assessment,
    maximum_score: assessmentType === "CA" ? previous.maximum_score : null,
    examination: assessmentType === "CA" ? null : previous.examination,
    total_score: null,
    grade: "",
    remark: "",
  };
}

export function validateAssessmentMarks(fields: AssessmentFields): string[] {
  const errors: string[] = [];
  const { assessment_type, continuous_assessment, examination, maximum_score, total_score } = fields;

  if (continuous_assessment !== null) {
    if (!Number.isFinite(continuous_assessment) || continuous_assessment < 0) {
      errors.push("CA score must be a finite, non-negative number.");
    } else if (assessment_type === "CA" && maximum_score !== null
      && (!Number.isFinite(maximum_score) || maximum_score <= 0 || continuous_assessment > maximum_score)) {
      errors.push("CA score must not exceed its positive maximum score.");
    } else if (assessment_type === "Combined" && continuous_assessment > 40) {
      errors.push("End-of-term CA score cannot exceed 40.");
    }
  }

  if (examination !== null) {
    if (!Number.isFinite(examination) || examination < 0) {
      errors.push("Examination score must be a finite, non-negative number.");
    } else if (assessment_type === "Combined" && examination > 60) {
      errors.push("End-of-term examination score cannot exceed 60.");
    } else if (assessment_type === "Examination" && examination > 100) {
      errors.push("Legacy examination score cannot exceed 100.");
    }
  }

  if (assessment_type === "CA" && maximum_score !== null
    && (!Number.isFinite(maximum_score) || maximum_score <= 0)) {
    errors.push("Maximum score must be a positive number or left blank.");
  }

  if (assessment_type === "Examination" && total_score !== null
    && (!Number.isFinite(total_score) || total_score < 0 || total_score > 100)) {
    errors.push("Entered total must be between 0 and 100.");
  }

  if (assessment_type === "Combined" && total_score !== null
    && (!Number.isFinite(total_score) || total_score < 0 || total_score > 100)) {
    errors.push("Entered total must be between 0 and 100.");
  }

  return errors;
}

export function computeTotal(continuousAssessment: number | null, examination: number | null): number | null {
  if (continuousAssessment === null || examination === null) return null;
  return Number((continuousAssessment + examination).toFixed(2));
}

export function gradeFromTotal(total: number | null): string | null {
  if (total === null || !Number.isFinite(total) || total < 0 || total > 100) return null;
  const matchedBand = grandessaGradingScale.find((band) => total >= band.min);

  return matchedBand?.grade ?? null;
}

export function remarkFromGrade(grade: string | null): string | null {
  if (grade === null) return null;
  const matchedBand = grandessaGradingScale.find((band) => band.grade === grade);

  return matchedBand?.remark ?? null;
}

export function calculateResult(
  assessmentType: ResultAssessmentType,
  continuousAssessment: number | null,
  examination: number | null,
): CalculatedResult {
  if (assessmentType !== "Combined" || continuousAssessment === null || examination === null) {
    return { total: null, grade: null, remark: null };
  }

  const markErrors = validateAssessmentMarks({
    assessment_type: assessmentType,
    continuous_assessment: continuousAssessment,
    maximum_score: null,
    examination,
    total_score: null,
    grade: "",
    remark: "",
  });
  if (markErrors.length > 0) return { total: null, grade: null, remark: null };

  const total = computeTotal(continuousAssessment, examination);
  const grade = gradeFromTotal(total);
  return { total, grade, remark: remarkFromGrade(grade) };
}
