import type { ReportCardData, ReportType } from "../types/reportCard";
import type { Result } from "../types/result";

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
  >,
): ReportSummaryValues {
  if (report.calculationMode === "Automatic") {
    return {
      totalMarksObtained: report.totalMarksObtained,
      totalMarksObtainable: report.totalMarksObtainable,
      studentPercentage: report.studentPercentage,
    };
  }
  return {
    totalMarksObtained: report.reportTotalMarksObtained,
    totalMarksObtainable: report.reportTotalMarksObtainable,
    studentPercentage: report.reportStudentPercentage,
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
  return (includeUnpublished || result.status === "Published")
    && result.student_id === target.studentId
    && result.class_id === target.classId
    && result.academic_year === target.academicYear
    && result.term === target.term
    && (target.reportType === "Midterm"
      ? result.assessment_type === "CA"
      : result.assessment_type === "Combined" || result.assessment_type === "Examination");
}
