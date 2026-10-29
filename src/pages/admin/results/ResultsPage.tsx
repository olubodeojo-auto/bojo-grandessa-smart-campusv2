/* eslint-disable react-hooks/set-state-in-effect */

import { motion } from "framer-motion";
import { FilePlus2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import AppModal from "../../../components/modals/AppModal";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import { useAuth } from "../../../hooks/useAuth";
import StudentForm from "../students/StudentForm";
import { deleteResult, getMyResultAssignments, getResults, publishResult, reviewResult, submitResult } from "../../../services/resultService";
import {
  deleteImportReviewDraft,
  getImportReviewDrafts,
  getImportReviewSchoolId,
  getImportReviewWorkbooks,
  getImportSubjectMappings,
  saveImportReviewDraft,
  saveImportSubjectMapping,
  saveImportedReportCard,
  type ImportReviewWorkbook,
} from "../../../services/reportCardService";
import {
  collapseDuplicatePendingImportPupils,
  getImportReportDateErrors,
  getImportScoreWarnings,
  getImportItemsForSave,
  isImportItemSkippableForMissingMarks,
  areImportedResultValuesEquivalent,
  normalizeImportSubjectKey,
  getImportEntryKey,
  getImportSubjectRowKey,
  getNextUnresolvedImportSubjectIndex,
  getImportableResultEntries,
  isImportEntryReady,
  inspectResultWorkbook,
  parseResultWorkbook,
  reconcileSavedImportStudentMatches,
  buildReviewedImportResultValues,
  resolveImportStudentAssignment,
  selectCreatedImportStudent,
  updateImportEntryByKey,
  updateImportSubjectByKey,
  resolveExistingResultImportDecision,
  resolveSubjectMatch,
  selectResultWorkbookSheet,
  mergeSavedImportReviewDrafts,
  parseImportReviewCursor,
  normalizeImportDate,
  saveImportEntriesIndependently,
  serializeImportReviewCursor,
  summarizeImportPreview,
  type ResultImportItem,
  type ResultImportPreviewEntry,
  type ResultImportReportDetailNumericField,
  type ResultImportReportKind,
  type ResultImportScoreField,
  type ResultWorkbookSheet,
} from "../../../services/resultImportService";
import { getStudents } from "../../../services/studentService";
import { getSubjects } from "../../../services/subjectService";
import { getClasses } from "../../../services/classService";
import type { Result } from "../../../types/result";
import { canAdministratorDeleteResult, canAdministratorEditResult, canPublishResult, canTeacherEditResult, canTeacherSubmitResult, canTransitionResult, getResultRoleFlags } from "../../../utils/resultPermissions";
import type { Student } from "../../../types/student";
import type { Subject } from "../../../types/subject";
import type { SchoolClass } from "../../../types/class";
import ResultFilters from "./ResultFilters";
import { calculateResult, validateAssessmentMarks } from "../../../utils/resultCalculations";
import ResultForm from "./ResultForm";
import ResultBatchEntry from "./ResultBatchEntry";
import ResultTableGrouped from "./ResultTableGrouped";
import ResultsNotificationBell from "./ResultsNotificationBell";
import ResultsScrollRegion from "./ResultsScrollRegion";
import type { ResultNotice } from "./ResultsNotificationBell";
import type { ResultRow } from "./ResultTable";
import { grandessaGradingScale } from "../../../config/grandessaGrading";
import { groupSavedResultDrafts } from "../../../utils/resultDraftRecovery";
import { formatScoreInput, parseScoreInput } from "../../../utils/scoreInput";
import { getReportCenterPublishBlockReason, getReportCenterResultsWithRecordedMarks, publishReportResultsAndVerify } from "../../../utils/reportCenter";

type FilterTerm = "All" | "First" | "Second" | "Third";
type FilterStatus = "All" | Result["status"];
type FilterReportType = "All" | "Midterm" | "End-of-Term";
type ImportReportKindSelection = ResultImportReportKind | "Auto-detect";
type ImportReportDetailField = keyof NonNullable<ResultImportPreviewEntry["reportDetails"]>;

type PendingImportPupil = {
  workbookKey: string;
  ownerId: string;
  ownerName: string;
  sheetName: string;
  savedAt: string;
  duplicateCount: number;
  duplicateWorkbookCount: number;
  olderVersions?: Array<{ workbookKey: string; ownerId: string; savedAt: string; entry: ResultImportPreviewEntry }>;
  entry: ResultImportPreviewEntry;
};

type PublishSavedPeriodParams = {
  studentId: string;
  classId: string;
  academicYear: string;
  term: Result["term"];
  reportType: "Midterm" | "End-of-Term";
};

type PendingImportPupilStatus = { label: string; explanation: string };

function getPendingImportPupilStatus(entry: ResultImportPreviewEntry): PendingImportPupilStatus {
  const classWarning = entry.warnings.find((warning) =>
    /selected student is not currently|worksheet says|workbook class differs|class differs|worksheet class/i.test(warning),
  );
  if (classWarning) {
    const details = classWarning.match(/registered pupil is in (.+?), but the worksheet says (.+?)(?:\.|$)/i);
    return {
      label: "Class needs checking",
      explanation: details
        ? `Worksheet: ${details[2]} · school record: ${details[1]}. Choose the correct pupil or update the class record.`
        : "The worksheet class and school record differ. Check the pupil and class record before publishing.",
    };
  }
  if (entry.matchStatus === "manual-review" || entry.matchStatus === "unmatched" || !entry.selectedStudentId) {
    return { label: "Choose a pupil", explanation: "Select the pupil from Students below. If no school record exists yet, create the pupil first." };
  }
  if (entry.reportKind === "Unclear") {
    return { label: "Choose report type", explanation: "Select Midterm (CA) or End-of-Term in report settings." };
  }
  if (!entry.academicYear.trim()) {
    return { label: "Choose session", explanation: "Select the academic session in report settings." };
  }
  if (!entry.term) {
    return { label: "Choose term", explanation: "Select the school term in report settings." };
  }
  if (entry.items.length === 0) {
    return { label: "Add subjects", explanation: "No subjects were found for this pupil. Add a subject row, choose the subject, and enter its marks." };
  }

  const itemsToSave = getImportItemsForSave(entry);
  const unresolvedSubject = itemsToSave.find((item) => !item.subjectId || !item.classId);
  if (unresolvedSubject) {
    return { label: "Match subject", explanation: `Choose the official subject for “${unresolvedSubject.subjectName}” in the table below.` };
  }
  if (itemsToSave.length === 0) {
    return {
      label: "Enter marks",
      explanation: "Add marks to at least one subject. Other complete pupil results can be saved while you finish this entry.",
    };
  }

  const scoreWarnings = getImportScoreWarnings({ ...entry, items: itemsToSave });
  if (scoreWarnings.length > 0 || itemsToSave.some((item) => (item.invalidMarks?.length ?? 0) > 0)) {
    return { label: "Check marks", explanation: "One or more scores needs correcting. Use the action below to jump to the subject row." };
  }

  const skippedItems = [...(entry.skippedItems ?? []), ...entry.items.filter(isImportItemSkippableForMissingMarks)];
  if (skippedItems.length > 0) {
    const names = [...new Set(skippedItems.map((item) => item.subjectName).filter(Boolean))].join(", ");
    return {
      label: "Ready — some marks left blank",
      explanation: `Complete subjects can be published now. Blank subjects (${names || "shown below"}) will be left out and can be completed later.`,
    };
  }
  return { label: "Ready to publish", explanation: "All entered subjects have complete marks." };
}

function importItemKey(entry: ResultImportPreviewEntry, itemIndex: number): string {
  return `${entry.studentKey}|${itemIndex}`;
}

function getImportSubjectRowsNeedingAction(entry: ResultImportPreviewEntry): number[] {
  return entry.items.flatMap((item, index) => {
    if (isImportItemSkippableForMissingMarks(item)) return [];
    if (!item.subjectId || !item.classId || (item.invalidMarks?.length ?? 0) > 0) return [index];
    const totalScore = item.assessmentType === "Combined" && item.calculationMode === "Automatic"
      ? calculateResult("Combined", item.continuousAssessment, item.examination).total
      : item.totalScore;
    const markErrors = validateAssessmentMarks({
      assessment_type: item.assessmentType,
      continuous_assessment: item.continuousAssessment,
      maximum_score: item.maximumScore,
      examination: item.examination,
      total_score: totalScore,
      grade: item.grade ?? "",
      remark: item.remark ?? "",
    });
    return markErrors.length > 0 ? [index] : [];
  });
}

function importReviewCursorKey(userId: string, schoolId: string, workbookKey: string): string {
  return `grandessa:results-import-review:${userId}:${schoolId}:${workbookKey}`;
}

function uniqueByName<T>(items: T[], nameOf: (item: T) => string, name: string): T | null {
  const normalize = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = normalize(name);
  const matching = items.filter((item) => normalize(nameOf(item)) === target);
  return matching.length === 1 ? matching[0] : null;
}

async function fingerprintWorkbook(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function withSelectedDuplicateWarnings(entries: ResultImportPreviewEntry[]): ResultImportPreviewEntry[] {
  const result = entries.map((entry) => ({
    ...entry,
    warnings: entry.warnings.filter((warning) => !warning.startsWith("Duplicate selected result:")),
  }));
  const duplicateIndices = new Map<string, Array<{ entryIndex: number; subjectName: string }>>();

  result.forEach((entry, entryIndex) => {
    if (entry.included === false || !entry.selectedStudentId) return;
    entry.items.forEach((item) => {
      // Rows with no required marks are skipped and must not raise duplicate-result blockers.
      if (isImportItemSkippableForMissingMarks(item)) return;
      const academicYear = item.academicYear || entry.academicYear;
      const term = item.term ?? entry.term;
      if (!item.subjectId || !term || !academicYear) return;
      const key = [
        entry.selectedStudentId,
        item.classId,
        item.subjectId,
        academicYear,
        term,
        item.assessmentType,
      ].join("|");
      const matches = duplicateIndices.get(key) ?? [];
      matches.push({ entryIndex, subjectName: item.subjectName });
      duplicateIndices.set(key, matches);
    });
  });

  duplicateIndices.forEach((matches) => {
    if (matches.length < 2) return;
    matches.forEach(({ entryIndex, subjectName }) => {
      result[entryIndex] = {
        ...result[entryIndex],
        warnings: [...result[entryIndex].warnings, `Duplicate selected result: ${subjectName} has more than one row for this student, session, term and assessment type.`],
      };
    });
  });
  return result;
}

function formatName(firstName?: string, lastName?: string): string {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || "Unknown";
}

function studentClassMismatch(student: Student | undefined, classId: string): boolean {
  return !student || student.class_id !== classId;
}

function ResultDetails({ row }: { row: ResultRow | null }) {
  if (!row) {
    return <EmptyState title="No result selected" description="Select a result row to view details." />;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
      <Detail label="Student" value={row.studentName} />
      <Detail label="Class" value={row.className} />
      <Detail label="Subject" value={row.subjectName} />
      <Detail label="Teacher" value={row.teacherName} />
      <Detail label="Session" value={row.academicYear} />
      <Detail label="Term" value={row.term} />
      <Detail label="Assessment type" value={row.assessmentType === "CA" ? "Midterm" : "End-of-Term"} />
      <Detail label="CA" value={String(row.continuousAssessment ?? "Not recorded")} />
      {row.assessmentType === "CA" && row.maximumScore !== null ? <Detail label="Midterm maximum" value={String(row.maximumScore)} /> : null}
      <Detail label="Exam" value={String(row.examination ?? "Not recorded")} />
      <Detail label="Total" value={String(row.assessmentType === "CA" ? "Not applicable to CA" : row.totalScore ?? "Not finalised")} />
      <Detail label="Grade" value={row.assessmentType === "CA" ? "Not applicable to CA" : row.grade ?? "Not assigned"} />
      <Detail label="Remark" value={row.assessmentType === "CA" ? "Not applicable to CA" : row.remark ?? "Not assigned"} />
      <Detail label="Status" value={row.status} />
      {row.submittedBy ? <Detail label="Submitted by" value={row.submittedByName || row.submittedBy} /> : null}
      {row.submittedAt ? <Detail label="Submitted at" value={row.submittedAt} /> : null}
      {row.reviewedBy ? <Detail label="Correction recorded by" value={row.reviewedBy} /> : null}
      {row.reviewedAt ? <Detail label="Correction recorded at" value={row.reviewedAt} /> : null}
      <Detail label="Published by" value={row.publishedBy ?? "Not published"} />
      <Detail label="Published at" value={row.publishedAt ?? "—"} />
      {row.reviewReason ? <Detail label="Correction reason" value={row.reviewReason} /> : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fafafa" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color: "#1f2937" }}>{value}</div>
    </div>
  );
}

function SynchronizedHorizontalScroll({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  // ResultsScrollRegion keeps a horizontal scrollbar available above the content
  // and provides independent vertical and horizontal scrolling within this layer.
  return (
    <ResultsScrollRegion id={id} label={label} maxHeight="min(58vh, 560px)">
      {children}
    </ResultsScrollRegion>
  );
}

function workbookSelectionKey(workbook: Pick<ImportReviewWorkbook, "ownerId" | "workbookKey">): string {
  return `${workbook.ownerId}::${workbook.workbookKey}`;
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const color = status === "Ready to review" ? ["#166534", "#dcfce7"]
    : status === "Confirm pupil" || status === "Pupil match needed" || status === "Missing subject marks" || status === "Check marks"
      ? ["#92400e", "#fef3c7"]
      : ["#475569", "#f1f5f9"];
  return { borderRadius: 999, background: color[1], color: color[0], fontSize: 12, fontWeight: 700, padding: "4px 9px" };
}

export default function ResultsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles, user } = useAuth();

  const roleFlags = getResultRoleFlags(roles.map((assignedRole) => assignedRole.name));
  const isAdmin = roleFlags.isAdministrator;
  const isTeacher = roleFlags.isTeacher;
  const canManage = isAdmin || isTeacher;

  const [loading, setLoading] = useState<boolean>(true);
  const [results, setResults] = useState<Result[]>([]);
  const [importedResultIds, setImportedResultIds] = useState<Set<string>>(new Set());
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<Array<{ class_id: string }>>([]);
  const [error, setError] = useState<string>("");
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isAddingImportStudent, setIsAddingImportStudent] = useState<boolean>(false);
  const [importStudentDraft, setImportStudentDraft] = useState<Student | null>(null);
  const [importStudentEntryKey, setImportStudentEntryKey] = useState<string | null>(null);
  const [importEntries, setImportEntries] = useState<ResultImportPreviewEntry[]>([]);
  const [importFileName, setImportFileName] = useState<string>("");
  const [importWorkbookFile, setImportWorkbookFile] = useState<File | null>(null);
  const [importWorkbookKey, setImportWorkbookKey] = useState<string>("");
  const [importWorkbookSheets, setImportWorkbookSheets] = useState<ResultWorkbookSheet[]>([]);
  const [selectedImportSheet, setSelectedImportSheet] = useState<string>("");
  const [savedImportWorkbooks, setSavedImportWorkbooks] = useState<ImportReviewWorkbook[]>([]);
  const [pendingImportPupils, setPendingImportPupils] = useState<PendingImportPupil[]>([]);
  const [loadingPendingImportPupils, setLoadingPendingImportPupils] = useState<boolean>(true);
  const [pendingImportPupilsError, setPendingImportPupilsError] = useState<string>("");
  const [selectedSavedWorkbookKey, setSelectedSavedWorkbookKey] = useState<string>("");
  const [loadingSavedWorkbooks, setLoadingSavedWorkbooks] = useState<boolean>(true);
  const [savedWorkbookError, setSavedWorkbookError] = useState<string>("");
  const [importDraftSchoolId, setImportDraftSchoolId] = useState<string>("");
  const [importDraftOwnerId, setImportDraftOwnerId] = useState<string>("");
  const [importSubmitting, setImportSubmitting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<string>("");
  const [activeImportEntryKey, setActiveImportEntryKey] = useState<string | null>(null);
  const [activeSubjectRowKey, setActiveSubjectRowKey] = useState<string | null>(null);
  const [completedSubjectMappingEntryKey, setCompletedSubjectMappingEntryKey] = useState<string | null>(null);
  const [pendingStudentSelections, setPendingStudentSelections] = useState<Record<string, string>>({});
  const [subjectSearch, setSubjectSearch] = useState<string>("");
  const [isFinalImportPreview, setIsFinalImportPreview] = useState<boolean>(false);
  const [finalPreviewIndex, setFinalPreviewIndex] = useState<number>(0);
  const [draftSaveStates, setDraftSaveStates] = useState<Record<string, { state: "unsaved" | "saving" | "saved" | "failed"; error?: string }>>({});
  const [importResultStates, setImportResultStates] = useState<Record<string, { state: "saved" | "failed"; error?: string }>>({});
  const draftSaveQueue = useRef<Map<string, Promise<void>>>(new Map());
  const autoResumeHandled = useRef<string | null>(null);
  const [importReportKind, setImportReportKind] = useState<ImportReportKindSelection>("Auto-detect");
  const [importExistingChoices, setImportExistingChoices] = useState<Record<string, string>>({});

  const [search, setSearch] = useState<string>(searchParams.get("search") ?? "");
  const initialTerm = searchParams.get("term");
  const initialReportType = searchParams.get("reportType");
  const [term, setTerm] = useState<FilterTerm>(
    initialTerm === "First" || initialTerm === "Second" || initialTerm === "Third" ? initialTerm : "All",
  );
  const [session, setSession] = useState<string>(searchParams.get("session") ?? "");
  const [classId, setClassId] = useState<string>(searchParams.get("classId") ?? "");
  const [reportType, setReportType] = useState<FilterReportType>(
    initialReportType === "Midterm" || initialReportType === "End-of-Term" ? initialReportType : "All",
  );
  const [status, setStatus] = useState<FilterStatus>("All");

  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isBatchOpen, setIsBatchOpen] = useState<boolean>(false);
  const [resumeBatchResult, setResumeBatchResult] = useState<Result | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingResult, setEditingResult] = useState<Result | null>(null);

  async function loadWithDiagnostics<T>(label: string, loader: () => Promise<T>): Promise<T> {
    try {
      return await loader();
    } catch (error) {
      console.error(`[ResultsPage] ${label} failed`, error);
      throw error;
    }
  }

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    setImportSummary("");

    try {
      const assignments = isTeacher && !isAdmin
        ? await loadWithDiagnostics("getMyResultAssignments", () => getMyResultAssignments())
        : [];
      const permittedClassIds = [...new Set(assignments.map((assignment) => assignment.class_id))];
      const [resultsData, studentsData, allClasses, allSubjects] = await Promise.all([
        loadWithDiagnostics("getResults", () => getResults()),
        loadWithDiagnostics("getStudents", () => getStudents(isTeacher && !isAdmin ? { classIds: permittedClassIds } : {})),
        loadWithDiagnostics("getClasses", () => getClasses()),
        loadWithDiagnostics("getSubjects", () => getSubjects()),
      ]);
      const classesData = isTeacher && !isAdmin
        ? allClasses.filter((item) => permittedClassIds.includes(item.id))
        : allClasses;
      const subjectsData = allSubjects;
      setResults(resultsData);
      setStudents(studentsData);
      setClasses(classesData);
      setSubjects(subjectsData);
      setTeacherAssignments(assignments);
      window.dispatchEvent(new Event("grandessa:results-updated"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load results module.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isTeacher]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isImportOpen || isFinalImportPreview || !activeImportEntryKey) return;
    const frameId = window.requestAnimationFrame(() => {
      document.getElementById("active-import-pupil-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isImportOpen, isFinalImportPreview, activeImportEntryKey]);

  useEffect(() => {
    if (!canManage || !user) {
      setLoadingSavedWorkbooks(false);
      return;
    }
    let cancelled = false;
    setLoadingSavedWorkbooks(true);
    setSavedWorkbookError("");
    void Promise.all([getImportReviewSchoolId(), getImportReviewWorkbooks()])
      .then(([schoolId, workbooks]) => {
        if (cancelled) return;
        setImportDraftSchoolId(schoolId);
        setSavedImportWorkbooks(workbooks);
        setSelectedSavedWorkbookKey(workbooks[0] ? workbookSelectionKey(workbooks[0]) : "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSavedWorkbookError(err instanceof Error ? err.message : "Unable to list saved import drafts.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSavedWorkbooks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, user]);

  useEffect(() => {
    if (!isAdmin || !user) {
      setPendingImportPupils([]);
      setPendingImportPupilsError("");
      setLoadingPendingImportPupils(false);
      return;
    }
    if (loading || loadingSavedWorkbooks) {
      setLoadingPendingImportPupils(true);
      return;
    }
    if (savedImportWorkbooks.length === 0) {
      setPendingImportPupils([]);
      setPendingImportPupilsError("");
      setLoadingPendingImportPupils(false);
      return;
    }

    let cancelled = false;
    setLoadingPendingImportPupils(true);
    setPendingImportPupilsError("");
    void Promise.all(savedImportWorkbooks.map(async (workbook) => {
      const entries = await getImportReviewDrafts(workbook.workbookKey, workbook.ownerId);
      const completedResultIds = entries.filter((entry) => Boolean(entry.workflowStatus))
        .flatMap((entry) => entry.importedResultIds ?? []);
      const reviewEntries = reconcileSavedImportStudentMatches(entries, students, classes);
      const separatorIndex = workbook.workbookKey.indexOf(":");
      const sheetName = separatorIndex >= 0
        ? workbook.workbookKey.slice(separatorIndex + 1)
        : "Saved worksheet";
      return {
        completedResultIds,
        reviewEntries: reviewEntries.map((entry) => ({
          workbookKey: workbook.workbookKey,
          ownerId: workbook.ownerId,
          ownerName: workbook.ownerName,
          sheetName,
          savedAt: entry.savedAt || workbook.updatedAt,
          duplicateCount: 1,
          duplicateWorkbookCount: 1,
          entry,
        })),
      };
    }))
      .then((workbookEntries) => {
        if (cancelled) return;
        setImportedResultIds(new Set(workbookEntries.flatMap((item) => item.completedResultIds)));
        setPendingImportPupils(collapseDuplicatePendingImportPupils(workbookEntries.flatMap((item) => item.reviewEntries)));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPendingImportPupilsError(err instanceof Error ? err.message : "Unable to load outstanding pupil imports.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPendingImportPupils(false);
      });
    return () => { cancelled = true; };
  }, [isAdmin, user, loading, loadingSavedWorkbooks, savedImportWorkbooks, students, classes]);

  const studentsMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((student) => map.set(student.id, student));
    return map;
  }, [students]);
  const savedResultDraftGroups = useMemo(() => groupSavedResultDrafts(results), [results]);

  const rows = useMemo<ResultRow[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return results
      .map((result) => {
        const student = studentsMap.get(result.student_id);
        const classNameValue = result.class_name?.trim() || "Not Assigned";
        const subjectNameValue = result.subject_name?.trim() || "Unknown subject";
        const teacherNameValue = result.teacher_name?.trim() || "Not Assigned";

        return {
          id: result.id,
          studentId: result.student_id,
          classId: result.class_id,
          studentName: student
            ? `${formatName(student.first_name, student.last_name)} (${student.admission_number})`
            : "Unknown student",
          className: classNameValue,
          subjectName: subjectNameValue,
          teacherName: teacherNameValue,
          academicYear: result.academic_year,
          term: result.term,
          assessmentType: result.assessment_type,
          continuousAssessment: result.continuous_assessment,
          maximumScore: result.maximum_score ?? null,
          examination: result.examination,
          totalScore: result.total_score,
          grade: result.grade,
          remark: result.remark,
          status: result.status,
          createdBy: result.created_by,
          reviewReason: result.review_reason,
          submittedBy: result.submitted_by,
          submittedByName: result.submitted_by_name,
          submittedAt: result.submitted_at,
          reviewedBy: result.reviewed_by,
          reviewedAt: result.reviewed_at,
          publishedBy: result.published_by,
          publishedAt: result.published_at,
        };
      })
      .filter((row) => {
        const matchesSearch =
          !normalizedSearch ||
          row.studentName.toLowerCase().includes(normalizedSearch) ||
          row.className.toLowerCase().includes(normalizedSearch) ||
          row.subjectName.toLowerCase().includes(normalizedSearch) ||
          row.teacherName.toLowerCase().includes(normalizedSearch);

        const matchesTerm = term === "All" || row.term === term;
        const matchesStatus = status === "All" || row.status === status;
        const matchesSession = !session.trim() || row.academicYear.toLowerCase().includes(session.trim().toLowerCase());
        const matchesClass = !classId || row.classId === classId;
        const matchesReport = reportType === "All"
          || (reportType === "Midterm" ? row.assessmentType === "CA" : row.assessmentType !== "CA");

        return matchesSearch && matchesTerm && matchesStatus && matchesSession && matchesClass && matchesReport;
      })
      .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
  }, [results, studentsMap, search, term, status, session, classId, reportType]);
  const academicYears = useMemo(
    () => [...new Set(results.map((result) => result.academic_year).filter(Boolean))]
      .sort((left, right) => right.localeCompare(left)),
    [results],
  );
  const importCounts = summarizeImportPreview(importEntries);
  const readyImportEntries = getImportableResultEntries(importEntries)
    .filter((entry) => importResultStates[entry.studentKey]?.state !== "saved");
  const importableBlocks = readyImportEntries.length;
  const activeImportEntry = importEntries.find((entry) => entry.studentKey === activeImportEntryKey);
  const activeWorkbookDraftKey = importWorkbookKey && selectedImportSheet
    ? `${importWorkbookKey}:${selectedImportSheet}`
    : "";
  const readReviewCursor = (workbookKey: string): { entryKey: string; subjectRowKey?: string | null } | null => {
    if (!user || !importDraftSchoolId) return null;
    try {
      return parseImportReviewCursor(
        window.localStorage.getItem(importReviewCursorKey(user.id, importDraftSchoolId, workbookKey)),
      );
    } catch {
      setSavedWorkbookError("The saved active pupil position could not be read from this browser.");
      return null;
    }
  };
  const studentOptions = useMemo(
    () => [...students].sort((left, right) => {
      const nameOf = (student: Student): string =>
        [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ").trim();
      return nameOf(left).localeCompare(nameOf(right)) || (left.admission_number ?? "").localeCompare(right.admission_number ?? "");
    }),
    [students],
  );

  const persistImportDraft = useCallback(async (entry: ResultImportPreviewEntry): Promise<boolean> => {
    if (!activeWorkbookDraftKey) return false;
    const saveKey = `${activeWorkbookDraftKey}:${entry.studentKey}`;
    const previousSave = draftSaveQueue.current.get(saveKey);
    setDraftSaveStates((current) => ({
      ...current,
      [entry.studentKey]: { state: "saving" },
    }));

    const queuedSave = (previousSave ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => saveImportReviewDraft({ workbookKey: activeWorkbookDraftKey, entry, ownerId: importDraftOwnerId || undefined }));
    draftSaveQueue.current.set(saveKey, queuedSave);
    try {
      await queuedSave;
      if (draftSaveQueue.current.get(saveKey) === queuedSave) {
        setDraftSaveStates((current) => ({
          ...current,
          [entry.studentKey]: { state: "saved" },
        }));
        setError("");
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save this pupil's review progress.";
      if (draftSaveQueue.current.get(saveKey) === queuedSave) {
        setDraftSaveStates((current) => ({
          ...current,
          [entry.studentKey]: { state: "failed", error: message },
        }));
        setError(message);
      }
      return false;
    } finally {
      if (draftSaveQueue.current.get(saveKey) === queuedSave) draftSaveQueue.current.delete(saveKey);
    }
  }, [activeWorkbookDraftKey, importDraftOwnerId]);

  useEffect(() => {
    if (!activeWorkbookDraftKey || !activeImportEntryKey || !importDraftSchoolId || !user) return;
    try {
      const cursor = {
        entryKey: activeImportEntryKey,
        subjectRowKey: activeSubjectRowKey,
      };
      window.localStorage.setItem(
        importReviewCursorKey(user.id, importDraftSchoolId, activeWorkbookDraftKey),
        serializeImportReviewCursor(cursor),
      );
    } catch {
      setSavedWorkbookError("The active pupil position could not be saved in this browser.");
    }
  }, [activeImportEntryKey, activeSubjectRowKey, activeWorkbookDraftKey, importDraftSchoolId, importEntries, user]);

  useEffect(() => {
    if (!activeWorkbookDraftKey || !isImportOpen) return;
    const savePendingDrafts = (): void => {
      const pendingEntries = importEntries.filter((entry) =>
        entry.studentKey === activeImportEntryKey || draftSaveStates[entry.studentKey]?.state === "unsaved"
          || draftSaveStates[entry.studentKey]?.state === "failed",
      );
      void Promise.all(pendingEntries.map((entry) => persistImportDraft(entry)));
    };
    const saveWhenHidden = (): void => {
      if (document.visibilityState === "hidden") savePendingDrafts();
    };
    document.addEventListener("visibilitychange", saveWhenHidden);
    window.addEventListener("pagehide", savePendingDrafts);
    return () => {
      document.removeEventListener("visibilitychange", saveWhenHidden);
      window.removeEventListener("pagehide", savePendingDrafts);
    };
  }, [activeImportEntryKey, activeWorkbookDraftKey, draftSaveStates, importEntries, isImportOpen, persistImportDraft]);

  const markDraftDirty = (studentKey: string): void => {
    setDraftSaveStates((current) => ({
      ...current,
      [studentKey]: { state: "unsaved" },
    }));
  };

  useEffect(() => {
    if (!isImportOpen || isAddingImportStudent || !activeImportEntryKey || !activeImportEntry) return;
    const timeout = window.setTimeout(() => {
      void persistImportDraft(activeImportEntry);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [activeImportEntry, activeImportEntryKey, isAddingImportStudent, isImportOpen, persistImportDraft]);
  const selectedSheetMetadata = importWorkbookSheets.find((sheet) => sheet.name === selectedImportSheet);
  const importPeriodConflict = Boolean(selectedSheetMetadata
    && ((session && selectedSheetMetadata.academicYear !== session)
      || (term !== "All" && !selectedSheetMetadata.terms.includes(term))));

  const handleAdd = (): void => {
    setFormMode("add");
    setEditingResult(null);
    setIsFormOpen(true);
  };

  const handleEdit = (row: ResultRow): void => {
    const target = results.find((result) => result.id === row.id) ?? null;
    if (!target || (isAdmin
      ? !canAdministratorEditResult(target)
      : !isTeacher || !user || !canTeacherEditResult(target, user.id, teacherAssignments))) return;
    setFormMode("edit");
    setEditingResult(target);
    setIsFormOpen(true);
  };

  const handleView = (row: ResultRow): void => {
    setSelectedRow(row);
    setIsDetailOpen(true);
  };

  const handleReview = async (
    row: ResultRow,
    decision: "publish" | "return" | "unpublish",
  ): Promise<void> => {
    if (!isAdmin) return;
    const result = results.find((candidate) => candidate.id === row.id);
    if (!result) {
      setError("The selected result is no longer available.");
      return;
    }
    if (decision === "unpublish"
      && !window.confirm(`Unpublish the result for ${row.studentName} — ${row.subjectName}? It will remain unpublished until explicitly published again.`)) return;
    const requestsMessage = decision === "return" || decision === "unpublish";
    const reason = requestsMessage
      ? window.prompt(decision === "return"
        ? "Optional message for the teacher (up to 250 characters):"
        : "Optional internal note for unpublishing (up to 250 characters):")
      : undefined;
    if (requestsMessage && reason === null) return;
    const trimmedReason = reason?.trim();
    const reasonLength = trimmedReason?.length ?? 0;
    if (requestsMessage && reasonLength > 250) {
      setError("The message must be no more than 250 characters.");
      return;
    }
    if (!canTransitionResult(result, decision, true, trimmedReason)) {
      setError(decision === "publish"
        ? "Only draft results or corrected unpublished results can be published."
        : decision === "return"
          ? "Only submitted results can be returned."
          : "Only published results can be unpublished.");
      return;
    }
    if (decision === "publish" && !window.confirm(`Publish result for ${row.studentName} — ${row.subjectName}?`)) return;
    if (decision === "return" && !window.confirm(`Return result for ${row.studentName} — ${row.subjectName} to the teacher?`)) return;
    try {
      await reviewResult(row.id, decision, trimmedReason);
      if (decision === "unpublish") {
        setSelectedRow((current) => current?.id === row.id
          ? { ...current, status: "Returned", reviewReason: trimmedReason || null }
          : current);
      }
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Unable to ${decision} result.`;
      setError(message);
    }
  };

  const handleSubmitResult = async (row: ResultRow): Promise<void> => {
    if (!user || !isTeacher || isAdmin) return;
    const result = results.find((candidate) => candidate.id === row.id);
    if (!result || !canTeacherSubmitResult(result, user.id, teacherAssignments)) return;
    if (!window.confirm(`Submit result for ${row.studentName} — ${row.subjectName} for administrator review?`)) return;
    try {
      await submitResult(row.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit result.");
    }
  };

  const handleDelete = async (row: ResultRow): Promise<void> => {
    const result = results.find((candidate) => candidate.id === row.id);
    if (!result || !canAdministratorDeleteResult(isAdmin)) {
      return;
    }

    const admissionNumber = studentsMap.get(result.student_id)?.admission_number || "Unavailable";
    const confirmed = window.confirm(
      `Permanently delete this subject result?\n\nPupil: ${row.studentName}\nAdmission number: ${admissionNumber}\nSubject: ${row.subjectName}\nAcademic year: ${row.academicYear}\nTerm: ${row.term}\nCurrent status: ${result.status}\n\nOnly this subject-result record will be deleted. This deletion is permanent and cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteResult(row.id);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete result.";
      setError(message);
    }
  };

  const populateImportPreview = async (file: File, sheetName: string, workbookKey: string): Promise<void> => {
    try {
      const entries = await parseResultWorkbook(
        file,
        students,
        importReportKind === "Auto-detect" ? "Unclear" : importReportKind,
        sheetName,
        term === "All" ? null : term,
      );
      const subjectMappings = await getImportSubjectMappings();
      const validatedEntries = entries.map((entry) => {
        const warnings = entry.warnings.filter((warning) =>
          !warning.startsWith("Class missing from workbook.")
          && !warning.startsWith("A subject could not be identified."),
        );
        const resolvedItems = entry.items.map((item) => {
          const sourceSubjectName = item.sourceSubjectName?.trim() || item.subjectName;
          const classEntity = uniqueByName(classes, (candidate) => candidate.class_name, item.className || entry.className);
          const savedMapping = classEntity
            ? subjectMappings.find((mapping) =>
                mapping.classId === classEntity.id
                && mapping.sourceSubjectKey === normalizeImportSubjectKey(sourceSubjectName))
            : undefined;
          const savedSubject = savedMapping
            ? subjects.find((candidate) => candidate.id === savedMapping.subjectId)
            : undefined;
          const subject = savedSubject ?? resolveSubjectMatch(subjects, sourceSubjectName);
          if (!classEntity) warnings.push(`Class "${item.className || entry.className || "missing"}" is missing or ambiguous in the school records.`);
          if (!subject) warnings.push(`Subject "${sourceSubjectName}" is missing or ambiguous in the school records.`);
          if (classEntity && isTeacher && !isAdmin
            && !teacherAssignments.some((assignment) => assignment.class_id === classEntity.id)) {
            warnings.push(`You are not the class teacher for ${classEntity.class_name}.`);
          }
          if (entry.selectedStudentId && classEntity && studentClassMismatch(studentsMap.get(entry.selectedStudentId), classEntity.id)) {
            warnings.push("Selected student is not currently in the workbook class.");
          }
          return {
            ...item,
            sourceSubjectName,
            className: classEntity?.class_name ?? item.className,
            classId: classEntity?.id,
            subjectName: subject?.subject_name ?? sourceSubjectName,
            subjectId: subject?.id,
          };
        });
        return validateImportMappings({
          ...entry,
          included: true,
          items: resolvedItems,
          warnings: [...new Set(warnings)],
        });
      });
      const savedEntries = await getImportReviewDrafts(`${workbookKey}:${sheetName}`, user?.id);
      const mergedEntries = reconcileSavedImportStudentMatches(
        mergeSavedImportReviewDrafts(validatedEntries, savedEntries),
        students,
        classes,
      );
      const completedEntries = mergedEntries.filter((entry) => Boolean(entry.workflowStatus));
      const restoredEntries = mergedEntries.filter((entry) => !entry.workflowStatus);
      setImportSummary(completedEntries.length > 0
        ? `${completedEntries.length} pupil review(s) were skipped because their results have already been imported. Check Results & reports for their saved status.`
        : "");
      setImportEntries(withSelectedDuplicateWarnings(restoredEntries));
      setDraftSaveStates(Object.fromEntries(savedEntries.filter((entry) => !entry.workflowStatus).map((entry) => [entry.studentKey, { state: "saved" as const }])));
      setImportResultStates({});
      const savedCursor = readReviewCursor(`${workbookKey}:${sheetName}`);
      const restoredActive = restoredEntries.find((entry) => entry.studentKey === savedCursor?.entryKey) ?? restoredEntries[0];
      setActiveImportEntryKey(restoredActive?.studentKey ?? null);
      const unresolvedIndex = restoredActive?.items.findIndex((item) => !item.subjectId) ?? -1;
      const savedSubjectIndex = restoredActive && savedCursor?.subjectRowKey
        ? restoredActive.items.findIndex((_item, index) => getImportSubjectRowKey(restoredActive, index) === savedCursor.subjectRowKey)
        : -1;
      const activeSubjectIndex = savedSubjectIndex >= 0 ? savedSubjectIndex : unresolvedIndex;
      setActiveSubjectRowKey(restoredActive && activeSubjectIndex >= 0
        ? getImportSubjectRowKey(restoredActive, activeSubjectIndex)
        : null);
      setCompletedSubjectMappingEntryKey(restoredActive && activeSubjectIndex < 0 ? restoredActive.studentKey : null);
      setIsFinalImportPreview(false);
      setIsImportOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to parse workbook or restore saved review progress.";
      setError(message);
    }
  };

  const handleResumeSavedWorkbook = async (workbookKeyOverride?: string, ownerIdOverride?: string, entryKeyOverride?: string): Promise<void> => {
    const selected = workbookKeyOverride
      ? savedImportWorkbooks.find((workbook) =>
          workbook.workbookKey === workbookKeyOverride && (!ownerIdOverride || workbook.ownerId === ownerIdOverride))
      : savedImportWorkbooks.find((workbook) => workbookSelectionKey(workbook) === selectedSavedWorkbookKey);
    if (!selected) {
      setError("Choose an available saved workbook first.");
      return;
    }
    setError("");
    try {
      const separatorIndex = selected.workbookKey.indexOf(":");
      if (separatorIndex < 1 || separatorIndex === selected.workbookKey.length - 1) {
        throw new Error("The saved workbook draft has an invalid key and cannot be reopened.");
      }
      const workbookKey = selected.workbookKey.slice(0, separatorIndex);
      const sheetName = selected.workbookKey.slice(separatorIndex + 1);
      const entries = await getImportReviewDrafts(selected.workbookKey, selected.ownerId);
      if (entries.length === 0) throw new Error("This saved workbook has no pupil reviews to restore.");
      const completedEntries = entries.filter((entry) => Boolean(entry.workflowStatus));
      const pendingEntries = entries.filter((entry) => !entry.workflowStatus);
      if (pendingEntries.length === 0) {
        setImportSummary("All pupil entries in this workbook have already been imported. Their publication status is shown in Results & reports; no duplicate import was started.");
        return;
      }
      const reconciledEntries = reconcileSavedImportStudentMatches(
        [...pendingEntries].sort((left, right) => left.index - right.index),
        students,
        classes,
      );
      const restoredEntries = withSelectedDuplicateWarnings(reconciledEntries);
      setImportSummary(completedEntries.length > 0
        ? `${completedEntries.length} previously imported pupil review(s) were left out of this working view to prevent duplicate imports.`
        : "");
      const savedCursor = readReviewCursor(selected.workbookKey);
      const activeEntry = entryKeyOverride
        ? restoredEntries.find((entry) => entry.studentKey === entryKeyOverride)
        : restoredEntries.find((entry) => entry.studentKey === savedCursor?.entryKey) ?? restoredEntries[0];
      if (entryKeyOverride && !activeEntry) {
        setError("This pupil's import is no longer awaiting reconciliation. Return to report review and refresh the list.");
        return;
      }
      const unresolvedIndex = activeEntry?.items.findIndex((item) => !item.subjectId) ?? -1;
      const savedSubjectIndex = activeEntry && savedCursor?.subjectRowKey
        ? activeEntry.items.findIndex((_item, index) => getImportSubjectRowKey(activeEntry, index) === savedCursor.subjectRowKey)
        : -1;
      const activeSubjectIndex = savedSubjectIndex >= 0 ? savedSubjectIndex : unresolvedIndex;

      setImportWorkbookKey(workbookKey);
      setImportDraftOwnerId(selected.ownerId);
      setSelectedSavedWorkbookKey(workbookSelectionKey(selected));
      setImportWorkbookFile(null);
      setImportFileName(`Saved workbook draft · ${sheetName}`);
      setImportWorkbookSheets([{
        name: sheetName,
        academicYear: "",
        term: null,
        terms: [],
        studentBlockCount: restoredEntries.length,
      }]);
      setSelectedImportSheet(sheetName);
      setImportEntries(restoredEntries);
      setDraftSaveStates(Object.fromEntries(restoredEntries.map((entry) => [entry.studentKey, { state: "saved" as const }])));
      setImportResultStates({});
      setActiveImportEntryKey(activeEntry?.studentKey ?? null);
      setActiveSubjectRowKey(activeEntry && activeSubjectIndex >= 0
        ? getImportSubjectRowKey(activeEntry, activeSubjectIndex)
        : null);
      setCompletedSubjectMappingEntryKey(activeEntry && activeSubjectIndex < 0 ? activeEntry.studentKey : null);
      setIsFinalImportPreview(false);
      setIsImportOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reopen the saved workbook draft.");
    }
  };

  useEffect(() => {
    const requestedWorkbookKey = searchParams.get("resumeWorkbook");
    if (!requestedWorkbookKey) {
      autoResumeHandled.current = null;
      return;
    }
    if (!canManage || loading || loadingSavedWorkbooks || savedWorkbookError) return;
    const requestedOwnerId = searchParams.get("resumeOwner") ?? undefined;
    const requestedEntryKey = searchParams.get("resumeEntry") ?? undefined;
    const autoResumeKey = `${requestedOwnerId ?? ""}::${requestedWorkbookKey}::${requestedEntryKey ?? ""}`;
    if (autoResumeHandled.current === autoResumeKey) return;

    const workbookExists = savedImportWorkbooks.some((workbook) =>
      workbook.workbookKey === requestedWorkbookKey && (!requestedOwnerId || workbook.ownerId === requestedOwnerId));
    if (!workbookExists) {
      autoResumeHandled.current = autoResumeKey;
      setError("This saved import review is not available to this account. Refresh the review list and try again.");
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("resumeWorkbook");
        next.delete("resumeOwner");
        next.delete("resumeEntry");
        return next;
      }, { replace: true });
      return;
    }

    autoResumeHandled.current = autoResumeKey;
    const selectedWorkbook = savedImportWorkbooks.find((workbook) =>
      workbook.workbookKey === requestedWorkbookKey && (!requestedOwnerId || workbook.ownerId === requestedOwnerId));
    if (selectedWorkbook) setSelectedSavedWorkbookKey(workbookSelectionKey(selectedWorkbook));
    void handleResumeSavedWorkbook(requestedWorkbookKey, requestedOwnerId, requestedEntryKey).finally(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("resumeWorkbook");
        next.delete("resumeOwner");
        next.delete("resumeEntry");
        return next;
      }, { replace: true });
    });
  }, [canManage, handleResumeSavedWorkbook, loading, loadingSavedWorkbooks, savedImportWorkbooks, savedWorkbookError, searchParams, setSearchParams]);

  const handleRefreshSavedWorkbooks = async (): Promise<void> => {
    setLoadingSavedWorkbooks(true);
    setSavedWorkbookError("");
    try {
      const [schoolId, workbooks] = await Promise.all([
        getImportReviewSchoolId(),
        getImportReviewWorkbooks(),
      ]);
      setImportDraftSchoolId(schoolId);
      setSavedImportWorkbooks(workbooks);
      if (!workbooks.some((workbook) => workbookSelectionKey(workbook) === selectedSavedWorkbookKey)) {
        setSelectedSavedWorkbookKey(workbooks[0] ? workbookSelectionKey(workbooks[0]) : "");
      }
    } catch (err) {
      setSavedWorkbookError(err instanceof Error ? err.message : "Unable to list saved import drafts.");
    } finally {
      setLoadingSavedWorkbooks(false);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setImportFileName(file.name);
    setImportWorkbookFile(file);
    try {
      const sheets = await inspectResultWorkbook(file);
      if (sheets.length === 0) throw new Error("The workbook does not contain any worksheets.");
      const workbookKey = await fingerprintWorkbook(file);
      setImportDraftOwnerId(user?.id ?? "");
      const selectedSheet = selectResultWorkbookSheet(sheets, session, term === "All" ? null : term);
      setImportWorkbookSheets(sheets);
      setSelectedImportSheet(selectedSheet);
      setImportWorkbookKey(workbookKey);
      await populateImportPreview(file, selectedSheet, workbookKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to inspect workbook worksheets.";
      setError(message);
    } finally {
      event.target.value = "";
    }
  };

  function validateImportMappings(
    entry: ResultImportPreviewEntry,
    studentOverride?: Student,
  ): ResultImportPreviewEntry {
    if (entry.included === false) return entry;
    const studentId = entry.selectedStudentId;
    const student = studentOverride ?? (studentId ? studentsMap.get(studentId) : undefined);
    const warnings = entry.warnings.filter((warning) =>
      !warning.startsWith("Name is only a suggested match")
      && !warning.startsWith("No exact admission-number")
      && !warning.startsWith("Admission number ")
      && !warning.startsWith("The name matches")
      && !warning.startsWith("Several students")
      && !warning.startsWith("Select the correct student before import.")
      && !warning.startsWith("Selected student is not currently")
      && !warning.startsWith("Selected student has no saved class assignment.")
      && !warning.startsWith("Class ")
      && !warning.startsWith("Subject ")
      && !warning.startsWith("You are not assigned to teach ")
    );

    entry.items.forEach((item) => {
      // Blank-mark subject rows are intentionally omitted; they need no mapping or class warning this pass.
      if (isImportItemSkippableForMissingMarks(item)) return;
      const classEntity = item.classId ? classes.find((candidate) => candidate.id === item.classId) : undefined;
      const subject = item.subjectId ? subjects.find((candidate) => candidate.id === item.subjectId) : undefined;
      if (!classEntity) warnings.push(`Class "${item.className || entry.className || "missing"}" must be resolved before import.`);
      if (!subject) warnings.push(`Subject "${item.subjectName || "missing"}" must be resolved before import.`);
      if (classEntity && studentId && studentClassMismatch(student, classEntity.id)) {
        warnings.push("Selected student is not currently in the workbook class.");
      }
      if (classEntity && isTeacher && !isAdmin
        && !teacherAssignments.some((assignment) => assignment.class_id === classEntity.id)) {
        warnings.push(`You are not the class teacher for ${classEntity.class_name}.`);
      }
    });

    if (!studentId) warnings.push("Select the correct student before import.");
    if (studentId && !student?.class_id) {
      warnings.push("Selected student has no saved class assignment. Assign a class to the pupil before importing.");
    }
    if (entry.reportKind === "Unclear") warnings.push("Choose a report type before import.");
    if (!entry.academicYear.trim()) warnings.push("Select an academic session before import.");
    if (!entry.term || entry.items.some((item) => !item.term && !entry.term)) {
      warnings.push("Select a term before import.");
    }
    return {
      ...entry,
      warnings: [...new Set(warnings)],
    };
  }

  function getExistingImportMatches(
    entry: ResultImportPreviewEntry,
    item: ResultImportPreviewEntry["items"][number],
    resultRows: Result[] = results,
  ): Result[] {
    if (!entry.selectedStudentId || !item.classId || !item.subjectId || !(item.term ?? entry.term)) return [];
    return resultRows.filter((result) =>
      result.student_id === entry.selectedStudentId
      && result.class_id === item.classId
      && result.subject_id === item.subjectId
      && result.academic_year === (item.academicYear || entry.academicYear)
      && result.term === (item.term ?? entry.term)
      && (item.assessmentType === "CA"
        ? result.assessment_type === "CA"
        : result.assessment_type === "Combined" || result.assessment_type === "Examination")
    );
  }

  const handleImportSelection = (entryIndex: number, studentId: string): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;

    const selectedStudent = studentId ? studentsMap.get(studentId) : undefined;
    if (studentId && !selectedStudent) {
      setError("That pupil is no longer in the loaded school list. Refresh the pupil list and select the registered record again.");
      return;
    }

    markDraftDirty(currentEntry.studentKey);
    const studentAssignment = resolveImportStudentAssignment(selectedStudent, classes);
    const normalizeClassName = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, "");
    const worksheetClass = classes.find((candidate) =>
      normalizeClassName(candidate.class_name) === normalizeClassName(currentEntry.className),
    );
    const existingResolvedClassId = currentEntry.items.find((item) => item.classId)?.classId;
    // Preserve a resolved worksheet class. An explicit pupil match must never silently
    // move marks into another class; a true class-number mismatch stays in draft.
    const targetClassId = existingResolvedClassId ?? worksheetClass?.id ?? studentAssignment.classId;
    const targetClass = classes.find((candidate) => candidate.id === targetClassId);
    const targetClassName = targetClass?.class_name || currentEntry.className || studentAssignment.className;
    const targetTeacherName = targetClass
      ? [targetClass.class_teacher?.first_name, targetClass.class_teacher?.last_name].filter(Boolean).join(" ")
      : studentAssignment.teacherName;

    setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(
      current,
      currentEntry.studentKey,
      (entry) => validateImportMappings({
        ...entry,
        selectedStudentId: studentId || undefined,
        matchedStudentId: studentId || undefined,
        matchStatus: studentId ? "matched" : "unmatched",
        className: targetClassName,
        teacherName: targetTeacherName || entry.teacherName,
        items: entry.items.map((item) => {
          const itemClassId = item.classId ?? targetClassId;
          const mappedClass = classes.find((candidate) => candidate.id === itemClassId);
          return {
            ...item,
            classId: itemClassId,
            className: mappedClass?.class_name ?? item.className ?? targetClassName,
          };
        }),
      }),
    )));
    setPendingStudentSelections((current) => ({ ...current, [currentEntry.studentKey]: studentId }));
  };

  const handleImportInclusionChange = (entryIndex: number, included: boolean): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;
    markDraftDirty(currentEntry.studentKey);
    const updatedEntry = included
      ? validateImportMappings({ ...currentEntry, included })
      : { ...currentEntry, included };
    setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(current, currentEntry.studentKey, (entry) => {
      const updated = { ...entry, included };
      return included ? validateImportMappings(updated) : updated;
    })));
    if (!included && activeImportEntryKey === currentEntry.studentKey) {
      setActiveImportEntryKey(null);
      setActiveSubjectRowKey(null);
    }
    void persistImportDraft(updatedEntry);
  };

  const handleReviewPupil = (entry: ResultImportPreviewEntry): void => {
    setIsFinalImportPreview(false);
    setActiveImportEntryKey(entry.studentKey);
    const firstActionIndex = getImportSubjectRowsNeedingAction(entry)[0] ?? -1;
    setActiveSubjectRowKey(firstActionIndex >= 0 ? getImportSubjectRowKey(entry, firstActionIndex) : null);
    setCompletedSubjectMappingEntryKey(firstActionIndex < 0 ? entry.studentKey : null);
    setPendingStudentSelections((current) => ({ ...current, [entry.studentKey]: entry.selectedStudentId ?? "" }));
    setSubjectSearch("");
  };

  const handleMoveToPupil = async (entry: ResultImportPreviewEntry): Promise<void> => {
    if (activeImportEntry && !(await persistImportDraft(activeImportEntry))) return;
    handleReviewPupil(entry);
  };

  const handleClosePupilReview = async (): Promise<void> => {
    if (activeImportEntry && !(await persistImportDraft(activeImportEntry))) return;
    setActiveImportEntryKey(null);
    setActiveSubjectRowKey(null);
  };

  const handleSaveProgress = async (): Promise<void> => {
    if (!activeImportEntry) return;
    const saved = await persistImportDraft(activeImportEntry);
    if (saved) setError("");
  };

  const handleDiscardImportDraft = async (entry: ResultImportPreviewEntry): Promise<void> => {
    if (!activeWorkbookDraftKey || !window.confirm(
      `Delete ${entry.studentName}'s saved review? This removes the saved review only; results already saved are not deleted.`,
    )) return;
    const saveKey = `${activeWorkbookDraftKey}:${entry.studentKey}`;
    const pendingSave = draftSaveQueue.current.get(saveKey);
    if (pendingSave) {
      try {
        await pendingSave;
      } catch {
        // The explicit discard below remains the requested final action.
      }
    }
    try {
      await deleteImportReviewDraft(activeWorkbookDraftKey, entry.studentKey, importDraftOwnerId || undefined);
      setImportEntries((current) => current.filter((candidate) => candidate.studentKey !== entry.studentKey));
      setDraftSaveStates((current) => {
        const next = { ...current };
        delete next[entry.studentKey];
        return next;
      });
      setActiveImportEntryKey(null);
      setActiveSubjectRowKey(null);
      if (user && importDraftSchoolId) {
        try {
          window.localStorage.removeItem(importReviewCursorKey(user.id, importDraftSchoolId, activeWorkbookDraftKey));
        } catch {
          setSavedWorkbookError("The pupil draft was discarded, but its saved browser cursor could not be removed.");
        }
      }
      setError("");
      await handleRefreshSavedWorkbooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to discard the saved pupil review.");
    }
  };

  const handleNextUnresolvedSubject = (entry: ResultImportPreviewEntry): void => {
    const currentIndex = entry.items.findIndex((_item, index) =>
      getImportSubjectRowKey(entry, index) === activeSubjectRowKey,
    );
    const actionIndices = getImportSubjectRowsNeedingAction(entry);
    const nextIndex = actionIndices.find((index) => index > currentIndex) ?? actionIndices[0] ?? null;
    if (nextIndex !== null) {
      setActiveSubjectRowKey(getImportSubjectRowKey(entry, nextIndex));
      setCompletedSubjectMappingEntryKey(null);
      setSubjectSearch("");
    } else {
      setActiveSubjectRowKey(null);
      setCompletedSubjectMappingEntryKey(entry.studentKey);
    }
  };

  useEffect(() => {
    if (!activeSubjectRowKey) return;
    requestAnimationFrame(() => {
      document.getElementById(activeSubjectRowKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [activeSubjectRowKey]);

  async function handleDeleteSingleImportVersion(
    review: PendingImportPupil,
    older: { workbookKey: string; ownerId: string; savedAt: string; entry: ResultImportPreviewEntry },
  ): Promise<void> {
    const date = new Date(older.savedAt);
    const dateLabel = Number.isNaN(date.getTime()) ? "date unavailable" : date.toLocaleString();
    if (!window.confirm(
      `Delete the older saved import review for ${review.entry.studentName}?\n\nSaved: ${dateLabel}\nSession: ${older.entry.academicYear}\nTerm: ${older.entry.term ?? "Unconfirmed"}\n\nThis deletes only this review snapshot. Subject marks and published results will not be deleted.`,
    )) return;
    try {
      await deleteImportReviewDraft(older.workbookKey, older.entry.studentKey, older.ownerId);
      await handleRefreshSavedWorkbooks();
      setImportSummary(`Removed the older review saved ${dateLabel} for ${review.entry.studentName}. The latest version remains.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this older review version.");
    }
  }

  async function handleDeleteOlderImportVersions(review: PendingImportPupil): Promise<void> {
    const olderVersions = review.olderVersions ?? [];
    if (!olderVersions.length) return;
    const latestDate = new Date(review.savedAt);
    const latestLabel = Number.isNaN(latestDate.getTime()) ? "the latest saved version" : latestDate.toLocaleString();
    if (!window.confirm(`Keep the latest review saved ${latestLabel} for ${review.entry.studentName} and delete ${olderVersions.length} older workbook review copy/copies?\n\nOnly saved review snapshots will be removed. Subject marks and published results will not be deleted.`)) return;
    setLoadingPendingImportPupils(true);
    const failures: string[] = [];
    for (const older of olderVersions) {
      try { await deleteImportReviewDraft(older.workbookKey, older.entry.studentKey, older.ownerId); }
      catch (err) { failures.push(err instanceof Error ? err.message : "Unable to delete an older review version."); }
    }
    await handleRefreshSavedWorkbooks();
    setLoadingPendingImportPupils(false);
    if (failures.length) setError(`Some older review copies could not be removed: ${failures.join(" ")}`);
    else setImportSummary(`Removed ${olderVersions.length} older review copies and kept the latest review for ${review.entry.studentName}.`);
  };

  const handleCloseImport = async (): Promise<void> => {
    if (isAddingImportStudent) {
      setIsAddingImportStudent(false);
      setImportStudentDraft(null);
      setImportStudentEntryKey(null);
      return;
    }
    if (activeImportEntry && !(await persistImportDraft(activeImportEntry))) return;
    setIsImportOpen(false);
    setImportEntries([]);
    setImportFileName("");
    setActiveImportEntryKey(null);
    setActiveSubjectRowKey(null);
    setIsFinalImportPreview(false);
  };

  const handleAddStudentToImport = (entryIndex: number): void => {
    const entry = importEntries[entryIndex];
    if (!entry) return;
    const nameParts = entry.studentName.trim().split(/\s+/).filter(Boolean);
    const [firstName = "", ...remainingName] = nameParts;
    const schoolClass = classes.find((candidate) => candidate.id === entry.items[0]?.classId);
    setImportStudentDraft({
      id: "",
      admission_number: entry.admissionNumber,
      first_name: firstName,
      last_name: remainingName.join(" "),
      gender: "Male",
      date_of_birth: "",
      class_id: schoolClass?.id ?? null,
      class_name: schoolClass?.class_name ?? "",
      admission_date: new Date().toISOString().slice(0, 10),
      status: "Active",
      created_at: "",
      updated_at: "",
    });
    setImportStudentEntryKey(entry.studentKey);
    setIsAddingImportStudent(true);
  };

  const handleImportStudentSaved = (savedStudent: Student): void => {
    const schoolClass = classes.find((candidate) => candidate.id === savedStudent.class_id);
    const hydratedStudent: Student = {
      ...savedStudent,
      class_name: schoolClass?.class_name ?? "",
      class_teacher: schoolClass?.class_teacher ?? null,
    };
    setStudents((current) => [
      ...current.filter((candidate) => candidate.id !== hydratedStudent.id),
      hydratedStudent,
    ]);
    if (importStudentEntryKey !== null) {
      markDraftDirty(importStudentEntryKey);
      setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(current, importStudentEntryKey, (entry) => {
        const selectedEntry = selectCreatedImportStudent(entry, hydratedStudent, classes);
        return validateImportMappings(selectedEntry, hydratedStudent);
      })));
    }
    setError("");
    setIsAddingImportStudent(false);
    setImportStudentDraft(null);
    if (importStudentEntryKey) {
      setPendingStudentSelections((current) => ({ ...current, [importStudentEntryKey]: hydratedStudent.id }));
    }
    setImportStudentEntryKey(null);
  };

  const handleImportEntityChange = (
    entryIndex: number,
    itemIndex: number,
    field: "classId" | "subjectId",
    id: string,
  ): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;
    markDraftDirty(currentEntry.studentKey);
    if (field === "classId") {
      setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(current, currentEntry.studentKey, (entry) => {
        const assignment = resolveImportStudentAssignment(id ? { class_id: id } : undefined, classes);
        const items = entry.items.map((item) => ({
          ...item,
          classId: assignment.classId,
          className: assignment.className,
        }));
        return validateImportMappings({
          ...entry,
          items,
          className: assignment.className,
          teacherName: assignment.teacherName,
        });
      })));
      return;
    }

    const selectedSubject = subjects.find((candidate) => candidate.id === id);
    const sourceItem = currentEntry.items[itemIndex];
    const sourceSubjectName = (sourceItem?.sourceSubjectName ?? sourceItem?.subjectName ?? "").trim();
    const items = currentEntry.items.map((item, currentItemIndex) => {
      if (currentItemIndex !== itemIndex) {
        return { ...item, sourceSubjectName: item.sourceSubjectName?.trim() || item.subjectName };
      }
      return {
        ...item,
        sourceSubjectName: item.sourceSubjectName?.trim() || item.subjectName,
        subjectId: selectedSubject?.id,
        subjectName: selectedSubject?.subject_name ?? item.subjectName,
      };
    });
    if (selectedSubject && sourceItem?.classId && sourceSubjectName) {
      void saveImportSubjectMapping({
        classId: sourceItem.classId,
        sourceSubjectName,
        subjectId: selectedSubject.id,
      }).then(() => {
        setImportSummary(`Remembered "${sourceSubjectName}" as "${selectedSubject.subject_name}" for ${sourceItem.className || currentEntry.className || "this class"} on future uploads.`);
      }).catch((err: unknown) => {
        setError(err instanceof Error
          ? `This subject choice remains in the current pupil review, but it could not be remembered for future uploads: ${err.message}`
          : "This subject choice remains in the current pupil review, but it could not be remembered for future uploads.");
      });
    }
    if (!selectedSubject) {
      setActiveSubjectRowKey(getImportSubjectRowKey(currentEntry, itemIndex));
      setCompletedSubjectMappingEntryKey(null);
    } else {
      const nextIndex = getNextUnresolvedImportSubjectIndex(items, itemIndex);
      setActiveSubjectRowKey(nextIndex !== null ? getImportSubjectRowKey(currentEntry, nextIndex) : null);
      setCompletedSubjectMappingEntryKey(nextIndex !== null ? null : currentEntry.studentKey);
      setSubjectSearch("");
    }
    setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(current, currentEntry.studentKey, (entry) => {
      return validateImportMappings({ ...entry, items, className: items[0]?.className ?? entry.className });
    })));
  };

  const handleAddImportSubjectRow = (entryIndex: number): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;
    const selectedStudent = currentEntry.selectedStudentId
      ? studentsMap.get(currentEntry.selectedStudentId)
      : undefined;
    const workbookClass = classes.find((candidate) =>
      candidate.class_name.trim().toLowerCase() === currentEntry.className.trim().toLowerCase()
    );
    const assignment = resolveImportStudentAssignment(
      selectedStudent ?? (workbookClass ? { class_id: workbookClass.id } : undefined),
      classes,
    );
    const assessmentType: Result["assessment_type"] =
      currentEntry.reportKind === "End-of-Term / Year Report Card" ? "Combined" : "CA";
    const newItem: ResultImportItem = {
      assessmentType,
      calculationMode: currentEntry.items[0]?.calculationMode ?? "Manual",
      reportKind: currentEntry.reportKind,
      subjectName: "",
      subjectId: undefined,
      className: assignment.className || currentEntry.className,
      classId: assignment.classId,
      teacherName: assignment.teacherName || currentEntry.teacherName,
      academicYear: currentEntry.academicYear,
      term: currentEntry.term,
      continuousAssessment: null,
      maximumScore: assessmentType === "CA" ? 40 : null,
      examination: null,
      totalScore: null,
      grade: null,
      remark: null,
      notices: [],
      invalidMarks: [],
      manualEntry: true,
      scoreInputText: assessmentType === "CA"
        ? { continuousAssessment: "", maximumScore: "40" }
        : { continuousAssessment: "", examination: "", totalScore: "" },
    };
    markDraftDirty(currentEntry.studentKey);
    setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(current, currentEntry.studentKey, (entry) => {
      const warnings = entry.warnings.filter((warning) => !warning.startsWith("No valid subject rows detected."));
      return validateImportMappings({
        ...entry,
        className: assignment.className || entry.className,
        teacherName: assignment.teacherName || entry.teacherName,
        warnings,
        items: [...entry.items, newItem],
      });
    })));
    setActiveSubjectRowKey(getImportSubjectRowKey(currentEntry, currentEntry.items.length));
    setCompletedSubjectMappingEntryKey(null);
    setSubjectSearch("");
  };

  const handleRemoveImportSubjectRow = (entryIndex: number, itemIndex: number): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry?.items[itemIndex]?.manualEntry) return;
    markDraftDirty(currentEntry.studentKey);
    setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(current, currentEntry.studentKey, (entry) =>
      validateImportMappings({
        ...entry,
        items: entry.items.filter((_, index) => index !== itemIndex),
      })
    )));
    setActiveSubjectRowKey(null);
    setCompletedSubjectMappingEntryKey(null);
  };

  const handleRestoreSkippedImportRows = (entryIndex: number): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry?.skippedItems?.length) return;
    markDraftDirty(currentEntry.studentKey);
    setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(current, currentEntry.studentKey, (entry) =>
      validateImportMappings({
        ...entry,
        items: [...entry.items, ...(entry.skippedItems ?? [])],
        skippedItems: [],
      })
    )));
    setActiveSubjectRowKey(null);
    setCompletedSubjectMappingEntryKey(null);
  };

  const handleImportTeacherNameChange = (entryIndex: number, teacherName: string): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;
    markDraftDirty(currentEntry.studentKey);
    setImportEntries((current) => updateImportEntryByKey(current, currentEntry.studentKey, (entry) => ({ ...entry, teacherName })));
  };

  const handleImportItemChange = (
    entryIndex: number,
    itemIndex: number,
    field: "grade" | "remark",
    value: string | null,
  ): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;
    markDraftDirty(currentEntry.studentKey);
    setImportEntries((current) => updateImportSubjectByKey(current, currentEntry.studentKey, itemIndex, (item) => {
        const updatedItem = {
          ...item,
          [field]: value,
        };
        if (item.calculationMode === "Automatic") {
          const calculated = calculateResult(updatedItem.assessmentType, updatedItem.continuousAssessment, updatedItem.examination);
          updatedItem.totalScore = calculated.total;
          updatedItem.grade = calculated.grade;
          updatedItem.remark = calculated.remark;
        }
        return updatedItem;
      }));
  };

  const handleImportScoreChange = (
    entryIndex: number,
    itemIndex: number,
    field: ResultImportScoreField,
    text: string,
  ): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;
    markDraftDirty(currentEntry.studentKey);
    const parsed = parseScoreInput(text);
    setImportEntries((current) => updateImportSubjectByKey(current, currentEntry.studentKey, itemIndex, (item) => {
      const invalidField = field === "continuousAssessment"
        ? "CA"
        : field === "maximumScore"
          ? "maximum score"
          : field === "examination"
            ? "examination"
            : "total";
      const updatedItem = {
        ...item,
        [field]: parsed.value,
        scoreInputText: { ...item.scoreInputText, [field]: text },
        invalidMarks: item.invalidMarks?.filter((invalid) => invalid !== invalidField),
      };
      if (item.calculationMode === "Automatic") {
        const calculated = calculateResult(updatedItem.assessmentType, updatedItem.continuousAssessment, updatedItem.examination);
        updatedItem.totalScore = calculated.total;
        updatedItem.grade = calculated.grade;
        updatedItem.remark = calculated.remark;
        updatedItem.scoreInputText.totalScore = formatScoreInput(calculated.total);
      }
      return updatedItem;
    }));
  };

  const handleImportReportDetailChange = (
    entryIndex: number,
    field: ImportReportDetailField,
    value: string,
  ): void => {
    const numericFields = new Set([
      "classAverage", "totalMarksObtained", "totalMarksObtainable", "studentPercentage",
      "maximumAttendance", "timesPresent", "timesAbsent",
    ]);
    const isNumericField = (candidate: ImportReportDetailField): candidate is ResultImportReportDetailNumericField =>
      numericFields.has(candidate as ResultImportReportDetailNumericField);
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;
    markDraftDirty(currentEntry.studentKey);
    setImportEntries((current) => updateImportEntryByKey(current, currentEntry.studentKey, (entry) => {
      const currentDetails = entry.reportDetails ?? {
        age: "",
        classAverage: null,
        totalMarksObtained: null,
        totalMarksObtainable: null,
        studentPercentage: null,
        maximumAttendance: null,
        timesPresent: null,
        timesAbsent: null,
        termEnding: "",
        nextTermBegins: "",
        classTeacherComment: "",
        headTeacherComment: "",
      };
      if (isNumericField(field)) {
        const parsed = parseScoreInput(value);
        const reportDetails = { ...currentDetails, [field]: parsed.value };
        return {
          ...entry,
          reportDetails,
          reportDetailInputText: { ...entry.reportDetailInputText, [field]: value },
        };
      }
      return { ...entry, reportDetails: { ...currentDetails, [field]: value } };
    }));
  };

  const handleImportPeriodChange = (
    entryIndex: number,
    field: "academicYear" | "term",
    value: string,
  ): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;
    markDraftDirty(currentEntry.studentKey);
    setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(current, currentEntry.studentKey, (entry) => {
      const updated = field === "academicYear"
        ? { ...entry, academicYear: value, items: entry.items.map((item) => ({ ...item, academicYear: value })) }
        : {
          ...entry,
          term: value ? value as Result["term"] : null,
          items: entry.items.map((item) => ({ ...item, term: value ? value as Result["term"] : null })),
        };
      return validateImportMappings(updated);
    })));
  };

  const handleImportModeChange = (entryIndex: number, mode: "Manual" | "Automatic"): void => {
    const entry = importEntries[entryIndex];
    if (!entry) return;
    markDraftDirty(entry.studentKey);
    if (mode === "Automatic" && entry.items.some((item) => item.totalScore !== null || item.grade || item.remark)
      && !window.confirm("Automatic calculation will replace entered totals, grades and remarks where marks allow. Continue?")) return;

    setImportEntries((current) => updateImportEntryByKey(current, entry.studentKey, (candidate) => ({
      ...candidate,
      items: candidate.items.map((item) => {
        if (mode === "Manual") {
          return {
            ...item,
            calculationMode: mode,
            scoreInputText: { ...item.scoreInputText, totalScore: formatScoreInput(item.totalScore) },
          };
        }
        const calculated = calculateResult(item.assessmentType, item.continuousAssessment, item.examination);
        return {
          ...item,
          calculationMode: mode,
          totalScore: calculated.total,
          scoreInputText: { ...item.scoreInputText, totalScore: formatScoreInput(calculated.total) },
          grade: calculated.grade,
          remark: calculated.remark,
        };
      }),
    })));
  };

  const handleImportReportKindChange = (entryIndex: number, reportKind: ResultImportReportKind): void => {
    const currentEntry = importEntries[entryIndex];
    if (!currentEntry) return;
    markDraftDirty(currentEntry.studentKey);
    setImportEntries((current) => withSelectedDuplicateWarnings(updateImportEntryByKey(current, currentEntry.studentKey, (entry) => {
      const assessmentType: Result["assessment_type"] = reportKind === "Midterm / Continuous Assessment" ? "CA" : "Combined";
      const items = entry.items.map((item) => ({
        ...item,
        reportKind,
        assessmentType,
        continuousAssessment: item.continuousAssessment,
        maximumScore: assessmentType === "CA" ? item.maximumScore : null,
        examination: assessmentType === "CA" ? null : item.examination,
        totalScore: assessmentType === "CA" ? null : item.calculationMode === "Automatic"
          ? calculateResult("Combined", item.continuousAssessment, item.examination).total
          : item.totalScore,
        grade: assessmentType === "CA" ? null : item.calculationMode === "Automatic"
          ? calculateResult("Combined", item.continuousAssessment, item.examination).grade
          : item.grade,
        remark: assessmentType === "CA" ? null : item.calculationMode === "Automatic"
          ? calculateResult("Combined", item.continuousAssessment, item.examination).remark
          : item.remark,
      }));
      return validateImportMappings({ ...entry, reportKind, assessmentType, items });
    })));
  };

  const publishSavedResultPeriod = async (
    params: PublishSavedPeriodParams,
    requireConfirmation = true,
  ): Promise<void> => {
    if (!isAdmin) throw new Error("Only an administrator can publish results.");
    if (requireConfirmation && !window.confirm(
      `Publish ${params.reportType === "Midterm" ? "midterm" : "end-of-term"} results for this pupil?\n\nClass: ${classes.find((item) => item.id === params.classId)?.class_name ?? "Class unavailable"}\nSession: ${params.academicYear}\nTerm: ${params.term} Term\n\nThe saved subject marks will be checked and their Published status verified. No parent messages are sent.`,
    )) throw new Error("Publication was cancelled. The saved marks remain available in Results.");
    const refreshedResults = await getResults();
    const isMidterm = params.reportType === "Midterm";
    const periodResults = refreshedResults.filter((result) =>
      result.student_id === params.studentId && result.class_id === params.classId
      && result.academic_year === params.academicYear && result.term === params.term
      && (isMidterm ? result.assessment_type === "CA"
        : result.assessment_type === "Combined" || result.assessment_type === "Examination"),
    );
    if (periodResults.length === 0) throw new Error("No saved subject results were found for this pupil and period. Refresh Results before publishing.");
    const publishablePeriodResults = getReportCenterResultsWithRecordedMarks(periodResults);
    if (publishablePeriodResults.length === 0) {
      throw new Error("No complete subject marks are available to publish yet. Incomplete subject rows remain drafts; enter their marks later and publish the complete rows when ready.");
    }
    const pendingResults = publishablePeriodResults.filter((result) => result.status !== "Published");
    if (pendingResults.length > 0) {
      const reason = getReportCenterPublishBlockReason({
        key: [params.studentId, params.classId, params.academicYear, params.term, params.reportType].join("|"),
        studentId: params.studentId, classId: params.classId, academicYear: params.academicYear,
        term: params.term, reportType: params.reportType, results: publishablePeriodResults,
      }, refreshedResults, isAdmin);
      if (reason) throw new Error(reason);
      const outcome = await publishReportResultsAndVerify(pendingResults, publishResult, getResults);
      if (!outcome.refreshedResults) throw new Error("The publish result could not be verified. Refresh the saved status before trying again.");
      setResults(outcome.refreshedResults);
      if (outcome.failures.length > 0 || outcome.publishedResultIds.length !== pendingResults.length) {
        const names = new Map(pendingResults.map((result) => [result.id, result.subject_name?.trim() || result.id]));
        const details = outcome.failures.map((failure) => `${names.get(failure.resultId) ?? failure.resultId}: ${failure.message}`).join(" ");
        throw new Error(`Published and verified ${outcome.publishedResultIds.length} of ${pendingResults.length} subject results. ${details}`);
      }
    } else setResults(refreshedResults);
    window.dispatchEvent(new Event("grandessa:results-updated"));
  };

  const handleConfirmImport = async (publishAfterSave = false, targetStudentKey?: string): Promise<void> => {
    const selectedEntries = targetStudentKey
      ? readyImportEntries.filter((entry) => entry.studentKey === targetStudentKey)
      : readyImportEntries;
    if (selectedEntries.length === 0) {
      if (targetStudentKey) {
        setError("This pupil is not ready to save. Complete the highlighted pupil, subject and mark issues first.");
        return;
      }
      const includedEntries = importEntries.filter((entry) => entry.included !== false);
      setError(includedEntries.length === 0
        ? "Include at least one pupil before importing."
        : "There are no included, ready pupils to import. Resolve the remaining issues or mark those pupils Ignore.");
      return;
    }
    const invalidReportDates = selectedEntries.flatMap((entry) =>
      getImportReportDateErrors(entry).map((dateError) => `${entry.studentName}: ${dateError}`),
    );
    if (invalidReportDates.length > 0) {
      setError(`Correct the report-card dates before importing: ${invalidReportDates.join(" ")}`);
      return;
    }
    if (importPeriodConflict) {
      setError("Choose a worksheet that matches the requested session and term before importing.");
      return;
    }
    if (publishAfterSave && !isAdmin) {
      setError("Only an administrator can publish results.");
      return;
    }
    if (publishAfterSave && !window.confirm(`Save and publish the ${selectedEntries.length} ready pupil result set(s)?\n\nEach pupil's subject marks will be checked and publication verified. Any pupil that fails a genuine check will remain unpublished and be listed for review. No parent messages are sent.`)) return;

    setImportSubmitting(true);
    setError("");

    try {
      const currentResults = await getResults();
      const outcomes = await saveImportEntriesIndependently(selectedEntries, async (entry) => {
        const studentId = entry.selectedStudentId;
        if (!studentId) throw new Error("Select a student record before importing this pupil.");
        const student = studentsMap.get(studentId);
        if (!student) throw new Error("Import preview is out of date. Reload the workbook and select the pupil again.");

        const entryCreates: Array<Omit<Result, "id" | "created_at" | "updated_at">> = [];
        const entryUpdates: Array<{ id: string; values: Partial<Result> }> = [];
        const reusedExistingResultIds: string[] = [];
        let reused = 0;

        const itemsToSave = getImportItemsForSave(entry);
        if (itemsToSave.length === 0) {
          throw new Error("No complete subject marks are available to save for this pupil. Enter at least one complete subject row.");
        }
        const skippedMissingMarkItems = entry.items.filter(isImportItemSkippableForMissingMarks);
        for (const [itemIndex, item] of entry.items.entries()) {
          if (isImportItemSkippableForMissingMarks(item)) continue;
          const classEntity = classes.find((candidate) => candidate.id === item.classId);
          const subject = subjects.find((candidate) => candidate.id === item.subjectId);
          const resultTerm = item.term ?? entry.term;
          if (!classEntity || !subject) throw new Error("Import preview is out of date. Reload the workbook and correct its class or subject matches.");
          if (!resultTerm) throw new Error("Workbook term is missing. Import cancelled without saving this pupil's results.");

          const values = buildReviewedImportResultValues({
            studentId: student.id,
            classId: classEntity.id,
            className: classEntity.class_name,
            subjectId: subject.id,
            subjectName: subject.subject_name,
            teacherId: classEntity.class_teacher_id ?? undefined,
            teacherName: entry.teacherName.trim(),
            academicYear: item.academicYear || entry.academicYear,
            term: resultTerm,
            item,
          });
          const matches = getExistingImportMatches(entry, item, currentResults);
          if (matches.length > 1) {
            throw new Error(`More than one saved ${subject.subject_name} result exists for ${student.first_name} ${student.last_name}. Resolve the duplicate result records before importing this pupil.`);
          }
          const choice = importExistingChoices[importItemKey(entry, itemIndex)];
          const decision = resolveExistingResultImportDecision(matches, choice);
          if (decision.action === "skip") {
            const existing = matches[0];
            if (!existing || !["Draft", "Published"].includes(existing.status)
              || !areImportedResultValuesEquivalent(existing, values)) {
              throw new Error(existing?.status === "Published"
                ? `The published ${subject.subject_name} result for ${student.first_name} ${student.last_name} differs from this worksheet. Do not overwrite a published result from an upload; review it through the normal results workflow.`
                : existing && existing.status !== "Draft"
                  ? `The ${subject.subject_name} result is currently ${existing.status}. Use the normal results review process before updating it from a workbook.`
                  : `The saved ${subject.subject_name} result for ${student.first_name} ${student.last_name} has different marks. Choose an eligible Draft result to update, or correct the worksheet marks before saving.`);
            }
            reusedExistingResultIds.push(existing.id);
            reused += 1;
            continue;
          }

          const updateTarget = decision.action === "update" ? decision.result : undefined;
          if (updateTarget && updateTarget.status !== "Draft") {
            throw new Error(`Only Draft subject results can be updated from a workbook. ${subject.subject_name} is currently ${updateTarget.status}; use the normal results review process.`);
          }
          if (updateTarget && !isAdmin
            && (!user || !canTeacherEditResult(updateTarget, user.id, teacherAssignments))) {
            throw new Error(`You no longer have permission to update ${student.first_name} ${student.last_name}'s ${subject.subject_name} result.`);
          }

          if (updateTarget) entryUpdates.push({ id: updateTarget.id, values });
          else entryCreates.push({ ...values, status: "Draft" });
        }

        if (entryUpdates.length + entryCreates.length + reusedExistingResultIds.length !== itemsToSave.length) {
          throw new Error("Every subject must be linked to one saved or new result before this pupil can be saved.");
        }
        const targetResultIds = [
          ...entryUpdates.map((update) => update.id),
          ...reusedExistingResultIds,
        ];
        if (new Set(targetResultIds).size !== targetResultIds.length) {
          throw new Error("The same saved subject result was selected more than once. Refresh the pupil review before saving.");
        }

        const reportClassId = itemsToSave[0]?.classId;
        if (!reportClassId || !entry.term) throw new Error("A saved class and term are required for the report card.");
        const workbookKey = activeWorkbookDraftKey;
        const ownerId = importDraftOwnerId || user?.id;
        if (!workbookKey || !ownerId) throw new Error("The saved pupil review could not be identified. Reopen the pupil from Reports and try again.");

        // Save the review first so a failed transaction leaves the pupil's corrections available.
        // Marks, report-card details and exact result links are then saved together.
        const trackingEntry: ResultImportPreviewEntry = {
          ...entry,
          items: itemsToSave,
          skippedItems: [
            ...(entry.skippedItems ?? []),
            ...skippedMissingMarkItems,
          ],
        };
        await saveImportReviewDraft({ workbookKey, entry: trackingEntry, ownerId });
        const details = entry.reportDetails;
        const termEnding = normalizeImportDate(details?.termEnding ?? "", "Term ending");
        const nextTermBegins = normalizeImportDate(details?.nextTermBegins ?? "", "Next term begins");
        const saveOutcome = await saveImportedReportCard({
          updates: entryUpdates,
          inserts: entryCreates,
          tracking: {
            workbookKey,
            entryKey: entry.studentKey,
            ownerId,
            existingResultIds: reusedExistingResultIds,
          },
          reportDetails: {
            studentId,
            academicYear: entry.academicYear,
            term: entry.term,
            classId: reportClassId,
            reportType: entry.reportKind === "Midterm / Continuous Assessment" ? "Midterm" : "End-of-Term",
            calculationMode: itemsToSave[0]?.calculationMode ?? "Manual",
            classTeacherName: entry.teacherName,
            classTeacherComment: details?.classTeacherComment ?? "",
            headTeacherComment: details?.headTeacherComment ?? "",
            classAverage: details?.classAverage ?? null,
            totalMarksObtained: details?.totalMarksObtained ?? null,
            totalMarksObtainable: details?.totalMarksObtainable ?? null,
            studentPercentage: details?.studentPercentage ?? null,
            maximumAttendance: details?.maximumAttendance ?? null,
            timesPresent: details?.timesPresent ?? null,
            timesAbsent: details?.timesAbsent ?? null,
            termEnding: termEnding.value,
            nextTermBegins: nextTermBegins.value,
          },
        });

        let wasPublished = saveOutcome.workflowStatus === "published";
        let publicationError = "";
        if (publishAfterSave && !wasPublished) {
          try {
            await publishSavedResultPeriod({
              studentId: student.id, classId: reportClassId, academicYear: entry.academicYear,
              term: entry.term,
              reportType: entry.reportKind === "Midterm / Continuous Assessment" ? "Midterm" : "End-of-Term",
            }, false);
            wasPublished = true;
          } catch (publishError) {
            publicationError = publishError instanceof Error ? publishError.message : "Publication failed; the saved marks remain available in Results.";
          }
        }
        return {
          name: formatName(student.first_name, student.last_name),
          created: entryCreates.length,
          updated: entryUpdates.length,
          reused,
          workflowStatus: wasPublished ? "published" as const : saveOutcome.workflowStatus,
          published: wasPublished,
          publicationError,
        };
      });

      outcomes.saved.forEach(({ entry }) => setImportResultStates((current) => ({
        ...current,
        [entry.studentKey]: { state: "saved" },
      })));
      outcomes.failed.forEach(({ entry, error: failure }) => setImportResultStates((current) => ({
        ...current,
        [entry.studentKey]: { state: "failed", error: failure },
      })));
      const successfulNames = outcomes.saved.map(({ value }) => value.name);
      const failedNames = outcomes.failed.map(({ entry, error: failure }) => `${entry.studentName || "Unknown pupil"}: ${failure}`);
      const createdRows = outcomes.saved.reduce((total, { value }) => total + value.created, 0);
      const updatedRows = outcomes.saved.reduce((total, { value }) => total + value.updated, 0);
      const reusedRows = outcomes.saved.reduce((total, { value }) => total + value.reused, 0);
      const verifiedStatuses = outcomes.saved.map(({ entry, value }) =>
        `${entry.studentName}: ${value.workflowStatus === "published" ? "already published" : "saved as draft"}`,
      );
      await loadData();
      const publicationWarnings = outcomes.saved.filter(({ value }) => Boolean(value.publicationError))
        .map(({ value }) => `${value.name}: ${value.publicationError}`);
      const publishedNames = outcomes.saved.filter(({ value }) => value.published).map(({ value }) => value.name);
      const savedAsDraftNames = outcomes.saved.filter(({ value }) => !value.published).map(({ value }) => value.name);
      setError([
        failedNames.length > 0 ? `Import failed for ${failedNames.join("; ")}` : "",
        publicationWarnings.length > 0 ? `Not published or tracking needs attention: ${publicationWarnings.join("; ")}` : "",
      ].filter(Boolean).join(". "));
      setImportSummary([
        successfulNames.length > 0 ? `Saved: ${successfulNames.join(", ")}.` : "",
        publishedNames.length > 0 ? `Published and verified: ${publishedNames.join(", ")}.` : "",
        (publishAfterSave && savedAsDraftNames.length > 0) ? `Saved but still unpublished: ${savedAsDraftNames.join(", ")}.` : "",
        failedNames.length > 0 ? `Failed to save: ${failedNames.join("; ")}.` : "",
        `Created ${createdRows} result row(s), updated ${updatedRows}, reused ${reusedRows} exact matches.`,
        verifiedStatuses.length > 0 ? `Saved status: ${verifiedStatuses.join("; ")}.` : "",
      ].filter(Boolean).join(" "));
      const allSelectedPupilsSaved = outcomes.failed.length === 0 && outcomes.saved.length === selectedEntries.length;
      if (allSelectedPupilsSaved) {
        setIsImportOpen(false);
        setImportEntries([]);
        setImportFileName("");
        setActiveImportEntryKey(null);
        setActiveSubjectRowKey(null);
        setIsFinalImportPreview(false);
        window.dispatchEvent(new Event("grandessa:results-updated"));
        requestAnimationFrame(() => {
          document.getElementById("publish-arena-reports")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        if (!embedded) navigate("/admin/results");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to import results.";
      setError(message);
      selectedEntries.forEach((entry) => setImportResultStates((current) => ({
        ...current,
        [entry.studentKey]: { state: "failed", error: message },
      })));
    } finally {
      setImportSubmitting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="card" style={{ padding: 30 }}>
        <h2 style={{ marginTop: 0 }}>Results Module</h2>
        <p>Your role does not have permission to manage results.</p>
      </div>
    );
  }

  return (
    <>
      <motion.div id="results-entry-workspace" style={{ scrollMarginTop: 18 }} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#172b4d", fontFamily: "Fredoka", fontSize: 25 }}>{embedded ? "Enter or import marks" : "Results"}</h2>
            <p style={{ marginTop: 7, marginBottom: 0, color: "#64748b", fontFamily: "Poppins", lineHeight: 1.6, maxWidth: 680 }}>
              {embedded ? "Use a spreadsheet or enter marks manually. Both go through the same pupil review and report-publishing flow below." : "Manage pupil marks and publication status in one workspace."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {!embedded ? (
              <>
                <ResultsNotificationBell
                  results={results}
                  isAdministrator={isAdmin}
                  isTeacher={isTeacher && !isAdmin}
                  onOpen={(notice: ResultNotice) => {
                    setStatus(notice.status);
                    setClassId(notice.classId);
                    setSession(notice.academicYear);
                    setTerm(notice.term);
                    setReportType(notice.assessmentType === "CA" ? "Midterm" : "End-of-Term");
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => void loadData()} disabled={loading}>Refresh</Button>
                <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 12, fontWeight: 700 }}>
                  Import type
                  <select value={importReportKind} onChange={(event) => setImportReportKind(event.target.value as ImportReportKindSelection)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}>
                    <option value="Auto-detect">Auto-detect</option>
                    <option value="Midterm / Continuous Assessment">Midterm / Continuous Assessment</option>
                    <option value="End-of-Term / Year Report Card">End-of-Term / Year Report Card</option>
                  </select>
                </label>
              </>
            ) : null}
            <label style={{ display: "inline-flex" }}>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void handleImportFile(event)} hidden />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "#e2e8f0", color: "#0f172a", fontWeight: 700, cursor: "pointer" }}>
                <Upload size={16} />
                Import spreadsheet
              </span>
            </label>
            <Button type="button" onClick={() => {
              setResumeBatchResult(null);
              setIsBatchOpen(true);
            }} disabled={loading || (isTeacher && !isAdmin && teacherAssignments.length === 0)}>
              <FilePlus2 size={16} />
              Enter marks
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAdd}
              disabled={loading || (isTeacher && !isAdmin && teacherAssignments.length === 0)}
            >
              Add one subject
            </Button>
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        ) : null}

        {savedWorkbookError ? (
          <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>
            {savedWorkbookError}
          </div>
        ) : null}

        {importSummary ? (
          <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 360px", minWidth: 0 }}>{importSummary}</div>
            {!embedded ? (
              <Button type="button" onClick={() => navigate("/admin/results")} style={{ minHeight: 48, padding: "12px 18px", background: "#1d4ed8", borderColor: "#1d4ed8", fontWeight: 900 }}>
                OPEN RESULTS / PUBLISH ARENA →
              </Button>
            ) : null}
          </div>
        ) : null}

        {isAdmin ? (
          <section className="card" aria-labelledby="imports-awaiting-reconciliation-results" style={{ marginBottom: 20, padding: 18, border: "1px solid #c7d2fe", background: "linear-gradient(180deg,#ffffff 0%,#f8faff 100%)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 id="imports-awaiting-reconciliation-results" style={{ margin: 0 }}>Imports awaiting reconciliation</h2>
                  <span style={{ borderRadius: 999, background: pendingImportPupils.length > 0 ? "#fef3c7" : "#dcfce7", color: pendingImportPupils.length > 0 ? "#92400e" : "#166534", padding: "4px 9px", fontSize: 12, fontWeight: 700 }}>
                    {loadingPendingImportPupils ? "Checking…" : `${pendingImportPupils.length} pupil review(s)`}
                  </span>
                </div>
                <p style={{ color: "#475569", margin: "6px 0 0" }}>
                  These are saved Excel reviews waiting for action. Each pupil and period appears once, even if saved from more than one workbook upload. Check the registered pupil, class, assigned class teacher, subjects and marks before saving results. Nothing is published from this review.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button type="button" variant="secondary" onClick={() => void handleRefreshSavedWorkbooks()} disabled={loadingSavedWorkbooks || loadingPendingImportPupils}>
                  Refresh imports
                </Button>
                {!embedded ? <Button type="button" variant="secondary" onClick={() => navigate("/admin/results")}>Return to Results</Button> : null}
              </div>
            </div>

            {pendingImportPupilsError ? (
              <div role="alert" style={{ marginTop: 12, padding: 10, border: "1px solid #fecaca", borderRadius: 10, background: "#fef2f2", color: "#991b1b" }}>
                {pendingImportPupilsError}
              </div>
            ) : null}
            {loadingPendingImportPupils ? (
              <p role="status" style={{ color: "#64748b", margin: "14px 0 0" }}>Loading outstanding pupil imports…</p>
            ) : pendingImportPupils.length === 0 ? (
              <p style={{ color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, margin: "14px 0 0" }}>
                {pendingImportPupilsError ? "Outstanding imports could not be confirmed. Refresh to retry." : "No outstanding imports to reconcile."}
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 14, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
                {pendingImportPupils.map((review) => {
                  const entry = review.entry;
                  const entryWithSource = entry as ResultImportPreviewEntry & { sourceStudentName?: string };
                  const worksheetName = entryWithSource.sourceStudentName?.trim() || entry.studentName;
                  const possiblePupil = students.find((candidate) => candidate.id === entry.matchedStudentId);
                  const confirmedPupil = students.find((candidate) => candidate.id === entry.selectedStudentId);
                  const displayName = entry.matchStatus === "matched" && confirmedPupil
                    ? `${confirmedPupil.first_name} ${confirmedPupil.last_name}`.trim()
                    : worksheetName;
                  const rosterCandidate = confirmedPupil ?? possiblePupil;
                  const officialClass = rosterCandidate?.class_id
                    ? classes.find((candidate) => candidate.id === rosterCandidate.class_id)
                    : possiblePupil
                      ? undefined
                      : classes.find((candidate) => candidate.id === entry.items.find((item) => item.classId)?.classId);
                  const progress = getPendingImportPupilStatus(entry);
                  const reportTypeLabel = entry.reportKind === "Midterm / Continuous Assessment"
                    ? "Midterm (CA)"
                    : entry.reportKind === "End-of-Term / Year Report Card"
                      ? "End-of-Term"
                      : "Report type to confirm";
                  const params = new URLSearchParams({
                    resumeWorkbook: review.workbookKey,
                    resumeOwner: review.ownerId,
                    resumeEntry: entry.studentKey,
                  });
                  return (
                    <article key={`${review.ownerId}::${review.workbookKey}::${entry.studentKey}`} style={{ display: "grid", gap: 7, border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff", minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: 16, overflowWrap: "anywhere" }}>{displayName}</h3>
                          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                            {entry.matchStatus === "matched" && confirmedPupil ? (
                              <>Registered class: {officialClass?.class_name || confirmedPupil.class_name || "Needs confirmation"}</>
                            ) : possiblePupil ? (
                              <>Worksheet class: {entry.className || "Needs confirmation"} · School record class: {officialClass?.class_name || possiblePupil.class_name || "Needs confirmation"}</>
                            ) : (
                              <>Class: {officialClass?.class_name || entry.className || "Needs confirmation"}</>
                            )}
                          </p>
                          <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 13 }}>
                            {entry.academicYear || "Session to confirm"} · {entry.term ? `${entry.term} Term` : "Term to confirm"} · {reportTypeLabel}
                          </p>
                          {worksheetName !== displayName ? (
                            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Name on worksheet: {worksheetName}</p>
                          ) : null}
                          {entry.matchStatus !== "matched" && possiblePupil ? (
                            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Suggested school record: {possiblePupil.first_name} {possiblePupil.last_name}</p>
                          ) : null}
                        </div>
                        <span style={statusBadgeStyle(progress.label)}>{progress.label}</span>
                      </div>
                      <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>{progress.explanation}</p>
                      {entry.matchStatus !== "matched" || possiblePupil ? (
                        <details style={{ border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", background: "#fffbeb" }}>
                          <summary style={{ cursor: "pointer", color: "#334155", fontSize: 13, fontWeight: 700 }}>Pupil and class details</summary>
                          <div style={{ display: "grid", gap: 5, marginTop: 8, fontSize: 13, color: "#78350f", overflowWrap: "anywhere" }}>
                            <div><strong>Name on worksheet:</strong> {worksheetName || "Not detected"}</div>
                            <div><strong>Registered pupil:</strong> {possiblePupil ? [possiblePupil.first_name, possiblePupil.middle_name, possiblePupil.last_name].filter(Boolean).join(" ") : confirmedPupil ? [confirmedPupil.first_name, confirmedPupil.middle_name, confirmedPupil.last_name].filter(Boolean).join(" ") : "No pupil has been confirmed yet"}</div>
                            <div><strong>Worksheet class:</strong> {entry.className || "Not detected"}</div>
                            <div><strong>Registered class:</strong> {officialClass?.class_name || rosterCandidate?.class_name || "Not confirmed"}</div>
                            <div>Use the class and admission number above to confirm the school record.</div>
                          </div>
                        </details>
                      ) : null}
                       <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>
                         Latest review saved: {Number.isNaN(new Date(review.savedAt).getTime()) ? "date unavailable" : new Date(review.savedAt).toLocaleString()} · Imported from Excel
                       </p>
                       {review.duplicateCount > 1 ? (
                         <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                           <p style={{ margin: 0, color: "#92400e", fontSize: 12 }}>{review.duplicateCount} saved versions across {review.duplicateWorkbookCount} uploads.</p>
                           <Button type="button" size="sm" variant="secondary" onClick={() => void handleDeleteOlderImportVersions(review)}>Delete {review.olderVersions?.length ?? 0} older version(s)</Button>
                         </div>
                       ) : null}
                      {review.olderVersions?.length ? (
                        <details style={{ marginTop: 5, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                          <summary style={{ cursor: "pointer", color: "#334155", fontSize: 12, fontWeight: 700 }}>
                            View older versions and saved dates ({review.olderVersions.length})
                          </summary>
                          <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
                            {review.olderVersions.map((older, olderIndex) => {
                              const olderDate = new Date(older.savedAt);
                              const olderDateLabel = Number.isNaN(olderDate.getTime()) ? "date unavailable" : olderDate.toLocaleString();
                              const separator = older.workbookKey.indexOf(":");
                              const olderSheet = separator >= 0 ? older.workbookKey.slice(separator + 1) : "Saved worksheet";
                              return (
                                <div key={`${older.ownerId}::${older.workbookKey}::${older.entry.studentKey}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderTop: "1px solid #e2e8f0", paddingTop: 7 }}>
                                  <span style={{ color: "#475569", fontSize: 12 }}>
                                    Older copy {olderIndex + 1} · {olderDateLabel} · {olderSheet}
                                  </span>
                                  <Button type="button" size="sm" variant="secondary" onClick={() => void handleDeleteSingleImportVersion(review, older)}>
                                    Delete this version
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      ) : null}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ color: "#64748b", fontSize: 12 }}>Worksheet: {review.sheetName}{review.ownerName ? ` · Saved by ${review.ownerName}` : ""}</span>
                        <Button type="button" size="sm" onClick={() => navigate(`/admin/results?${params.toString()}`)}>Open saved review</Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {!embedded ? (
        <section className="card" aria-labelledby="saved-result-drafts-heading" style={{ marginBottom: 20, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 id="saved-result-drafts-heading" style={{ margin: 0 }}>Saved Result Drafts</h2>
              <p style={{ color: "#64748b", margin: "6px 0 0" }}>
                Saved subject drafts are grouped by pupil and period. Each group is labelled Imported, Manual, or Mixed. Actual publish actions are available in the pupil report list above.
              </p>
            </div>
            <span>{savedResultDraftGroups.length} pupil/period group(s)</span>
          </div>
          {loading ? (
            <p role="status" style={{ color: "#64748b", marginBottom: 0 }}>Loading saved result drafts…</p>
          ) : savedResultDraftGroups.length === 0 ? (
            <p style={{ color: "#64748b", marginBottom: 0 }}>No saved result drafts are available.</p>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {savedResultDraftGroups.map((group) => {
                const student = studentsMap.get(group.studentId);
                const className = classes.find((candidate) => candidate.id === group.classId)?.class_name
                  ?? group.results[0]?.class_name
                  ?? "Class unavailable";
                const assessmentName = group.assessmentType === "CA"
                  ? "Midterm · CA"
                  : group.assessmentType === "Examination"
                    ? "End-of-Term · Examination"
                    : "End-of-Term · Combined";
                return (
                  <details key={group.key} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                      {student ? formatName(student.first_name, student.last_name) : "Pupil unavailable"}
                      {" · "}{group.results.length} subject draft(s)
                      <span style={{ display: "block", color: "#64748b", fontSize: 13, fontWeight: 400, marginTop: 3 }}>
                        {className} · {group.academicYear} · {group.term} Term · {assessmentName}
                      </span>
                      <span style={{ display: "inline-block", marginTop: 5, borderRadius: 999, padding: "2px 8px", background: "#f1f5f9", color: "#334155", fontSize: 11, fontWeight: 700 }}>
                        {group.results.every((row) => importedResultIds.has(row.id)) ? "Imported" : group.results.some((row) => importedResultIds.has(row.id)) ? "Mixed" : "Manual"}
                      </span>
                    </summary>
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      {group.results.map((result) => {
                        const subject = subjects.find((candidate) => candidate.id === result.subject_id);
                        return (
                          <article key={result.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                            <div style={{ color: "#475569", fontSize: 13 }}>
                              <strong style={{ color: "#1f2937" }}>{subject?.subject_name ?? result.subject_name ?? "Subject unavailable"}</strong>
                              <span> · CA {result.continuous_assessment?.toFixed(2) ?? "—"}</span>
                              <span> · Exam {result.examination?.toFixed(2) ?? "—"}</span>
                              <span> · Total {result.total_score?.toFixed(2) ?? "—"}</span>
                              <span> · {result.status}</span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={!student || !result.subject_id}
                              onClick={() => {
                                setResumeBatchResult(result);
                                setIsBatchOpen(true);
                              }}
                            >
                              Resume in Add Results
                            </Button>
                          </article>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
        ) : null}

        {!embedded ? (
        <section className="card" aria-labelledby="saved-workbook-drafts-heading" style={{ marginBottom: 20, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 id="saved-workbook-drafts-heading" style={{ margin: 0 }}>Saved Workbook Drafts</h2>
              <p style={{ color: "#64748b", margin: "6px 0 0" }}>
                These are saved Excel review payloads that let you reopen a full worksheet review. Pupil entries still waiting for name, class, subject or mark confirmation are listed above. A workbook draft is not the same as a saved subject-result row.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => void handleRefreshSavedWorkbooks()} disabled={loadingSavedWorkbooks}>
              {loadingSavedWorkbooks ? "Loading drafts…" : "Refresh drafts"}
            </Button>
          </div>
          {savedWorkbookError ? (
            <div role="alert" style={{ marginTop: 12, padding: 10, borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>
              {savedWorkbookError}
            </div>
          ) : null}
          {loadingSavedWorkbooks ? (
            <p role="status" style={{ color: "#64748b", marginBottom: 0 }}>Loading workbook drafts…</p>
          ) : savedImportWorkbooks.length === 0 ? (
            <p style={{ color: "#64748b", marginBottom: 0 }}>No saved workbook drafts are available.</p>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginTop: 12 }}>
              <label style={{ display: "grid", gap: 4, color: "#334155", fontSize: 12, fontWeight: 700 }}>
                Workbook · worksheet · pupil reviews · last saved
                <select
                  aria-label="Saved workbook drafts"
                  value={selectedSavedWorkbookKey}
                  onChange={(event) => setSelectedSavedWorkbookKey(event.target.value)}
                  style={{ minWidth: 320, maxWidth: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}
                >
                  <option value="">Select a saved workbook draft</option>
                  {savedImportWorkbooks.map((workbook) => {
                    const separatorIndex = workbook.workbookKey.indexOf(":");
                    const sheetName = separatorIndex >= 0 ? workbook.workbookKey.slice(separatorIndex + 1) : workbook.workbookKey;
                    const updatedAt = new Date(workbook.updatedAt);
                    const lastSaved = Number.isNaN(updatedAt.getTime())
                      ? "saved date unavailable"
                      : `saved ${updatedAt.toLocaleString()}`;
                    return (
                      <option key={workbookSelectionKey(workbook)} value={workbookSelectionKey(workbook)}>
                        {sheetName} · {workbook.entryCount} pupil review(s) · {workbook.ownerName} · {lastSaved}
                      </option>
                    );
                  })}
                </select>
              </label>
              <Button type="button" size="sm" variant="secondary" onClick={() => void handleResumeSavedWorkbook()} disabled={!selectedSavedWorkbookKey || loadingSavedWorkbooks}>
                Resume saved draft
              </Button>
            </div>
          )}
        </section>


        ) : null}

        <details
          id="all-subject-records"
          className="card"
          open={Boolean(search.trim() || term !== "All" || session.trim() || classId || reportType !== "All" || status !== "All")}
          style={{ padding: 18, border: "1px solid #dfe7ef", borderRadius: 16, scrollMarginTop: 18 }}
        >
          <summary
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
              cursor: "pointer",
              listStylePosition: "outside",
              color: "#172b4d",
            }}
          >
            <span style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 850 }}>All subject records</span>
              <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                Optional detailed list for finding or editing one subject row. Normal review and publishing happens in the report list below.
              </span>
            </span>
            <span style={{ borderRadius: 999, padding: "6px 10px", background: "#f1f5f9", color: "#475569", fontSize: 12, fontWeight: 750 }}>
              {rows.length} matching subject row(s)
            </span>
          </summary>
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            <ResultFilters
              search={search}
              term={term}
              session={session}
              sessions={academicYears}
              classId={classId}
              classes={classes.filter((schoolClass) => isAdmin || !isTeacher || teacherAssignments.some((assignment) => assignment.class_id === schoolClass.id))}
              report={reportType}
              status={status}
              onSearchChange={setSearch}
              onTermChange={setTerm}
              onSessionChange={setSession}
              onClassChange={setClassId}
              onReportChange={setReportType}
              onStatusChange={setStatus}
            />

            <ResultTableGrouped
              rows={rows}
              loading={loading}
              canEdit={(row) => {
                const result = results.find((candidate) => candidate.id === row.id);
                return Boolean(result && (isAdmin
                  ? canAdministratorEditResult(result)
                  : isTeacher && user && canTeacherEditResult(result, user.id, teacherAssignments)));
              }}
              canDelete={(row) => {
                const result = results.find((candidate) => candidate.id === row.id);
                return Boolean(result && canAdministratorDeleteResult(isAdmin));
              }}
              canSubmit={(row) => {
                const result = results.find((candidate) => candidate.id === row.id);
                return Boolean(result && user && isTeacher && !isAdmin && canTeacherSubmitResult(result, user.id, teacherAssignments));
              }}
              canReturn={(row) => isAdmin && row.status === "Submitted"}
              canPublish={(row) => {
                const result = results.find((candidate) => candidate.id === row.id);
                return Boolean(result && canPublishResult(result, isAdmin));
              }}
              canUnpublish={(row) => row.status === "Published" && isAdmin}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSubmit={handleSubmitResult}
              onReview={handleReview}
            />
          </div>
        </details>
      </motion.div>

      <AppModal
        open={isFormOpen}
        title={formMode === "edit" ? "Edit Result" : "Add Result"}
        size="xl"
        dialogStyle={{
          height: "calc(100dvh - 32px)",
          maxHeight: "calc(100dvh - 32px)",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
        bodyStyle={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
        }}
        onClose={() => {
          setIsFormOpen(false);
          setEditingResult(null);
        }}
      >
        <ResultsScrollRegion label="Result form" maxHeight="calc(100dvh - 170px)">
          <ResultForm
            key={`${formMode}-${editingResult?.id ?? "new"}`}
            mode={formMode}
            result={editingResult}
            students={students}
            classes={classes}
            subjects={subjects}
            allowedAssignments={isTeacher && !isAdmin ? teacherAssignments : undefined}
            academicYears={academicYears}
            onClose={() => {
              setIsFormOpen(false);
              setEditingResult(null);
            }}
            onSaved={loadData}
          />
        </ResultsScrollRegion>
      </AppModal>

      <AppModal
        open={isBatchOpen}
        title="Add results for one student"
        size="xl"
        dialogStyle={{
          height: "calc(100dvh - 32px)",
          maxHeight: "calc(100dvh - 32px)",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
        bodyStyle={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          paddingBottom: 8,
        }}
        onClose={() => setIsBatchOpen(false)}
      >
        <ResultsScrollRegion label="Batch result entry" maxHeight="calc(100dvh - 170px)">
          <ResultBatchEntry
            key={resumeBatchResult?.id ?? "new-batch-entry"}
            students={students}
            classes={classes.filter((schoolClass) => isAdmin || !isTeacher || teacherAssignments.some((assignment) => assignment.class_id === schoolClass.id))}
            subjects={subjects}
            results={results}
            academicYears={academicYears}
            userId={user?.id}
            resumeResult={resumeBatchResult}
            onSaved={loadData}
            canPublish={isAdmin}
            onSaveAndPublish={publishSavedResultPeriod}
            onEditExisting={(result) => {
              setIsBatchOpen(false);
              setFormMode("edit");
              setEditingResult(result);
              setIsFormOpen(true);
            }}
          />
        </ResultsScrollRegion>
      </AppModal>

      <AppModal
        open={isImportOpen}
        title={isAddingImportStudent ? "Add pupil" : isFinalImportPreview ? "Confirm results" : "Review imported marks"}
        size="xl"
        dialogStyle={{
          width: "100%",
          maxWidth: "none",
          height: "calc(100dvh - 32px)",
          maxHeight: "calc(100dvh - 32px)",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          padding: "10px 12px 8px",
          borderRadius: 12,
        }}
        bodyStyle={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          width: "100%",
        }}
        footerStyle={{
          flex: "0 0 auto",
          position: "sticky",
          bottom: 0,
          background: "#fff",
          borderTop: "1px solid #e2e8f0",
          paddingTop: 8,
          marginTop: 8,
        }}
        onClose={() => void handleCloseImport()}
        footer={!isAddingImportStudent ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%", justifyContent: "flex-end" }}>
            <Button type="button" size="sm" variant="secondary" onClick={() => {
              void handleCloseImport();
            }}>
              Cancel
            </Button>
            {isFinalImportPreview ? (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={() => setIsFinalImportPreview(false)}>Back to pupil review</Button>
                {isAdmin ? (
                  <Button type="button" size="sm" onClick={() => void handleConfirmImport(true)} disabled={importSubmitting || importableBlocks === 0 || importPeriodConflict} style={{ background: "#047857", borderColor: "#047857", fontWeight: 900 }}>
                    {importSubmitting ? "SAVING & PUBLISHING…" : `SAVE & PUBLISH (${importableBlocks})`}
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="secondary" onClick={() => void handleConfirmImport(false)} disabled={importSubmitting || importableBlocks === 0 || importPeriodConflict}>
                  {importSubmitting ? "Saving…" : `Save results (${importableBlocks})`}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    if (activeImportEntry) await persistImportDraft(activeImportEntry);
                    const invalidReportDates = readyImportEntries.flatMap((entry) =>
                      getImportReportDateErrors(entry).map((dateError) => `${entry.studentName}: ${dateError}`),
                    );
                    if (invalidReportDates.length > 0) {
                      setError(`Correct the report-card dates before previewing: ${invalidReportDates.join(" ")}`);
                      return;
                    }
                    setFinalPreviewIndex(0);
                    setIsFinalImportPreview(true);
                    setActiveImportEntryKey(null);
                  }}
                  disabled={importableBlocks === 0 || importPeriodConflict}
                >
                  Review summary before saving ({importableBlocks})
                </Button>
              </>
            )}
          </div>
        ) : null}
      >
        {isAddingImportStudent && importStudentDraft ? (
          <StudentForm
            mode="add"
            student={importStudentDraft}
            onClose={() => {
              setIsAddingImportStudent(false);
              setImportStudentDraft(null);
              setImportStudentEntryKey(null);
            }}
            onSaved={handleImportStudentSaved}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, overflow: "hidden", width: "100%", gap: 6 }}>
        <style>{`
          .grandessa-import-review-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            grid-auto-flow: row;
            align-content: start;
          }
          .grandessa-import-active-pupil {
            order: -1 !important;
            grid-column: 1 !important;
            grid-row: 1 !important;
            position: relative !important;
            top: auto !important;
            right: auto !important;
            bottom: auto !important;
            width: 100% !important;
            max-height: none !important;
            min-height: 0;
            overflow: visible !important;
            align-self: start;
            z-index: auto !important;
            box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08) !important;
          }
        `}</style>
        <div style={{ marginBottom: 0, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 750, fontSize: 14, color: "#172b4d", overflowWrap: "anywhere" }}>{importFileName || "Uploaded file"}</div>
              {selectedSheetMetadata ? <span style={{ color: "#64748b", fontSize: 12 }}>{selectedSheetMetadata.name} · {selectedSheetMetadata.academicYear || "Session to confirm"} · {selectedSheetMetadata.term ? `${selectedSheetMetadata.term} Term` : "Term to confirm"}</span> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
              <span>{importCounts.totalStudents} pupils</span>
              <span>{readyImportEntries.length} ready</span>
              {importCounts.unresolvedStudents > 0 ? <span>{importCounts.unresolvedStudents} to check</span> : null}
              {importCounts.duplicateRecords > 0 ? <span>{importCounts.duplicateRecords} duplicates</span> : null}
            </div>
          </div>
          {importWorkbookSheets.length > 1 ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "100%", margin: "4px 0", color: "#475569", fontSize: 12 }}>
              <span style={{ flex: "0 0 auto", fontWeight: 700 }}>Worksheet</span>
              <select
                style={{ minWidth: 0, maxWidth: "min(620px, 100%)", padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
                value={selectedImportSheet}
                onChange={async (event) => {
                  const nextSheet = event.target.value;
                  if (activeImportEntry) await persistImportDraft(activeImportEntry);
                  setSelectedImportSheet(nextSheet);
                  setImportEntries([]);
                  setActiveImportEntryKey(null);
                  setActiveSubjectRowKey(null);
                  if (importWorkbookFile && importWorkbookKey) {
                    void populateImportPreview(importWorkbookFile, nextSheet, importWorkbookKey);
                  }
                }}
              >
                {importWorkbookSheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name} — {sheet.academicYear || "session not detected"} · {sheet.terms.length > 0 ? `${sheet.terms.join("/")} Term(s)` : "term not detected"} · {sheet.studentBlockCount} pupil card(s)
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {importPeriodConflict ? (
            <div role="alert" style={{ margin: "4px 0", padding: "7px 10px", borderRadius: 8, background: "#fff7ed", color: "#9a3412", fontSize: 12 }}>
              This worksheet does not match the requested {session ? `session ${session}` : ""}{session && term !== "All" ? " and " : ""}{term !== "All" ? `${term} Term` : ""}. Choose a worksheet that matches the requested period before importing.
            </div>
          ) : null}
          {error ? (
            <div role="alert" style={{ marginTop: 4, padding: "7px 10px", borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontSize: 12 }}>
              {error}
            </div>
          ) : null}
        </div>

        <ResultsScrollRegion
          id="import-review-pupils"
          label="Pupil review list and active pupil editor"
          maxHeight="min(68vh, 760px)"
        >
          <div
            className={`grandessa-import-review-grid${activeImportEntryKey ? " has-active-pupil" : ""}`}
            role="region"
            aria-label="Pupil review list and active pupil editor"
            tabIndex={0}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gridAutoFlow: "row",
              alignItems: "start",
              gap: 10,
              minWidth: 0,
              minHeight: 0,
              width: "100%",
              maxWidth: "100%",
              paddingRight: 3,
              paddingBottom: 4,
            }}
          >
          {isFinalImportPreview ? (
            readyImportEntries.length === 0 ? (
              <EmptyState
                title="No unsaved ready pupils"
                description="Saved pupils are complete. Resolve included pupils with issues, or retry any failed pupil from the dashboard."
              />
            ) : (() => {
              const entry = readyImportEntries[Math.min(finalPreviewIndex, readyImportEntries.length - 1)];
              const student = studentsMap.get(entry.selectedStudentId ?? "");
              const reportDetails = entry.reportDetails;
              return (
                <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, background: "#fff" }}>
                  <p role="status" style={{ marginTop: 0, padding: 12, borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a" }}>
                    <strong>{readyImportEntries.length} pupil result set(s) ready.</strong> Choose <strong>SAVE &amp; PUBLISH</strong> to save these marks and publish each pupil report immediately, or Save results to keep them unpublished. Midterm CA needs only the CA mark and its maximum. No parent messages are sent. Existing published marks are reused only when they match exactly.
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>Pupil {Math.min(finalPreviewIndex, readyImportEntries.length - 1) + 1} of {readyImportEntries.length}</div>
                      <h3 style={{ margin: "4px 0" }}>{student ? formatName(student.first_name, student.last_name) : entry.studentName}</h3>
                      <div style={{ color: "#475569" }}>Admission: {student?.admission_number || entry.admissionNumber || "Unavailable"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button type="button" size="sm" variant="secondary" disabled={finalPreviewIndex <= 0} onClick={() => setFinalPreviewIndex((current) => Math.max(0, current - 1))}>Previous pupil</Button>
                      <Button type="button" size="sm" variant="secondary" disabled={finalPreviewIndex >= readyImportEntries.length - 1} onClick={() => setFinalPreviewIndex((current) => Math.min(readyImportEntries.length - 1, current + 1))}>Next pupil</Button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, margin: "16px 0" }}>
                    <Detail label="Student" value={student ? formatName(student.first_name, student.last_name) : entry.studentName} />
                    <Detail label="Class" value={entry.className || "Not assigned"} />
                    <Detail label="Session" value={entry.academicYear || "Not provided"} />
                    <Detail label="Term" value={entry.term ?? "Not provided"} />
                    <Detail label="Report type" value={entry.reportKind === "Midterm / Continuous Assessment" ? "Midterm" : "End-of-Term"} />
                    <Detail label="Calculation mode" value={entry.items[0]?.calculationMode ?? "Manual"} />
                    <Detail label="Class teacher" value={entry.teacherName || "Not assigned"} />
                  </div>
                  <h4>Reviewed subjects</h4>
                  <div style={{ display: "grid", gap: 6 }}>
                    {entry.items.map((item, itemIndex) => (
                      <div key={getImportSubjectRowKey(entry, itemIndex)} style={{ display: "grid", gridTemplateColumns: "minmax(120px,2fr) repeat(4,minmax(70px,1fr))", gap: 8, padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>
                        <strong>{item.subjectName}</strong>
                        <span>CA: {item.continuousAssessment ?? "—"}{item.assessmentType === "CA" ? ` / ${item.maximumScore ?? "—"}` : ""}</span>
                        {item.assessmentType === "CA" ? <span>Exam: —</span> : <span>Exam: {item.examination ?? "—"}</span>}
                        {item.assessmentType === "CA" ? <span>Total: —</span> : <span>Total: {item.totalScore ?? "—"}</span>}
                        {item.assessmentType === "CA" ? <span>Grade: —</span> : <span>Grade: {item.grade ?? "—"}</span>}
                        {item.remark ? <span>Teacher remark: {item.remark}</span> : null}
                      </div>
                    ))}
                  </div>
                  <h4>Report details</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
                    {([
                      ["Class average", reportDetails?.classAverage],
                      ["Total marks obtained", reportDetails?.totalMarksObtained],
                      ["Total marks obtainable", reportDetails?.totalMarksObtainable],
                      ["Student percentage", reportDetails?.studentPercentage],
                      ["Maximum attendance", reportDetails?.maximumAttendance],
                      ["Times present", reportDetails?.timesPresent],
                      ["Times absent", reportDetails?.timesAbsent],
                      ["Term ending", reportDetails?.termEnding],
                      ["Next term begins", reportDetails?.nextTermBegins],
                      ["Class-teacher comment", reportDetails?.classTeacherComment],
                      ["Head-teacher comment", reportDetails?.headTeacherComment],
                    ] as const).filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => (
                      <Detail key={label} label={label} value={String(value)} />
                    ))}
                  </div>
                  {getImportReportDateErrors(entry).map((dateError) => (
                    <div key={dateError} role="alert" style={{ color: "#b91c1c", fontSize: 13, marginTop: 6 }}>
                      {dateError}
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="secondary" style={{ marginTop: 12 }} onClick={() => handleReviewPupil(entry)}>
                    Return to edit this pupil
                  </Button>
                  {importResultStates[entry.studentKey]?.state === "failed" ? (
                    <div role="alert" style={{ color: "#b91c1c", marginTop: 10 }}>
                      Import failed: {importResultStates[entry.studentKey].error}
                    </div>
                  ) : null}
                </section>
              );
            })()
          ) : importEntries.length === 0 ? (
            <EmptyState title="No import preview" description="Upload a workbook to preview result rows." />
          ) : (
            importEntries
              .map((entry, index) => ({ entry, index }))
              .sort((left, right) => {
                const leftIsActive = activeImportEntryKey === left.entry.studentKey;
                const rightIsActive = activeImportEntryKey === right.entry.studentKey;
                return Number(leftIsActive) - Number(rightIsActive);
              })
              .map(({ entry, index }) => {
              const studentId = entry.selectedStudentId ?? "";
              const pendingStudentId = pendingStudentSelections[entry.studentKey] ?? studentId;
              const registeredStudent = studentsMap.get(studentId);
              const pendingStudent = studentsMap.get(pendingStudentId);
              const matchedCandidate = studentsMap.get(entry.matchedStudentId ?? "");
              const pupilStatus = getPendingImportPupilStatus(entry);
              const hasClassConflict = entry.warnings.some((warning) =>
                /selected student is not currently|worksheet says|workbook class differs|class differs|worksheet class/i.test(warning),
              );
              const needsPupilMatch = entry.matchStatus !== "matched" || !entry.selectedStudentId;
              const hasSkippableSubjectRows = [...(entry.skippedItems ?? []), ...entry.items.filter(isImportItemSkippableForMissingMarks)].length > 0;
              const subjectRowsNeedingAction = getImportSubjectRowsNeedingAction(entry);
              const importScoreWarnings = getImportScoreWarnings({ ...entry, items: getImportItemsForSave(entry) });
              const hasNoCompleteSubjectMarks = entry.items.length === 0 || getImportItemsForSave(entry).length === 0;
              const reviewableEntries = importEntries.filter((candidate) => candidate.included !== false);
              const reviewPosition = reviewableEntries.findIndex((candidate) => candidate.studentKey === entry.studentKey);
              const reportDetails = entry.reportDetails ?? {
                age: "",
                classAverage: null,
                totalMarksObtained: null,
                totalMarksObtainable: null,
                studentPercentage: null,
                maximumAttendance: null,
                timesPresent: null,
                timesAbsent: null,
                termEnding: "",
                nextTermBegins: "",
                classTeacherComment: "",
                headTeacherComment: "",
              };
              const expectedMidtermNotice = /CA entries do not retain final totals, grades, or remarks|one or more assessment components are blank and will remain blank|no grade was entered; it will remain blank|no remark was entered; it will remain blank/i;
              const visibleNotices = entry.reportKind === "Midterm / Continuous Assessment"
                ? entry.notices.filter((notice) => !expectedMidtermNotice.test(notice))
                : entry.notices;

              if (entry.included === false) {
                return (
                  <div
                    key={getImportEntryKey(entry)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: "12px 16px",
                      background: "#f8fafc",
                    }}
                  >
                    <div>
                      <strong>{entry.studentName || "Unknown pupil"}</strong>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        {entry.admissionNumber ? `Admission: ${entry.admissionNumber}` : "Admission number unavailable"} · {entry.className || "Class not matched"} · Set aside
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleImportInclusionChange(index, true)}
                    >
                          Include pupil
                    </Button>
                  </div>
                );
              }

              const isActivePupil = activeImportEntryKey === entry.studentKey;
              return (
                <div
                  key={getImportEntryKey(entry)}
                  className={isActivePupil ? "grandessa-import-active-pupil" : undefined}
                  id={isActivePupil ? "active-import-pupil-editor" : undefined}
                  aria-label={`Review item for ${entry.studentName || "pupil"}`}
                  style={{
                    border: isActivePupil ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                    borderRadius: isActivePupil ? 14 : 10,
                    padding: isActivePupil ? 18 : 10,
                    background: "#ffffff",
                    boxShadow: isActivePupil ? "0 18px 44px rgba(15, 23, 42, 0.16)" : "none",
                    gridColumn: "1",
                    position: "relative",
                    boxSizing: "border-box",
                    gridRow: isActivePupil ? "1" : undefined,
                    alignSelf: "start",
                    minWidth: 0,
                    minHeight: 0,
                    maxHeight: undefined,
                    overflowY: "visible",
                    scrollMarginTop: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{entry.studentName || "Unknown student"}</div>
                      <div style={{ color: "#475569", fontSize: 13 }}>
                        Admission: {studentsMap.get(entry.selectedStudentId ?? "")?.admission_number || entry.admissionNumber || "Not matched"} · Class: {entry.className || "Not matched"}
                      </div>
                      {entry.sourceStudentName ? (
                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Original worksheet name: {entry.sourceStudentName}</div>
                      ) : null}
                      <div role="status" style={{ color: importResultStates[entry.studentKey]?.state === "failed" ? "#b91c1c" : "#475569", fontSize: 13, marginTop: 3 }}>
                        {importResultStates[entry.studentKey]?.state === "saved" ? "Saved"
                          : importResultStates[entry.studentKey]?.state === "failed" ? "Import failed"
                            : draftSaveStates[entry.studentKey]?.state === "saved" ? "Saved"
                              : !entry.selectedStudentId ? "Needs matching"
                                : getImportItemsForSave(entry).some((item) => !item.subjectId) ? "Needs subject mapping"
                                  : isImportEntryReady(entry)
                                    ? (entry.items.some(isImportItemSkippableForMissingMarks) || (entry.skippedItems?.length ?? 0) > 0
                                      ? "Ready to import; incomplete subjects skipped"
                                      : "Ready to import")
                                    : getImportScoreWarnings({ ...entry, items: getImportItemsForSave(entry) }).length > 0 ? "Check marks" : "Needs review"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {importResultStates[entry.studentKey]?.state === "failed" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            if (activeImportEntry) await persistImportDraft(activeImportEntry);
                            const retryIndex = readyImportEntries.findIndex((candidate) => candidate.studentKey === entry.studentKey);
                            if (retryIndex >= 0) {
                              setFinalPreviewIndex(retryIndex);
                              setIsFinalImportPreview(true);
                              setActiveImportEntryKey(null);
                            }
                          }}
                        >
                          Retry import
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          if (activeImportEntryKey === entry.studentKey) void handleClosePupilReview();
                          else void handleMoveToPupil(entry);
                        }}
                      >
                        {activeImportEntryKey === entry.studentKey ? "Close this pupil" : "Open this pupil"}
                      </Button>
                      <div role="group" aria-label={`Import ${entry.studentName || "pupil"}`}>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          aria-pressed={false}
                          onClick={() => handleImportInclusionChange(index, false)}
                        >
                          Set aside
                        </Button>
                      </div>
                    </div>
                  </div>

                  {activeImportEntryKey === entry.studentKey ? (
                  <div style={{ marginTop: 8, borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Pupil {Math.max(1, reviewPosition + 1)} of {reviewableEntries.length}</div>
                      <div style={{ fontSize: 19, fontWeight: 700, color: "#172b4d", marginTop: 2 }}>{entry.studentName || "Unknown pupil"}</div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Admission: {registeredStudent?.admission_number || entry.admissionNumber || "Not matched"} · Class: {registeredStudent?.class_name || entry.className || "Not set"}</div>
                    </div>
                    <span role="status" style={{ color: draftSaveStates[entry.studentKey]?.state === "failed" ? "#b91c1c" : "#475569" }}>
                      {draftSaveStates[entry.studentKey]?.state === "saving" ? "Saving…"
                        : draftSaveStates[entry.studentKey]?.state === "saved" ? "Saved"
                          : draftSaveStates[entry.studentKey]?.state === "failed" ? `Save failed: ${draftSaveStates[entry.studentKey].error}`
                            : "Unsaved changes"}
                    </span>
                  </div>
                  <section aria-label="School record" style={{ marginBottom: 10, padding: 10, border: "1px solid #e2e8f0", borderRadius: 9, background: "#f8fafc" }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>School record</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, fontSize: 13 }}>
                      <div>
                        <div style={{ color: "#64748b" }}>Registered pupil</div>
                        <div style={{ fontWeight: 600 }}>
                          {registeredStudent
                            ? [registeredStudent.first_name, registeredStudent.middle_name, registeredStudent.last_name].filter(Boolean).join(" ")
                            : matchedCandidate
                              ? `Suggested school record: ${[matchedCandidate.first_name, matchedCandidate.middle_name, matchedCandidate.last_name].filter(Boolean).join(" ")}`
                              : "No school record selected yet"}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#64748b" }}>Original worksheet name</div>
                        <div style={{ fontWeight: 600 }}>{entry.sourceStudentName || entry.studentName || "Name missing"}</div>
                      </div>
                      <div>
                        <div style={{ color: "#64748b" }}>Admission number</div>
                        <div style={{ fontWeight: 600 }}>{registeredStudent?.admission_number || entry.admissionNumber || "Not matched"}</div>
                      </div>
                      <div>
                        <div style={{ color: "#64748b" }}>Official class</div>
                        <div style={{ fontWeight: 600 }}>{registeredStudent?.class_name || entry.className || "Not confirmed"}</div>
                      </div>
                    </div>
                  </section>
                  <section aria-label="Next action for this pupil" style={{ margin: "0 0 10px", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 9, background: "#fff", display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "#172b4d" }}>{pupilStatus.label}</div>
                        <div style={{ marginTop: 3, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>{pupilStatus.explanation}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {draftSaveStates[entry.studentKey]?.state === "saved" ? (
                          <Button type="button" size="sm" variant="secondary" onClick={() => void handleDiscardImportDraft(entry)} style={{ color: "#b91c1c", borderColor: "#fecaca" }}>
                            Delete saved review
                          </Button>
                        ) : null}
                        {hasClassConflict ? (
                          <Button type="button" size="sm" variant="secondary" onClick={() => document.getElementById(`registered-pupil-${entry.studentKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                            Check pupil and class
                          </Button>
                        ) : null}
                        {needsPupilMatch && matchedCandidate ? (
                          <Button type="button" size="sm" onClick={() => void handleImportSelection(index, matchedCandidate.id)}>
                            Use suggested pupil
                          </Button>
                        ) : null}
                        {needsPupilMatch ? (
                          <Button type="button" size="sm" variant="secondary" onClick={() => document.getElementById(`registered-pupil-${entry.studentKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                            Choose pupil
                          </Button>
                        ) : null}
                        {needsPupilMatch && isAdmin && !entry.selectedStudentId ? (
                          <Button type="button" size="sm" variant="secondary" onClick={() => handleAddStudentToImport(index)}>
                            Create pupil record
                          </Button>
                        ) : null}
                        {entry.items.length === 0 ? (
                          <Button type="button" size="sm" onClick={() => {
                            handleAddImportSubjectRow(index);
                            window.requestAnimationFrame(() => document.getElementById(`subject-mappings-${index}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
                          }}>
                            Add subject & marks
                          </Button>
                        ) : null}
                        {entry.items.length > 0 && hasNoCompleteSubjectMarks ? (
                          <Button type="button" size="sm" onClick={() => document.getElementById(`subject-mappings-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                            Enter marks
                          </Button>
                        ) : null}
                        {subjectRowsNeedingAction.length > 0 ? (
                          <Button type="button" size="sm" variant="secondary" onClick={() => handleNextUnresolvedSubject(entry)}>
                            Fix next subject
                          </Button>
                        ) : null}
                        {hasSkippableSubjectRows && !hasNoCompleteSubjectMarks && !hasClassConflict && isImportEntryReady(entry) ? (
                          <>
                            <Button type="button" size="sm" variant="secondary" onClick={() => {
                              const missingIndex = entry.items.findIndex(isImportItemSkippableForMissingMarks);
                              if (missingIndex >= 0) {
                                const rowKey = getImportSubjectRowKey(entry, missingIndex);
                                setActiveSubjectRowKey(rowKey);
                                window.requestAnimationFrame(() => document.getElementById(rowKey)?.scrollIntoView({ behavior: "smooth", block: "center" }));
                              } else {
                                document.getElementById(`subject-mappings-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }
                            }}>
                              Edit missing subjects
                            </Button>
                            {isAdmin ? (
                              <Button type="button" size="sm" onClick={() => void handleConfirmImport(true, entry.studentKey)}>
                                Publish completed subjects now
                              </Button>
                            ) : null}
                          </>
                        ) : isAdmin && isImportEntryReady(entry) && !hasClassConflict && !hasSkippableSubjectRows ? (
                          <Button type="button" size="sm" onClick={() => void handleConfirmImport(true, entry.studentKey)}>
                            Publish this pupil now
                          </Button>
                        ) : null}
                        {["Choose report type", "Choose session", "Choose term"].includes(pupilStatus.label) ? (
                          <Button type="button" size="sm" variant="secondary" onClick={() => {
                            const settings = document.getElementById(`import-settings-${entry.studentKey}`);
                            settings?.setAttribute("open", "");
                            settings?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}>
                            Edit report settings
                          </Button>
                        ) : null}
                        {getImportReportDateErrors(entry).length > 0 ? (
                          <Button type="button" size="sm" variant="secondary" onClick={() => {
                            const details = document.getElementById(`import-report-details-${entry.studentKey}`);
                            details?.setAttribute("open", "");
                            details?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}>
                            Fix report dates
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </section>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                    <Button type="button" size="sm" variant="secondary" onClick={() => {
                      const previous = reviewableEntries[reviewPosition - 1];
                      if (previous) void handleMoveToPupil(previous);
                    }} disabled={reviewPosition <= 0}>← Previous pupil</Button>
                    <span style={{ color: "#64748b", fontSize: 13 }}>{Math.max(1, reviewPosition + 1)} of {reviewableEntries.length} included pupils</span>
                    <Button type="button" size="sm" variant="secondary" onClick={() => {
                      const next = reviewableEntries[reviewPosition + 1];
                      if (next) void handleMoveToPupil(next);
                    }} disabled={reviewPosition < 0 || reviewPosition >= reviewableEntries.length - 1}>Next pupil →</Button>
                  </div>
                  <section aria-label={`Save actions for ${entry.studentName || "this pupil"}`} style={{ border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", marginBottom: 10, background: "#f8fafc" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Save options for {entry.studentName || "this pupil"}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void handleSaveProgress()}>
                        {draftSaveStates[entry.studentKey]?.state === "saving" ? "Saving…" : "Save progress"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleConfirmImport(false, entry.studentKey)}
                        disabled={importSubmitting || !isImportEntryReady(entry)}
                      >
                        Save marks as draft
                      </Button>
                      {isAdmin && !(isImportEntryReady(entry) && !hasClassConflict) ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleConfirmImport(true, entry.studentKey)}
                          disabled={importSubmitting || !isImportEntryReady(entry)}
                          style={{ background: "#0f766e", borderColor: "#0f766e", color: "#fff", fontWeight: 700 }}
                        >
                          Publish this pupil now
                        </Button>
                      ) : null}

                    </div>
                  </section>

                  <div style={{ marginBottom: 8, color: "#64748b", fontSize: 12 }}>
                    <strong style={{ color: "#334155" }}>Result period:</strong>{" "}
                    {entry.academicYear || "Session to confirm"} · {entry.term ? `${entry.term} Term` : "Term to confirm"} ·{" "}
                    {entry.reportKind === "Midterm / Continuous Assessment"
                      ? "Midterm (CA)"
                      : entry.reportKind === "End-of-Term / Year Report Card"
                        ? "End-of-Term"
                        : "Report type to confirm"} ·{" "}
                    {entry.items[0]?.calculationMode === "Automatic" ? "Automatic" : "Manual scoring"}
                  </div>
                  <details id={`import-settings-${entry.studentKey}`} style={{ marginBottom: 12 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700 }}>Change period, report type, teacher or scoring settings (only if needed)</summary>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 10 }}>
                      <label style={{ display: "grid", gap: 4 }}>
                        Session
                        <input value={entry.academicYear} onChange={(event) => handleImportPeriodChange(index, "academicYear", event.target.value)} />
                      </label>
                      <label style={{ display: "grid", gap: 4 }}>
                        Term
                        <select value={entry.term ?? ""} onChange={(event) => handleImportPeriodChange(index, "term", event.target.value)}>
                          <option value="">Select term</option>
                          <option value="First">First</option>
                          <option value="Second">Second</option>
                          <option value="Third">Third</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 4 }}>
                        Class teacher
                        <input
                          value={entry.teacherName}
                          onChange={(event) => handleImportTeacherNameChange(index, event.target.value)}
                          placeholder="Not assigned"
                        />
                      </label>
                      <label style={{ display: "grid", gap: 4 }}>
                        Report type
                        <select
                          value={entry.reportKind}
                          onChange={(event) => handleImportReportKindChange(index, event.target.value as ResultImportReportKind)}
                        >
                          <option value="Unclear">Choose report type</option>
                          <option value="Midterm / Continuous Assessment">Midterm Report</option>
                          <option value="End-of-Term / Year Report Card">End-of-Term Report</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 4 }}>
                        Calculation mode
                        <select
                          value={entry.items[0]?.calculationMode ?? "Manual"}
                          onChange={(event) => handleImportModeChange(index, event.target.value as "Manual" | "Automatic")}
                        >
                          <option value="Manual">Manual entry</option>
                          <option value="Automatic">Automatic calculation</option>
                        </select>
                      </label>
                    </div>
                  </details>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10, color: "#334155" }}>
                    <strong>{entry.items.length} subject{entry.items.length === 1 ? "" : "s"}</strong>
                    <Button type="button" size="sm" variant="secondary" onClick={() => {
                      handleAddImportSubjectRow(index);
                      window.requestAnimationFrame(() => document.getElementById(`subject-mappings-${index}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
                    }}>
                      {entry.items.length === 0 ? "Add subject & marks" : "Add subject"}
                    </Button>
                  </div>
                  {entry.items.length === 0 ? (
                    <div role="status" style={{ padding: "10px 12px", marginBottom: 10, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#475569" }}>
                      No subjects yet. Add a subject above, then enter the pupil’s marks.
                    </div>
                  ) : null}

                  <details id={`import-report-details-${entry.studentKey}`} style={{ marginBottom: 12 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700 }}>Report-card details from workbook (editable)</summary>
                    {reportDetails.age ? (
                      <div style={{ marginTop: 10, color: "#475569" }}>
                        Workbook age: <strong>{reportDetails.age}</strong> (reference only; the saved report uses the pupil's date of birth).
                      </div>
                    ) : null}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginTop: 10 }}>
                      {([
                        ["classAverage", "Class average"],
                        ["totalMarksObtained", "Total marks obtained"],
                        ["totalMarksObtainable", "Total marks obtainable"],
                        ["studentPercentage", "Student percentage"],
                        ["maximumAttendance", "Maximum attendance"],
                        ["timesPresent", "Times present"],
                        ["timesAbsent", "Times absent"],
                      ] as const).map(([field, label]) => (
                        <label key={field} style={{ display: "grid", gap: 4 }}>
                          {label}
                          <input
                            type="text"
                            inputMode="decimal"
                            value={entry.reportDetailInputText?.[field] ?? reportDetails[field] ?? ""}
                            onChange={(event) => handleImportReportDetailChange(index, field, event.target.value)}
                          />
                        </label>
                      ))}
                      {([
                        ["termEnding", "Term ending"],
                        ["nextTermBegins", "Next term begins"],
                        ["classTeacherComment", "Class-teacher comment"],
                        ["headTeacherComment", "Head-teacher comment"],
                      ] as const).map(([field, label]) => (
                        <label key={field} style={{ display: "grid", gap: 4 }}>
                          {label}
                          <input value={reportDetails[field]} onChange={(event) => handleImportReportDetailChange(index, field, event.target.value)} />
                        </label>
                      ))}
                    </div>
                    {getImportReportDateErrors(entry).map((dateError) => (
                      <div key={dateError} role="alert" style={{ color: "#b91c1c", fontSize: 13, marginTop: 6 }}>
                        {dateError}
                      </div>
                    ))}
                  </details>

                  <section aria-label="Confirm registered pupil" style={{ marginBottom: 12, padding: 12, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", minWidth: 0 }}>
                    <label htmlFor={`registered-pupil-${entry.studentKey}`} style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
                      {studentId ? "Registered pupil" : "Choose the registered pupil"}
                    </label>
                    <div style={{ color: "#475569", fontSize: 13, marginBottom: 8, overflowWrap: "anywhere" }}>
                      <strong>Name on worksheet:</strong> {entry.sourceStudentName || entry.studentName || "Name missing"}
                    </div>
                    <select
                      id={`registered-pupil-${entry.studentKey}`}
                      value={pendingStudentId}
                      onChange={(event) => setPendingStudentSelections((current) => ({ ...current, [entry.studentKey]: event.target.value }))}
                      style={{ boxSizing: "border-box", width: "100%", maxWidth: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #94a3b8", background: "#fff" }}
                    >
                      <option value="">Choose a pupil from the school register</option>
                      {studentOptions.map((student) => (
                        <option key={student.id} value={student.id}>
                          {[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")} · {student.admission_number || "No admission number"} · {student.class_name || "No class"}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleImportSelection(index, pendingStudentId)}
                        disabled={!pendingStudentId || pendingStudentId === studentId}
                      >
                        {!pendingStudentId
                          ? "Select a pupil first"
                          : pendingStudentId !== studentId
                            ? studentId ? "Confirm change of pupil" : "Confirm this pupil"
                            : "Pupil confirmed"}
                      </Button>
                      {isAdmin && !entry.selectedStudentId ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAddStudentToImport(index)}
                        >
                          Add a new student record
                        </Button>
                      ) : null}
                    </div>
                    {pendingStudentId && pendingStudentId !== studentId && pendingStudent ? (
                      <div role="status" style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "#fffbeb", color: "#92400e", fontSize: 13, overflowWrap: "anywhere" }}>
                        <strong>Selected pupil:</strong> {[pendingStudent.first_name, pendingStudent.middle_name, pendingStudent.last_name].filter(Boolean).join(" ")} · Admission {pendingStudent.admission_number || "not recorded"} · Class {pendingStudent.class_name || "not assigned"}. Select <strong>{studentId ? "Confirm change of pupil" : "Use this pupil"}</strong> to continue.
                      </div>
                    ) : registeredStudent ? (
                      <div role="status" style={{ marginTop: 8, color: "#166534", fontSize: 13, overflowWrap: "anywhere" }}>
                        <strong>Confirmed school record:</strong> {[registeredStudent.first_name, registeredStudent.middle_name, registeredStudent.last_name].filter(Boolean).join(" ")} · Admission {registeredStudent.admission_number || "not recorded"} · Class {registeredStudent.class_name || "not assigned"}
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                        Choose the registered pupil, then confirm the match.
                      </div>
                    )}
                  </section>

                  {entry.warnings.length > 0 || importScoreWarnings.length > 0 ? (
                    <details style={{ marginBottom: 10, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", background: "#fff" }}>
                      <summary style={{ cursor: "pointer", color: "#475569", fontSize: 12, fontWeight: 600 }}>
                        Additional notes ({new Set([...entry.warnings, ...importScoreWarnings]).size})
                      </summary>
                      <div style={{ display: "grid", gap: 4, marginTop: 8, color: "#64748b", fontSize: 12, overflowWrap: "anywhere" }}>
                        {[...new Set([...entry.warnings, ...importScoreWarnings])].filter((warning) =>
                          !/selected student is not currently|worksheet says|workbook class differs|class differs|worksheet class/i.test(warning),
                        ).map((warning) => <div key={warning}>{warning}</div>)}
                      </div>
                    </details>
                  ) : null}
                  {visibleNotices.length > 0 ? (
                    <div role="status" style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: "#eff6ff", color: "#1e40af", fontSize: 13 }}>
                      {visibleNotices.map((notice) => (
                        <div key={notice}>{notice}</div>
                      ))}
                    </div>
                  ) : null}

                  {getImportReportDateErrors(entry).map((dateError) => (
                    <div key={dateError} role="alert" style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8, overflowWrap: "anywhere" }}>
                      {dateError}
                    </div>
                  ))}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <strong>{entry.items.filter((item) => item.subjectId).length} subjects mapped · {entry.items.filter((item) => !item.subjectId).length} unresolved</strong>
                    <Button type="button" size="sm" variant="secondary" onClick={() => handleNextUnresolvedSubject(entry)} disabled={subjectRowsNeedingAction.length === 0}>
                      Fix next subject
                    </Button>
                  </div>
                  {completedSubjectMappingEntryKey === entry.studentKey ? (
                    <div role="status" style={{ padding: 10, borderRadius: 8, background: "#f0fdf4", color: "#166534", fontWeight: 700 }}>
                      All subjects are mapped.
                    </div>
                  ) : null}
                  {(() => {
                    const skippedThisAttempt = entry.items.filter(isImportItemSkippableForMissingMarks);
                    const previouslySkipped = entry.skippedItems ?? [];
                    const skippedNames = [...new Set([...previouslySkipped, ...skippedThisAttempt].map((item) => item.subjectName).filter(Boolean))];
                    if (skippedNames.length === 0) return null;
                    return (
                      <div role="status" style={{ margin: "8px 0", padding: 12, border: "1px solid #f59e0b", borderRadius: 8, background: "#fffbeb", color: "#78350f" }}>
                        <strong>These incomplete subjects will not hold up this pupil's other results.</strong>
                        <div style={{ marginTop: 4 }}>Not included until marks are entered: {skippedNames.join(", ")}. Complete subject rows can still be saved and published. Missing subjects can be added later from Results.</div>
                        {previouslySkipped.length > 0 ? (
                          <div style={{ marginTop: 8 }}>
                            <Button type="button" size="sm" variant="secondary" onClick={() => handleRestoreSkippedImportRows(index)}>
                              Restore skipped subjects to edit their marks
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                  <label style={{ display: "grid", gap: 4, maxWidth: 360, marginBottom: 8 }}>
                    Search subject choices
                    <input value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} placeholder="Search subjects" />
                  </label>
                  <SynchronizedHorizontalScroll
                    id={`subject-mappings-${index}`}
                    label={`Subject mappings for ${entry.studentName}`}
                  >
                    <table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Workbook subject / mapping", "Subject record", "CA", ...(entry.assessmentType === "CA" ? ["Maximum"] : ["Exam", "Total", "Grade", "Remark"]), "Existing result"].map((heading) => (
                            <th key={heading} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entry.items.map((item, itemIndex) => {
                          const rowKey = getImportSubjectRowKey(entry, itemIndex);
                          const isActiveSubject = rowKey === activeSubjectRowKey;
                          const matches = getExistingImportMatches(entry, item);
                          const key = importItemKey(entry, itemIndex);
                          const selectedExisting = matches.find((candidate) => candidate.id === importExistingChoices[key]);
                          const updateableMatches = matches.filter((candidate) =>
                            candidate.status === "Draft" && (
                              (isAdmin && canAdministratorEditResult(candidate))
                                || Boolean(user && isTeacher && canTeacherEditResult(candidate, user.id, teacherAssignments))
                            ),
                          );
                          const invalid = new Set(item.invalidMarks ?? []);
                          const markErrors = validateAssessmentMarks({
                            assessment_type: item.assessmentType,
                            continuous_assessment: item.continuousAssessment,
                            maximum_score: item.maximumScore,
                            examination: item.examination,
                            total_score: item.totalScore,
                            grade: item.grade ?? "",
                            remark: item.remark ?? "",
                          });
                          const cellStyle = { padding: 8, borderBottom: "1px solid #e2e8f0", verticalAlign: "top" as const };
                          const fieldErrorStyle = { display: "block", color: "#b91c1c", fontSize: 11, marginTop: 3 };
                          const errorsFor = (prefix: string): string[] => markErrors.filter((message) => message.startsWith(prefix));
                          const invalidScoreInput = (field: ResultImportScoreField): boolean => {
                            const text = item.scoreInputText?.[field];
                            return text !== undefined && !parseScoreInput(text).valid;
                          };
                          return (
                            <tr key={rowKey} id={rowKey} style={{ background: isActiveSubject ? "#eff6ff" : item.subjectId ? "#f0fdf4" : "#fff7ed" }}>
                              <td style={cellStyle}>
                                <strong>{item.subjectName || (item.manualEntry ? "Select a subject" : "Unnamed worksheet subject")}</strong>
                                <div role="status" style={{ color: isImportItemSkippableForMissingMarks(item) ? "#92400e" : item.subjectId ? "#166534" : "#9a3412", fontSize: 12 }}>
                                  {isImportItemSkippableForMissingMarks(item)
                                    ? "Required mark missing — this subject will be skipped, not the pupil's other results"
                                    : item.subjectId ? "Matched" : "Needs subject mapping"}
                                </div>
                                {!item.subjectId ? (
                                  <Button type="button" size="sm" variant="secondary" onClick={() => setActiveSubjectRowKey(rowKey)}>Review mapping</Button>
                                ) : null}
                                {item.manualEntry ? (
                                  <Button type="button" size="sm" variant="secondary" onClick={() => handleRemoveImportSubjectRow(index, itemIndex)}>
                                    Remove added row
                                  </Button>
                                ) : null}
                              </td>
                              <td style={cellStyle}>
                                <select aria-label={`Subject record for ${item.subjectName}`} value={item.subjectId ?? ""} onChange={(event) => handleImportEntityChange(index, itemIndex, "subjectId", event.target.value)}>
                                  <option value="">Select subject</option>
                                  {subjects.filter((subject) => subject.subject_name.toLowerCase().includes(subjectSearch.trim().toLowerCase())).map((subject) => (
                                    <option key={subject.id} value={subject.id}>{subject.subject_name}</option>
                                  ))}
                                </select>
                                {!item.subjectId ? <span role="alert" style={fieldErrorStyle}>Match a subject.</span> : null}
                              </td>
                              <td style={cellStyle}>
                                {item.assessmentType !== "Examination" ? (
                                  <>
                                    <input aria-label={`CA mark for ${item.subjectName}`} type="text" inputMode="decimal" value={item.scoreInputText?.continuousAssessment ?? item.continuousAssessment ?? ""} onChange={(event) => handleImportScoreChange(index, itemIndex, "continuousAssessment", event.target.value)} />
                                    {[...new Set([...errorsFor("CA score"), ...(invalid.has("CA") || invalidScoreInput("continuousAssessment") ? ["CA mark is not a valid number."] : [])])].map((message) => <span key={message} role="alert" style={fieldErrorStyle}>{message}</span>)}
                                  </>
                                ) : "—"}
                              </td>
                              {entry.assessmentType === "CA" ? (
                                <td style={cellStyle}>
                                  <input aria-label={`Maximum for ${item.subjectName}`} type="text" inputMode="decimal" value={item.scoreInputText?.maximumScore ?? item.maximumScore ?? ""} onChange={(event) => handleImportScoreChange(index, itemIndex, "maximumScore", event.target.value)} />
                                  {[...new Set([...errorsFor("Maximum score"), ...(invalid.has("maximum score") || invalidScoreInput("maximumScore") ? ["Maximum score is not a valid number."] : [])])].map((message) => <span key={message} role="alert" style={fieldErrorStyle}>{message}</span>)}
                                </td>
                              ) : (
                                <>
                                  <td style={cellStyle}>
                                    <input aria-label={`Examination mark for ${item.subjectName}`} type="text" inputMode="decimal" value={item.scoreInputText?.examination ?? item.examination ?? ""} onChange={(event) => handleImportScoreChange(index, itemIndex, "examination", event.target.value)} />
                                    {[...new Set([...errorsFor("Examination score"), ...(invalid.has("examination") || invalidScoreInput("examination") ? ["Examination mark is not a valid number."] : [])])].map((message) => <span key={message} role="alert" style={fieldErrorStyle}>{message}</span>)}
                                  </td>
                                  <td style={cellStyle}>
                                    <input aria-label={`Total for ${item.subjectName}`} type="text" inputMode="decimal" value={item.scoreInputText?.totalScore ?? item.totalScore ?? ""} readOnly={item.calculationMode === "Automatic"} onChange={(event) => handleImportScoreChange(index, itemIndex, "totalScore", event.target.value)} />
                                    {[...new Set([...errorsFor("Entered total"), ...(invalid.has("total") || invalidScoreInput("totalScore") ? ["Total is not a valid number."] : [])])].map((message) => <span key={message} role="alert" style={fieldErrorStyle}>{message}</span>)}
                                  </td>
                                  <td style={cellStyle}>
                                    <select aria-label={`Grade for ${item.subjectName}`} value={item.grade ?? ""} disabled={item.calculationMode === "Automatic"} onChange={(event) => handleImportItemChange(index, itemIndex, "grade", event.target.value || null)}>
                                      <option value="">Select grade</option>
                                      {grandessaGradingScale.map((band) => <option key={band.grade} value={band.grade}>{band.grade}</option>)}
                                      {item.grade && !grandessaGradingScale.some((band) => band.grade === item.grade) ? <option value={item.grade}>{item.grade} (workbook)</option> : null}
                                    </select>
                                  </td>
                                  <td style={cellStyle}>
                                    <select aria-label={`Remark for ${item.subjectName}`} value={item.remark ?? ""} disabled={item.calculationMode === "Automatic"} onChange={(event) => handleImportItemChange(index, itemIndex, "remark", event.target.value || null)}>
                                      <option value="">Select remark</option>
                                      {grandessaGradingScale.map((band) => <option key={band.remark} value={band.remark}>{band.remark}</option>)}
                                      {item.remark && !grandessaGradingScale.some((band) => band.remark === item.remark) ? <option value={item.remark}>{item.remark} (workbook)</option> : null}
                                    </select>
                                  </td>
                                </>
                              )}
                              <td style={cellStyle}>
                                {matches.length > 0 ? (
                                  <label style={{ display: "grid", gap: 4 }}>
                                    <span>{matches.length} existing match(es)</span>
                                    <select aria-label={`Existing result action for ${item.subjectName}`} value={selectedExisting?.id ?? ""} onChange={(event) => setImportExistingChoices((current) => ({ ...current, [key]: event.target.value }))}>
                                      <option value="">Use existing only if the marks match</option>
                                      {updateableMatches.map((candidate) => <option key={candidate.id} value={candidate.id}>Update {candidate.status}</option>)}
                                    </select>
                                  </label>
                                ) : "New"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </SynchronizedHorizontalScroll>
                  </div>
                  ) : null}
                </div>
              );
            })
          )}
          </div>
        </ResultsScrollRegion>
          </div>
        )}
      </AppModal>

      <AppModal
        open={isDetailOpen}
        title="Result Details"
        size="lg"
        dialogStyle={{
          height: "calc(100dvh - 32px)",
          maxHeight: "calc(100dvh - 32px)",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
        bodyStyle={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
        }}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedRow(null);
        }}
        footer={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", width: "100%" }}>
            {isAdmin && selectedRow?.status === "Published" ? (
              <Button type="button" variant="secondary" onClick={() => void handleReview(selectedRow, "unpublish")}>
                Unpublish
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => {
                setIsDetailOpen(false);
                setSelectedRow(null);
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        <ResultsScrollRegion label="Result details" maxHeight="calc(100dvh - 170px)">
          <ResultDetails row={selectedRow} />
        </ResultsScrollRegion>
      </AppModal>
    </>
  );
}
