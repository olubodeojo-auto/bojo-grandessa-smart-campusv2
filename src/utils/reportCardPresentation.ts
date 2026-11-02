import type { ReportCardData, ReportType } from "../types/reportCard";
import type { Result } from "../types/result";

export function isParentVisibleReportStatus(status: string): boolean {
  return status === "Published" || status === "Approved";
}

export function formatStudentName(
  student: Pick<ReportCardData["student"], "first_name" | "middle_name" | "last_name">,
): string {
  const seen = new Set<string>();
  const parts = [student.first_name, student.middle_name, student.last_name];
  const tokens = parts.flatMap((part) => (part ?? "").trim().split(/\s+/).filter(Boolean));
  return tokens.filter((token) => {
    const key = token.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(" ");
}

export interface ReportSummaryValues {
  totalMarksObtained: number | null;
  totalMarksObtainable: number | null;
  studentPercentage: number | null;
}

export function getReportSummaryValues(
  report: Pick<ReportCardData,
    | "calculationMode"
    | "totalMarksObtained"
    | "totalMarksObtainable"
    | "studentPercentage"
    | "reportTotalMarksObtained"
    | "reportTotalMarksObtainable"
    | "reportStudentPercentage"
  > & Partial<Pick<ReportCardData, "reportType">>,
): ReportSummaryValues {
  const calculated = {
    totalMarksObtained: report.totalMarksObtained,
    totalMarksObtainable: report.totalMarksObtainable,
    studentPercentage: report.studentPercentage,
  };
  // Midterm is always a CA/40 calculation. Older saved manual report details
  // can contain stale 100-point totals, so never let them override the marks.
  if (report.reportType === "Midterm" || report.calculationMode === "Automatic") {
    return calculated;
  }
  return {
    totalMarksObtained: report.reportTotalMarksObtained ?? calculated.totalMarksObtained,
    totalMarksObtainable: report.reportTotalMarksObtainable ?? calculated.totalMarksObtainable,
    studentPercentage: report.reportStudentPercentage ?? calculated.studentPercentage,
  };
}

export function calculateAgeFromDateOfBirth(dateOfBirth: string, asOf = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== dateOfBirth) return null;
  if (birthDate > asOf) return null;

  let age = asOf.getUTCFullYear() - birthDate.getUTCFullYear();
  const hasHadBirthday = asOf.getUTCMonth() > birthDate.getUTCMonth()
    || (asOf.getUTCMonth() === birthDate.getUTCMonth() && asOf.getUTCDate() >= birthDate.getUTCDate());
  if (!hasHadBirthday) age -= 1;
  return age;
}

export function isMatchingPublishedReportResult(
  result: Result,
  target: { studentId: string; classId: string; academicYear: string; term: string; reportType: ReportType },
  includeUnpublished = false,
): boolean {
  return (includeUnpublished || isParentVisibleReportStatus(result.status))
    && result.student_id === target.studentId
    && result.class_id === target.classId
    && result.academic_year === target.academicYear
    && result.term === target.term
    && (target.reportType === "Midterm"
      ? result.assessment_type === "CA"
      : result.assessment_type === "Combined" || result.assessment_type === "Examination");
}
