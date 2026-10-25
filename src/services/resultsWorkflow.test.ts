import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  getImportScoreWarnings,
  inspectResultWorkbook,
  parseResultWorkbook,
  buildReviewedImportResultValues,
  getImportableResultEntries,
  getImportEntryKey,
  getImportSubjectRowKey,
  getNextUnresolvedImportSubjectIndex,
  getImportReportDateErrors,
  getUnresolvedIncludedResultEntries,
  isImportEntryReady,
  mergeSavedImportReviewDrafts,
  reconcileSavedImportStudentMatches,
  resolveImportStudentMatch,
  resolveImportStudentAssignment,
  resolveExistingResultImportDecision,
  selectCreatedImportStudent,
  updateImportEntryByKey,
  updateImportSubjectByKey,
  resolveSubjectMatch,
  selectResultWorkbookSheet,
  searchImportStudents,
  normalizeImportDate,
  parseImportReviewCursor,
  saveImportEntriesIndependently,
  serializeImportReviewCursor,
  summarizeImportPreview,
} from "./resultImportService";
import { flattenImportedResultUpdates, type SavedReportCard } from "./reportCardService";
import type { ResultImportItem, ResultImportPreviewEntry } from "./resultImportService";
import type { Result } from "../types/result";
import type { Student } from "../types/student";
import type { ReportCardData } from "../types/reportCard";
import { defaultSchoolSettings } from "./schoolSettingsService";
import ReportCardDocument from "../components/reports/ReportCardDocument";
import { calculateResult, transitionAssessmentType, validateAssessmentMarks } from "../utils/resultCalculations";
import { calculateEndOfTermMetrics, calculateMidtermMetrics } from "../utils/reportCalculations";
import { calculateAgeFromDateOfBirth, getReportSummaryValues, isMatchingPublishedReportResult } from "../utils/reportCardPresentation";
import { getResultBatchDraftResume, getSavedResultDrafts, groupSavedResultDrafts } from "../utils/resultDraftRecovery";
import {
  acquireReportPublishLock,
  canDeleteDraftReportPeriod,
  canDeleteReportPeriod,
  canPublishReportCenterPeriod,
  deleteReportPeriodRecords,
  discoverReportCenterPeriods,
  getReportCenterCompleteness,
  getReportCenterPeriodStatus,
  getReportCenterPublishActionState,
  getReportCenterPublishBlockReason,
  getReportPeriodResults,
  publishReportResultsAndVerify,
  unpublishReportResultsAndVerify,
  type ReportCenterPeriod,
} from "../utils/reportCenter";
import { resolveReportTermId, toStoredTermName, type AcademicTermMatch } from "../utils/reportTermResolution";
import { validateAcademicSessionSetup } from "../utils/academicSessionValidation";
import type { AcademicSessionSetup } from "../types/academicSession";
import { parseScoreInput } from "../utils/scoreInput";
import {
  findLatestReportPeriod,
  selectSupplementalPublishedResults,
  isCompletePublishedCombinedResult,
} from "../utils/resultPresentation";
import {
  canAdministratorDeleteResult,
  canAdministratorEditResult,
  canPublishResult,
  getResultPublishBlockReason,
  getResultUnpublishAuditEvidence,
  canTeacherEditResult,
  canTeacherSubmitResult,
  canTransitionResult,
  getResultRoleFlags,
  hasAssessmentCorrectionSinceReturn,
  isTeacherAssignedToResult,
  type ResultAssignment,
} from "../utils/resultPermissions";

const migrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261014000000_results_workflow_and_assessment_types.sql",
  { eager: true, query: "?raw", import: "default" },
);
const resultsMigration = Object.values(migrationFiles)[0] ?? "";
const reportMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261016000000_report_card_details.sql",
  { eager: true, query: "?raw", import: "default" },
);
const reportMigration = Object.values(reportMigrationFiles)[0] ?? "";
const importDraftMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261017000000_result_import_review_drafts.sql",
  { eager: true, query: "?raw", import: "default" },
);
const importDraftMigration = Object.values(importDraftMigrationFiles)[0] ?? "";
const importDraftListingMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261018000000_list_result_import_review_workbooks.sql",
  { eager: true, query: "?raw", import: "default" },
);
const importDraftListingMigration = Object.values(importDraftListingMigrationFiles)[0] ?? "";
const workflowSecurityMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261025123540_restore_workbook_ownership_and_record_rls_20261025.sql",
  { eager: true, query: "?raw", import: "default" },
);
const workflowSecurityMigration = Object.values(workflowSecurityMigrationFiles)[0] ?? "";
const importWorkflowStatusMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261025125614_mark_imported_workbook_entries_20261025.sql",
  { eager: true, query: "?raw", import: "default" },
);
const importWorkflowStatusMigration = Object.values(importWorkflowStatusMigrationFiles)[0] ?? "";
const reportCardDateFixMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261025125245_fix_report_card_import_rpc_date_types_20261025.sql",
  { eager: true, query: "?raw", import: "default" },
);
const reportCardDateFixMigration = Object.values(reportCardDateFixMigrationFiles)[0] ?? "";
const academicSessionMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261015000000_academic_session_term_admin_access.sql",
  { eager: true, query: "?raw", import: "default" },
);
const academicSessionMigration = Object.values(academicSessionMigrationFiles)[0] ?? "";
const publishResultMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261017000001_publish_result_rpc.sql",
  { eager: true, query: "?raw", import: "default" },
);
const publishResultMigration = Object.values(publishResultMigrationFiles)[0] ?? "";
const legacyRepublishMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261018120000_results_audit_backed_legacy_republish.sql",
  { eager: true, query: "?raw", import: "default" },
);
const legacyRepublishMigration = Object.values(legacyRepublishMigrationFiles)[0] ?? "";
const adminRepublishMigrationFiles = import.meta.glob<string>(
  "../../supabase/migrations/20261018160000_allow_admin_republish_without_marks_change.sql",
  { eager: true, query: "?raw", import: "default" },
);
const adminRepublishMigration = Object.values(adminRepublishMigrationFiles)[0] ?? "";
const reportCardServiceFiles = import.meta.glob<string>(
  "./reportCardService.ts",
  { eager: true, query: "?raw", import: "default" },
);
const reportCardService = Object.values(reportCardServiceFiles)[0] ?? "";
const resultServiceFiles = import.meta.glob<string>(
  "./resultService.ts",
  { eager: true, query: "?raw", import: "default" },
);
const resultService = Object.values(resultServiceFiles)[0] ?? "";
const reportCardsPageFiles = import.meta.glob<string>(
  "../pages/admin/results/ReportCardsPage.tsx",
  { eager: true, query: "?raw", import: "default" },
);
const reportCardsPage = Object.values(reportCardsPageFiles)[0] ?? "";
const resultsPageFiles = import.meta.glob<string>(
  "../pages/admin/results/ResultsPage.tsx",
  { eager: true, query: "?raw", import: "default" },
);
const resultsPage = Object.values(resultsPageFiles)[0] ?? "";
const communicationsPageFiles = import.meta.glob<string>(
  "../pages/admin/CommunicationsPage.tsx",
  { eager: true, query: "?raw", import: "default" },
);
const communicationsPage = Object.values(communicationsPageFiles)[0] ?? "";
const sendCommunicationFunctionFiles = import.meta.glob<string>(
  "../../supabase/functions/send-communication/index.ts",
  { eager: true, query: "?raw", import: "default" },
);
const sendCommunicationFunction = Object.values(sendCommunicationFunctionFiles)[0] ?? "";
const resultFormFiles = import.meta.glob<string>(
  "../pages/admin/results/ResultForm.tsx",
  { eager: true, query: "?raw", import: "default" },
);
const resultForm = Object.values(resultFormFiles)[0] ?? "";
const batchEntryFiles = import.meta.glob<string>(
  "../pages/admin/results/ResultBatchEntry.tsx",
  { eager: true, query: "?raw", import: "default" },
);
const batchEntry = Object.values(batchEntryFiles)[0] ?? "";
const groupedResultsFiles = import.meta.glob<string>(
  "../pages/admin/results/ResultTableGrouped.tsx",
  { eager: true, query: "?raw", import: "default" },
);
const groupedResults = Object.values(groupedResultsFiles)[0] ?? "";
const reportCardDocumentFiles = import.meta.glob<string>(
  "../components/reports/ReportCardDocument.tsx",
  { eager: true, query: "?raw", import: "default" },
);
const reportCardDocument = Object.values(reportCardDocumentFiles)[0] ?? "";
const reportCardStyles = readFileSync(resolve("src/styles/report-card.css"), "utf8");
const appModalFiles = import.meta.glob<string>(
  "../components/modals/AppModal.tsx",
  { eager: true, query: "?raw", import: "default" },
);
const appModal = Object.values(appModalFiles)[0] ?? "";
const studentFormFiles = import.meta.glob<string>(
  "../pages/admin/students/StudentForm.tsx",
  { eager: true, query: "?raw", import: "default" },
);
const studentForm = Object.values(studentFormFiles)[0] ?? "";
const assignedPair: ResultAssignment = { class_id: "class-1" };

function student(id: string, name: string, admissionNumber: string, className = ""): Student {
  const [firstName, ...lastName] = name.split(" ");
  return {
    id,
    admission_number: admissionNumber,
    class_name: className,
    first_name: firstName,
    last_name: lastName.join(" "),
    gender: "Female",
    date_of_birth: "",
    admission_date: "",
    status: "Active",
    created_at: "",
    updated_at: "",
  };
}

function result(overrides: Partial<Result> = {}): Result {
  return {
    id: "result-1",
    student_id: "student-1",
    class_id: "class-1",
    subject_id: "subject-1",
    academic_year: "2025/2026",
    term: "Third",
    assessment_type: "Combined",
    continuous_assessment: 30,
    examination: 50,
    total_score: 80,
    grade: "A*",
    remark: "Excellent",
    status: "Draft",
    created_by: "teacher-1",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function reportCard(overrides: Partial<ReportCardData> = {}): ReportCardData {
  return {
    reportType: "Midterm",
    classId: "class-1",
    calculationMode: "Manual",
    student: student("student-1", "Test Pupil", "G-001"),
    schoolSettings: defaultSchoolSettings,
    className: "Basic 1",
    classTeacherName: "Class Teacher",
    academicYear: "2025/2026",
    term: "First",
    termEnding: "",
    nextTermBegins: "",
    lines: [],
    totalMarksObtained: 35,
    totalMarksObtainable: 50,
    studentPercentage: 70,
    classAverage: null,
    reportTotalMarksObtained: null,
    reportTotalMarksObtainable: null,
    reportStudentPercentage: null,
    classTeacherComment: "",
    headTeacherComment: "",
    attendance: { maximumAttendance: null, timesPresent: null, timesAbsent: null },
    gradingScale: [],
    template: { id: "default", name: "Default", level: "Basic", headingText: [], tableLabels: [] },
    ...overrides,
  };
}

function workbookFile(
  secondName = "Unlisted Learner",
  includeSecondAdmission = true,
  marks: { ca: number | null | string; exam: number | null | string; total: number | null | string } = { ca: 30, exam: 55, total: 85 },
  includeSession = true,
  reportHeading = "",
  firstName = "Omolekan Treasure",
  secondAdmission = "K2-UNKNOWN",
): File {
  const rows: unknown[][] = Array.from({ length: 7 }, () => Array<unknown>(16).fill(""));
  rows[0][0] = `NAME OF PUPIL: ${firstName}`;
  rows[0][8] = `NAME OF PUPIL: ${secondName}`;
  rows[0][3] = "CLASS: Kindergarten 2";
  rows[0][11] = "CLASS: Kindergarten 2";
  rows[1][1] = "ADMISSION NO: K2-001";
  rows[1][8] = "CLASS: Kindergarten 2";
  if (includeSecondAdmission) rows[1][9] = `ADMISSION NO: ${secondAdmission}`;
  rows[2][0] = "SUBJECTS";
  rows[2][2] = "CA(40)";
  rows[2][3] = "EXAM";
  rows[2][4] = "TOTAL";
  rows[2][5] = "GRADE";
  rows[2][6] = "REMARK";
  rows[2][8] = "SUBJECTS";
  rows[2][10] = "CA(40)";
  rows[2][11] = "EXAM";
  rows[2][12] = "TOTAL";
  rows[2][13] = "GRADE";
  rows[2][14] = "REMARK";
  rows[3][0] = "Mathematics";
  rows[3][2] = marks.ca;
  rows[3][3] = marks.exam;
  rows[3][4] = marks.total;
  rows[3][5] = "A";
  rows[3][6] = "Source remark";
  rows[3][8] = "Mathematics";
  rows[3][10] = 25;
  rows[3][11] = 50;
  rows[3][12] = 75;
  rows[3][13] = "B";
  rows[3][14] = "Second source remark";
  if (reportHeading) rows[1][5] = reportHeading;
  if (includeSession) rows[4][0] = "SESSION: 2025/2026 THIRD TERM";
  rows[5][0] = "CLASS AVERAGE:";
  rows[5][1] = 72.5;
  rows[5][2] = "MAXIMUM ATTENDANCE:";
  rows[5][3] = 100;
  rows[5][4] = "TIMES PRESENT:";
  rows[5][5] = 91;
  rows[5][6] = "TIMES ABSENT:";
  rows[5][7] = 9;
  rows[6][0] = "TERM ENDING:";
  rows[6][1] = "15 December 2025";
  rows[6][2] = "CLASS TEACHER COMMENT:";
  rows[6][3] = "Source class-teacher comment";
  rows[6][4] = "HEAD TEACHER COMMENT:";
  rows[6][5] = "Source head-teacher comment";
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Kindergarten 2");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new File([buffer], "kindergarten-2.xlsx");
}

const bundledWorkbookPath = resolve(process.cwd(), "..", "client-resources", "report-templates", "GDS_REPORT_ESTHER_-_3RD_TERM2025-2026_xlsx.xlsx");
const actualWorkbookPath = process.env.GRANDESSA_RESULTS_WORKBOOK_FIXTURE
  ?? (existsSync(bundledWorkbookPath) ? bundledWorkbookPath : undefined);
const rosterFixturePath = process.env.GRANDESSA_RESULTS_ROSTER_FIXTURE;

function fixtureRoster(path: string): Student[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed) || parsed.some((entry) =>
    typeof entry !== "object" || entry === null
    || !("id" in entry) || typeof entry.id !== "string"
    || !("first_name" in entry) || typeof entry.first_name !== "string"
    || !("last_name" in entry) || typeof entry.last_name !== "string"
  )) {
    throw new Error("The independent roster fixture must be a JSON array with id, first_name and last_name fields.");
  }

  return parsed.map((entry) => {
    const record = entry as { id: string; first_name: string; last_name: string; admission_number?: string; class_name?: string };
    return student(record.id, `${record.first_name} ${record.last_name}`, record.admission_number ?? "", record.class_name ?? "");
  });

  it.each(["First", "Second", "Third"] as const)("maps the %s UI label to its saved term name", (term) => {
    expect(toStoredTermName(term)).toBe(`${term} Term`);
    expect(resolveReportTermId([{
      id: `${term.toLowerCase()}-id`,
      term_name: `${term} Term`,
      academic_sessions: { session_name: "2025/2026" },
    }], "2025/2026", term)).toBe(`${term.toLowerCase()}-id`);
  });

  it("keeps Midterm, End-of-Term, unpublished, and incomplete rows separate", () => {
    const results = [
      result({ id: "published-final", status: "Published", assessment_type: "Combined", total_score: 70 }),
      result({ id: "published-midterm", status: "Published", assessment_type: "CA", continuous_assessment: 20, maximum_score: 40, examination: null, total_score: null }),
      result({ id: "unpublished-final", status: "Draft", total_score: 95 }),
      result({ id: "incomplete-final", status: "Published", subject_id: "subject-2", total_score: null }),
    ];

    expect(calculateEndOfTermMetrics(results, "student-1", "class-1", "2025/2026", "Third")).toEqual({
      totalMarksObtained: 70,
      totalMarksObtainable: 100,
      studentPercentage: 70,
    });
    expect(calculateMidtermMetrics(results, "student-1", "class-1", "2025/2026", "Third")).toEqual({
      totalMarksObtained: 20,
      totalMarksObtainable: 40,
      studentPercentage: 50,
    });
  });
}

describe("report-card session resolution and presentation", () => {
  it("resolves a term using its actual session-name relationship and reports missing or ambiguous matches", () => {
    const terms: AcademicTermMatch[] = [
      { id: "first-2025", term_name: "First Term", academic_sessions: { session_name: "2025/2026" } },
      { id: "first-2026", term_name: "First Term", academic_sessions: { session_name: "2026/2027" } },
    ];

    expect(resolveReportTermId(terms, "2025/2026", "First")).toBe("first-2025");
    expect(resolveReportTermId([{
      id: "array-joined-session",
      term_name: "First Term",
      academic_sessions: [{ session_name: "2025/2026" }],
    }], "2025/2026", "First")).toBe("array-joined-session");
    expect(() => resolveReportTermId([], "2025/2026", "First")).toThrow(/No First term exists/);
    expect(() => resolveReportTermId([
      ...terms,
      { id: "duplicate", term_name: "First Term", academic_sessions: { session_name: "2025/2026" } },
    ], "2025/2026", "First")).toThrow(/More than one First term/);
  });

  it("validates user-entered session and ordered, non-overlapping term dates", () => {
    const setup: AcademicSessionSetup = {
      sessionId: null,
      sessionName: "2025/2026",
      startDate: "2025-09-01",
      endDate: "2026-07-31",
      isCurrent: true,
      currentTerm: "First",
      terms: [
        { termName: "First", startDate: "2025-09-01", endDate: "2025-12-19" },
        { termName: "Second", startDate: "2026-01-05", endDate: "2026-04-02" },
        { termName: "Third", startDate: "2026-04-20", endDate: "2026-07-31" },
      ],
    };

    expect(validateAcademicSessionSetup(setup)).toBeNull();
    expect(validateAcademicSessionSetup({ ...setup, startDate: "" })).toMatch(/valid session/);
    expect(validateAcademicSessionSetup({
      ...setup,
      terms: [setup.terms[0], { ...setup.terms[1], startDate: "2025-12-01" }, setup.terms[2]],
    })).toMatch(/non-overlapping/);
    expect(validateAcademicSessionSetup({ ...setup, isCurrent: false })).toMatch(/current term/);
  });

  it("uses saved manual report summaries, calculated automatic summaries, and preserves blank values", () => {
    const values = {
      calculationMode: "Manual" as const,
      totalMarksObtained: 35,
      totalMarksObtainable: 50,
      studentPercentage: 70,
      reportTotalMarksObtained: 31,
      reportTotalMarksObtainable: 45,
      reportStudentPercentage: 68.89,
    };
    expect(getReportSummaryValues(values)).toEqual({
      totalMarksObtained: 31,
      totalMarksObtainable: 45,
      studentPercentage: 68.89,
    });
    expect(getReportSummaryValues({
      ...values,
      calculationMode: "Automatic",
    })).toEqual({
      totalMarksObtained: 35,
      totalMarksObtainable: 50,
      studentPercentage: 70,
    });
    expect(getReportSummaryValues({
      ...values,
      reportTotalMarksObtained: null,
      reportTotalMarksObtainable: null,
      reportStudentPercentage: null,
    })).toEqual({
      totalMarksObtained: null,
      totalMarksObtainable: null,
      studentPercentage: null,
    });
  });

  it("keeps parent report eligibility separate for Midterm and End-of-Term assessments", () => {
    const target = { studentId: "student-1", classId: "class-1", academicYear: "2025/2026", term: "First" };
    const publishedCa = result({ status: "Published", assessment_type: "CA", term: "First" });
    const publishedCombined = result({ status: "Published", assessment_type: "Combined", term: "First" });
    const publishedExam = result({ status: "Published", assessment_type: "Examination", term: "First" });

    expect(isMatchingPublishedReportResult(publishedCa, { ...target, reportType: "Midterm" })).toBe(true);
    expect(isMatchingPublishedReportResult(publishedCombined, { ...target, reportType: "Midterm" })).toBe(false);
    expect(isMatchingPublishedReportResult(publishedCa, { ...target, reportType: "End-of-Term" })).toBe(false);
    expect(isMatchingPublishedReportResult(publishedCombined, { ...target, reportType: "End-of-Term" })).toBe(true);
    expect(isMatchingPublishedReportResult(publishedExam, { ...target, reportType: "End-of-Term" })).toBe(true);
    expect(isMatchingPublishedReportResult({ ...publishedCa, status: "Approved" }, { ...target, reportType: "Midterm" })).toBe(false);
    expect(isMatchingPublishedReportResult({ ...publishedCa, class_id: "class-2" }, { ...target, reportType: "Midterm" })).toBe(false);
  });

  it("prints Midterm comments and selected summary values, and calculates age only from a valid birth date", () => {
    const report = reportCard({
      student: { ...student("student-1", "Test Pupil", "G-001"), date_of_birth: "2018-04-10" },
      reportTotalMarksObtained: 28,
      reportTotalMarksObtainable: 40,
      reportStudentPercentage: 70,
      classTeacherComment: "Steady progress",
      headTeacherComment: "Keep it up",
    });
    const markup = renderToStaticMarkup(createElement(ReportCardDocument, { report }));

    expect(markup).toContain("TOTAL MARK OBTAINED");
    expect(markup).toContain("<td>TOTAL MARK OBTAINED</td><td>28</td>");
    expect(markup).toContain("Steady progress");
    expect(markup).toContain("Keep it up");
    expect(markup).toContain("AGE: 8");
    expect(markup).not.toContain("GRADING");
    const automaticMarkup = renderToStaticMarkup(createElement(ReportCardDocument, {
      report: { ...report, calculationMode: "Automatic" },
    }));
    expect(automaticMarkup).toContain("<td>TOTAL MARK OBTAINED</td><td>35</td>");
    expect(automaticMarkup).not.toContain("<td>TOTAL MARK OBTAINED</td><td>28</td>");
    expect(calculateAgeFromDateOfBirth("2018-04-10", new Date("2026-10-16T00:00:00Z"))).toBe(8);
    expect(calculateAgeFromDateOfBirth("not-a-date", new Date("2026-10-16T00:00:00Z"))).toBeNull();
  });
});

describe("result assessment calculations", () => {
  it("preserves multi-digit score text through entry, deletion, and re-entry", () => {
    const edits = ["4", "40", "", "4", "40"].map(parseScoreInput);

    expect(edits.map(({ text, value, valid }) => ({ text, value, valid }))).toEqual([
      { text: "4", value: 4, valid: true },
      { text: "40", value: 40, valid: true },
      { text: "", value: null, valid: true },
      { text: "4", value: 4, valid: true },
      { text: "40", value: 40, valid: true },
    ]);
    expect(parseScoreInput("0")).toMatchObject({ text: "0", value: 0, valid: true });
    expect(parseScoreInput("12.50")).toMatchObject({ text: "12.50", value: 12.5, valid: true });
    expect(parseScoreInput("12.")).toMatchObject({ text: "12.", value: 12, valid: true });
    expect(parseScoreInput("-")).toMatchObject({ text: "-", value: null, valid: false });
  });

  it("wires score form fields to raw text while retaining existing validation and save values", () => {
    expect(resultForm).toContain('type="text"');
    expect(resultForm).toContain('inputMode="decimal"');
    expect(resultForm).toContain("value={scoreInputs.continuous_assessment}");
    expect(resultForm).toContain('updateScoreInput("continuous_assessment", event.target.value)');
    expect(resultForm).toContain("getScoreInputErrors()");
    expect(resultForm).toContain("continuous_assessment: form.assessment_type === \"Examination\" ? null : form.continuous_assessment");
    expect(resultForm).not.toMatch(/Number\(event\.target\.value\)/);
    expect(resultsPage).toContain("scoreInputText: { ...item.scoreInputText, [field]: text }");
    expect(resultsPage).toContain("reportDetailInputText: { ...entry.reportDetailInputText, [field]: value }");
    expect(resultsPage).toContain("parseScoreInput(value)");
    expect(resultsPage).not.toContain("Number(event.target.value)");
  });

  it("does not generate a final grade for CA-only or examination-only scores", () => {
    expect(calculateResult("CA", 30, null)).toEqual({ total: null, grade: null, remark: null });
    expect(calculateResult("Examination", null, 55)).toEqual({ total: null, grade: null, remark: null });
  });

  it("uses the configured scale for complete combined scores", () => {
    expect(calculateResult("Combined", 30, 50)).toEqual({ total: 80, grade: "A*", remark: "Excellent" });
  });

  it.each([
    [79.99, "A"],
    [80, "A*"],
    [70, "A"],
    [69.99, "B"],
    [60, "B"],
    [59.99, "C"],
    [50, "C"],
    [49.99, "D"],
    [40, "D"],
    [39.99, "F"],
  ])("applies the corrected automatic grade band at %s", (total, grade) => {
    expect(calculateResult("Combined", total * 0.4, total * 0.6).grade).toBe(grade);
  });

  it("clears fields that do not belong to the selected assessment type", () => {
    const combined = {
      assessment_type: "Combined" as const,
      continuous_assessment: 30,
      maximum_score: null,
      examination: 55,
      total_score: 85,
      grade: "A",
      remark: "Source remark",
    };
    expect(transitionAssessmentType(combined, "CA")).toEqual({
      ...combined,
      assessment_type: "CA",
      examination: null,
      total_score: null,
      grade: "",
      remark: "",
    });
    expect(transitionAssessmentType(combined, "Examination")).toEqual({
      ...combined,
      assessment_type: "Examination",
      continuous_assessment: null,
      total_score: null,
      grade: "",
      remark: "",
    });
  });

  it("permits incomplete and zero marks while enforcing optional midterm and final score ranges", () => {
    const base = {
      assessment_type: "CA" as const,
      continuous_assessment: null,
      maximum_score: null,
      examination: null,
      total_score: null,
      grade: "",
      remark: "",
    };
    expect(validateAssessmentMarks(base)).toEqual([]);
    expect(validateAssessmentMarks({ ...base, continuous_assessment: 0, maximum_score: 40 })).toEqual([]);
    expect(validateAssessmentMarks({ ...base, continuous_assessment: 40.01, maximum_score: 40 })).toContain(
      "CA score must not exceed its positive maximum score.",
    );
    expect(validateAssessmentMarks({ ...base, assessment_type: "Combined", continuous_assessment: 40, examination: 60 })).toEqual([]);
    expect(validateAssessmentMarks({ ...base, assessment_type: "Combined", continuous_assessment: 40.01, examination: 60 })).toContain(
      "End-of-term CA score cannot exceed 40.",
    );
    expect(calculateResult("Combined", 40.01, 59.99)).toEqual({ total: null, grade: null, remark: null });
  });
});

describe("end-of-term report metrics", () => {
  it("uses published complete final rows without inventing missing-subject totals or class averages", () => {
    const metrics = calculateEndOfTermMetrics([
      result({ id: "target-final", student_id: "student-1", subject_id: "subject-1", status: "Published", total_score: 80 }),
      result({ id: "target-draft", student_id: "student-1", subject_id: "subject-2", status: "Draft", total_score: null }),
      result({ id: "peer-one", student_id: "student-2", subject_id: "subject-1", status: "Published", total_score: 90 }),
      result({ id: "peer-two", student_id: "student-2", subject_id: "subject-2", status: "Published", total_score: 70 }),
    ], "student-1", "class-1", "2025/2026", "Third");

    expect(metrics).toEqual({
      totalMarksObtained: 80,
      totalMarksObtainable: 100,
      studentPercentage: 80,
    });

  });

  describe("midterm report metrics", () => {
    it("uses each published CA maximum and withholds a percentage for incomplete marks", () => {
      const metrics = calculateMidtermMetrics([
        result({ id: "target-mark", assessment_type: "CA", status: "Published", continuous_assessment: 30, maximum_score: 40, examination: null, total_score: null }),
        result({ id: "target-blank", assessment_type: "CA", status: "Published", subject_id: "subject-2", continuous_assessment: null, maximum_score: 20, examination: null, total_score: null }),
        result({ id: "peer-mark", assessment_type: "CA", student_id: "student-2", status: "Published", continuous_assessment: 20, maximum_score: 25, examination: null, total_score: null }),
      ], "student-1", "class-1", "2025/2026", "Third");

      expect(metrics).toEqual({
        totalMarksObtained: 30,
        totalMarksObtainable: 60,
        studentPercentage: null,
      });
    });

    it("preserves a genuine zero midterm score", () => {
      expect(calculateMidtermMetrics([
        result({ assessment_type: "CA", status: "Published", continuous_assessment: 0, maximum_score: 40, examination: null, total_score: null }),
      ], "student-1", "class-1", "2025/2026", "Third")).toMatchObject({
        totalMarksObtained: 0,
        totalMarksObtainable: 40,
        studentPercentage: 0,
      });
    });
  });

  it("returns unavailable metrics rather than inventing a denominator", () => {
    expect(calculateEndOfTermMetrics([], "student-1", "class-1", "2025/2026", "Third")).toEqual({
      totalMarksObtained: null,
      totalMarksObtainable: null,
      studentPercentage: null,
    });
  });
});

describe("Report Center period discovery and readiness", () => {
  it("discovers Midterm CA separately and does not mark missing subject maxima ready to publish", () => {
    const midterm = result({
      id: "trixie-ca",
      student_id: "trixie",
      academic_year: "2025/2026",
      term: "First",
      assessment_type: "CA",
      continuous_assessment: 20,
      maximum_score: null,
      examination: null,
      total_score: null,
      status: "Draft",
    });
    const [period] = discoverReportCenterPeriods([midterm], []);

    expect(period).toMatchObject({ studentId: "trixie", academicYear: "2025/2026", term: "First", reportType: "Midterm" });
    expect(getReportCenterPeriodStatus(period)).toBe("Draft");
    expect(getReportCenterCompleteness(period)).toMatchObject({
      complete: false,
      reason: "One or more Midterm subject maximum scores are missing.",
    });
    expect(canPublishReportCenterPeriod(period)).toBe(false);
  });

  it("makes complete End-of-Term rows publishable only while existing statuses are reviewable", () => {
    const submitted = [
      result({ id: "math", status: "Submitted" }),
      result({ id: "english", subject_id: "subject-2", status: "Submitted", continuous_assessment: 35, examination: 55, total_score: 90 }),
    ];
    const [period] = discoverReportCenterPeriods(submitted, []);

    expect(getReportCenterPeriodStatus(period)).toBe("Ready for review");
    expect(getReportCenterCompleteness(period).complete).toBe(true);
    expect(canPublishReportCenterPeriod(period)).toBe(true);
    expect(canPublishReportCenterPeriod({
      ...period,
      results: submitted.map((row) => ({ ...row, status: "Returned" })),
    })).toBe(false);
  });

  it("keeps saved report details distinct from result publication status", () => {
    const savedReport: SavedReportCard = {
      id: "saved-details",
      student_id: "student-1",
      class_id: "class-1",
      academic_year: "2025/2026",
      term: "Third",
      report_type: "End-of-Term",
    };
    const [period] = discoverReportCenterPeriods([], [savedReport]);
    expect(getReportCenterPeriodStatus(period)).toBe("Saved details only");
    expect(period.savedReport).toEqual(savedReport);
    expect(getReportCenterCompleteness(period).complete).toBe(false);
  });

  it("offers report-period deletion to administrators across all supported statuses only", () => {
    const statuses = ["Draft", "Submitted", "Returned", "Published", "Approved"] as const;
    for (const status of statuses) {
      const [period] = discoverReportCenterPeriods([result({ status })], []);
      expect(canDeleteReportPeriod(period, true), `${status} period`).toBe(true);
      expect(canDeleteReportPeriod(period, false), `${status} non-admin`).toBe(false);
    }
    const [savedDetailsOnly] = discoverReportCenterPeriods([], [{
      id: "saved-details",
      student_id: "student-1",
      class_id: "class-1",
      academic_year: "2025/2026",
      term: "Third",
      report_type: "End-of-Term",
    }]);
    expect(canDeleteReportPeriod(savedDetailsOnly, true)).toBe(true);
    expect(canDeleteReportPeriod({ ...savedDetailsOnly, savedReport: undefined }, true)).toBe(false);
  });

  it("does nothing when report-period deletion is cancelled", async () => {
    const [period] = discoverReportCenterPeriods([
      result({ id: "published-result", status: "Published" }),
    ], [{
      id: "saved-report",
      student_id: "student-1",
      class_id: "class-1",
      academic_year: "2025/2026",
      term: "First",
      report_type: "End-of-Term",
    }]);
    const deleteResultMock = vi.fn(async (id: string) => { void id; });
    const deleteReportMock = vi.fn(async (id: string) => { void id; });

    await expect(deleteReportPeriodRecords(
      period,
      true,
      () => false,
      deleteResultMock,
      deleteReportMock,
    )).resolves.toMatchObject({ cancelled: true, deletedResultIds: [], deletedSavedReport: false });
    expect(deleteResultMock).not.toHaveBeenCalled();
    expect(deleteReportMock).not.toHaveBeenCalled();
  });

  it("deletes only the selected pupil's exact report period and its saved details", async () => {
    const selected = result({
      id: "selected-end-of-term",
      student_id: "student-1",
      class_id: "class-1",
      academic_year: "2025/2026",
      term: "Third",
      assessment_type: "Combined",
      status: "Published",
    });
    const selectedExamination = {
      ...selected,
      id: "selected-examination",
      assessment_type: "Examination" as const,
    };
    const otherPupil = { ...selected, id: "other-pupil", student_id: "student-2" };
    const otherClass = { ...selected, id: "other-class", class_id: "class-2" };
    const otherSession = { ...selected, id: "other-session", academic_year: "2024/2025" };
    const otherTerm = { ...selected, id: "other-term", term: "Second" as const };
    const midterm = { ...selected, id: "midterm", assessment_type: "CA" as const };
    const period = discoverReportCenterPeriods([selected], [{
      id: "selected-report-card",
      student_id: "student-1",
      class_id: "class-1",
      academic_year: "2025/2026",
      term: "Third",
      report_type: "End-of-Term",
    }])[0];
    const exactResults = getReportPeriodResults(period, [
      selected,
      selectedExamination,
      otherPupil,
      otherClass,
      otherSession,
      otherTerm,
      midterm,
    ]);
    const deletedResultIds: string[] = [];
    const deletedReportIds: string[] = [];
    const deleteResultMock = vi.fn(async (id: string) => { deletedResultIds.push(id); });
    const deleteReportMock = vi.fn(async (id: string) => { deletedReportIds.push(id); });

    const outcome = await deleteReportPeriodRecords(
      { ...period, results: exactResults },
      true,
      () => true,
      deleteResultMock,
      deleteReportMock,
    );

    expect(exactResults.map(({ id }) => id)).toEqual(["selected-end-of-term", "selected-examination"]);
    expect(deletedResultIds).toEqual(["selected-end-of-term", "selected-examination"]);
    expect(deletedReportIds).toEqual(["selected-report-card"]);
    expect(outcome).toMatchObject({
      cancelled: false,
      deletedResultIds: ["selected-end-of-term", "selected-examination"],
      failures: [],
      deletedSavedReport: true,
    });
  });

  it("retains saved report details when any subject-result deletion fails", async () => {
    const [period] = discoverReportCenterPeriods([
      result({ id: "delete-ok" }),
      result({ id: "delete-fails", subject_id: "subject-2" }),
    ], [{
      id: "saved-report",
      student_id: "student-1",
      class_id: "class-1",
      academic_year: "2025/2026",
      term: "First",
      report_type: "End-of-Term",
    }]);
    const deleteReportMock = vi.fn(async (id: string) => { void id; });

    const outcome = await deleteReportPeriodRecords(
      period,
      true,
      () => true,
      async (resultId) => {
        if (resultId === "delete-fails") throw new Error("Delete denied.");
      },
      deleteReportMock,
    );

    expect(outcome.deletedResultIds).toEqual(["delete-ok"]);
    expect(outcome.failures).toEqual([{ resultId: "delete-fails", message: "Delete denied." }]);
    expect(outcome.deletedSavedReport).toBe(false);
    expect(deleteReportMock).not.toHaveBeenCalled();
  });

  it("blocks unauthorized report-period deletion before confirmation or database calls", async () => {
    const [period] = discoverReportCenterPeriods([result()], []);
    const confirmMock = vi.fn(() => true);
    const deleteResultMock = vi.fn(async (id: string) => { void id; });

    await expect(deleteReportPeriodRecords(
      period,
      false,
      confirmMock,
      deleteResultMock,
      vi.fn(async (id: string) => { void id; }),
    )).rejects.toThrow("Only an administrator can delete report periods.");
    expect(confirmMock).not.toHaveBeenCalled();
    expect(deleteResultMock).not.toHaveBeenCalled();
  });

  it("confirms the selected report identity, status, and affected count while retaining older delete actions", () => {
    expect(reportCardsPage).toContain("{canDeleteReport ? (");
    expect(reportCardsPage).toContain("Delete Report Card");
    expect(reportCardsPage).toContain("Admission number: ${admissionNumber}");
    expect(reportCardsPage).toContain("Class: ${className}");
    expect(reportCardsPage).toContain("Academic session: ${period.academicYear}");
    expect(reportCardsPage).toContain("Term: ${period.term} Term");
    expect(reportCardsPage).toContain("Report type: ${period.reportType}");
    expect(reportCardsPage).toContain("Current publication status: ${currentStatus}");
    expect(reportCardsPage).toContain("Subject-result records affected: ${currentPeriod.results.length}");
    expect(reportCardsPage).toContain("This permanently deletes the listed subject-result records");
    expect(reportCardsPage).toContain("Existing subject-result audit history is retained.");
    expect(reportCardsPage).toContain("if (outcome.cancelled) return;");
    expect(reportCardsPage).toContain("Delete Draft");
    expect(groupedResults).toContain("<Trash2 size={16} /> Delete");
  });

  it("allows all 12 complete eligible Omolekan-style result rows and blocks a one-subject Midterm against observed class subjects", () => {
    const endOfTermRows = Array.from({ length: 12 }, (_, index) => result({
      id: `end-${index}`,
      student_id: "omolekan",
      class_id: "basic-1",
      class_name: "Basic 1",
      subject_id: `subject-${index}`,
      subject_name: `Subject ${index + 1}`,
      academic_year: "2025/2026",
      term: "Third",
      assessment_type: "Combined",
      calculation_mode: "Manual",
      continuous_assessment: 30,
      examination: 50,
      total_score: 80,
      status: "Draft",
    }));
    const trixieMidterm = result({
      id: "trixie-agriculture",
      student_id: "trixie",
      class_id: "basic-1",
      class_name: "Basic 1",
      subject_id: "subject-agriculture",
      subject_name: "Agriculture",
      academic_year: "2025/2026",
      term: "First",
      assessment_type: "CA",
      continuous_assessment: 20,
      maximum_score: 40,
      examination: null,
      total_score: null,
      status: "Draft",
    });
    const allResults = [...endOfTermRows, trixieMidterm];
    const periods = discoverReportCenterPeriods(allResults, []);
    const omolekanPeriod = periods.find((period) => period.studentId === "omolekan");
    const trixiePeriod = periods.find((period) => period.studentId === "trixie");

    expect(omolekanPeriod?.results).toHaveLength(12);
    expect(getReportCenterCompleteness(omolekanPeriod!, allResults).complete).toBe(true);
    expect(canPublishReportCenterPeriod(omolekanPeriod!, allResults, true)).toBe(true);
    expect(canPublishReportCenterPeriod(omolekanPeriod!, allResults, false)).toBe(false);
    expect(getReportCenterPublishBlockReason(trixiePeriod!, allResults, true))
      .toBe("Missing subject results observed for this class and session: Subject 1, Subject 2, Subject 3, Subject 4, Subject 5, Subject 6, Subject 7, Subject 8, Subject 9, Subject 10, Subject 11, Subject 12.");
    expect(canPublishReportCenterPeriod(trixiePeriod!, allResults, true)).toBe(false);
  });

  it("allows a complete 12-subject Returned period after every subject has an assessment correction", () => {
    const snapshot = ["Combined", 30, 50, 80, null];
    const returnedRows = Array.from({ length: 12 }, (_, index) => result({
      id: `returned-${index}`,
      student_id: "synthetic-pupil",
      class_id: "basic-1",
      class_name: "Basic 1",
      subject_id: `subject-${index}`,
      subject_name: `Subject ${index + 1}`,
      academic_year: "2025/2026",
      term: "Third",
      assessment_type: "Combined",
      continuous_assessment: 31,
      examination: 50,
      total_score: 81,
      status: "Returned",
      published_at: "2026-10-01T00:00:00Z",
      returned_assessment_snapshot: snapshot,
    }));
    const [period] = discoverReportCenterPeriods(returnedRows, []);

    expect(getReportCenterCompleteness(period).complete).toBe(true);
    expect(getResultPublishBlockReason(returnedRows[0], true)).toBe("");
    expect(canPublishReportCenterPeriod(period, returnedRows, true)).toBe(true);
    expect(getReportCenterPublishBlockReason(period, returnedRows, true)).toBe("");
    expect(getReportCenterPublishActionState(period, returnedRows, true)).toEqual({
      visible: true,
      disabled: false,
      reason: "",
    });
    expect(getReportCenterPublishActionState(period, returnedRows, true, true).disabled).toBe(true);
    expect(getReportCenterPublishActionState(period, returnedRows, false).visible).toBe(false);
  });

  it("allows a previously published Returned subject with an unchanged assessment in a complete period", () => {
    const snapshot = ["Combined", 30, 50, 80, null];
    const returnedRows = Array.from({ length: 12 }, (_, index) => result({
      id: `returned-${index}`,
      student_id: "synthetic-pupil",
      class_id: "basic-1",
      class_name: "Basic 1",
      subject_id: `subject-${index}`,
      subject_name: index === 4 ? "Mathematics" : `Subject ${index + 1}`,
      academic_year: "2025/2026",
      term: "Third",
      assessment_type: "Combined",
      continuous_assessment: index === 4 ? 30 : 31,
      examination: 50,
      total_score: index === 4 ? 80 : 81,
      status: "Returned",
      published_at: "2026-10-01T00:00:00Z",
      returned_assessment_snapshot: snapshot,
    }));
    const [period] = discoverReportCenterPeriods(returnedRows, []);
    expect(getReportCenterCompleteness(period).complete).toBe(true);
    expect(canPublishReportCenterPeriod(period, returnedRows, true)).toBe(true);
    expect(getReportCenterPublishBlockReason(period, returnedRows, true)).toBe("");
    expect(getReportCenterPublishActionState(period, returnedRows, true)).toEqual({
      visible: true,
      disabled: false,
      reason: "",
    });
  });

  it("allows audit-verified legacy unpublishes with null timestamps at report-period level", () => {
    const snapshot = ["Combined", 30, 50, 80, null];
    const rows = Array.from({ length: 12 }, (_, index) => result({
      id: `legacy-returned-${index}`,
      student_id: "synthetic-pupil",
      class_id: "basic-1",
      class_name: "Basic 1",
      subject_id: `subject-${index}`,
      subject_name: `Subject ${index + 1}`,
      academic_year: "2025/2026",
      term: "Third",
      status: "Returned",
      published_at: null,
      continuous_assessment: 31,
      total_score: 81,
      returned_assessment_snapshot: snapshot,
    }));
    const evidence = new Map(rows.map((row) => [row.id, "verified" as const]));
    const [period] = discoverReportCenterPeriods(rows, []);

    expect(getReportCenterCompleteness(period).complete).toBe(true);
    expect(getReportCenterPublishBlockReason(period, rows, true, evidence)).toBe("");
    expect(getReportCenterPublishActionState(period, rows, true, false, "", evidence)).toMatchObject({
      visible: true,
      disabled: false,
      reason: "",
    });
  });

  it("keeps the administrator Publish action visible and disabled with its blocker reason", () => {
    expect(reportCardsPage).toContain("{publishAction.visible ? (");
    expect(reportCardsPage).toContain("disabled={publishAction.disabled}");
    expect(reportCardsPage).toContain("getReportCenterPublishActionState(");
    expect(reportCardsPage).toContain("Publishing unavailable: {publishBlockReason}");
  });

  it("surfaces saved workbook reviews in Report Card Publishing and opens the selected draft directly", () => {
    expect(reportCardsPage).toContain("Saved work waiting for review");
    expect(reportCardsPage).toContain("getImportReviewWorkbookSummaries");
    expect(reportCardsPage).toContain("Continue review");
    expect(reportCardsPage).toContain("resumeWorkbook: workbook.workbookKey");
    expect(reportCardsPage).toContain("resumeOwner: workbook.ownerId");
    expect(reportCardsPage).toContain("Pupil matches resolved");
    expect(reportCardsPage).toContain("Saving or reviewing work does not publish it or email parents.");
    expect(resultsPage).toContain('searchParams.get("resumeWorkbook")');
    expect(resultsPage).toContain("handleResumeSavedWorkbook(requestedWorkbookKey, requestedOwnerId)");
    expect(resultsPage).toContain("workbook.ownerId === requestedOwnerId");
    expect(resultsPage).toContain("autoResumeHandled");
    expect(resultsPage).not.toContain("{workbookIdentity.slice(0, 12)}");
  });

  it("keeps result publication email-free and scopes parent notifications to fully published periods", () => {
    expect(reportCardsPage).toContain("Publishing updates online access only. It does not send emails");
    expect(reportCardsPage).not.toContain("sendCommunication(");
    expect(communicationsPage).toContain('value: "parents_published_results"');
    expect(communicationsPage).toContain("Published report period");
    expect(communicationsPage).toContain("previewCommunication(target)");
    expect(communicationsPage).toContain("confirmMassSend");
    expect(sendCommunicationFunction).toContain('type Audience = "parents" | "parents_published_results"');
    expect(sendCommunicationFunction).toContain("getFullyPublishedStudentResultGroups");
    expect(sendCommunicationFunction).toContain('group.rows.every((result) => result.status === "Published")');
    expect(sendCommunicationFunction).toContain("directory.parentLinks");
    expect(sendCommunicationFunction).toContain("contactCandidates(directory, eligibleStudents)");
    expect(sendCommunicationFunction).toContain("published_results_periods: getPublishedResultsPeriods(directory)");
    expect(sendCommunicationFunction).toContain("There are no fully published results for that period.");
  });

  it("uses audit-verified unpublish evidence in both the lifecycle trigger and review RPC", () => {
    expect(legacyRepublishMigration).toContain("public.has_verified_result_unpublish_history");
    expect(legacyRepublishMigration).toContain("audit.old_record ->> 'status' = 'Published'");
    expect(legacyRepublishMigration).toContain("audit.new_record ->> 'status' = 'Returned'");
    expect(legacyRepublishMigration).toContain("public.has_verified_result_unpublish_history(old.id, old.returned_assessment_snapshot)");
    expect(legacyRepublishMigration).toContain("public.has_verified_result_unpublish_history(target.id, target.returned_assessment_snapshot)");
    expect(legacyRepublishMigration).toContain("old.published_at is not null");
    expect(legacyRepublishMigration).toContain("target.published_at is not null");
    expect(legacyRepublishMigration).toContain(
      "A returned result must have verified publication history and a valid snapshot; assessment values must be corrected unless verified legacy history confirms a missing publication timestamp.",
    );
  });

  it("loads scoped Returned audit evidence and fails closed when the lookup fails", () => {
    expect(resultService).toContain('.from("result_change_log")');
    expect(resultService).toContain('.select("result_id, action, old_record, new_record")');
    expect(resultService).not.toContain('.eq("action", "UPDATE")');
    expect(resultService).toContain('.in("result_id", candidates.map((result) => result.id))');
    expect(reportCardsPage).toContain("getResultPublicationEvidence(candidates)");
    expect(reportCardsPage).toContain("setPublicationEvidenceError");
    expect(reportCardsPage).toContain("function getPublicationEvidenceErrorForPeriod(period: ReportCenterPeriod): string");
    expect(reportCardsPage).toContain("const publishBlockReason = getPublicationEvidenceErrorForPeriod(period)");
    expect(reportCardsPage).toContain("|| getReportCenterPublishBlockReason");
  });

  it("reports successful publication only after the refreshed saved statuses are Published", async () => {
    const pending = [result({ id: "publish-1" }), result({ id: "publish-2", subject_id: "subject-2" })];
    const calls: string[] = [];
    const outcome = await publishReportResultsAndVerify(
      pending,
      async (resultId) => { calls.push(resultId); },
      async () => pending.map((row) => ({ ...row, status: "Published" })),
    );

    expect(calls).toEqual(["publish-1", "publish-2"]);
    expect(outcome.refreshedResults?.map((row) => row.status)).toEqual(["Published", "Published"]);
    expect(outcome.publishedResultIds).toEqual(["publish-1", "publish-2"]);
    expect(outcome.failures).toEqual([]);
    expect(outcome.verificationError).toBeNull();
  });

  it("surfaces RPC errors and rejects a void success whose refreshed status is unchanged", async () => {
    const pending = [result({ id: "rpc-error" }), result({ id: "no-change", subject_id: "subject-2" })];
    const outcome = await publishReportResultsAndVerify(
      pending,
      async (resultId) => {
        if (resultId === "rpc-error") throw new Error("Not authorized");
      },
      async () => pending,
    );

    expect(outcome.publishedResultIds).toEqual([]);
    expect(outcome.failures).toEqual([
      { resultId: "rpc-error", message: "Not authorized" },
      { resultId: "no-change", message: "The publish request returned without an error, but the saved status is Draft." },
    ]);
  });

  it("reports partial success from saved statuses and keeps failed result details", async () => {
    const pending = [result({ id: "published" }), result({ id: "failed", subject_id: "subject-2" })];
    const outcome = await publishReportResultsAndVerify(
      pending,
      async (resultId) => {
        if (resultId === "failed") throw new Error("Database rejected the transition.");
      },
      async () => [
        { ...pending[0], status: "Published" },
        pending[1],
      ],
    );

    expect(outcome.publishedResultIds).toEqual(["published"]);
    expect(outcome.failures).toEqual([{ resultId: "failed", message: "Database rejected the transition." }]);
  });

  it("blocks retry when the saved-status verification request itself fails", async () => {
    const pending = [result({ id: "uncertain" })];
    const outcome = await publishReportResultsAndVerify(
      pending,
      async () => {},
      async () => { throw new Error("Network unavailable"); },
    );

    expect(outcome.refreshedResults).toBeNull();
    expect(outcome.publishedResultIds).toEqual([]);
    expect(outcome.verificationError).toBe("Network unavailable");
    expect(outcome.failures).toEqual([{ resultId: "uncertain", message: "The saved status could not be verified." }]);
  });

  it("unpublishes report subjects through the authorized callback and verifies Returned statuses", async () => {
    const published = [result({ id: "published-1", status: "Published" }), result({ id: "published-2", status: "Published", subject_id: "subject-2" })];
    const calls: Array<[string, string | undefined]> = [];
    const outcome = await unpublishReportResultsAndVerify(
      published,
      async (resultId, reason) => { calls.push([resultId, reason]); },
      async () => published.map((row) => ({ ...row, status: "Returned" })),
      "Correction required",
    );

    expect(calls).toEqual([
      ["published-1", "Correction required"],
      ["published-2", "Correction required"],
    ]);
    expect(outcome.returnedResultIds).toEqual(["published-1", "published-2"]);
    expect(outcome.failures).toEqual([]);
    expect(outcome.verificationError).toBeNull();
  });

  it("reports unpublish RPC failures and refuses to claim success when refresh fails", async () => {
    const published = [result({ id: "rpc-error", status: "Published" })];
    const failedRpc = await unpublishReportResultsAndVerify(
      published,
      async () => { throw new Error("Not authorized"); },
      async () => published,
    );
    expect(failedRpc.returnedResultIds).toEqual([]);
    expect(failedRpc.failures).toEqual([{ resultId: "rpc-error", message: "Not authorized" }]);

    const failedRefresh = await unpublishReportResultsAndVerify(
      published,
      async () => {},
      async () => { throw new Error("Network unavailable"); },
    );
    expect(failedRefresh.refreshedResults).toBeNull();
    expect(failedRefresh.verificationError).toBe("Network unavailable");
  });

  it("allows period deletion only for administrator-owned all-Draft results", () => {
    const draftPeriod: ReportCenterPeriod = {
      key: "pupil|class|2025/2026|First|End-of-Term",
      studentId: "pupil",
      classId: "class",
      academicYear: "2025/2026",
      term: "First",
      reportType: "End-of-Term",
      results: [result({ status: "Draft" }), result({ id: "draft-2", status: "Draft", subject_id: "subject-2" })],
    };
    expect(canDeleteDraftReportPeriod(draftPeriod, true)).toBe(true);
    expect(canDeleteDraftReportPeriod(draftPeriod, false)).toBe(false);
    expect(canDeleteDraftReportPeriod({ ...draftPeriod, results: [{ ...draftPeriod.results[0], status: "Published" }] }, true)).toBe(false);
    expect(canDeleteDraftReportPeriod({ ...draftPeriod, results: [] }, true)).toBe(false);
  });

  it("prevents duplicate publish submissions while a period is in flight", () => {
    const inFlight = new Set<string>();
    const release = acquireReportPublishLock(inFlight, "period-1");
    expect(release).toBeTypeOf("function");
    expect(acquireReportPublishLock(inFlight, "period-1")).toBeNull();
    release?.();
    expect(acquireReportPublishLock(inFlight, "period-1")).toBeTypeOf("function");
  });
});

describe("Add Results saved draft recovery", () => {
  it("lists saved Draft result rows and restores the selected student's exact assessment fields", () => {
    const savedDraft = result({
      id: "trixie-agriculture-ca",
      student_id: "trixie-id",
      class_id: "basic-1",
      class_name: "Basic 1",
      subject_id: "agriculture-id",
      subject_name: "Agriculture",
      academic_year: "2025/2026",
      term: "First",
      assessment_type: "CA",
      calculation_mode: "Manual",
      continuous_assessment: 20,
      maximum_score: 40,
      examination: null,
      total_score: null,
      grade: null,
      remark: null,
      status: "Draft",
      created_at: "2026-10-17T10:00:00Z",
    });
    const submitted = result({ id: "submitted", status: "Submitted" });

    expect(getSavedResultDrafts([submitted, savedDraft])).toEqual([savedDraft]);
    expect(getResultBatchDraftResume(savedDraft)).toEqual({
      studentId: "trixie-id",
      academicYear: "2025/2026",
      term: "First",
      reportType: "Midterm",
      calculationMode: "Manual",
      subjectId: "agriculture-id",
      entry: {
        continuousAssessment: "20",
        examination: "",
        totalScore: "",
        grade: "",
        remark: "",
        maximumScore: "40",
        dirty: false,
      },
    });
  });

  it("does not treat workbook review objects as database result drafts", () => {
    const savedDraft = result({ id: "saved-result", status: "Draft" });
    expect(getSavedResultDrafts([savedDraft])).toEqual([savedDraft]);
  });

  it("groups saved subject drafts without merging pupil periods or Midterm and End-of-Term records", () => {
    const math = result({ id: "math-draft", student_id: "pupil-1", subject_id: "math", assessment_type: "CA", term: "First" });
    const english = result({ id: "english-draft", student_id: "pupil-1", subject_id: "english", assessment_type: "CA", term: "First" });
    const endOfTerm = result({ id: "combined-draft", student_id: "pupil-1", subject_id: "math", assessment_type: "Combined", term: "First" });
    const otherTerm = result({ id: "next-term-draft", student_id: "pupil-1", subject_id: "math", assessment_type: "CA", term: "Second" });
    const groups = groupSavedResultDrafts([math, english, endOfTerm, otherTerm]);

    expect(groups).toHaveLength(3);
    expect(groups.find((group) => group.assessmentType === "CA" && group.term === "First")?.results.map((row) => row.id))
      .toEqual(["math-draft", "english-draft"]);
    expect(groups.map((group) => group.results.map((row) => row.id)).flat())
      .toEqual(["math-draft", "english-draft", "combined-draft", "next-term-draft"]);
    expect(resultsPage).toContain("Saved Result Drafts");
    expect(resultsPage).toContain("Resume in Add Results");
    expect(resultsPage).toContain("Saved Workbook Drafts");
    expect(resultsPage).toContain("The stored result row does not identify whether it originated from manual entry or an import");
    expect(resultsPage).not.toContain('role="tablist"');
  });

  it("keeps workbook recovery separate from grouped database result drafts", () => {
    const resultDraft = result({ id: "database-result", status: "Draft" });
    expect(groupSavedResultDrafts([resultDraft]).flatMap((group) => group.results.map((row) => row.id)))
      .toEqual(["database-result"]);
    expect(resultsPage).toContain("Saved Workbook Drafts");
    expect(resultsPage).toContain("getImportReviewDrafts(selected.workbookKey, selected.ownerId)");
    expect(resultsPage).toContain("Resume saved draft");
    expect(resultsPage).not.toContain('role="tablist"');
  });
});

describe("result workbook import preview", () => {
  const actualWorkbookTest = actualWorkbookPath && rosterFixturePath ? it : it.skip;
  const availableWorkbookTest = actualWorkbookPath ? it : it.skip;

  actualWorkbookTest("parses each student block in the school's workbook without losing unresolved identities", async () => {
    const workbookBuffer = readFileSync(actualWorkbookPath!);
    const roster = fixtureRoster(rosterFixturePath!);
    const preview = await parseResultWorkbook(
      new File([new Uint8Array(workbookBuffer)], "school-report-workbook.xlsx"),
      roster,
    );
    const summary = summarizeImportPreview(preview);

    expect(preview).toHaveLength(4);
    expect(summary.totalStudents).toBe(4);
    const omolekan = roster.filter((candidate) =>
      `${candidate.first_name} ${candidate.last_name}`.toLowerCase().replace(/[^a-z0-9]/g, "") === "omolekan treasure".replace(/[^a-z0-9]/g, ""),
    );
    expect(omolekan).toHaveLength(1);
    expect(preview.some((entry) => entry.selectedStudentId === omolekan[0].id && entry.matchStatus === "matched")).toBe(true);
    expect(preview.filter((entry) => entry.matchStatus !== "matched").every((entry) => !entry.selectedStudentId)).toBe(true);
    expect(preview.every((entry) => entry.term === "Third")).toBe(true);
    expect(preview.some((entry) => entry.className === "KINDERGARTEN 2")).toBe(true);
    expect(preview.some((entry) => entry.studentName === "OMOLEKAN TREASURE")).toBe(true);
  }, 20_000);

  availableWorkbookTest("selects the heading-matched sheet and parses only its four named third-term cards", async () => {
    const file = new File([new Uint8Array(readFileSync(actualWorkbookPath!))], "report.xlsx");
    const sheets = await inspectResultWorkbook(file);
    expect(sheets.map(({ name, academicYear, term, terms }) => ({ name, academicYear, term, terms }))).toEqual([
      { name: "Sheet1", academicYear: "2025/2026", term: "First", terms: ["First", "Second", "Third"] },
      { name: "Sheet2", academicYear: "2025/2026", term: "Third", terms: ["Third"] },
    ]);
    expect(sheets[0].studentBlockCount).toBeGreaterThan(19);
    expect(sheets[1].studentBlockCount).toBe(4);
    expect(selectResultWorkbookSheet(sheets, "2025/2026", "Third")).toBe("Sheet2");
    expect(selectResultWorkbookSheet(sheets, "2025/2026", "First")).toBe("Sheet1");
    expect(selectResultWorkbookSheet(sheets, "2025/2026", "Second")).toBe("Sheet1");

    const autoSelected = await parseResultWorkbook(file, []);
    expect(autoSelected).toHaveLength(4);
    expect(autoSelected.every((entry) => entry.term === "Third")).toBe(true);
    expect(summarizeImportPreview(autoSelected).duplicateRecords).toBe(0);

    const thirdTerm = await parseResultWorkbook(file, [], "Unclear", "Sheet2");
    expect(thirdTerm.map((entry) => entry.studentName)).toEqual([
      "OMOLEKAN TREASURE",
      "FORSON DORCAS",
      "TRIXIE ADETIREWA OLADUNJOYE",
      "FAHEEM BALOGUN",
    ]);
    expect(thirdTerm.every((entry) => entry.term === "Third")).toBe(true);
    const importedSubjectNames = thirdTerm.flatMap((entry) => entry.items.map((item) => item.subjectName));
    expect(importedSubjectNames).not.toContain("STUDENT PERCENTAGE");
    expect(importedSubjectNames).not.toContain("COUNTING");
    expect(importedSubjectNames).not.toContain("WRITING");
    expect(thirdTerm[0].reportDetails).toMatchObject({
      age: "5+",
      totalMarksObtained: 1133,
      totalMarksObtainable: 1200,
      studentPercentage: 94.4166666666667,
    });
    expect(thirdTerm.map((entry) => entry.items[0])).toEqual(expect.arrayContaining([
      expect.objectContaining({ subjectName: "NUMERACY RECOGNITION", continuousAssessment: 38, examination: 55, totalScore: 93, grade: "A*", remark: "EXCELLENT" }),
      expect.objectContaining({ subjectName: "NUMERACY RECOGNITION", continuousAssessment: 40, examination: 60, totalScore: 100, grade: "A*", remark: null }),
      expect.objectContaining({ subjectName: "NUMERACY RECOGNITION", continuousAssessment: 40, examination: 60, totalScore: 100, grade: "A*", remark: "EXCELLENT" }),
      expect.objectContaining({ subjectName: "NUMERACY RECOGNITION", continuousAssessment: 40, examination: 54, totalScore: 94, grade: "A*", remark: "EXCELLENT" }),
    ]));

    const firstTerm = await parseResultWorkbook(file, [], "Unclear", "Sheet1");
    expect(firstTerm).toHaveLength(19);
    expect(firstTerm.every((entry) => entry.term === "First")).toBe(true);
    expect(firstTerm.some((entry) => entry.studentName === "ABDULMUMEEN ONASANYA")).toBe(true);
    const secondTerm = await parseResultWorkbook(file, [], "Unclear", "Sheet1", "Second");
    expect(secondTerm.length).toBeGreaterThan(0);
    expect(secondTerm.every((entry) => entry.term === "Second")).toBe(true);
  }, 20_000);

  it("keeps side-by-side student blocks and their scores attached to the correct admission number", async () => {
    const preview = await parseResultWorkbook(
      workbookFile("Unlisted Learner", true, { ca: 30, exam: 55, total: 84 }),
      [student("student-1", "Omolekan Treasure", "K2-001")],
    );

    expect(preview).toHaveLength(2);
    expect(preview[0]).toMatchObject({
      studentName: "Omolekan Treasure",
      admissionNumber: "K2-001",
      matchStatus: "matched",
      selectedStudentId: "student-1",
    });
    expect(preview[0].items[0]).toMatchObject({
      subjectName: "Mathematics",
      continuousAssessment: 30,
      examination: 55,
      totalScore: 84,
      grade: "A",
      remark: "Source remark",
      assessmentType: "Combined",
    });
    expect(preview[0].notices.join(" ")).toContain("entered grade A differs from the configured scale suggestion (A*)");
    expect(preview[0].notices.join(" ")).toContain("these figures add up to 85, while the entered total is 84");
    expect(preview[0].items[0].totalScore).toBe(84);
    expect(preview[1]).toMatchObject({ studentName: "Unlisted Learner", matchStatus: "unmatched" });
    expect(preview[1].selectedStudentId).toBeUndefined();
  });

  it("parses editable report-level class-average and attendance values", async () => {
    const preview = await parseResultWorkbook(
      workbookFile("Unlisted Learner"),
      [student("student-1", "Omolekan Treasure", "K2-001")],
    );
    expect(preview[0].reportDetails).toMatchObject({
      classAverage: 72.5,
      maximumAttendance: 100,
      timesPresent: 91,
      timesAbsent: 9,
      termEnding: "15 December 2025",
      classTeacherComment: "Source class-teacher comment",
      headTeacherComment: "Source head-teacher comment",
    });
  });

  it("parses CSV files through the advertised workbook import path", async () => {
    const source = XLSX.read(await workbookFile("Unlisted Learner").arrayBuffer(), { type: "array" });
    const csv = XLSX.utils.sheet_to_csv(source.Sheets[source.SheetNames[0]]);
    const preview = await parseResultWorkbook(
      new File([csv], "results.csv", { type: "text/csv" }),
      [student("student-1", "Omolekan Treasure", "K2-001")],
    );
    expect(preview[0].items[0]).toMatchObject({
      subjectName: "Mathematics",
      continuousAssessment: 30,
      examination: 55,
    });
  });

  it("parses legacy XLS files through the advertised workbook import path", async () => {
    const source = XLSX.read(await workbookFile("Unlisted Learner").arrayBuffer(), { type: "array" });
    const xls = XLSX.write(source, { type: "array", bookType: "xls" });
    const preview = await parseResultWorkbook(
      new File([xls], "results.xls"),
      [student("student-1", "Omolekan Treasure", "K2-001")],
    );
    expect(preview[0].items[0]).toMatchObject({
      subjectName: "Mathematics",
      continuousAssessment: 30,
      examination: 55,
    });
  });

  it("defaults matching import rows to skip and requires an explicit existing record to update", () => {
    const existing = result({ id: "existing-result", status: "Draft" });
    expect(resolveExistingResultImportDecision([], existing.id)).toEqual({ action: "create" });
    expect(resolveExistingResultImportDecision([existing])).toEqual({ action: "skip" });
    expect(resolveExistingResultImportDecision([existing], existing.id)).toEqual({ action: "update", result: existing });
    expect(resolveExistingResultImportDecision([existing], "unmatched-id")).toEqual({ action: "skip" });
  });

  it("automatically accepts a unique normalized name match", async () => {
    const preview = await parseResultWorkbook(
      workbookFile("Omolekan Treasure", false),
      [student("student-1", "  OMOLEKAN   TREASURE! ", "K2-001", "Kindergarten 2")],
    );
    const nameOnlyEntry = preview[0];
    expect(nameOnlyEntry?.matchStatus).toBe("matched");
    expect(nameOnlyEntry?.matchedStudentId).toBe("student-1");
    expect(nameOnlyEntry?.selectedStudentId).toBe("student-1");
  });

  it("matches surname-first pupil names safely and keeps class conflicts in manual review", () => {
    const rosterStudent: Student = {
      ...student("student-1", "Jason Oyewumi", "GDS-0010", "Basic 4"),
      first_name: "Jason Ifeoluwanimi",
      middle_name: "Ifeoluwanimi",
      last_name: "Oyewumi",
    };
    const entry: ResultImportPreviewEntry = {
      index: 0,
      studentKey: "pupil-1",
      studentName: "OYEWUMI JASON",
      admissionNumber: "",
      academicYear: "2026/2027",
      term: "First",
      assessmentType: "CA",
      reportKind: "Midterm / Continuous Assessment",
      className: "Basic 4",
      teacherName: "",
      matchStatus: "unmatched",
      included: true,
      warnings: ["No exact admission-number or unique name match found; select the correct student manually."],
      notices: [],
      items: [],
    };

    expect(resolveImportStudentMatch(entry, [rosterStudent])).toMatchObject({
      status: "matched",
      matchedStudentId: "student-1",
    });
    expect(resolveImportStudentMatch({ ...entry, className: "Basic 2" }, [rosterStudent])).toMatchObject({
      status: "manual-review",
      matchedStudentId: "student-1",
    });

    const [safeMatch, classConflict] = reconcileSavedImportStudentMatches(
      [entry, { ...entry, studentKey: "pupil-2", className: "Basic 2" }],
      [rosterStudent],
    );
    expect(safeMatch).toMatchObject({ matchStatus: "matched", selectedStudentId: "student-1" });
    expect(classConflict).toMatchObject({ matchStatus: "manual-review", matchedStudentId: "student-1" });
    expect(classConflict.selectedStudentId).toBeUndefined();
  });

  it("resolves only unambiguous existing subjects through known spelling aliases", () => {
    expect(resolveSubjectMatch([{ subject_name: "Maths" }], "Mathematics")?.subject_name).toBe("Maths");
    expect(resolveSubjectMatch([{ subject_name: "Computer Studies" }], "Computer (ICT)")?.subject_name).toBe("Computer Studies");
    expect(resolveSubjectMatch([
      { subject_name: "ICT" },
      { subject_name: "Computer Studies" },
    ], "Computer ICT")).toBeNull();
    expect(resolveSubjectMatch([{ subject_name: "Biology" }], "Chemistry")).toBeNull();
  });

  it("leaves duplicated names unresolved when class evidence cannot disambiguate them", async () => {
    const preview = await parseResultWorkbook(workbookFile("Omolekan Treasure", false), [
      student("student-1", "Omolekan Treasure", "K2-001"),
      student("student-2", "Omolekan Treasure", "K2-002"),
    ]);
    expect(preview[1].matchStatus).toBe("manual-review");
    expect(preview[1].selectedStudentId).toBeUndefined();
    expect(summarizeImportPreview(preview)).toMatchObject({ unresolvedStudents: 1 });
  });

  it("uses class details to resolve duplicated names and flags conflicting classes", async () => {
    const duplicatedNameRoster = [
      student("student-k2", "Omolekan Treasure", "K2-001", "Kindergarten 2"),
      student("student-k3", "Omolekan Treasure", "K3-001", "Kindergarten 3"),
    ];
    const matching = await parseResultWorkbook(workbookFile("Unlisted Learner", false), duplicatedNameRoster);
    expect(matching[0].selectedStudentId).toBe("student-k2");

    const conflict = await parseResultWorkbook(workbookFile("Unlisted Learner", true), [
      student("student-1", "Omolekan Treasure", "K2-001", "Kindergarten 3"),
    ]);
    expect(conflict[0].matchStatus).toBe("manual-review");
    expect(conflict[0].selectedStudentId).toBeUndefined();
    expect(conflict[0].warnings.join(" ")).toContain("workbook class differs");
  });

  it("requires review when an admission number conflicts with the workbook name", async () => {
    const preview = await parseResultWorkbook(
      workbookFile("Unlisted Learner", true, undefined, true, "", "Different Pupil"),
      [student("student-1", "Omolekan Treasure", "K2-001")],
    );
    expect(preview[0].matchStatus).toBe("manual-review");
    expect(preview[0].matchedStudentId).toBe("student-1");
    expect(preview[0].selectedStudentId).toBeUndefined();
    expect(preview[0].warnings.join(" ")).toContain("Admission number K2-001");
  });

  it("flags duplicate student-subject rows across separate workbook blocks", async () => {
    const preview = await parseResultWorkbook(
      workbookFile("Omolekan Treasure", true, undefined, true, "", "Omolekan Treasure", "K2-001"),
      [student("student-1", "Omolekan Treasure", "K2-001")],
    );
    expect(preview).toHaveLength(2);
    expect(preview.every((entry) => entry.warnings.some((warning) => warning.includes("duplicate workbook result rows")))).toBe(true);
  });

  it("blocks out-of-range marks but keeps workbook total discrepancies as review notices", async () => {
    const preview = await parseResultWorkbook(
      workbookFile("Unlisted Learner", true, { ca: 45, exam: 61, total: 100 }),
      [student("student-1", "Omolekan Treasure", "K2-001")],
    );
    expect(getImportScoreWarnings(preview[0]).join(" ")).toContain("End-of-term CA score cannot exceed 40");
    expect(getImportScoreWarnings(preview[0]).join(" ")).toContain("End-of-term examination score cannot exceed 60");
    expect(preview[0].notices.join(" ")).toContain("entered total is 100");
  });

  it("preserves an entered total and grade when assessment marks are blank", async () => {
    const preview = await parseResultWorkbook(
      workbookFile("Unlisted Learner", true, { ca: null, exam: null, total: 0 }),
      [student("student-1", "Omolekan Treasure", "K2-001")],
    );

    expect(preview[0].items[0]).toMatchObject({
      assessmentType: "Combined",
      continuousAssessment: null,
      examination: null,
      totalScore: 0,
      grade: "A",
      remark: "Source remark",
    });
  });

  it("detects midterm CA and prevents final fields from being imported as CA results", async () => {
    const preview = await parseResultWorkbook(
      workbookFile("Unlisted Learner", true, { ca: 30, exam: null, total: 30 }, true, "MID-TERM CONTINUOUS ASSESSMENT"),
      [student("student-1", "Omolekan Treasure", "K2-001")],
    );

    expect(preview[0].reportKind).toBe("Midterm / Continuous Assessment");
    expect(preview[0].items[0]).toMatchObject({
      assessmentType: "CA",
      continuousAssessment: 30,
      maximumScore: 40,
      examination: null,
      totalScore: null,
      grade: null,
      remark: null,
    });

    expect(preview[0].notices.join(" ")).toContain("CA entries do not retain final totals, grades, or remarks");
    expect(preview[0].warnings.every((warning) => !warning.includes("must be present"))).toBe(true);
  });

  it("distinguishes zero, blank and malformed marks in the preview", async () => {
    const zero = await parseResultWorkbook(workbookFile("Unlisted Learner", true, { ca: 0, exam: 0, total: 0 }), [
      student("student-1", "Omolekan Treasure", "K2-001"),
    ]);
    expect(zero[0].items[0]).toMatchObject({ continuousAssessment: 0, examination: 0, totalScore: 0 });
    expect(getImportScoreWarnings(zero[0])).toEqual([]);

    const malformed = await parseResultWorkbook(workbookFile("Unlisted Learner", true, { ca: "bad", exam: 0, total: 0 }), [
      student("student-1", "Omolekan Treasure", "K2-001"),
    ]);
    expect(getImportScoreWarnings(malformed[0]).join(" ")).toContain("CA mark is not a valid number");
  });

  it("does not default a missing term to First", async () => {
    const preview = await parseResultWorkbook(workbookFile("Unlisted Learner", true, undefined, false), []);
    expect(preview[0].term).toBeNull();
    expect(preview[0].warnings).toContain("Term missing from workbook; select the correct term before importing.");
  });

  it("populates the selected pupil's saved class and its assigned teacher without guessing", () => {
    const assignment = resolveImportStudentAssignment(
      { class_id: "class-1" },
      [{
        id: "class-1",
        class_name: "Basic 1",
        class_teacher_id: "teacher-1",
        class_teacher: { id: "teacher-1", first_name: "Ada", last_name: "Teacher", status: "Active" },
        status: "Active",
        created_at: "",
        updated_at: "",
      }],
    );

    expect(assignment).toEqual({
      classId: "class-1",
      className: "Basic 1",
      teacherId: "teacher-1",
      teacherName: "Ada Teacher",
    });
    expect(resolveImportStudentAssignment({ class_id: null }, [])).toEqual({
      classId: undefined,
      className: "",
      teacherId: undefined,
      teacherName: "",
    });
  });

  it("places selected subject IDs and reviewed marks in the flat save payload", () => {
    const reviewedItem: ResultImportItem = {
      assessmentType: "Combined",
      calculationMode: "Manual",
      reportKind: "End-of-Term / Year Report Card",
      subjectName: "Numeracy",
      subjectId: "old-subject",
      className: "Basic 1",
      classId: "class-1",
      teacherName: "Workbook Teacher",
      academicYear: "2025/2026",
      term: "Third",
      continuousAssessment: 37,
      maximumScore: null,
      examination: 56,
      totalScore: 93,
      workbookTotal: 80,
      grade: "A*",
      remark: "Reviewed remark",
      notices: [],
    };
    const reviewedValues = buildReviewedImportResultValues({
      studentId: "student-1",
      classId: "class-1",
      className: "Basic 1",
      subjectId: "selected-subject",
      subjectName: "Mathematics",
      teacherId: "teacher-1",
      teacherName: "Edited Teacher",
      academicYear: "2025/2026",
      term: "Third",
      item: reviewedItem,
    });
    const [saveUpdate] = flattenImportedResultUpdates([{ id: "result-1", values: reviewedValues }]);

    expect(saveUpdate).toMatchObject({
      id: "result-1",
      student_id: "student-1",
      class_id: "class-1",
      subject_id: "selected-subject",
      teacher_id: "teacher-1",
      teacher_name: "Edited Teacher",
      continuous_assessment: 37,
      examination: 56,
      total_score: 93,
      grade: "A*",
      remark: "Reviewed remark",
    });
    expect(saveUpdate).not.toHaveProperty("values");

    const midtermValues = buildReviewedImportResultValues({
      studentId: "student-1",
      classId: "class-1",
      className: "Basic 1",
      subjectId: "selected-subject",
      subjectName: "Mathematics",
      teacherName: "Edited Teacher",
      academicYear: "2025/2026",
      term: "Third",
      item: {
        ...reviewedItem,
        assessmentType: "CA",
        reportKind: "Midterm / Continuous Assessment",
        continuousAssessment: 27,
        maximumScore: 35,
        examination: 56,
        totalScore: 93,
        grade: "A*",
        remark: "Workbook remark",
      },
    });
    expect(midtermValues).toMatchObject({
      subject_id: "selected-subject",
      continuous_assessment: 27,
      maximum_score: 35,
      examination: null,
      total_score: null,
      grade: null,
      remark: null,
    });
  });

  it("imports one included pupil while three ignored pupils remain unresolved", () => {
    const item: ResultImportItem = {
      assessmentType: "Combined",
      calculationMode: "Manual",
      reportKind: "End-of-Term / Year Report Card",
      subjectName: "Mathematics",
      subjectId: "subject-1",
      className: "Basic 1",
      classId: "class-1",
      teacherName: "Teacher",
      academicYear: "2025/2026",
      term: "Third",
      continuousAssessment: 35,
      maximumScore: null,
      examination: 55,
      totalScore: 90,
      grade: "A*",
      remark: "Excellent",
      notices: [],
    };
    const validEntry: ResultImportPreviewEntry = {
      index: 0,
      studentKey: "included-pupil",
      studentName: "Included Pupil",
      admissionNumber: "G-001",
      academicYear: "2025/2026",
      term: "Third",
      assessmentType: "Combined",
      reportKind: "End-of-Term / Year Report Card",
      className: "Basic 1",
      teacherName: "Teacher",
      matchStatus: "matched",
      selectedStudentId: "student-1",
      included: true,
      warnings: [],
      notices: [],
      items: [item],
    };
    const ignoredEntries = ["ignored-1", "ignored-2", "ignored-3"].map((studentKey, index) => ({
      ...validEntry,
      index: index + 1,
      studentKey,
      studentName: studentKey,
      selectedStudentId: undefined,
      matchStatus: "unmatched" as const,
      included: false,
      warnings: ["Select the correct student before import."],
    }));
    const candidates = [validEntry, ...ignoredEntries];

    expect(getImportableResultEntries(candidates)).toEqual([validEntry]);
    expect(getUnresolvedIncludedResultEntries(candidates)).toEqual([]);
    expect(summarizeImportPreview(candidates)).toMatchObject({
      totalStudents: 4,
      matchedStudents: 1,
      unresolvedStudents: 0,
      ignoredStudents: 3,
    });
  });

  it("keeps pupil and subject selections attached to stable row identities", () => {
      const entries: ResultImportPreviewEntry[] = [
        {
          index: 0,
          studentKey: "sheet-1-row-1",
          studentName: "Pupil One",
          admissionNumber: "G-001",
          academicYear: "2025/2026",
          term: "Third",
          assessmentType: "Combined",
          reportKind: "End-of-Term / Year Report Card",
          className: "Basic 1",
          teacherName: "Teacher",
          matchStatus: "matched",
          selectedStudentId: "student-1",
          included: true,
          warnings: [],
          notices: [],
          reportDetailInputText: { totalMarksObtained: "-" },
          items: [{
            assessmentType: "Combined",
            calculationMode: "Manual",
            reportKind: "End-of-Term / Year Report Card",
            subjectName: "Original subject",
            subjectId: "subject-original",
            className: "Basic 1",
            classId: "class-1",
            teacherName: "Teacher",
            academicYear: "2025/2026",
            term: "Third",
            continuousAssessment: 31,
            maximumScore: null,
            examination: 54,
            totalScore: 85,
            grade: "A",
            remark: "Reviewed remark",
            notices: [],
          }],
        },
        {
          index: 1,
          studentKey: "sheet-1-row-2",
          studentName: "Pupil Two",
          admissionNumber: "G-002",
          academicYear: "2025/2026",
          term: "Third",
          assessmentType: "Combined",
          reportKind: "End-of-Term / Year Report Card",
          className: "Basic 1",
          teacherName: "Teacher",
          matchStatus: "matched",
          selectedStudentId: "student-2",
          included: true,
          warnings: [],
          notices: [],
          items: [{
            assessmentType: "Combined",
            calculationMode: "Manual",
            reportKind: "End-of-Term / Year Report Card",
            subjectName: "Other subject",
            subjectId: "subject-2",
            className: "Basic 1",
            classId: "class-1",
            teacherName: "Teacher",
            academicYear: "2025/2026",
            term: "Third",
            continuousAssessment: 20,
            maximumScore: null,
            examination: 48,
            totalScore: 68,
            grade: "B",
            remark: "Original remark",
            notices: [],
          }],
        },
      ];
      const originalPupilKey = getImportEntryKey(entries[0]);
      const originalSubjectKey = getImportSubjectRowKey(entries[0], 0);
      const selected = updateImportSubjectByKey(entries, originalPupilKey, 0, (item) => ({
        ...item,
        subjectName: "Selected subject",
        subjectId: "subject-selected",
      }));
      const collapsed = updateImportEntryByKey(selected, originalPupilKey, (entry) => ({
        ...entry,
        selectedStudentId: "student-selected",
        included: false,
      }));
      const updated = updateImportEntryByKey(collapsed, originalPupilKey, (entry) => ({
        ...entry,
        included: true,
      }));

      expect(getImportEntryKey(updated[0])).toBe(originalPupilKey);
      expect(getImportSubjectRowKey(updated[0], 0)).toBe(originalSubjectKey);
      expect(updated[0]).toMatchObject({
        selectedStudentId: "student-selected",
        included: true,
        items: [{
          subjectId: "subject-selected",
          continuousAssessment: 31,
          examination: 54,
          totalScore: 85,
          grade: "A",
          remark: "Reviewed remark",
        }],
      });
      expect(updated[1]).toEqual(entries[1]);
      expect(buildReviewedImportResultValues({
        studentId: updated[0].selectedStudentId!,
        classId: updated[0].items[0].classId!,
        className: updated[0].items[0].className,
        subjectId: updated[0].items[0].subjectId!,
        subjectName: updated[0].items[0].subjectName,
        teacherName: updated[0].teacherName,
        academicYear: updated[0].academicYear,
        term: updated[0].term!,
        item: updated[0].items[0],
      })).toMatchObject({
        student_id: "student-selected",
        subject_id: "subject-selected",
    });
  });

  it("searches the existing roster by normalized pupil name and admission number", () => {
    const roster = [
      student("pupil-1", "Omolekan Treasure", "GDS-024"),
      student("pupil-2", "Trixie Green", "GDS-031"),
    ];

    expect(searchImportStudents(roster, " omolekan  treasure ")).toEqual([roster[0]]);
    expect(searchImportStudents(roster, "gds 031")).toEqual([roster[1]]);
    expect(searchImportStudents(roster, "missing pupil")).toEqual([]);
  });

  it("normalizes human report-card dates and rejects invalid calendar dates with field labels", () => {
    expect(normalizeImportDate("14TH SEPTEMBER 2026", "Next term begins")).toEqual({ value: "2026-09-14" });
    expect(normalizeImportDate("1st January 2027", "Term ending")).toEqual({ value: "2027-01-01" });
    expect(normalizeImportDate("2ND Feb 2027", "Term ending")).toEqual({ value: "2027-02-02" });
    expect(normalizeImportDate("3rD March 2027", "Term ending")).toEqual({ value: "2027-03-03" });
    expect(normalizeImportDate("2024-02-29", "Term ending")).toEqual({ value: "2024-02-29" });
    expect(normalizeImportDate("2026-02-29", "Term ending").error).toContain("Term ending");
    expect(normalizeImportDate("31st February 2026", "Term ending").error).toContain("31st February 2026");
    expect(normalizeImportDate("", "Next term begins")).toEqual({ value: null });

    const entry: ResultImportPreviewEntry = {
      index: 0,
      studentKey: "pupil-dates",
      studentName: "Pupil",
      admissionNumber: "",
      academicYear: "2025/2026",
      term: "Third",
      assessmentType: "Combined",
      reportKind: "End-of-Term / Year Report Card",
      className: "Basic 1",
      teacherName: "",
      matchStatus: "matched",
      warnings: [],
      notices: [],
      items: [],
      reportDetails: {
        age: "",
        classAverage: null,
        totalMarksObtained: null,
        totalMarksObtainable: null,
        studentPercentage: null,
        maximumAttendance: null,
        timesPresent: null,
        timesAbsent: null,
        termEnding: "32ND DECEMBER 2026",
        nextTermBegins: "14TH SEPTEMBER 2026",
        classTeacherComment: "",
        headTeacherComment: "",
      },
    };
    expect(getImportReportDateErrors(entry)).toEqual([
      expect.stringContaining("Term ending"),
    ]);
  });

  it("advances subject mapping to the next unresolved row and never marks unresolved work complete", () => {
    const subjectItems: ResultImportPreviewEntry["items"] = [0, 1, 2].map((index) => ({
      assessmentType: "Combined",
      calculationMode: "Manual",
      reportKind: "End-of-Term / Year Report Card",
      subjectName: `Subject ${index}`,
      subjectId: index === 0 ? "subject-1" : undefined,
      className: "Basic 1",
      teacherName: "",
      academicYear: "2025/2026",
      term: "Third",
      continuousAssessment: null,
      maximumScore: null,
      examination: null,
      totalScore: null,
      grade: null,
      remark: null,
      notices: [],
    }));
    expect(getNextUnresolvedImportSubjectIndex(subjectItems, 1)).toBe(2);
    expect(getNextUnresolvedImportSubjectIndex(subjectItems, 2)).toBe(1);
    expect(getNextUnresolvedImportSubjectIndex([subjectItems[0]], 0)).toBeNull();
  });

  it("restores the selected pupil and subject mapping position from a saved cursor", () => {
    const cursor = { entryKey: "pupil-2", subjectRowKey: "pupil-2-subject-3" };
    expect(parseImportReviewCursor(serializeImportReviewCursor(cursor))).toEqual(cursor);
    expect(parseImportReviewCursor("legacy-pupil-key")).toEqual({ entryKey: "legacy-pupil-key" });
    expect(parseImportReviewCursor(null)).toBeNull();
  });

  it("restores a saved pupil's selected records and reviewed marks when the workbook is reopened", () => {
    const parsed: ResultImportPreviewEntry = {
      index: 0,
      studentKey: "Sheet2-1-0-Omolekan",
      studentName: "Omolekan",
      admissionNumber: "",
      academicYear: "2025/2026",
      term: "Third",
      assessmentType: "Combined",
      reportKind: "End-of-Term / Year Report Card",
      className: "",
      teacherName: "",
      matchStatus: "unmatched",
      included: true,
      warnings: [],
      notices: [],
      items: [{
        assessmentType: "Combined",
        calculationMode: "Manual",
        reportKind: "End-of-Term / Year Report Card",
        subjectName: "Mathematics",
        subjectId: undefined,
        className: "",
        teacherName: "",
        academicYear: "2025/2026",
        term: "Third",
        continuousAssessment: 32,
        maximumScore: null,
        examination: 51,
        totalScore: 83,
        grade: "A",
        remark: "Reviewed",
        notices: [],
      }],
    };
    const saved = {
      ...parsed,
      selectedStudentId: "student-omolekan",
      className: "Basic 2",
      teacherName: "Assigned Teacher",
      items: [{
        ...parsed.items[0],
        subjectId: "subject-maths",
        classId: "class-basic-2",
        className: "Basic 2",
        continuousAssessment: 35,
        examination: 54,
        totalScore: 89,
        grade: "A*",
        remark: "Excellent",
      }],
    };

    expect(mergeSavedImportReviewDrafts([parsed], [saved])[0]).toMatchObject({
      selectedStudentId: "student-omolekan",
      className: "Basic 2",
      teacherName: "Assigned Teacher",
      items: [{
        subjectId: "subject-maths",
        classId: "class-basic-2",
        continuousAssessment: 35,
        examination: 54,
        totalScore: 89,
        grade: "A*",
        remark: "Excellent",
      }],
    });
  });

  it("continues pupil-by-pupil saves after one failure and leaves the failed pupil retryable", async () => {
    const entries = ["Omolekan", "Forson", "Trixie"];
    const attempts: string[] = [];
    const firstPass = await saveImportEntriesIndependently(entries, async (name) => {
      attempts.push(name);
      if (name === "Forson") throw new Error("network error");
      return `${name} saved`;
    });

    expect(firstPass.saved.map(({ entry }) => entry)).toEqual(["Omolekan", "Trixie"]);
    expect(firstPass.failed).toEqual([{ entry: "Forson", error: "network error" }]);
    expect(attempts).toEqual(["Omolekan", "Forson", "Trixie"]);

    const retry = await saveImportEntriesIndependently(firstPass.failed.map(({ entry }) => entry), async (name) => `${name} saved`);
    expect(retry.saved).toEqual([{ entry: "Forson", value: "Forson saved" }]);
  });

  it("keeps included unresolved pupils blocked until matched or ignored", () => {
    const unresolved: ResultImportPreviewEntry = {
      index: 0,
      studentKey: "unresolved",
      studentName: "Unknown Pupil",
      admissionNumber: "",
      academicYear: "2025/2026",
      term: "Third",
      assessmentType: "Combined",
      reportKind: "End-of-Term / Year Report Card",
      className: "Basic 1",
      teacherName: "",
      matchStatus: "unmatched",
      included: true,
      warnings: ["Select the correct student before import."],
      notices: [],
      items: [{
        assessmentType: "Combined",
        calculationMode: "Manual",
        reportKind: "End-of-Term / Year Report Card",
        subjectName: "Mathematics",
        subjectId: "subject-1",
        className: "Basic 1",
        classId: "class-1",
        teacherName: "",
        academicYear: "2025/2026",
        term: "Third",
        continuousAssessment: 30,
        maximumScore: null,
        examination: 50,
        totalScore: 80,
        grade: "A*",
        remark: "Excellent",
        notices: [],
      }],
    };

    expect(isImportEntryReady(unresolved)).toBe(false);
    expect(getUnresolvedIncludedResultEntries([unresolved])).toEqual([unresolved]);
    expect(getImportableResultEntries([unresolved])).toEqual([]);
    expect(getUnresolvedIncludedResultEntries([{ ...unresolved, included: false, warnings: [] }])).toEqual([]);
  });

  it("selects the ID returned by Add Student and retains the pupil's reviewed result", () => {
    const draftEntry: ResultImportPreviewEntry = {
      index: 0,
      studentKey: "new-student",
      studentName: "New Student",
      admissionNumber: "G-009",
      academicYear: "2025/2026",
      term: "Third",
      assessmentType: "Combined",
      reportKind: "End-of-Term / Year Report Card",
      className: "Basic 1",
      teacherName: "",
      matchStatus: "unmatched",
      included: true,
      warnings: [],
      notices: [],
      items: [{
        assessmentType: "Combined",
        calculationMode: "Manual",
        reportKind: "End-of-Term / Year Report Card",
        subjectName: "Mathematics",
        subjectId: "subject-1",
        className: "Basic 1",
        classId: "class-1",
        teacherName: "",
        academicYear: "2025/2026",
        term: "Third",
        continuousAssessment: 37,
        maximumScore: null,
        examination: 56,
        totalScore: 93,
        grade: "A*",
        remark: "Excellent",
        notices: [],
      }],
    };
    const savedStudent = student("saved-student-id", "New Student", "G-009", "Basic 1");
    savedStudent.class_id = "class-1";
    const selected = selectCreatedImportStudent(draftEntry, savedStudent, [{
      id: "class-1",
      class_name: "Basic 1",
      class_teacher_id: "teacher-1",
      class_teacher: { id: "teacher-1", first_name: "Ada", last_name: "Teacher", status: "Active" },
      status: "Active",
      created_at: "",
      updated_at: "",
    }]);

    expect(selected.selectedStudentId).toBe("saved-student-id");
    expect(selected.items[0]).toMatchObject({
      subjectId: "subject-1",
      continuousAssessment: 37,
      examination: 56,
      totalScore: 93,
      grade: "A*",
      remark: "Excellent",
    });
    expect(selected.teacherName).toBe("Ada Teacher");
    expect(studentForm).toContain("onSaved?.(savedStudent)");
    expect(resultsPage).toContain("onSaved={handleImportStudentSaved}");
  });

  it("keeps Cancel, Preview and Confirm reachable while pupil cards scroll internally", () => {
    expect(appModal).toContain("const onCloseRef = useRef(onClose)");
    expect(appModal).toContain("onCloseRef.current = onClose");
    expect(appModal).toContain("onCloseRef.current()");
    expect(appModal).toMatch(/useEffect\(\(\) => \{[\s\S]*?previousActiveElement\?\.focus\(\);[\s\S]*?\}, \[open\]\)/);
    expect(resultsPage).toContain('height: "calc(100dvh - 32px)"');
    expect(resultsPage).toContain('position: "sticky"');
    expect(resultsPage).toContain('overflowY: "auto"');
    expect(resultsPage).toContain('id="import-review-pupils"');
    expect(resultsPage).toContain('aria-label="Import review pupils; scroll vertically to review pupils"');
    expect(resultsPage).toContain('tabIndex={0}');
    expect(resultsPage).toContain('overflowY: "auto"');
    expect(resultsPage).toContain('overflowX: "auto"');
    expect(resultsPage).toContain('minWidth: 0');
    expect(resultsPage).toContain('maxWidth: "100%", overflowX: "auto"');
    expect(resultsPage).toContain('onClick={() => document.getElementById("import-review-pupils")?.scrollTo({ top: 0, behavior: "smooth" })}');
    expect(resultsPage).toContain("Continue / Preview");
    expect(resultsPage).toMatch(/>\s*Cancel\s*<\/Button>/);
    expect(resultsPage).toContain("Review ready pupils");
    expect(resultsPage).toContain("Confirm import (");
  });

  it("keeps raw workbook score text in the autosaved import entry and blocks invalid text", () => {
    const entry: ResultImportPreviewEntry = {
      index: 0,
      studentKey: "pupil-1",
      studentName: "Pupil One",
      admissionNumber: "G-001",
      academicYear: "2025/2026",
      term: "First",
      assessmentType: "Combined",
      reportKind: "End-of-Term / Year Report Card",
      className: "Basic 1",
      teacherName: "Teacher",
      matchStatus: "matched",
      selectedStudentId: "student-1",
      included: true,
      warnings: [],
      notices: [],
      reportDetailInputText: { totalMarksObtained: "-" },
      items: [{
        assessmentType: "Combined",
        calculationMode: "Manual",
        reportKind: "End-of-Term / Year Report Card",
        subjectName: "Mathematics",
        className: "Basic 1",
        teacherName: "Teacher",
        academicYear: "2025/2026",
        term: "First",
        continuousAssessment: null,
        maximumScore: null,
        examination: null,
        totalScore: null,
        grade: null,
        remark: null,
        notices: [],
        scoreInputText: { continuousAssessment: "-" },
      }],
    };
    const updated = updateImportSubjectByKey([entry], entry.studentKey, 0, (item) => ({
      ...item,
      scoreInputText: { ...item.scoreInputText, continuousAssessment: "40" },
      continuousAssessment: parseScoreInput("40").value,
    }))[0];

    expect(updated.items[0]).toMatchObject({
      continuousAssessment: 40,
      scoreInputText: { continuousAssessment: "40" },
    });
    expect(getImportScoreWarnings({
      ...updated,
      items: [{ ...updated.items[0], scoreInputText: { continuousAssessment: "-" } }],
    })).toEqual(expect.arrayContaining([
      "Mathematics: CA mark is not a valid number.",
      "Total marks obtained must be a valid number.",
    ]));
  });

  it("collapses ignored pupil cards and retains an Include control", () => {
    expect(resultsPage).toContain('useState<string | null>(null)');
    expect(resultsPage).toMatch(/if \(entry\.included === false\)\s*\{\s*return \([\s\S]*?key=\{getImportEntryKey\(entry\)\}[\s\S]*?\{entry\.studentName \|\| "Unknown pupil"\}[\s\S]*?Ignored[\s\S]*?>\s*Include pupil\s*<\/Button>[\s\S]*?\);\s*\}/);
    expect(resultsPage).toContain("activeImportEntryKey === entry.studentKey");
    expect(resultsPage).toContain('key={getImportSubjectRowKey(entry, itemIndex)}');
  });
});

describe("result lifecycle permissions", () => {
  it("keeps a Parent plus Teacher role combination separate from administrator authority", () => {
    const parentTeacher = getResultRoleFlags(["Parent", "Teacher"]);
    expect(parentTeacher).toEqual({
      isAdministrator: false,
      isTeacher: true,
      isParent: true,
    });
    const assignedDraft = result({ status: "Draft" });
    const submitted = result({ status: "Submitted" });

    expect(canTeacherEditResult(assignedDraft, "teacher-1", [assignedPair])).toBe(true);
    expect(canTeacherSubmitResult(assignedDraft, "teacher-1", [assignedPair])).toBe(true);
    expect(canPublishResult(submitted, parentTeacher.isAdministrator)).toBe(false);
    expect(canTransitionResult(submitted, "return", parentTeacher.isAdministrator)).toBe(false);
    expect(canTransitionResult(result({ status: "Published" }), "unpublish", parentTeacher.isAdministrator)).toBe(false);
    expect(canAdministratorDeleteResult(parentTeacher.isAdministrator)).toBe(false);
  });

  it("keeps administrator powers attached to the administrator role, not globally removed", () => {
    const administrator = getResultRoleFlags(["Administrator"]);
    expect(administrator).toEqual({
      isAdministrator: true,
      isTeacher: false,
      isParent: false,
    });
    expect(canPublishResult(result({ status: "Draft" }), administrator.isAdministrator)).toBe(true);
    expect(canAdministratorDeleteResult(administrator.isAdministrator)).toBe(true);
  });

  it("limits teacher result access to their assigned class and lifecycle status", () => {
    expect(isTeacherAssignedToResult(result(), [assignedPair])).toBe(true);
    expect(isTeacherAssignedToResult(result(), [{ class_id: "class-2" }])).toBe(false);
    expect(canTeacherEditResult(result(), "teacher-1", [assignedPair])).toBe(true);
    expect(canTeacherEditResult(result({ status: "Returned" }), "teacher-1", [assignedPair])).toBe(true);
    expect(canTeacherEditResult(result({ status: "Returned", published_at: "2026-10-01T00:00:00Z" }), "teacher-1", [assignedPair])).toBe(false);
    expect(canTeacherEditResult(result({ status: "Published" }), "teacher-1", [assignedPair])).toBe(false);
    expect(canTeacherEditResult(result({ created_by: "other-teacher" }), "teacher-1", [assignedPair])).toBe(true);
    expect(canTeacherEditResult(result(), "teacher-1", [])).toBe(false);
    expect(canTeacherSubmitResult(result(), "teacher-1", [assignedPair])).toBe(true);
    expect(canTeacherSubmitResult(result({ status: "Returned" }), "teacher-1", [assignedPair])).toBe(true);
    expect(canTeacherSubmitResult(result({ status: "Submitted" }), "teacher-1", [assignedPair])).toBe(false);
  });

  it("blocks administrator editing of published results until they are unpublished", () => {
    expect(canAdministratorEditResult(result({ status: "Draft" }))).toBe(true);
    expect(canAdministratorEditResult(result({ status: "Returned" }))).toBe(true);
    expect(canAdministratorEditResult(result({ status: "Published" }))).toBe(false);
    expect(canAdministratorDeleteResult(true)).toBe(true);
    expect(canAdministratorDeleteResult(false)).toBe(false);
    expect(resultsMigration).toContain("Only an administrator can permanently delete results.");
    expect(resultsMigration).toContain('drop policy if exists "Results teachers delete own drafts"');
    expect(resultsMigration).not.toMatch(/create policy "Results teachers delete own drafts"/);
  });

  it("blocks Published edits in single, batch, and workbook entry paths", () => {
    expect(resultForm).toContain('if (mode === "edit" && result?.status === "Published")');
    expect(batchEntry).toContain('row.matches.some((match) => match.status === "Published")');
    expect(batchEntry).toContain('disabled={existing.status === "Published"}');
    expect(resultsPage).toContain('if (updateTarget?.status === "Published")');
    expect(resultsPage).toContain('(isAdmin && canAdministratorEditResult(candidate))');
  });

  it("keeps explicit unpublish and republish as separate lifecycle actions", () => {
    expect(resultsPage).toContain('window.confirm(`Unpublish the result for');
    expect(resultsPage).toContain('reviewResult(row.id, decision, trimmedReason)');
    expect(resultsPage).toMatch(/>\s*Unpublish\s*<\/Button>/);
    expect(resultForm).toContain('status: mode === "edit" ? result?.status ?? "Draft" : "Draft"');
    expect(resultsPage).toContain('aria-label="Result details; scroll vertically to view all fields"');
    expect(resultsPage).toContain('style={{ height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable" }}');
    expect(canAdministratorEditResult(result({ status: "Returned" }))).toBe(true);
    expect(canAdministratorEditResult(result({ status: "Published" }))).toBe(false);
  });

  it("keeps result grids and report-card tables keyboard-scrollable", () => {
    expect(groupedResults).toContain('aria-expanded={isExpanded}');
    expect(groupedResults).toContain('aria-label="Pupil results; scroll horizontally to view all subject columns"');
    expect(groupedResults).toContain('minWidth: 1050');
    expect(batchEntry).toContain('aria-label="Batch subject results; scroll horizontally to see all columns"');
    expect(batchEntry).toContain('minWidth: 900');
    expect(resultsPage).toContain('aria-label={`Subject mappings for ${entry.studentName}; scroll horizontally to see all columns`}');
    expect(resultsPage).toContain('overflowX: "hidden"');
    expect(reportCardDocument).toContain('role="region"');
    expect(reportCardStyles).toContain('min-width: 620px');
    expect(reportCardStyles).toContain('min-width: 0;');
  });

  it("shows individual-result Delete only when the administrator permission allows it", () => {
    expect(groupedResults).toContain("View Details");
    expect(groupedResults).toContain("Edit Result");
    expect(groupedResults).toContain("{canDelete(row) ? (");
    expect(groupedResults).toContain("<Trash2 size={16} /> Delete");
    expect(groupedResults).toContain("Unpublish");
    expect(groupedResults).toContain("Unpublish this result before editing it.");
    expect(resultsPage).toContain("return Boolean(result && canAdministratorDeleteResult(isAdmin));");
    expect(resultsPage).toContain("if (!result || !canAdministratorDeleteResult(isAdmin))");

    const statuses = ["Draft", "Submitted", "Returned", "Published"] as const;
    for (const status of statuses) {
      expect(canAdministratorDeleteResult(true), `${status} administrator delete permission`).toBe(true);
      expect(canAdministratorDeleteResult(false), `${status} non-administrator delete permission`).toBe(false);
    }
  });

  it("confirms permanent deletion details and targets only the selected subject-result row", () => {
    expect(resultsPage).toContain("Admission number: ${admissionNumber}");
    expect(resultsPage).toContain('studentsMap.get(result.student_id)?.admission_number || "Unavailable"');
    expect(resultsPage).toContain("Pupil: ${row.studentName}");
    expect(resultsPage).toContain("Subject: ${row.subjectName}");
    expect(resultsPage).toContain("Academic year: ${row.academicYear}");
    expect(resultsPage).toContain("Term: ${row.term}");
    expect(resultsPage).toContain("Current status: ${result.status}");
    expect(resultsPage).toContain("Only this subject-result record will be deleted. This deletion is permanent");
    expect(resultsPage).toContain("await deleteResult(row.id);");
  });

  it("allows admins to publish drafts and previously published Returned results without changing marks", () => {
    expect(canAdministratorEditResult(result({ status: "Draft" }))).toBe(true);
    expect(canPublishResult(result({ status: "Draft" }), true)).toBe(true);
    expect(canPublishResult(result({ status: "Draft", created_by: "admin-1" }), true)).toBe(true);
    expect(canPublishResult(result({ status: "Draft" }), false)).toBe(false);
    expect(canPublishResult(result({ status: "Published" }), true)).toBe(false);
    const returnedSnapshot = ["Combined", 30, 50, 80];
    const unchangedUnpublished = Object.assign(
      result({ status: "Returned", published_at: "2026-10-15T10:00:00Z" }),
      { returned_assessment_snapshot: returnedSnapshot },
    );
    const correctedUnpublished = Object.assign(
      result({ status: "Returned", published_at: "2026-10-15T10:00:00Z", examination: 51 }),
      { returned_assessment_snapshot: returnedSnapshot },
    );
    expect(canPublishResult(result({ status: "Returned" }), true)).toBe(false);
    expect(canPublishResult(unchangedUnpublished, true)).toBe(true);
    expect(canPublishResult(correctedUnpublished, true)).toBe(true);

    const unchangedAuditVerified = result({
      status: "Returned",
      published_at: null,
      returned_assessment_snapshot: returnedSnapshot,
    });
    expect(getResultPublishBlockReason(unchangedAuditVerified, true, "verified")).toBe("");
    expect(canPublishResult(unchangedAuditVerified, true, "verified")).toBe(true);
    expect(getResultPublishBlockReason(
      { ...unchangedAuditVerified, returned_assessment_snapshot: null },
      true,
      "verified",
    )).toContain("saved pre-unpublish assessment snapshot is unavailable");
  });

  it("allows a previously published legacy row after audited unpublish and a real assessment correction", () => {
    const snapshot = ["Combined", 30, 50, 80, null];
    const returned = result({
      id: "legacy-unpublished",
      status: "Returned",
      published_at: null,
      continuous_assessment: 31,
      examination: 50,
      total_score: 81,
      returned_assessment_snapshot: snapshot,
    });
    const audit = [{
      result_id: returned.id,
      action: "UPDATE",
      old_record: {
        id: returned.id,
        status: "Published",
        assessment_type: "Combined",
        continuous_assessment: 30,
        examination: 50,
        total_score: 80,
        maximum_score: null,
      },
      new_record: {
        id: returned.id,
        status: "Returned",
        returned_assessment_snapshot: snapshot,
      },
    }];
    const evidence = getResultUnpublishAuditEvidence(returned.id, snapshot, audit);

    expect(evidence).toBe("verified");
    expect(getResultPublishBlockReason(returned, true, evidence)).toBe("");
    expect(canPublishResult(returned, true, evidence)).toBe(true);
    expect(canTransitionResult(returned, "publish", true, undefined, evidence)).toBe(true);
    expect(canTransitionResult(returned, "publish", true)).toBe(false);
  });

  it("keeps never-published Returned results on teacher submission and administrator review", () => {
    const neverPublished = result({ status: "Returned", published_at: null });
    const neverPublishedAudit = [{
      result_id: neverPublished.id,
      action: "INSERT",
      old_record: null,
      new_record: { id: neverPublished.id, status: "Draft" },
    }];
    const evidence = getResultUnpublishAuditEvidence(neverPublished.id, null, neverPublishedAudit);
    const snapshotOnly = result({
      id: "snapshot-is-not-history",
      status: "Returned",
      published_at: null,
      returned_assessment_snapshot: ["Combined", 30, 50, 80, null],
    });
    const neverPublishedWithSnapshot = result({
      id: "never-published-with-snapshot",
      status: "Returned",
      published_at: null,
      returned_assessment_snapshot: ["Combined", 30, 50, 80, null],
    });

    expect(evidence).toBe("never-published");
    expect(getResultPublishBlockReason(neverPublished, true, evidence))
      .toContain("assigned teacher must submit it for administrator review");
    expect(canPublishResult(neverPublished, true, evidence)).toBe(false);
    expect(getResultPublishBlockReason(neverPublishedWithSnapshot, true, "never-published"))
      .toContain("assigned teacher must submit it for administrator review");
    expect(canPublishResult(neverPublishedWithSnapshot, true, "never-published")).toBe(false);
    expect(canTeacherSubmitResult(neverPublished, "teacher-1", [assignedPair])).toBe(true);
    expect(canPublishResult({ ...neverPublishedWithSnapshot, status: "Submitted" }, true)).toBe(true);
    expect(getResultUnpublishAuditEvidence(snapshotOnly.id, snapshotOnly.returned_assessment_snapshot, [])).toBe("unverified");
    expect(getResultPublishBlockReason(snapshotOnly, true, "unverified")).toContain("complete audit trail is unavailable");
    expect(canPublishResult(snapshotOnly, true, "unverified")).toBe(false);
  });

  it("blocks audit transitions whose prior assessment does not match the saved snapshot", () => {
    const snapshot = ["Combined", 30, 50, 80, null];
    const returned = result({ id: "contradictory", status: "Returned", published_at: null, returned_assessment_snapshot: snapshot });
    const evidence = getResultUnpublishAuditEvidence(returned.id, snapshot, [{
      result_id: returned.id,
      action: "UPDATE",
      old_record: { id: returned.id, status: "Published", assessment_type: "Combined", continuous_assessment: 29, examination: 50, total_score: 79, maximum_score: null },
      new_record: { id: returned.id, status: "Returned", returned_assessment_snapshot: snapshot },
    }]);

    expect(evidence).toBe("contradictory");
    expect(getResultPublishBlockReason(returned, true, evidence))
      .toContain("does not substantiate this Returned result's current assessment snapshot");
  });

  it("keeps partial CA and incomplete final calculations free of final fields", () => {
    const caResult = result({
      assessment_type: "CA",
      continuous_assessment: 30,
      examination: null,
      total_score: null,
      grade: null,
      remark: null,
    });
    expect(caResult.total_score).toBeNull();
    expect(caResult.grade).toBeNull();
    expect(caResult.remark).toBeNull();
    expect(calculateResult("Combined", null, 50)).toMatchObject({ total: null, grade: null, remark: null });
    expect(calculateResult("Combined", 30, null)).toMatchObject({ total: null, grade: null, remark: null });
  });

  it("enforces direct admin publishing, reasoned unpublishing, and rejects every other transition", () => {
    const draft = result({ status: "Draft" });
    const published = { ...draft, status: "Published" as const };
    const returned = Object.assign(
      { ...draft, status: "Returned" as const, published_at: "2026-10-15T10:00:00Z" },
      { returned_assessment_snapshot: ["Combined", 30, 50, 80] },
    );
    const correctedReturned = Object.assign(
      { ...returned, continuous_assessment: 31 },
      { returned_assessment_snapshot: ["Combined", 30, 50, 80] },
    );

    expect(canTransitionResult(draft, "publish", true)).toBe(true);
    expect(canTransitionResult(draft, "publish", false)).toBe(false);
    expect(canTransitionResult(published, "publish", true)).toBe(false);
    expect(canTransitionResult(published, "unpublish", true)).toBe(true);
    expect(canTransitionResult(published, "unpublish", true, "Correction needed")).toBe(true);
    expect(canTransitionResult(published, "unpublish", true, " ")).toBe(true);
    expect(canTransitionResult(published, "unpublish", true, "x".repeat(251))).toBe(false);
    expect(canTransitionResult(published, "unpublish", false, "Correction")).toBe(false);
    expect(canTransitionResult(returned, "publish", true)).toBe(true);
    expect(canTransitionResult(returned, "publish", false)).toBe(false);
    expect(canTransitionResult(correctedReturned, "publish", true)).toBe(true);
    expect(canTransitionResult(correctedReturned, "publish", false)).toBe(false);
  });

  it("allows unchanged republishing with saved prior-publication evidence", () => {
    const snapshot = ["Combined", 30, 50, 80];
    const unchanged = Object.assign(
      result({ status: "Returned", published_at: "2026-10-15T10:00:00Z" }),
      { returned_assessment_snapshot: snapshot },
    );
    const remarkOnly = Object.assign(
      result({ status: "Returned", published_at: "2026-10-15T10:00:00Z", remark: "Updated remark" }),
      { returned_assessment_snapshot: snapshot },
    );
    const changedAssessment = Object.assign(
      result({ status: "Returned", published_at: "2026-10-15T10:00:00Z", continuous_assessment: 31 }),
      { returned_assessment_snapshot: snapshot },
    );

    expect(hasAssessmentCorrectionSinceReturn(unchanged)).toBe(false);
    expect(hasAssessmentCorrectionSinceReturn(remarkOnly)).toBe(false);
    expect(hasAssessmentCorrectionSinceReturn(changedAssessment)).toBe(true);
    expect(canPublishResult(unchanged, true)).toBe(true);
    expect(canPublishResult(changedAssessment, true)).toBe(true);
    expect(hasAssessmentCorrectionSinceReturn(result({ status: "Returned" }))).toBe(false);
  });
});

describe("published parent result presentation", () => {
  it("keeps the parent's explicitly selected report type when another type is the only published report", () => {
    const history = [{
      academicYear: "2025/2026",
      entries: [{
        academicYear: "2025/2026",
        term: "Third" as const,
        classId: "class-1",
        className: "Basic 1",
        reportType: "Midterm" as const,
        resultCount: 4,
        publishedCount: 4,
        latestUpdatedAt: "2026-10-01T10:00:00Z",
      }],
    }];

    expect(findLatestReportPeriod(history, "Midterm")?.period.reportType).toBe("Midterm");
    expect(findLatestReportPeriod(history, "End-of-Term")).toBeNull();
  });

  it("separates published CA and incomplete entries from complete report-card results", () => {
    const complete = result({ status: "Published" });
    const caOnly = result({
      id: "ca-result",
      status: "Published",
      assessment_type: "CA",
      continuous_assessment: 22,
      examination: null,
      total_score: null,
      grade: null,
      remark: null,
    });
    const incompleteCombined = result({
      id: "incomplete-result",
      status: "Published",
      examination: null,
      total_score: null,
      grade: null,
      remark: null,
    });

    expect(isCompletePublishedCombinedResult(complete)).toBe(true);
    expect(isCompletePublishedCombinedResult(result({ status: "Published", grade: null, remark: null }))).toBe(true);
    expect(selectSupplementalPublishedResults([complete, caOnly, incompleteCombined], "student-1", "2025/2026", "Third"))
      .toEqual([caOnly, incompleteCombined]);
    expect(selectSupplementalPublishedResults([caOnly], "student-2", "2025/2026", "Third")).toEqual([]);
    expect(selectSupplementalPublishedResults([{ ...caOnly, status: "Draft" }], "student-1", "2025/2026", "Third")).toEqual([]);
    expect(resultsMigration).toMatch(/status in \('Published', 'Approved'\)[\s\S]*?public\.is_parent_linked_student\(student_id\)/);
  });
});

describe("results workflow migration contract", () => {
  it("uses the established class-teacher relation rather than a separate assignment table", () => {
    expect(resultsMigration).toContain("public.users");
    expect(resultsMigration).toContain("public.classes");
    expect(resultsMigration).toContain("references public.users(id)");
    expect(resultsMigration).not.toContain("public.teachers");
    expect(resultsMigration).not.toContain("public.teacher_assignments");
    expect(resultsMigration).not.toMatch(/(?:u|s|c|sub)\.school_id/);
    expect(resultsMigration).toContain("c.class_teacher_id = u.id");
    expect(resultsMigration).toContain("u.status = 'Active'");
    expect(resultsMigration).toContain("lower(replace(role_record.name, ' ', '_')) = 'teacher'");
    expect(resultsMigration).toContain("s.class_id = c.id");
    expect(resultsMigration).toContain("subject_record.id = target_subject_id");
    expect(resultsMigration).not.toContain("is_active_staff_user()");
    expect(resultsMigration).toMatch(/create policy "Results administrators manage"[\s\S]*?public\.is_result_admin_for\(student_id\)/);
    expect(resultsMigration).toMatch(/create policy "Results assigned teachers read"[\s\S]*?public\.is_result_teacher_for\(student_id, class_id, subject_id\)/);
    expect(resultsMigration).toMatch(/create policy "Results teachers insert own drafts"[\s\S]*?created_by = auth\.uid\(\)[\s\S]*?teacher_id = auth\.uid\(\)[\s\S]*?public\.is_result_teacher_for/);
    expect(resultsMigration).toMatch(/create policy "Results teachers update own drafts and returned"[\s\S]*?public\.is_result_teacher_for/);
    expect(resultsMigration).toMatch(/new\.student_id, new\.class_id, new\.subject_id, new\.teacher_id[\s\S]*?old\.student_id, old\.class_id, old\.subject_id, old\.teacher_id/);
  });

  it("adds result columns after checking the live schema and preserves existing result rows", () => {
    expect(resultsMigration.indexOf("add column if not exists class_id uuid"))
      .toBeLessThan(resultsMigration.indexOf("create index if not exists idx_results_class_id"));
    expect(resultsMigration).toContain("add column if not exists assessment_type text,");
    expect(resultsMigration).toContain("alter column assessment_type set not null");
    expect(resultsMigration).toContain("add column if not exists class_name text");
    expect(resultsMigration).toContain("add column if not exists subject_name text");
    expect(resultsMigration).toContain("add column if not exists teacher_name text");
    expect(resultsMigration).toContain("-- Preserve existing rows; never infer assessment type, class, or subject.");
    expect(resultsMigration).toContain("The live results schema differs from the required results contract; review columns before applying this migration.");
    expect(resultsMigration).not.toContain("default 'Combined'");
    expect(resultsMigration).not.toContain("with unique_class_names as");
    expect(resultsMigration).not.toContain("with unique_subject_names as");
    expect(resultsMigration).not.toContain("public.teacher_assignments");
    expect(resultsMigration).toContain("alter column continuous_assessment drop not null");
    expect(resultsMigration).toContain("alter column examination drop not null");
    expect(resultsMigration).toContain("drop constraint if exists results_continuous_assessment_check");
    expect(resultsMigration).toContain("drop constraint if exists results_examination_check");
    expect(resultsMigration).toContain("drop constraint if exists results_total_score_check");
    expect(resultsMigration).toContain("references public.users(id) on delete set null");
  });

  it("declares the submitter variable in submit_result and preserves approved-parent access", () => {
    const reviewFunction = resultsMigration.match(/create or replace function public\.review_result[\s\S]*?\$\$;/)?.[0] ?? "";
    const submitFunction = resultsMigration.match(/create or replace function public\.submit_result[\s\S]*?\$\$;/)?.[0] ?? "";

    expect(reviewFunction).not.toContain("submitter_name");
    expect(submitFunction).toMatch(/declare\s+target public\.results%rowtype;\s+submitter_name text;/);
    expect(submitFunction).toContain("submitted_by_name = submitter_name");
    expect(resultsMigration).toMatch(/create policy "Results parents read published children"[\s\S]*?status in \('Published', 'Approved'\)[\s\S]*?public\.is_parent_linked_student\(student_id\)/);
    expect(resultsMigration).toContain("check (status in ('Draft', 'Submitted', 'Returned', 'Published', 'Approved'))");
    expect(resultsMigration).not.toContain("set status = 'Draft',");
  });

  it("creates a compatible report-card base table before adding saved details", () => {
    expect(reportMigration.indexOf("create table if not exists public.report_cards"))
      .toBeLessThan(reportMigration.indexOf("alter table public.report_cards"));
    expect(reportMigration).toContain("school_id uuid not null references public.school_settings(school_id)");
    expect(reportMigration).toContain("student_id uuid not null references public.students(id)");
    expect(reportMigration).toContain("class_id uuid not null references public.classes(id)");
    expect(reportMigration).toContain("term_id uuid not null references public.terms(id)");
    expect(reportMigration).toContain("academic_year text not null");
    expect(reportMigration).toContain("term text not null");
    expect(reportMigration).not.toContain("public.schools");
    expect(reportMigration).toContain("public.academic_sessions");
    expect(reportMigration).toContain("academic_session_id");
    expect(reportMigration).toContain("term_name");
    expect(reportMigration).toContain("session_name = new.academic_year");
    expect(reportMigration).not.toMatch(/table_name = 'terms' and column_name = '(school_id|academic_year|name)'/);
    expect(reportMigration).toContain("add column if not exists report_type text not null default 'End-of-Term'");
    expect(reportMigration).toContain("add column if not exists calculation_mode text not null default 'Manual'");
    expect(reportMigration).toContain("add column if not exists class_teacher_name text");
    expect(reportMigration).toContain("add column if not exists class_teacher_comment text");
    expect(reportMigration).toContain("add column if not exists head_teacher_comment text");
    expect(reportMigration).toContain("add column if not exists class_average numeric");
    expect(reportMigration).toContain("add column if not exists total_marks_obtained numeric");
    expect(reportMigration).toContain("add column if not exists total_marks_obtainable numeric");
    expect(reportMigration).toContain("add column if not exists student_percentage numeric");
    expect(reportMigration).toContain("add column if not exists maximum_attendance integer");
    expect(reportMigration).toContain("add column if not exists times_present integer");
    expect(reportMigration).toContain("add column if not exists times_absent integer");
    expect(reportMigration).toContain("add column if not exists term_ending text");
    expect(reportMigration).toContain("add column if not exists next_term_begins text");
    expect(reportMigration).toContain("alter column calculation_mode set default 'Manual'");
  });

  it("accepts PostgreSQL varchar metadata for session and term names", () => {
    expect(reportMigration).toMatch(
      /table_name = 'academic_sessions'[\s\S]*?column_name = 'session_name'[\s\S]*?data_type in \('text', 'character varying'\)[\s\S]*?udt_name in \('text', 'varchar'\)/,
    );
    expect(reportMigration).toMatch(
      /table_name = 'terms'[\s\S]*?column_name = 'term_name'[\s\S]*?data_type in \('text', 'character varying'\)[\s\S]*?udt_name in \('text', 'varchar'\)/,
    );
    expect(reportMigration).not.toMatch(/column_name = '(session_name|term_name)' and data_type = 'text'/);
  });

  it("drops only academic-session policies owned by its migration", () => {
    const droppedPolicies = [...academicSessionMigration.matchAll(
      /drop policy if exists "([^"]+)" on public\.(academic_sessions|terms);/g,
    )].map(([, policyName, tableName]) => `${tableName}:${policyName}`);

    expect(droppedPolicies).toEqual([
      "academic_sessions:Academic sessions authenticated read",
      "academic_sessions:Academic sessions administrators manage",
      "terms:Terms authenticated read",
      "terms:Terms administrators manage",
    ]);
    expect(academicSessionMigration).not.toMatch(/from pg_policies/);
    expect(academicSessionMigration).not.toMatch(/execute format\([\s\S]*?drop policy/);
  });

  it("keeps historical report and academic migrations separate from explicit RLS hardening", () => {
    expect(reportMigration).toContain("on public.report_cards(school_id, student_id, class_id, academic_year, term, report_type)");
    expect(reportMigration).toContain("create unique index if not exists uidx_report_cards_period_type");
    expect(reportMigration.indexOf("add column if not exists report_type"))
      .toBeLessThan(reportMigration.indexOf("create unique index if not exists uidx_report_cards_period_type"));
    [
      [resultsMigration, "results"],
      [resultsMigration, "result_change_log"],
      [reportMigration, "report_cards"],
      [academicSessionMigration, "academic_sessions"],
      [academicSessionMigration, "terms"],
    ].forEach(([migration, table]) => {
      expect(migration).not.toMatch(new RegExp(
        `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
        "i",
      ));
    });
    expect(reportMigration).toContain("revoke all on public.report_cards from public, anon, authenticated");
    expect(reportMigration).toContain("grant select, insert, update, delete on public.report_cards to authenticated");
    expect(reportMigration).toContain("create policy \"Report cards administrators manage\"");
    expect(reportMigration).toContain("public.is_assignment_admin()");
    expect(reportMigration).toContain("create policy \"Report cards assigned teachers read\"");
    expect(reportMigration).toContain("create policy \"Report cards assigned teachers insert\"");
    expect(reportMigration).toContain("create policy \"Report cards assigned teachers update\"");
    expect(reportMigration).toContain("c.class_teacher_id = u.id");
    expect(reportMigration).toContain("s.class_id = c.id");
    expect(reportMigration).toContain("create policy \"Report cards parents read published reports\"");
    expect(reportMigration).toContain("public.is_parent_linked_student(target_student_id)");
    expect(reportMigration).toContain("r.status = 'Published'");
    expect(reportMigration).toContain("target_report_type = 'Midterm' and r.assessment_type = 'CA'");
    expect(reportMigration).toContain("target_report_type = 'End-of-Term' and r.assessment_type in ('Combined', 'Examination')");
    expect(reportMigration).toContain("Duplicate report cards exist");
    expect(reportCardService).toMatch(/from\("report_cards"\)[\s\S]*?\.eq\("school_id", schoolSettings\.school_id\)/);
    expect(reportCardService).toContain("school_id: schoolSettings.school_id");
    expect(reportCardService).toContain("academic_sessions!inner(session_name)");
    expect(reportCardService).toContain('.eq("term_name", toStoredTermName(params.term))');
    expect(reportCardService).toContain('.eq("academic_sessions.session_name", params.academicYear)');
    expect(reportCardService).not.toMatch(/\.eq\("(school_id|academic_year)", (schoolSettings\.school_id|params\.academicYear)\)[\s\S]*?\.ilike\("name"/);
    expect(reportCardService.indexOf("resolveReportTermId("))
      .toBeLessThan(reportCardService.indexOf('.from("report_cards").insert'));
    expect(reportCardService).toContain('calculation_mode ?? "Manual"');
    expect(reportCardService).toMatch(/export async function getSavedReportCards[\s\S]*?\.eq\("academic_year", filters\.academicYear\)[\s\S]*?\.eq\("term", filters\.term\)[\s\S]*?\.eq\("report_type", filters\.reportType\)/);
    expect(reportCardService).toMatch(/export async function deleteReportCard[\s\S]*?\.from\("report_cards"\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\("id", id\)/);
    expect(reportCardService).toMatch(/const reportCardRecord = await getReportCardRecord[\s\S]*?if \(scopedResults\.length === 0 && !reportCardRecord\) return null/);
    expect(reportCardService).toContain("if (lines.length === 0 && !reportCardRecord) return null;");
  });

  it("wires discovered report periods to preview, edit, result review, and eligible publication", () => {
    const reviewFunction = resultsMigration.match(/create or replace function public\.review_result[\s\S]*?\$\$;/)?.[0] ?? "";
    const adminReviewFunction = adminRepublishMigration.match(/create or replace function public\.review_result[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(reportCardsPage).toContain("discoverReportCenterPeriods(results, savedReports)");
    expect(reportCardsPage).toContain('aria-label="Search pupil by name or admission number"');
    expect(reportCardsPage).toContain("async function deleteDraftPeriod(period: ReportCenterPeriod)");
    expect(reportCardsPage).toContain("await deleteResult(result.id)");
    expect(reportCardsPage).toContain("await deleteReportCard(period.savedReport.id)");
    expect(reportCardsPage).toContain("Delete all ${period.results.length} draft subject result(s)");
    expect(reportCardsPage).toContain("Preview Report Card");
    expect(reportCardsPage).toContain("Edit Report Card Comments");
    expect(reportCardsPage).toContain("Edit Subject Results");
    expect(reportCardsPage).toContain('onClick={() => void openReportPeriod(period)}');
    expect(reportCardsPage).toContain('onClick={() => void openReportPeriod(period, true)}');
    expect(reportCardsPage).toContain('onClick={() => navigateToResults(period)}');
    expect(reportCardsPage).toContain("getReportCenterPublishBlockReason(period, results, isAdministrator, publicationEvidence)");
    expect(reportCardsPage).toContain("getReportCenterPublishActionState(");
    expect(reportCardsPage).toContain("Publish Report Card");
    expect(reportCardsPage).toContain("Unpublish Report Card");
    expect(reportCardsPage).toContain('period.results.every((result) => result.status === "Published")');
    expect(reportCardsPage).toContain("canDeleteDraftReportPeriod(period, isAdministrator)");
    expect(reportCardsPage).toContain('reviewResult(resultId, "unpublish", note)');
    expect(reportCardsPage).toContain("publishReportResultsAndVerify");
    expect(reportCardsPage).toContain("publishResult,");
    expect(reportCardsPage).not.toContain('reviewResult(resultId, "publish")');
    expect(reportCardsPage).toContain("Verify saved status");
    expect(reportCardsPage).toContain("Verified: published");
    expect(reportCardsPage).toContain("publishVerificationErrors[period.key]");
    expect(adminReviewFunction).toMatch(/security definer[\s\S]*?public\.is_assignment_admin\(\)/);
    expect(adminReviewFunction).toContain("target.published_at is not null");
    expect(adminReviewFunction).toContain("public.has_verified_result_unpublish_history(target.id, target.returned_assessment_snapshot)");
    expect(adminReviewFunction).toContain("jsonb_array_length(target.returned_assessment_snapshot) not in (4, 5)");
    expect(adminReviewFunction).toContain("perform set_config('app.result_action', 'publish', true)");
    expect(adminReviewFunction).toContain("set status = 'Published'");
    expect(adminReviewFunction).toContain("published_by = auth.uid()");
    expect(adminReviewFunction).toContain("published_at = now()");
    expect(publishResultMigration).toContain("revoke all on function public.publish_result(uuid) from public;");
    expect(publishResultMigration).toContain("revoke all on function public.publish_result(uuid) from anon;");
    expect(publishResultMigration).toContain("grant execute on function public.publish_result(uuid) to authenticated");
    expect(reviewFunction).toMatch(/returns void[\s\S]*?if not public\.is_assignment_admin\(\) then[\s\S]*?raise exception 'Only an authorised administrator/);
    expect(reviewFunction).toContain("raise exception 'Result not found.'");
    expect(reviewFunction).toContain("status = 'Published'");
    expect(reportCardsPage).toContain("Class: ${className}\\nSession: ${period.academicYear}\\nTerm: ${period.term}");
    expect(reportCardsPage).toContain("Report-card presentation details have no separate publication status.");
    expect(reportCardsPage).toContain("includeUnpublished: isAdministrator");
    expect(reportCardsPage).toContain("This preview includes unpublished subject results.");
    expect(reportCardsPage).toContain("unpublishVerificationErrors[period.key]");
    expect(reportCardsPage).toContain("Unpublish retry is blocked until status is refreshed.");
    expect(reportCardsPage).toContain("search: student ? `${student.first_name} ${student.last_name}`.trim() : \"\"");
    expect(resultsPage).toContain("searchParams.get(\"session\")");
    expect(resultsPage).toContain("searchParams.get(\"classId\")");
    expect(resultsPage).toContain("searchParams.get(\"reportType\")");
  });

  it("keeps report comments editing separate from the read-only preview", () => {
    expect(reportCardsPage).toContain('title={`Edit Report Card Comments · ${report.student.first_name} ${report.student.last_name}`}');
    expect(reportCardsPage).toContain("Save Changes");
    expect(reportCardsPage).toContain(">Cancel</Button>");
    expect(reportCardsPage).toContain('window.confirm("Discard unsaved report-card detail changes?")');
    expect(reportCardsPage).toContain("if (!report || savingCommentsInFlight.current) return;");
    expect(reportCardsPage).toContain('if (reason === null)');
    expect(reportCardsPage).toContain("setSuccess(`${report.reportType === \"Midterm\" ? \"Midterm\" : \"End-of-Term\"} report details saved");
    expect(reportCardsPage).toContain("setError(err instanceof Error ? err.message : \"Unable to save report comments.\")");
    expect(reportCardsPage).toContain("<ReportCardDocument report={report} />");
  });

  it("saves each imported pupil's results and report details in one database transaction", () => {
    expect(reportCardService).toContain('rpc("save_imported_report_card"');
    expect(reportCardService).toMatch(/target_school_id:\s*schoolSettings\.school_id,[\s\S]*?result_updates:\s*flattenImportedResultUpdates\(params\.updates\),[\s\S]*?result_inserts:\s*params\.inserts,[\s\S]*?report_details:/);
    expect(reportMigration).toMatch(/create or replace function public\.save_imported_report_card\(\s*target_school_id uuid,\s*result_updates jsonb,\s*result_inserts jsonb,\s*report_details jsonb\s*\)/);
    expect(reportMigration).toContain("notify pgrst, 'reload schema'");
    expect(resultsPage).toContain("await saveImportedReportCard({");
    expect(resultsPage).not.toContain("await updateResult(update.id, update.values)");
    expect(resultsPage).not.toContain("await createResults(createPayloads)");
    expect(reportMigration).toMatch(/create or replace function public\.save_imported_report_card[\s\S]*?update public\.results[\s\S]*?insert into public\.results[\s\S]*?insert into public\.report_cards[\s\S]*?on conflict/);
    expect(reportMigration).toContain("security invoker");
    expect(reportMigration).toContain("grant execute on function public.save_imported_report_card(uuid, jsonb, jsonb, jsonb) to authenticated");
    const teacherReportAccess = reportMigration.match(/create or replace function public\.is_report_card_teacher_for[\s\S]*?create or replace function public\.is_parent_report_card_available/)?.[0] ?? "";
    const parentReportAccess = reportMigration.slice(reportMigration.indexOf("create or replace function public.is_parent_report_card_available"));
    expect(teacherReportAccess).not.toContain("r.status = 'Published'");
    expect(parentReportAccess).toContain("r.status = 'Published'");
  });

  it("enforces existing report-card policies and restricts contact records to authenticated staff", () => {
    expect(workflowSecurityMigration).toContain("alter table public.report_cards enable row level security");
    expect(workflowSecurityMigration).toContain("alter table public.contacts enable row level security");
    expect(workflowSecurityMigration).toContain("revoke all on public.contacts from public, anon, authenticated");
    expect(workflowSecurityMigration).toContain("grant select, insert, update on public.contacts to authenticated");
    expect(workflowSecurityMigration).toContain('create policy "Contacts staff manage"');
    expect(workflowSecurityMigration).toContain("public.is_active_staff_user()");
    expect(reportMigration).toContain('create policy "Report cards administrators manage"');
    expect(reportMigration).toContain('create policy "Report cards assigned teachers read"');
    expect(reportMigration).toContain('create policy "Report cards parents read published reports"');
    expect(workflowSecurityMigration).not.toContain("alter table public.result_import_review_drafts enable row level security");
  });

  it("lists and resumes saved workbooks by their staff owner", () => {
    expect(workflowSecurityMigration).toContain("get_result_import_review_workbooks_v2");
    expect(workflowSecurityMigration).toContain("get_result_import_review_drafts_v2");
    expect(workflowSecurityMigration).toContain("save_result_import_review_draft_v2");
    expect(workflowSecurityMigration).toContain("delete_result_import_review_draft_v2");
    expect(workflowSecurityMigration).toContain("d.created_by = owner_to_read");
    expect(reportCardService).toContain("target_owner_id: params.ownerId ?? null");
    expect(reportCardsPage).toContain("getImportReviewWorkbookSummaries");
    expect(reportCardsPage).toContain("resumeOwner: workbook.ownerId");
    expect(resultsPage).toContain('searchParams.get("resumeOwner")');
    expect(resultsPage).toContain("workbook.ownerId === requestedOwnerId");
  });

  it("marks already imported workbook pupils and separates published results from drafts", () => {
    expect(importWorkflowStatusMigration).toContain("mark_result_import_review_draft_status_v2");
    expect(importWorkflowStatusMigration).toContain("target_workflow_status not in ('published', 'imported_draft')");
    expect(importWorkflowStatusMigration).toContain("'workflowStatus', target_workflow_status");
    expect(importWorkflowStatusMigration).toContain("matching_status_count <> result_count");
    expect(reportCardService).toContain("workflowStatus");
    expect(reportCardService).toContain("publishedSubjectRowCount");
    expect(reportCardService).toContain("draftImportedSubjectRowCount");
    expect(reportCardsPage).toContain("Published:");
    expect(reportCardsPage).toContain("Imported as Draft:");
    expect(resultsPage).toContain("completedEntries.length > 0");
    expect(resultsPage).toContain("All pupil entries in this workbook have already been imported");
    expect(resultsPage).toContain("!entry.workflowStatus");
  });

  it("uses date-compatible field types for the imported report-card RPC", () => {
    expect(reportCardDateFixMigration).toContain("term_ending date");
    expect(reportCardDateFixMigration).toContain("next_term_begins date");
    expect(reportCardDateFixMigration).toContain("revoke all on function public.save_imported_report_card(uuid,jsonb,jsonb,jsonb) from public, anon");
    expect(reportCardDateFixMigration).toContain("grant execute on function public.save_imported_report_card(uuid,jsonb,jsonb,jsonb) to authenticated");
  });

  it("stores private review drafts without changing RLS and restores them through owner-scoped RPCs", () => {
    expect(importDraftMigration).toContain("create table if not exists public.result_import_review_drafts");
    expect(importDraftMigration).toContain("unique (school_id, created_by, workbook_key, entry_key)");
    expect(importDraftMigration).toContain("revoke all on public.result_import_review_drafts from public, anon, authenticated");
    expect(importDraftMigration).toMatch(/create or replace function public\.save_result_import_review_draft[\s\S]*?security definer[\s\S]*?actor_id uuid := auth\.uid\(\)/);
    expect(importDraftMigration).toContain("c.class_teacher_id = actor_id");
    expect(importDraftMigration).toContain("d.created_by = actor_id");
    expect(importDraftMigration).toContain("grant execute on function public.get_result_import_review_drafts(uuid, text) to authenticated");
    expect(importDraftMigration).not.toMatch(/alter\s+table\s+public\.result_import_review_drafts\s+enable\s+row\s+level\s+security/i);
    expect(reportCardService).toContain('rpc("save_result_import_review_draft"');
    expect(reportCardService).toContain('rpc("get_result_import_review_drafts"');
    expect(reportCardService).toContain('rpc("get_result_import_review_workbooks_v2"');
    expect(reportCardService).toContain('rpc("get_result_import_review_drafts_v2"');
    expect(reportCardService).toContain('rpc("save_result_import_review_draft_v2"');
    expect(importDraftListingMigration).toMatch(/create or replace function public\.get_result_import_review_workbooks\(\s*target_school_id uuid\s*\)[\s\S]*?d\.school_id = target_school_id[\s\S]*?d\.created_by = actor_id[\s\S]*?group by d\.workbook_key/);
    expect(importDraftListingMigration).toMatch(/where d\.school_id = target_school_id\s+and\s*\(\s*public\.is_assignment_admin\(\)\s+or\s*\(\s*d\.created_by = actor_id[\s\S]*?c\.id = d\.class_id[\s\S]*?c\.class_teacher_id = actor_id/);
    expect(importDraftListingMigration.trimStart()).toMatch(/^do \$\$/);
    expect(importDraftListingMigration.trimEnd()).not.toMatch(/```$/);
    expect(importDraftListingMigration).toMatch(/grant execute\s+on function public\.get_result_import_review_workbooks\(uuid\)\s+to authenticated/);
    expect(importDraftListingMigration).not.toMatch(/alter\s+table[\s\S]*enable\s+row\s+level\s+security/i);
    expect(resultsPage).toContain("Resume saved draft");
    expect(resultsPage).toContain("document.addEventListener(\"visibilitychange\"");
    expect(resultsPage).toContain("window.addEventListener(\"pagehide\"");
    expect(resultsPage).toContain("getImportReviewDrafts(selected.workbookKey, selected.ownerId)");
    expect(resultsPage).toContain("importReviewCursorKey(user.id, importDraftSchoolId");
    expect(resultsPage).toContain("subjectRowKey: activeSubjectRowKey");
    expect(resultsPage).toContain("const [activeImportEntryKey, setActiveImportEntryKey] = useState<string | null>(null)");
    expect(resultsPage).toContain("Review ready pupils");
    expect(resultsPage).toContain("Save progress");
    expect(resultsPage).toContain("Ignore pupil");
    expect(resultsPage).toContain("Find student in records");
  });

  it("allows authenticated reads but restricts session and term mutations to administrators", () => {
    expect(academicSessionMigration).not.toMatch(/alter\s+table\s+public\.academic_sessions\s+enable\s+row\s+level\s+security/i);
    expect(academicSessionMigration).not.toMatch(/alter\s+table\s+public\.terms\s+enable\s+row\s+level\s+security/i);
    expect(academicSessionMigration).toContain("revoke all on public.academic_sessions, public.terms from public, anon, authenticated");
    expect(academicSessionMigration).toContain("create policy \"Academic sessions authenticated read\"");
    expect(academicSessionMigration).toContain("create policy \"Terms authenticated read\"");
    expect(academicSessionMigration).toContain("create policy \"Academic sessions administrators manage\"");
    expect(academicSessionMigration).toContain("create policy \"Terms administrators manage\"");
    expect(academicSessionMigration).toContain("using (public.is_assignment_admin())");
    expect(academicSessionMigration).toContain("create unique index if not exists uidx_academic_sessions_single_current");
    expect(academicSessionMigration).toContain("create unique index if not exists uidx_terms_single_current");
    expect(academicSessionMigration).toContain("on conflict (academic_session_id, term_name)");
    expect(academicSessionMigration).toContain("when 'First' then 'First Term'");
    expect(academicSessionMigration).toContain("when 'Second' then 'Second Term'");
    expect(academicSessionMigration).toContain("when 'Third' then 'Third Term'");
    expect(reportMigration).toContain("and t.term_name = new.term || ' Term'");
    expect(reportMigration).toContain("t.term_name is distinct from rc.term || ' Term'");
    expect(academicSessionMigration).toContain("Only an administrator can create or update academic sessions and terms.");
    expect(academicSessionMigration).not.toContain("session_is_locked");
    expect(academicSessionMigration).not.toContain("The selected academic session is locked and cannot be changed.");
    expect(academicSessionMigration).toMatch(/update public\.results\s+set academic_year = trim\(target_session_name\)\s+where academic_year = old_session_name/);
    expect(academicSessionMigration).toContain("if to_regclass('public.report_cards') is not null then");
    expect(academicSessionMigration).toMatch(/update public\.report_cards set academic_year = \$1 where academic_year = \$2/);
  });

  it("limits parents to published results, audits mutations, and enforces draft/published lifecycle rules", () => {
    expect(resultsMigration).toMatch(/create policy "Results parents read published children"[\s\S]*?using \([\s\S]*?status in \('Published', 'Approved'\)[\s\S]*?public\.is_parent_linked_student\(student_id\)/);
    expect(resultsMigration).toContain("after insert or update or delete on public.results");
    expect(resultsMigration).toContain("create table if not exists public.result_change_log");
    expect(resultsMigration).toContain("Only an authorised administrator can publish a result.");
    expect(resultsMigration).toContain("Only an authorised administrator can review, publish, or unpublish results.");
    expect(resultsMigration).toContain("if not public.is_assignment_admin() then");
    expect(resultsMigration).toMatch(/old\.status is not distinct from 'Returned'[\s\S]*?old\.published_at is not null/);
    expect(resultsMigration).toContain("Only an administrator can unpublish a result with an optional internal note");
    expect(resultsMigration).toContain("New results require resolved class and subject records.");
    expect(resultsMigration).toContain("Resolve the result class and subject before publishing.");
    expect(resultsMigration).toContain("returned_assessment_snapshot jsonb");
    expect(resultsMigration).toContain("assessment_type, continuous_assessment, examination, total_score");
    expect(resultsMigration).toContain("An unpublished result must have changed assessment values before republishing.");
    expect(resultsMigration).toContain("Returned assessment evidence can only be changed by a valid publish or unpublish transition.");
    expect(resultsMigration).toContain("action_name is distinct from 'publish'");
    expect(resultsMigration).toContain("action_name not in ('return', 'unpublish')");
    expect(resultsMigration).toContain("create or replace function public.submit_result(target_result_id uuid)");
    expect(resultsMigration).toContain("add column if not exists submitted_by_name text");
    expect(resultsMigration).toContain("submitted_by_name = submitter_name");
    expect(resultsMigration).toContain("table_name = 'users' and column_name = 'first_name'");
    expect(resultsMigration).toContain("table_name = 'users' and column_name = 'last_name'");
    expect(resultsMigration).toContain("decision = 'return'");
    expect(resultsMigration).toContain("status in ('Draft', 'Submitted', 'Returned', 'Published', 'Approved')");
    expect(resultsMigration).not.toContain("execute format('drop policy %I on public.results'");
    expect(resultsMigration).not.toContain("set status = 'Draft',");
    expect(resultsMigration).not.toContain("decision = 'approve'");
    expect(resultsMigration).not.toContain("old.status is distinct from 'Approved'");
    expect(resultsMigration).toMatch(/where status = 'Returned'[\s\S]*?and published_at is not null[\s\S]*?and returned_assessment_snapshot is null/);
  });

  it("keeps legacy rows and does not constrain totals, grades, remarks, or missing components", () => {
    expect(resultsMigration).not.toContain("add constraint results_result_lifecycle_complete_check");
    expect(resultsMigration).not.toContain("add constraint results_assessment_marks_check");
    expect(resultsMigration).toContain("add constraint results_maximum_score_check");
    expect(resultsMigration).not.toContain("new.total_score is distinct from round");
    expect(resultsMigration).not.toContain("new.grade is distinct from public.result_expected_grade");
    expect(resultsMigration).not.toContain("new.remark is distinct from public.result_expected_remark");
    expect(resultsMigration).toContain("status in ('Published', 'Approved')");
    expect(resultsMigration).toContain("public.is_parent_linked_student(student_id)");
  });
});
