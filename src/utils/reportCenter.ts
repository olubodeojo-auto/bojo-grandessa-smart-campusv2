import type { ReportTerm, ReportType } from "../types/reportCard";
import type { Result } from "../types/result";
import { calculateResult, validateAssessmentMarks } from "./resultCalculations";
import type { SavedReportCard } from "../services/reportCardService";
import { getResultPublishBlockReason, type ResultPublicationEvidence } from "./resultPermissions";

export type ReportCenterPeriod = {
  key: string;
  studentId: string;
  classId: string;
  academicYear: string;
  term: ReportTerm;
  reportType: ReportType;
  results: Result[];
  savedReport?: SavedReportCard;
};

export type ReportCenterPeriodStatus =
  | "Draft"
  | "Ready for review"
  | "Returned"
  | "Published"
  | "Approved (legacy)"
  | "In progress"
  | "Saved details only";

export type ReportPublishFailure = {
  resultId: string;
  message: string;
};

export type ReportPublishVerification = {
  refreshedResults: Result[] | null;
  publishedResultIds: string[];
  failures: ReportPublishFailure[];
  verificationError: string | null;
};

export type ReportUnpublishVerification = {
  refreshedResults: Result[] | null;
  returnedResultIds: string[];
  failures: ReportPublishFailure[];
  verificationError: string | null;
};

export type ReportPeriodDeleteResult = {
  cancelled: boolean;
  deletedResultIds: string[];
  failures: ReportPublishFailure[];
  deletedSavedReport: boolean;
};

export function acquireReportPublishLock(
  inFlightPeriods: Set<string>,
  periodKey: string,
): (() => void) | null {
  if (inFlightPeriods.has(periodKey)) return null;
  inFlightPeriods.add(periodKey);
  return () => inFlightPeriods.delete(periodKey);
}

export async function publishReportResultsAndVerify(
  pendingResults: Result[],
  publishResult: (resultId: string) => Promise<void>,
  refreshResults: () => Promise<Result[]>,
): Promise<ReportPublishVerification> {
  const failures = new Map<string, string>();
  for (const result of pendingResults) {
    try {
      await publishResult(result.id);
    } catch (error) {
      failures.set(
        result.id,
        error instanceof Error ? error.message : "The publish request failed.",
      );
    }
  }

  let refreshedResults: Result[];
  try {
    refreshedResults = await refreshResults();
  } catch (error) {
    return {
      refreshedResults: null,
      publishedResultIds: [],
      failures: pendingResults.map((result) => ({
        resultId: result.id,
        message: failures.get(result.id) ?? "The saved status could not be verified.",
      })),
      verificationError: error instanceof Error ? error.message : "Unable to reload saved result statuses.",
    };
  }

  const refreshedById = new Map(refreshedResults.map((result) => [result.id, result]));
  const publishedResultIds: string[] = [];
  for (const result of pendingResults) {
    const refreshed = refreshedById.get(result.id);
    if (refreshed?.status === "Published") {
      publishedResultIds.push(result.id);
      continue;
    }
    failures.set(
      result.id,
      failures.get(result.id)
        ?? `The publish request returned without an error, but the saved status is ${refreshed?.status ?? "missing"}.`,
    );
  }

  return {
    refreshedResults,
    publishedResultIds,
    failures: [...failures.entries()].map(([resultId, message]) => ({ resultId, message })),
    verificationError: null,
  };
}

export async function unpublishReportResultsAndVerify(
  publishedResults: Result[],
  unpublishResult: (resultId: string, reason?: string) => Promise<void>,
  refreshResults: () => Promise<Result[]>,
  reason?: string,
): Promise<ReportUnpublishVerification> {
  const failures = new Map<string, string>();
  for (const result of publishedResults) {
    try {
      await unpublishResult(result.id, reason);
    } catch (error) {
      failures.set(
        result.id,
        error instanceof Error ? error.message : "The unpublish request failed.",
      );
    }
  }

  let refreshedResults: Result[];
  try {
    refreshedResults = await refreshResults();
  } catch (error) {
    return {
      refreshedResults: null,
      returnedResultIds: [],
      failures: publishedResults.map((result) => ({
        resultId: result.id,
        message: failures.get(result.id) ?? "The saved status could not be verified.",
      })),
      verificationError: error instanceof Error ? error.message : "Unable to reload saved result statuses.",
    };
  }

  const refreshedById = new Map(refreshedResults.map((result) => [result.id, result]));
  const returnedResultIds: string[] = [];
  for (const result of publishedResults) {
    const refreshed = refreshedById.get(result.id);
    if (refreshed?.status === "Returned") {
      returnedResultIds.push(result.id);
      continue;
    }
    failures.set(
      result.id,
      failures.get(result.id)
        ?? `The unpublish request returned without an error, but the saved status is ${refreshed?.status ?? "missing"}.`,
    );
  }

  return {
    refreshedResults,
    returnedResultIds,
    failures: [...failures.entries()].map(([resultId, message]) => ({ resultId, message })),
    verificationError: null,
  };
}

export function canDeleteDraftReportPeriod(
  period: ReportCenterPeriod,
  isAdministrator: boolean,
): boolean {
  return isAdministrator
    && period.results.length > 0
    && period.results.every((result) => result.status === "Draft");
}

export function canDeleteReportPeriod(
  period: ReportCenterPeriod,
  isAdministrator: boolean,
): boolean {
  return isAdministrator && (period.results.length > 0 || Boolean(period.savedReport));
}

export function getReportPeriodResults(period: ReportCenterPeriod, results: Result[]): Result[] {
  return results.filter((result) =>
    result.student_id === period.studentId
    && result.class_id === period.classId
    && result.academic_year === period.academicYear
    && result.term === period.term
    && (period.reportType === "Midterm"
      ? result.assessment_type === "CA"
      : result.assessment_type === "Combined" || result.assessment_type === "Examination"),
  );
}

export async function deleteReportPeriodRecords(
  period: ReportCenterPeriod,
  isAdministrator: boolean,
  confirmDeletion: () => boolean,
  deleteSubjectResult: (resultId: string) => Promise<void>,
  deleteSavedReport: (reportId: string) => Promise<void>,
): Promise<ReportPeriodDeleteResult> {
  if (!isAdministrator) {
    throw new Error("Only an administrator can delete report periods.");
  }
  if (!confirmDeletion()) {
    return { cancelled: true, deletedResultIds: [], failures: [], deletedSavedReport: false };
  }

  const failures: ReportPublishFailure[] = [];
  const deletedResultIds: string[] = [];
  for (const result of period.results) {
    try {
      await deleteSubjectResult(result.id);
      deletedResultIds.push(result.id);
    } catch (error) {
      failures.push({
        resultId: result.id,
        message: error instanceof Error ? error.message : "The subject-result delete request failed.",
      });
    }
  }

  let deletedSavedReport = false;
  if (failures.length === 0 && period.savedReport) {
    try {
      await deleteSavedReport(period.savedReport.id);
      deletedSavedReport = true;
    } catch (error) {
      failures.push({
        resultId: period.savedReport.id,
        message: error instanceof Error ? error.message : "The saved report-card delete request failed.",
      });
    }
  }

  return { cancelled: false, deletedResultIds, failures, deletedSavedReport };
}

export function discoverReportCenterPeriods(
  results: Result[],
  savedReports: SavedReportCard[],
): ReportCenterPeriod[] {
  const periods = new Map<string, ReportCenterPeriod>();

  const getPeriod = (
    studentId: string,
    classId: string,
    academicYear: string,
    term: ReportTerm,
    reportType: ReportType,
  ): ReportCenterPeriod => {
    const key = [studentId, classId, academicYear, term, reportType].join("|");
    const existing = periods.get(key);
    if (existing) return existing;
    const period: ReportCenterPeriod = {
      key,
      studentId,
      classId,
      academicYear,
      term,
      reportType,
      results: [],
    };
    periods.set(key, period);
    return period;
  };

  for (const result of results) {
    if (!result.class_id || !result.academic_year) continue;
    if (result.assessment_type !== "CA"
      && result.assessment_type !== "Combined"
      && result.assessment_type !== "Examination") continue;
    const reportType: ReportType = result.assessment_type === "CA" ? "Midterm" : "End-of-Term";
    getPeriod(result.student_id, result.class_id, result.academic_year, result.term, reportType).results.push(result);
  }

  for (const report of savedReports) {
    const period = getPeriod(
      report.student_id,
      report.class_id,
      report.academic_year,
      report.term,
      report.report_type,
    );
    period.savedReport = report;
  }

  return [...periods.values()].sort((left, right) =>
    right.academicYear.localeCompare(left.academicYear)
    || ["First", "Second", "Third"].indexOf(right.term) - ["First", "Second", "Third"].indexOf(left.term)
    || left.reportType.localeCompare(right.reportType),
  );
}

export function getReportCenterPeriodStatus(period: ReportCenterPeriod): ReportCenterPeriodStatus {
  if (period.results.length === 0) return "Saved details only";
  const statuses = new Set(period.results.map((result) => result.status));
  if (statuses.size === 1) {
    const [status] = statuses;
    if (status === "Published") return "Published";
    if (status === "Approved") return "Approved (legacy)";
    if (status === "Submitted") return "Ready for review";
    if (status === "Returned") return "Returned";
    if (status === "Draft") return "Draft";
  }
  return "In progress";
}

function resultSubjectKey(result: Result): string | null {
  return result.subject_id?.trim() || result.subject_name?.trim().toLowerCase() || null;
}

export function getReportCenterCompleteness(
  period: ReportCenterPeriod,
  allResults: Result[] = period.results,
): { complete: boolean; reason: string } {
  if (period.results.length === 0) {
    return { complete: false, reason: "No subject-result rows are available for this report period." };
  }

  const subjectIds = period.results.map(resultSubjectKey).filter((subjectId): subjectId is string => Boolean(subjectId));
  if (subjectIds.length !== period.results.length || new Set(subjectIds).size !== subjectIds.length) {
    return { complete: false, reason: "A subject is missing or has duplicate result rows." };
  }

  const subjectSets = new Map<string, Map<string, string>>();
  for (const result of allResults) {
    if (result.class_id !== period.classId || result.academic_year !== period.academicYear) continue;
    const subjectId = resultSubjectKey(result);
    if (!subjectId) continue;
    const reportType = result.assessment_type === "CA" ? "Midterm" : "End-of-Term";
    const groupKey = [result.student_id, result.term, reportType].join("|");
    const group = subjectSets.get(groupKey) ?? new Map<string, string>();
    group.set(subjectId, result.subject_name?.trim() || subjectId);
    subjectSets.set(groupKey, group);
  }
  const currentGroupKey = [period.studentId, period.term, period.reportType].join("|");
  const expectedSubjects = [...subjectSets.entries()]
    .sort(([leftKey, left], [rightKey, right]) =>
      right.size - left.size
      || Number(rightKey === currentGroupKey) - Number(leftKey === currentGroupKey),
    )[0]?.[1] ?? new Map<string, string>();
  const periodSubjects = new Set(subjectIds);
  const missingSubjects = [...expectedSubjects.entries()]
    .filter(([subjectId]) => !periodSubjects.has(subjectId))
    .map(([, subjectName]) => subjectName);
  if (missingSubjects.length > 0) {
    return {
      complete: false,
      reason: `Missing subject results observed for this class and session: ${missingSubjects.join(", ")}.`,
    };
  }

  for (const result of period.results) {
    const assessmentType = result.assessment_type;
    const total = result.calculation_mode === "Automatic" && assessmentType === "Combined"
      ? calculateResult("Combined", result.continuous_assessment, result.examination).total
      : result.total_score;
    const errors = validateAssessmentMarks({
      assessment_type: assessmentType,
      continuous_assessment: result.continuous_assessment,
      maximum_score: result.maximum_score ?? null,
      examination: result.examination,
      total_score: total,
      grade: result.grade ?? "",
      remark: result.remark ?? "",
    });
    if (errors.length > 0) {
      return { complete: false, reason: errors[0] };
    }
    if (assessmentType === "CA" && result.continuous_assessment === null) {
      return { complete: false, reason: "One or more Midterm CA marks are missing." };
    }
    if (assessmentType === "CA" && !(result.maximum_score && result.maximum_score > 0)) {
      return { complete: false, reason: "One or more Midterm subject maximum scores are missing." };
    }
    if (assessmentType === "Combined"
      && (result.continuous_assessment === null || result.examination === null || total === null)) {
      return { complete: false, reason: "One or more End-of-Term CA, examination, or total marks are missing." };
    }
    if (assessmentType === "Examination" && (result.examination === null || total === null)) {
      return { complete: false, reason: "One or more examination or total marks are missing." };
    }
  }

  return { complete: true, reason: `${period.results.length} subject result(s) have complete marks.` };
}

export function getReportCenterPublishBlockReason(
  period: ReportCenterPeriod,
  allResults: Result[],
  isAdministrator: boolean,
  publicationEvidence: ReadonlyMap<string, ResultPublicationEvidence> = new Map(),
): string {
  const completeness = getReportCenterCompleteness(period, allResults);
  if (!completeness.complete) return completeness.reason;
  const unpublished = period.results.filter((result) => result.status !== "Published");
  if (unpublished.length === 0) return "All subject results in this report period are already published.";
  const blockers = unpublished.flatMap((result) => {
    const reason = getResultPublishBlockReason(result, isAdministrator, publicationEvidence.get(result.id));
    return reason
      ? [`${result.subject_name?.trim() || result.subject_id || "Subject result"}: ${reason}`]
      : [];
  });
  if (blockers.length > 0) return blockers.join(" ");
  return "";
}

export function canPublishReportCenterPeriod(
  period: ReportCenterPeriod,
  allResults: Result[] = period.results,
  isAdministrator = true,
  publicationEvidence: ReadonlyMap<string, ResultPublicationEvidence> = new Map(),
): boolean {
  return getReportCenterPublishBlockReason(period, allResults, isAdministrator, publicationEvidence) === "";
}

export function getReportCenterPublishActionState(
  period: ReportCenterPeriod,
  allResults: Result[],
  isAdministrator: boolean,
  isPublishing = false,
  verificationError = "",
  publicationEvidence: ReadonlyMap<string, ResultPublicationEvidence> = new Map(),
  publicationEvidenceError = "",
): { visible: boolean; disabled: boolean; reason: string } {
  const reason = getReportCenterPublishBlockReason(period, allResults, isAdministrator, publicationEvidence);
  return {
    visible: isAdministrator,
    disabled: !isAdministrator || Boolean(reason) || isPublishing || Boolean(verificationError) || Boolean(publicationEvidenceError),
    reason: verificationError || publicationEvidenceError || reason,
  };
}
