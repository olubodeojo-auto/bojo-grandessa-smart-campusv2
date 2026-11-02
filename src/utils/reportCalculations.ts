import type { Result } from "../types/result";
import { calculateResult } from "./resultCalculations";
import { isParentVisibleReportStatus } from "./reportCardPresentation";

export type EndOfTermMetrics = {
  totalMarksObtained: number | null;
  totalMarksObtainable: number | null;
  studentPercentage: number | null;
};

export type MidtermMetrics = {
  totalMarksObtained: number | null;
  totalMarksObtainable: number | null;
  studentPercentage: number | null;
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

function endOfTermTotal(result: Result): number | null {
  if (result.calculation_mode === "Automatic" && result.assessment_type === "Combined") {
    return calculateResult("Combined", result.continuous_assessment, result.examination).total;
  }
  return result.total_score;
}

export function calculateEndOfTermMetrics(
  results: Result[],
  studentId: string,
  classId: string,
  academicYear: string,
  term: string,
  includeUnpublished = false,
): EndOfTermMetrics {
  const endOfTermRows = results.filter((result) =>
    (includeUnpublished || isParentVisibleReportStatus(result.status))
    && result.class_id === classId
    && result.academic_year === academicYear
    && result.term === term
    && result.student_id === studentId
    && (result.assessment_type === "Combined" || result.assessment_type === "Examination")
  );
  const validRows = endOfTermRows.filter((result) => {
    const total = endOfTermTotal(result);
    return total !== null && Number.isFinite(total);
  });
  const totalMarksObtained = validRows.length > 0 ? round(validRows.reduce((total, result) => total + (
    endOfTermTotal(result) ?? 0
  ), 0)) : null;
  const totalMarksObtainable = validRows.length > 0 ? validRows.length * 100 : null;
  const studentPercentage = totalMarksObtainable !== null && totalMarksObtainable > 0 && totalMarksObtained !== null
    ? round((totalMarksObtained / totalMarksObtainable) * 100)
    : null;

  return {
    totalMarksObtained,
    totalMarksObtainable,
    studentPercentage,
  };
}

export function calculateMidtermMetrics(
  results: Result[],
  studentId: string,
  classId: string,
  academicYear: string,
  term: string,
  includeUnpublished = false,
): MidtermMetrics {
  const rows = results.filter((result) =>
    (includeUnpublished || isParentVisibleReportStatus(result.status))
    && result.assessment_type === "CA"
    && result.class_id === classId
    && result.academic_year === academicYear
    && result.term === term
  );
  const targetRows = rows.filter((result) => result.student_id === studentId);
  const markedRows = targetRows.filter((result) => result.continuous_assessment !== null);
  const totalMarksObtained = markedRows.length > 0
    ? round(markedRows.reduce((sum, result) => sum + (result.continuous_assessment ?? 0), 0))
    : null;
  const allTargetRowsHaveMaxima = targetRows.length > 0
    && targetRows.every((result) => (result.maximum_score ?? 40) > 0);
  const totalMarksObtainable = allTargetRowsHaveMaxima
    ? round(targetRows.reduce((sum, result) => sum + (result.maximum_score ?? 40), 0))
    : null;
  // Midterm percentages are school-supplied report details, not a derived value.
  // Keep this calculation limited to the marks summary; callers must read the
  // percentage from the saved report-card record when the school supplied one.
  return {
    totalMarksObtained,
    totalMarksObtainable,
    studentPercentage: null,
  };
}
