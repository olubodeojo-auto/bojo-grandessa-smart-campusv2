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

/**
 * Return only subject rows that have every required mark recorded for their assessment.
 * A completely blank subject stays Draft and can be completed later; it must not prevent
 * the pupil's other complete subjects from being published. Nonblank invalid marks remain
 * in this set so validation still blocks a genuinely incorrect score.
 */
export function getReportCenterResultsWithRecordedMarks(results: Result[]): Result[] {
  return results.filter((result) => {
    let requiredMarksPresent: boolean;
    if (result.assessment_type === "CA") {
      requiredMarksPresent = result.continuous_assessment !== null
        && typeof result.maximum_score === "number"
        && Number.isFinite(result.maximum_score)
        && result.maximum_score > 0;
    } else if (result.assessment_type === "Combined") {
      requiredMarksPresent = result.continuous_assessment !== null
        && result.examination !== null
        && result.total_score !== null;
    } else if (result.assessment_type === "Examination") {
      requiredMarksPresent = result.examination !== null && result.total_score !== null;
    } else {
      requiredMarksPresent = true;
    }

    // Blank required fields alone mean "not entered yet" and are skipped this pass.
    // A present but invalid mark is different: keep that row in the publish set so
    // the validation below blocks publication and tells staff to correct it.
    if (requiredMarksPresent) return true;
    const total = result.calculation_mode === "Automatic" && result.assessment_type === "Combined"
      ? calculateResult("Combined", result.continuous_assessment, result.examination).total
      : result.total_score;
    const errors = validateAssessmentMarks({
      assessment_type: result.assessment_type,
      continuous_assessment: result.continuous_assessment,
      maximum_score: result.maximum_score ?? null,
      examination: result.examination,
      total_score: total,
      grade: result.grade ?? "",
      remark: result.remark ?? "",
    });
    return errors.length > 0;
  });
}

export function getReportCenterCompleteness(
  period: ReportCenterPeriod,
  _allResults: Result[] = period.results,
): { complete: boolean; reason: string } {
  const recordedResults = getReportCenterResultsWithRecordedMarks(period.results);
  if (recordedResults.length === 0) {
    return {
      complete: false,
      reason: "No complete subject-result rows are available for publication. Add at least one subject with complete marks.",
    };
  }

  const subjectIds = recordedResults.map(resultSubjectKey).filter((subjectId): subjectId is string => Boolean(subjectId));
  if (subjectIds.length !== recordedResults.length || new Set(subjectIds).size !== subjectIds.length) {
    return { complete: false, reason: "A subject is missing or has duplicate result rows." };
  }

  // School policy: not-offered and not-yet-entered subjects stay out of this release.
  // Validate every complete result row; never discard a nonblank invalid score.
  for (const result of recordedResults) {
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
    if (errors.length > 0) return { complete: false, reason: errors[0] };
  }

  return { complete: true, reason: `${recordedResults.length} subject result(s) have complete marks. Incomplete subject rows will remain drafts.` };
}

export function getReportCenterPublishBlockReason(
  period: ReportCenterPeriod,
  allResults: Result[],
  isAdministrator: boolean,
  publicationEvidence: ReadonlyMap<string, ResultPublicationEvidence> = new Map(),
): string {
  const publishableResults = getReportCenterResultsWithRecordedMarks(period.results);
  const publishablePeriod = { ...period, results: publishableResults };
  const completeness = getReportCenterCompleteness(publishablePeriod, allResults);
  if (!completeness.complete) return completeness.reason;
  const unpublished = publishableResults.filter((result) => result.status !== "Published");
  if (unpublished.length === 0) return "All complete subject results in this report period are already published. Incomplete subject rows remain drafts.";
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
