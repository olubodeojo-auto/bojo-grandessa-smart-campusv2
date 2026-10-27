import { getAttendanceByStudent } from "./attendanceService";
import { getClasses } from "./classService";
import { getCalendarTermConfig, type ReportTerm as CalendarTerm } from "../config/grandessaCalendar";
import grandessaGradingScale from "../config/grandessaGrading";
import { supabase } from "../lib/supabase";
import { getResults } from "./resultService";
import { getAcademicCalendarByYear, getSchoolSettings } from "./schoolSettingsService";
import { getParentStudents, getStudents } from "./studentService";
import { getSubjects } from "./subjectService";
import { calculateResult, computeTotal, gradeFromTotal, remarkFromGrade } from "../utils/resultCalculations";
import { calculateEndOfTermMetrics, calculateMidtermMetrics } from "../utils/reportCalculations";
import { isMatchingPublishedReportResult } from "../utils/reportCardPresentation";
import { resolveReportTermId, toStoredTermName, type AcademicTermMatch } from "../utils/reportTermResolution";
import { resolveTemplateForClass } from "./reportTemplateEngine";
import type { ReportCardData, ReportHistoryBySession, ReportHistoryItem, ReportTerm, ReportType, SubjectReportLine } from "../types/reportCard";
import type { Result } from "../types/result";
import { reconcileSavedImportStudentMatches, type ResultImportPreviewEntry } from "./resultImportService";

type ReportCardRecord = {
  class_teacher_comment?: string | null;
  teacher_comment?: string | null;
  head_teacher_comment?: string | null;
  principal_comment?: string | null;
  academic_year?: string | null;
  term?: string | null;
  class_id?: string | null;
  report_type?: ReportType | null;
  class_average?: number | null;
  maximum_attendance?: number | null;
  times_present?: number | null;
  times_absent?: number | null;
  term_ending?: string | null;
  next_term_begins?: string | null;
  class_teacher_name?: string | null;
  calculation_mode?: "Manual" | "Automatic" | null;
  total_marks_obtained?: number | null;
  total_marks_obtainable?: number | null;
  student_percentage?: number | null;
};

export interface SavedReportCard {
  id: string;
  student_id: string;
  class_id: string;
  academic_year: string;
  term: ReportTerm;
  report_type: ReportType;
}

export function flattenImportedResultUpdates(
  updates: Array<{ id: string; values: Partial<Result> }>,
): Array<Partial<Result> & { id: string }> {
  return updates.map(({ id, values }) => ({ ...values, id }));
}

type ReportDependencies = {
  students: Awaited<ReturnType<typeof getStudents>>;
  classes: Awaited<ReturnType<typeof getClasses>>;
  subjects: Awaited<ReturnType<typeof getSubjects>>;
  results: Awaited<ReturnType<typeof getResults>>;
};

export async function getSavedReportCards(filters?: {
  academicYear: string;
  term: ReportTerm;
  reportType: ReportType;
  classId?: string;
}): Promise<SavedReportCard[]> {
  const schoolSettings = await getSchoolSettings();
  let query = supabase
    .from("report_cards")
    .select("id, student_id, class_id, academic_year, term, report_type")
    .eq("school_id", schoolSettings.school_id);
  if (filters) {
    query = query
      .eq("academic_year", filters.academicYear)
      .eq("term", filters.term)
      .eq("report_type", filters.reportType);
    if (filters.classId) query = query.eq("class_id", filters.classId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load saved report cards: ${error.message}`);
  return ((data ?? []) as SavedReportCard[])
    .sort((left, right) => left.academic_year.localeCompare(right.academic_year)
      || left.term.localeCompare(right.term));
}

export async function saveImportedReportCard(params: {
  updates: Array<{ id: string; values: Partial<Result> }>;
  inserts: Array<Omit<Result, "id" | "created_at" | "updated_at">>;
  reportDetails: Parameters<typeof saveReportCardDetails>[0];
}): Promise<void> {
  const schoolSettings = await getSchoolSettings();
  const { error } = await supabase.rpc("save_imported_report_card", {
    target_school_id: schoolSettings.school_id,
    result_updates: flattenImportedResultUpdates(params.updates),
    result_inserts: params.inserts,
    report_details: {
      student_id: params.reportDetails.studentId,
      class_id: params.reportDetails.classId,
      academic_year: params.reportDetails.academicYear,
      term: params.reportDetails.term,
      report_type: params.reportDetails.reportType,
      calculation_mode: params.reportDetails.calculationMode,
      class_teacher_name: params.reportDetails.classTeacherName,
      class_teacher_comment: params.reportDetails.classTeacherComment,
      head_teacher_comment: params.reportDetails.headTeacherComment,
      class_average: params.reportDetails.classAverage,
      total_marks_obtained: params.reportDetails.totalMarksObtained,
      total_marks_obtainable: params.reportDetails.totalMarksObtainable,
      student_percentage: params.reportDetails.studentPercentage,
      maximum_attendance: params.reportDetails.maximumAttendance,
      times_present: params.reportDetails.timesPresent,
      times_absent: params.reportDetails.timesAbsent,
      term_ending: params.reportDetails.termEnding,
      next_term_begins: params.reportDetails.nextTermBegins,
    },
  });
  if (error) throw new Error(`Unable to atomically save this pupil's imported results and report card: ${error.message}`);
}

export async function saveImportReviewDraft(params: {
  workbookKey: string;
  entry: ResultImportPreviewEntry;
  ownerId?: string;
}): Promise<void> {
  const schoolSettings = await getSchoolSettings();
  const { error } = await supabase.rpc("save_result_import_review_draft_v2", {
    target_school_id: schoolSettings.school_id,
    target_workbook_key: params.workbookKey,
    target_entry_key: params.entry.studentKey,
    target_student_id: params.entry.selectedStudentId ?? null,
    target_class_id: params.entry.items[0]?.classId ?? null,
    draft_payload: params.entry,
    target_owner_id: params.ownerId ?? null,
  });
  if (error) throw new Error(`Unable to save ${params.entry.studentName}'s import review progress: ${error.message}`);
}

export async function getImportReviewDrafts(workbookKey: string, ownerId?: string): Promise<ResultImportPreviewEntry[]> {
  const schoolSettings = await getSchoolSettings();
  const { data, error } = await supabase.rpc("get_result_import_review_drafts_v2", {
    target_school_id: schoolSettings.school_id,
    target_workbook_key: workbookKey,
    target_owner_id: ownerId ?? null,
  });
  if (error) throw new Error(`Unable to restore import review progress: ${error.message}`);
  if (!Array.isArray(data)) throw new Error("The saved import review response has an invalid shape.");

  return data.map((row) => {
    if (!row || typeof row !== "object" || !("draft_payload" in row)) {
      throw new Error("A saved import review entry is malformed.");
    }
    const entry = row.draft_payload as ResultImportPreviewEntry;
    if (!entry || typeof entry !== "object" || typeof entry.studentKey !== "string" || !Array.isArray(entry.items)) {
      throw new Error("A saved import review entry is malformed.");
    }
    return entry;
  });
}

export async function markImportReviewDraftStatus(params: {
  workbookKey: string;
  entryKey: string;
  ownerId?: string;
  studentId: string;
  classId: string;
  workflowStatus: "published" | "imported_draft";
  resultIds: string[];
}): Promise<void> {
  if (params.resultIds.length === 0) {
    throw new Error("At least one saved subject result is required to update a pupil's import status.");
  }
  const schoolSettings = await getSchoolSettings();
  const { error } = await supabase.rpc("mark_result_import_review_draft_status_v2", {
    target_school_id: schoolSettings.school_id,
    target_workbook_key: params.workbookKey,
    target_entry_key: params.entryKey,
    target_owner_id: params.ownerId ?? null,
    target_student_id: params.studentId,
    target_class_id: params.classId,
    target_workflow_status: params.workflowStatus,
    target_result_ids: params.resultIds,
  });
  if (error) throw new Error(`Unable to update ${params.workflowStatus === "published" ? "published" : "draft"} status for this pupil's import: ${error.message}`);
}

export type ImportReviewWorkbook = {
  workbookKey: string;
  ownerId: string;
  ownerName: string;
  entryCount: number;
  updatedAt: string;
};

export type ImportReviewWorkbookSummary = ImportReviewWorkbook & {
  sheetName: string;
  academicYears: string[];
  terms: string[];
  reportKinds: string[];
  classes: string[];
  includedEntryCount: number;
  excludedEntryCount: number;
  unresolvedEntryCount: number;
  subjectRowCount: number;
  importedEntryCount: number;
  publishedEntryCount: number;
  draftImportedEntryCount: number;
  importedSubjectRowCount: number;
  publishedSubjectRowCount: number;
  draftImportedSubjectRowCount: number;
  duplicatePupilCount: number;
  duplicatePupilNames: string[];
  linkedPupilNames: string[];
  unresolvedPupilNames: string[];
  manualReviewDetails: string[];
  unmatchedPupilNames: string[];
  reportTypeReviewPupilNames: string[];
  missingScorePupilNames: string[];
  subjectReviewPupilNames: string[];
};

export async function getImportReviewSchoolId(): Promise<string> {
  const schoolSettings = await getSchoolSettings();
  return schoolSettings.school_id;
}

export async function getImportReviewWorkbooks(): Promise<ImportReviewWorkbook[]> {
  const schoolSettings = await getSchoolSettings();
  const { data, error } = await supabase.rpc("get_result_import_review_workbooks_v2", {
    target_school_id: schoolSettings.school_id,
  });
  if (error) throw new Error(`Unable to list saved import review workbooks: ${error.message}`);
  if (!Array.isArray(data)) throw new Error("The saved import workbook response has an invalid shape.");

  return data.map((row) => {
    if (!row || typeof row !== "object"
      || typeof row.workbook_key !== "string"
      || typeof row.owner_id !== "string"
      || typeof row.owner_name !== "string"
      || typeof row.entry_count !== "number"
      || typeof row.updated_at !== "string") {
      throw new Error("A saved import workbook entry is malformed.");
    }
    return {
      workbookKey: row.workbook_key,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      entryCount: row.entry_count,
      updatedAt: row.updated_at,
    };
  });
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export async function getImportReviewWorkbookSummaries(): Promise<ImportReviewWorkbookSummary[]> {
  const workbooks = await getImportReviewWorkbooks();
  if (workbooks.length === 0) return [];

  const roster = await getStudents();
  const workbookEntries = await Promise.all(workbooks.map(async (workbook) => {
    const savedEntries = await getImportReviewDrafts(workbook.workbookKey, workbook.ownerId);
    const entries = reconcileSavedImportStudentMatches(savedEntries, roster);
    return { workbook, entries };
  }));

  // An included pupil can be saved in several workbook uploads for the same period.
  // Surface this rather than importing the same pupil twice with potentially different marks.
  const workbookKeysByPupilPeriod = new Map<string, Set<string>>();
  for (const { workbook, entries } of workbookEntries) {
    for (const entry of entries) {
      if (entry.workflowStatus || entry.included === false) continue;
      const studentId = entry.selectedStudentId ?? entry.matchedStudentId;
      if (!studentId) continue;
      const pupilPeriodKey = [
        studentId,
        entry.academicYear,
        entry.term ?? "",
        entry.reportKind,
      ].join("::");
      const matchingWorkbooks = workbookKeysByPupilPeriod.get(pupilPeriodKey) ?? new Set<string>();
      matchingWorkbooks.add(workbookSelectionKeyForSummary(workbook));
      workbookKeysByPupilPeriod.set(pupilPeriodKey, matchingWorkbooks);
    }
  }

  const duplicatePupilsByWorkbook = new Map<string, Map<string, string>>();
  for (const { workbook, entries } of workbookEntries) {
    const duplicates = new Map<string, string>();
    for (const entry of entries) {
      if (entry.workflowStatus || entry.included === false) continue;
      const studentId = entry.selectedStudentId ?? entry.matchedStudentId;
      if (!studentId) continue;
      const pupilPeriodKey = [
        studentId,
        entry.academicYear,
        entry.term ?? "",
        entry.reportKind,
      ].join("::");
      if ((workbookKeysByPupilPeriod.get(pupilPeriodKey)?.size ?? 0) > 1) {
        duplicates.set(studentId, entry.studentName);
      }
    }
    duplicatePupilsByWorkbook.set(workbookSelectionKeyForSummary(workbook), duplicates);
  }

  return workbookEntries.map(({ workbook, entries }) => {
    const pending = entries.filter((entry) => !entry.workflowStatus);
    const included = pending.filter((entry) => entry.included !== false);
    const excluded = pending.filter((entry) => entry.included === false);
    const imported = entries.filter((entry) => entry.workflowStatus === "published" || entry.workflowStatus === "imported_draft");
    const published = entries.filter((entry) => entry.workflowStatus === "published");
    const importedDrafts = entries.filter((entry) => entry.workflowStatus === "imported_draft");
    const unresolved = included.filter((entry) =>
      entry.matchStatus !== "matched" || !entry.selectedStudentId
    );
    const linkedPupils = included.filter((entry) =>
      entry.matchStatus === "matched" && Boolean(entry.selectedStudentId)
    );
    const manualReviews = included.filter((entry) =>
      entry.matchStatus === "manual-review" && !entry.selectedStudentId
    );
    const unmatchedPupils = included.filter((entry) =>
      entry.matchStatus === "unmatched" || (!entry.selectedStudentId && entry.matchStatus !== "manual-review")
    );
    const reportTypeReview = included.filter((entry) => entry.reportKind === "Unclear");
    const missingScores = included.filter((entry) => entry.items.length === 0);
    const subjectReview = included.filter((entry) =>
      entry.warnings.some((warning) =>
        /subject .*must be resolved|no valid subject rows detected|subject.*needs? review/i.test(warning)
      )
    );
    const manualReviewDetails = manualReviews.map((entry) => {
      const originalName = typeof (entry as ResultImportPreviewEntry & { sourceStudentName?: string }).sourceStudentName === "string"
        ? (entry as ResultImportPreviewEntry & { sourceStudentName?: string }).sourceStudentName!
        : entry.studentName;
      const reviewReason = entry.warnings.find((warning) =>
        warning.startsWith("Possible match:") || warning.startsWith("Admission number ")
          || warning.startsWith("The name matches ") || warning.includes("workbook class differs")
      );
      return reviewReason ? `${originalName}: ${reviewReason}` : `${originalName}: confirm the pupil and class from the school register.`;
    });
    const separatorIndex = workbook.workbookKey.indexOf(":");
    const sheetName = separatorIndex >= 0
      ? workbook.workbookKey.slice(separatorIndex + 1)
      : "Saved spreadsheet";
    const firstItemClasses = entries.flatMap((entry) => entry.items.map((item) => item.className ?? ""));
    const classes = uniqueSorted([...entries.map((entry) => entry.className), ...firstItemClasses]);
    const duplicateNames = [...(duplicatePupilsByWorkbook.get(workbookSelectionKeyForSummary(workbook))?.values() ?? [])];
    const subjectCount = (entry: ResultImportPreviewEntry): number => entry.importedResultCount ?? entry.items.length;
    return {
      ...workbook,
      entryCount: entries.length,
      sheetName,
      academicYears: uniqueSorted(entries.map((entry) => entry.academicYear)),
      terms: uniqueSorted(entries.map((entry) => entry.term ? `${entry.term} Term` : "")),
      reportKinds: uniqueSorted(entries.map((entry) => entry.reportKind === "Midterm / Continuous Assessment"
        ? "Midterm (CA)"
        : entry.reportKind === "End-of-Term / Year Report Card"
          ? "End-of-Term"
          : entry.reportKind === "Unclear"
            ? "Report type to confirm"
            : entry.reportKind)),
      classes,
      includedEntryCount: included.length,
      excludedEntryCount: excluded.length,
      unresolvedEntryCount: unresolved.length,
      subjectRowCount: included.reduce((total, entry) => total + entry.items.length, 0),
      importedEntryCount: imported.length,
      publishedEntryCount: published.length,
      draftImportedEntryCount: importedDrafts.length,
      importedSubjectRowCount: imported.reduce((total, entry) => total + subjectCount(entry), 0),
      publishedSubjectRowCount: published.reduce((total, entry) => total + (entry.publishedResultCount ?? subjectCount(entry)), 0),
      draftImportedSubjectRowCount: importedDrafts.reduce((total, entry) => total + subjectCount(entry), 0),
      duplicatePupilCount: duplicateNames.length,
      duplicatePupilNames: duplicateNames,
      linkedPupilNames: uniqueSorted(linkedPupils.map((entry) => entry.studentName)),
      unresolvedPupilNames: uniqueSorted(unresolved.map((entry) => entry.studentName)),
      manualReviewDetails: uniqueSorted(manualReviewDetails),
      unmatchedPupilNames: uniqueSorted(unmatchedPupils.map((entry) => entry.studentName)),
      reportTypeReviewPupilNames: uniqueSorted(reportTypeReview.map((entry) => entry.studentName)),
      missingScorePupilNames: uniqueSorted(missingScores.map((entry) => entry.studentName)),
      subjectReviewPupilNames: uniqueSorted(subjectReview.map((entry) => entry.studentName)),
    };
  });
}

function workbookSelectionKeyForSummary(workbook: Pick<ImportReviewWorkbook, "ownerId" | "workbookKey">): string {
  return `${workbook.ownerId}::${workbook.workbookKey}`;
}
export async function deleteImportReviewDraft(workbookKey: string, entryKey: string, ownerId?: string): Promise<void> {
  const schoolSettings = await getSchoolSettings();
  const { error } = await supabase.rpc("delete_result_import_review_draft_v2", {
    target_school_id: schoolSettings.school_id,
    target_workbook_key: workbookKey,
    target_entry_key: entryKey,
    target_owner_id: ownerId ?? null,
  });
  if (error) throw new Error(`Unable to remove saved import review progress: ${error.message}`);
}

export async function deleteReportCard(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("report_cards")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Unable to delete report card: ${error.message}`);
  if (!data) throw new Error("The report card does not exist or deletion was blocked by a database policy.");
}

function loadReportDependencies(parentScoped = false): Promise<ReportDependencies> {
  return Promise.all([
    parentScoped ? getParentStudents() : getStudents(),
    getClasses(),
    getSubjects(),
    getResults(),
  ]).then(([students, classes, subjects, results]) => ({ students, classes, subjects, results }));
}

function normalizeTerm(term: string): ReportTerm {
  if (term === "First" || term === "Second" || term === "Third") {
    return term;
  }
  return "First";
}

function classLabel(result: Result, classMap: Map<string, { class_name: string }>): string {
  const value = result.class_id ? classMap.get(result.class_id) : undefined;

  if (!value) {
    return result.class_name?.trim() || "Unknown Class";
  }

  return value.class_name;
}

function inTermWindow(dateText: string, termConfig: { startDate: string; endDate: string }): boolean {
  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const start = new Date(`${termConfig.startDate}T00:00:00`);
  const end = new Date(`${termConfig.endDate}T23:59:59`);

  return date >= start && date <= end;
}

async function getReportCardRecord(
  studentId: string,
  academicYear: string,
  term: ReportTerm,
  classId: string,
  reportType: ReportType,
): Promise<ReportCardRecord | null> {
  if (!classId) return null;
  const schoolSettings = await getSchoolSettings();
  const { data, error } = await supabase
    .from("report_cards")
    .select("*")
    .eq("school_id", schoolSettings.school_id)
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("academic_year", academicYear)
    .eq("term", term)
    .eq("report_type", reportType)
    .limit(2);
  if (error) throw new Error(`Unable to load saved report details: ${error.message}`);
  if ((data?.length ?? 0) > 1) {
    throw new Error("More than one saved report detail record exists for this pupil, class, period and report type.");
  }
  return (data?.[0] as ReportCardRecord | undefined) ?? null;
}

export async function getReportHistoryByStudent(studentId: string, options: { parentScoped?: boolean } = {}): Promise<ReportHistoryBySession[]> {
  const { results: allResults, classes } = await loadReportDependencies(options.parentScoped);
  const classMap = new Map(classes.map((item) => [item.id, { class_name: item.class_name }]));

  const rows = allResults
    .filter((result) => result.student_id === studentId && result.status === "Published")
    .filter((result) => result.assessment_type === "CA"
      || result.assessment_type === "Combined"
      || result.assessment_type === "Examination")
    .reduce<Map<string, ReportHistoryItem>>((acc, row) => {
      const reportType: ReportType = row.assessment_type === "CA" ? "Midterm" : "End-of-Term";
      const classId = row.class_id ?? row.class_name ?? "";
      const key = `${row.academic_year}|${row.term}|${classId}|${reportType}`;
      const existing = acc.get(key);

      if (existing) {
        existing.resultCount += 1;
        existing.publishedCount += row.status === "Published" ? 1 : 0;
        if (new Date(row.updated_at).getTime() > new Date(existing.latestUpdatedAt).getTime()) {
          existing.latestUpdatedAt = row.updated_at;
        }
      } else {
        acc.set(key, {
          academicYear: row.academic_year,
          term: normalizeTerm(row.term),
          classId,
          className: classLabel(row, classMap),
          reportType,
          resultCount: 1,
          publishedCount: row.status === "Published" ? 1 : 0,
          latestUpdatedAt: row.updated_at,
        });
      }

      return acc;
    }, new Map())
    .values();

  const sessionsMap = new Map<string, ReportHistoryItem[]>();

  Array.from(rows).forEach((item) => {
    const list = sessionsMap.get(item.academicYear) ?? [];
    list.push(item);
    sessionsMap.set(item.academicYear, list);
  });

  const orderedTerms: ReportTerm[] = ["First", "Second", "Third"];

  return Array.from(sessionsMap.entries())
    .map(([academicYear, entries]) => ({
      academicYear,
      entries: [...entries].sort((a, b) =>
        orderedTerms.indexOf(a.term) - orderedTerms.indexOf(b.term)
        || a.className.localeCompare(b.className)
        || a.reportType.localeCompare(b.reportType)),
    }))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear));
}

export async function buildStudentReportCard(
  studentId: string,
  academicYear: string,
  term: ReportTerm,
  options: { parentScoped?: boolean; reportType?: ReportType; classId?: string; includeUnpublished?: boolean } = {}
): Promise<ReportCardData | null> {
  const reportType = options.reportType ?? "End-of-Term";
  const isMidterm = reportType === "Midterm";
  const [{ students, classes, subjects, results: allResults }, attendanceRows] = await Promise.all([
    loadReportDependencies(options.parentScoped),
    getAttendanceByStudent(studentId),
  ]);

  const student = students.find((item) => item.id === studentId);

  if (!student) {
    return null;
  }

  const reportCandidates = allResults.filter(
    (result) => result.student_id === studentId
      && result.academic_year === academicYear
      && result.term === term
      && (options.includeUnpublished || result.status === "Published")
      && (isMidterm
        ? result.assessment_type === "CA"
        : result.assessment_type === "Combined" || result.assessment_type === "Examination")
      && (!options.classId || result.class_id === options.classId)
  );
  const classId = options.classId ?? reportCandidates[0]?.class_id ?? "";
  const scopedResults = reportCandidates.filter((result) => isMatchingPublishedReportResult(result, {
    studentId,
    classId,
    academicYear,
    term,
    reportType,
  }, options.includeUnpublished));

  if (!classId) return null;
  const reportCardRecord = await getReportCardRecord(studentId, academicYear, term, classId, reportType);
  if (scopedResults.length === 0 && !reportCardRecord) return null;

  const classById = new Map(classes.map((item) => [item.id, item]));
  const subjectById = new Map(subjects.map((item) => [item.id, item]));

  const classEntity = classId ? classById.get(classId) : undefined;
  const resultClassName = scopedResults.find((result) => {
    const value = result.class_name?.trim();
    return value && value.toLowerCase() !== "unknown" && value.toLowerCase() !== "unknown class";
  })?.class_name?.trim();
  const className = classEntity?.class_name?.trim() || student.class_name?.trim() || resultClassName || "";
  const classTeacherName = reportCardRecord?.class_teacher_name
    || [classEntity?.class_teacher?.first_name, classEntity?.class_teacher?.last_name].filter(Boolean).join(" ");

  const lines: SubjectReportLine[] = scopedResults
    .map((result) => {
      const subject = result.subject_id ? subjectById.get(result.subject_id) : undefined;
      const automatic = result.calculation_mode === "Automatic"
        && result.assessment_type === "Combined"
        && !isMidterm
        ? calculateResult(result.assessment_type, result.continuous_assessment, result.examination)
        : null;

      return {
        resultId: result.id,
        subjectId: result.subject_id ?? result.subject_name ?? "",
        subjectName: subject?.subject_name ?? result.subject_name ?? "Unknown Subject",
        subjectCode: subject?.subject_code ?? "",
        continuousAssessment: result.continuous_assessment,
        maximumScore: result.maximum_score ?? null,
        examination: isMidterm ? null : result.examination,
        totalScore: automatic ? automatic.total : result.total_score,
        grade: automatic ? automatic.grade : result.grade,
        teacherRemark: automatic ? automatic.remark ?? "" : result.remark ?? "",
        teacherName: result.teacher_name,
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  if (lines.length === 0 && !reportCardRecord) return null;
  const metrics = isMidterm
    ? calculateMidtermMetrics(allResults, studentId, classId, academicYear, term, options.includeUnpublished)
    : calculateEndOfTermMetrics(allResults, studentId, classId, academicYear, term, options.includeUnpublished);

  const [calendar, schoolSettings] = await Promise.all([
    getAcademicCalendarByYear(academicYear),
    getSchoolSettings(),
  ]);
  const termConfig = getCalendarTermConfig(calendar, term as CalendarTerm);
  const attendanceScoped = isMidterm ? [] : attendanceRows.filter((row) => inTermWindow(row.attendance_date, termConfig));
  const present = attendanceScoped.filter((row) => row.status === "Present").length;
  const absent = attendanceScoped.filter((row) => row.status === "Absent").length;

  const attendance = {
    maximumAttendance: reportCardRecord?.maximum_attendance ?? (attendanceScoped.length > 0 ? attendanceScoped.length : null),
    timesPresent: reportCardRecord?.times_present ?? (attendanceScoped.length > 0 ? present : null),
    timesAbsent: reportCardRecord?.times_absent ?? (attendanceScoped.length > 0 ? absent : null),
  };

  const template = resolveTemplateForClass(className, schoolSettings);

  return {
    reportType,
    classId,
    calculationMode: reportCardRecord?.calculation_mode ?? "Manual",
    student,
    schoolSettings,
    className,
    classTeacherName,
    academicYear,
    term,
    termEnding: reportCardRecord?.term_ending ?? (isMidterm ? "" : termConfig.termEnding),
    nextTermBegins: reportCardRecord?.next_term_begins ?? (isMidterm ? "" : termConfig.nextTermBegins),
    lines,
    totalMarksObtained: metrics.totalMarksObtained,
    totalMarksObtainable: metrics.totalMarksObtainable,
    studentPercentage: metrics.studentPercentage,
    classAverage: reportCardRecord?.class_average ?? null,
    reportTotalMarksObtained: reportCardRecord?.total_marks_obtained ?? null,
    reportTotalMarksObtainable: reportCardRecord?.total_marks_obtainable ?? null,
    reportStudentPercentage: reportCardRecord?.student_percentage ?? null,
    classTeacherComment: reportCardRecord?.class_teacher_comment ?? reportCardRecord?.teacher_comment ?? "",
    headTeacherComment: reportCardRecord?.head_teacher_comment ?? reportCardRecord?.principal_comment ?? "",
    attendance,
    gradingScale: grandessaGradingScale,
    template,
  };
}

export async function saveReportCardDetails(params: {
  studentId: string;
  academicYear: string;
  term: ReportTerm;
  classId: string;
  reportType: ReportType;
  calculationMode: "Manual" | "Automatic";
  classTeacherName: string;
  classTeacherComment: string;
  headTeacherComment: string;
  classAverage: number | null;
  totalMarksObtained: number | null;
  totalMarksObtainable: number | null;
  studentPercentage: number | null;
  maximumAttendance: number | null;
  timesPresent: number | null;
  timesAbsent: number | null;
  termEnding: string | null;
  nextTermBegins: string | null;
}): Promise<void> {
  const schoolSettings = await getSchoolSettings();
  const { data: existing, error: lookupError } = await supabase
    .from("report_cards")
    .select("id")
    .eq("school_id", schoolSettings.school_id)
    .eq("student_id", params.studentId)
    .eq("class_id", params.classId)
    .eq("academic_year", params.academicYear)
    .eq("term", params.term)
    .eq("report_type", params.reportType)
    .limit(2);
  if (lookupError) throw new Error(`Unable to find the selected report details: ${lookupError.message}`);
  if ((existing?.length ?? 0) > 1) {
    throw new Error("More than one saved report detail record exists for this pupil, class, period and report type.");
  }

  const payload = {
    school_id: schoolSettings.school_id,
    student_id: params.studentId,
    class_id: params.classId,
    academic_year: params.academicYear,
    term: params.term,
    report_type: params.reportType,
    calculation_mode: params.calculationMode,
    class_teacher_name: params.classTeacherName.trim() || null,
    class_teacher_comment: params.classTeacherComment.trim() || null,
    head_teacher_comment: params.headTeacherComment.trim() || null,
    class_average: params.classAverage,
    total_marks_obtained: params.totalMarksObtained,
    total_marks_obtainable: params.totalMarksObtainable,
    student_percentage: params.studentPercentage,
    maximum_attendance: params.maximumAttendance,
    times_present: params.timesPresent,
    times_absent: params.timesAbsent,
    term_ending: params.termEnding?.trim() || null,
    next_term_begins: params.nextTermBegins?.trim() || null,
  };
  const existingId = existing?.[0]?.id as string | undefined;
  if (existingId) {
    const { error } = await supabase.from("report_cards").update(payload).eq("id", existingId);
    if (error) throw error;
    return;
  }

  const { data: terms, error: termError } = await supabase
    .from("terms")
    .select("id, term_name, academic_sessions!inner(session_name)")
    .eq("term_name", toStoredTermName(params.term))
    .eq("academic_sessions.session_name", params.academicYear)
    .limit(2);
  if (termError) throw new Error(`Unable to find the selected report term: ${termError.message}`);
  const termId = resolveReportTermId(
    (terms ?? []) as AcademicTermMatch[],
    params.academicYear,
    params.term,
  );
  const { error } = await supabase.from("report_cards").insert({
    ...payload,
    term_id: termId,
  });
  if (error) throw error;
}

export function normalizeResultInput(
  continuousAssessment: number,
  examination: number
): { total: number; grade: string; remark: string } {
  const total = computeTotal(continuousAssessment, examination);
  const grade = gradeFromTotal(total);
  const remark = remarkFromGrade(grade);
  if (total === null || grade === null || remark === null) {
    throw new Error("Both CA and examination marks are required to calculate a final result.");
  }

  return { total, grade, remark };
}
