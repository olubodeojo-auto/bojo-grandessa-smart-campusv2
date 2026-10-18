import type { Result } from "../types/result";
import type { ReportHistoryBySession, ReportHistoryItem, ReportType } from "../types/reportCard";

export type CompletePublishedResult = Result & {
  continuous_assessment: number;
  examination: number;
  total_score: number;
};

export function isCompletePublishedCombinedResult(result: Result): result is CompletePublishedResult {
  return result.status === "Published"
    && result.assessment_type === "Combined"
    && result.continuous_assessment !== null
    && result.examination !== null
    && result.total_score !== null;
}

export function selectSupplementalPublishedResults(
  results: Result[],
  studentId: string,
  academicYear: string,
  term: string,
): Result[] {
  return results.filter((result) =>
    result.student_id === studentId
    && result.academic_year === academicYear
    && result.term === term
    && result.status === "Published"
    && !isCompletePublishedCombinedResult(result)
  );
}

export function findLatestReportPeriod(
  history: ReportHistoryBySession[],
  reportType: ReportType,
): { academicYear: string; period: ReportHistoryItem } | null {
  for (const session of history) {
    const period = session.entries.find((entry) => entry.reportType === reportType);
    if (period) return { academicYear: session.academicYear, period };
  }

  return null;
}
