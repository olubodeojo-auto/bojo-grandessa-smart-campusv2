/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import ReportCardDocument from "../../../components/reports/ReportCardDocument";
import ReportCardToolbar from "../../../components/reports/ReportCardToolbar";
import AppModal from "../../../components/modals/AppModal";
import EmptyState from "../../../components/ui/EmptyState";
import FormField, { inputStyle } from "../../../components/forms/FormField";
import SectionCard from "../../../components/ui/SectionCard";
import Button from "../../../components/ui/Button";
import { type AcademicCalendarConfig } from "../../../config/grandessaCalendar";
import { buildStudentReportCard, deleteReportCard, getImportReviewDrafts, getImportReviewWorkbooks, getSavedReportCards, markImportReviewDraftStatus, saveReportCardDetails, type SavedReportCard } from "../../../services/reportCardService";
import { getImportScoreWarnings, getImportItemsForSave, isImportItemSkippableForMissingMarks, reconcileSavedImportStudentMatches, type ResultImportPreviewEntry } from "../../../services/resultImportService";
import { getAcademicSessionSetups, saveAcademicSessionSetup } from "../../../services/academicSessionService";
import { getClasses } from "../../../services/classService";
import { deleteResult, getResultPublicationEvidence, getResults, publishResult, reviewResult } from "../../../services/resultService";
import {
  getAcademicCalendarByYear,
  getSchoolSettings,
  saveAcademicCalendar,
  saveSchoolSettings,
  uploadSchoolBrandingAsset,
} from "../../../services/schoolSettingsService";
import { getStudents } from "../../../services/studentService";
import { useAuth } from "../../../hooks/useAuth";
import { administratorRoles } from "../../../config/routeRoles";
import type { AcademicSession, AcademicSessionSetup, AcademicTermName } from "../../../types/academicSession";
import type { ReportCardData, ReportTerm } from "../../../types/reportCard";
import type { SchoolSettings } from "../../../types/schoolSettings";
import type { Student } from "../../../types/student";
import type { SchoolClass } from "../../../types/class";
import type { Result } from "../../../types/result";
import type { ResultPublicationEvidence } from "../../../utils/resultPermissions";
import {
  canDeleteReportPeriod,
  canDeleteDraftReportPeriod,
  acquireReportPublishLock,
  deleteReportPeriodRecords,
  discoverReportCenterPeriods,
  getReportCenterCompleteness,
  getReportCenterPublishBlockReason,
  getReportCenterPublishActionState,
  getReportCenterPeriodStatus,
  getReportCenterResultsWithRecordedMarks,
  getReportPeriodResults,
  publishReportResultsAndVerify,
  unpublishReportResultsAndVerify,
  type ReportCenterPeriod,
} from "../../../utils/reportCenter";

const TERMS: ReportTerm[] = ["First", "Second", "Third"];

type PendingImportPupil = {
  workbookKey: string;
  ownerId: string;
  ownerName: string;
  sheetName: string;
  entry: ResultImportPreviewEntry;
};

type PendingImportPupilStatus = {
  label: string;
  explanation: string;
};

function getPendingImportPupilStatus(entry: ResultImportPreviewEntry): PendingImportPupilStatus {
  const classConflict = entry.warnings.some((warning) =>
    /selected student is not currently|worksheet says|workbook class differs|class differs|worksheet class/i.test(warning),
  );
  if (classConflict || entry.matchStatus === "manual-review") {
    return {
      label: "Class or pupil confirmation needed",
      explanation: "Choose the correct registered pupil. If the worksheet class number differs from the registered class, keep this entry in drafts until the class is reconciled.",
    };
  }
  if (entry.matchStatus === "unmatched" || !entry.selectedStudentId) {
    return { label: "Pupil match needed", explanation: "Open Reconcile this pupil, choose the actual registered pupil from the dropdown, and press Confirm this pupil. Name differences alone do not prevent manual matching." };
  }
  if (entry.reportKind === "Unclear") {
    return { label: "Report type to confirm", explanation: "Choose Midterm (CA) or End-of-Term before importing." };
  }
  if (!entry.academicYear.trim()) {
    return { label: "Session to confirm", explanation: "Reconcile this pupil and open session/report settings to choose the correct academic session." };
  }
  if (!entry.term) {
    return { label: "Term to confirm", explanation: "Reconcile this pupil and choose the correct school term." };
  }
  if (entry.items.length === 0) {
    return { label: "No subject rows", explanation: "No subject marks were found. Add the subjects and marks, or set this pupil aside. This does not block other pupils." };
  }
  const itemsToSave = getImportItemsForSave(entry);
  const unresolvedSubject = itemsToSave.find((item) => !item.subjectId || !item.classId);
  if (unresolvedSubject) {
    return { label: "Subject or class to confirm", explanation: `Resolve "${unresolvedSubject.subjectName}" in the subject grid. Use Go to next issue to reach the row.` };
  }
  if (itemsToSave.length === 0) {
    return {
      label: "Set aside — no complete marks",
      explanation: "There are no complete subject marks for this pupil yet. Leave this pupil in the review queue until subjects and marks are entered; other pupils can still proceed.",
    };
  }
  const scoreWarnings = getImportScoreWarnings({ ...entry, items: itemsToSave });
  if (scoreWarnings.length > 0 || itemsToSave.some((item) => (item.invalidMarks?.length ?? 0) > 0)) {
    return { label: "Correct invalid marks", explanation: "A nonblank mark is invalid or outside the allowed range. Reconcile this pupil, use Go to next issue, correct the row, and save again." };
  }
  const skippedItems = [...(entry.skippedItems ?? []), ...entry.items.filter(isImportItemSkippableForMissingMarks)];
  if (skippedItems.length > 0) {
    const names = [...new Set(skippedItems.map((item) => item.subjectName).filter(Boolean))].join(", ");
    return {
      label: "Ready — missing marks skipped",
      explanation: `Complete subject results can be saved and published now. Blank-mark subjects (${names || "shown in the subject grid"}) will be left out of this pass and entered later.`,
    };
  }
  return { label: "Ready to review", explanation: "The required subject rows have complete marks. Reconcile this pupil to save or publish the complete results." };
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const color = status === "Published" ? ["#166534", "#dcfce7"]
    : status === "Ready for review" ? ["#1d4ed8", "#dbeafe"]
      : status === "Draft" ? ["#92400e", "#fef3c7"]
        : status === "Returned" ? ["#991b1b", "#fee2e2"]
          : ["#475569", "#f1f5f9"];
  return {
    borderRadius: 999,
    background: color[1],
    color: color[0],
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 9px",
  };
}

const savedBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  background: "#f3e8ff",
  color: "#6b21a8",
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 9px",
};

function formatPublicationBlocker(reason: string): string {
  const missingSubjects = reason.match(/^Missing subject results observed for this class and session:\s*(.+)\.$/i);
  if (missingSubjects) {
    return `Missing subject result: ${missingSubjects[1]}. Open Edit subject marks to add it before publishing.`;
  }
  const friendlyMessages: Record<string, string> = {
    "No subject-result rows are available for this report period.": "No subject marks have been imported for this pupil yet.",
    "No complete subject-result rows are available for publication. Add at least one subject with complete marks.": "No complete subject result is available yet. Add the missing marks to at least one subject; incomplete rows will remain drafts.",
    "A subject is missing or has duplicate result rows.": "A subject is missing or listed more than once. Check the subject list.",
    "One or more Midterm CA marks are missing.": "A Midterm CA mark is blank. Complete it before publishing.",
    "One or more Midterm subject maximum scores are missing.": "A subject maximum score is missing. Complete it before publishing.",
    "One or more End-of-Term CA, examination, or total marks are missing.": "An End-of-Term CA, examination or total mark is missing. Complete it before publishing.",
    "All subject results in this report period are already published.": "All subject results are already published.",
  };
  return friendlyMessages[reason] ?? reason;
}

function emptySessionSetup(): AcademicSessionSetup {
  return {
    sessionId: null,
    sessionName: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    currentTerm: "",
    terms: TERMS.map((termName) => ({ termName, startDate: "", endDate: "" })),
  };
}

function toSessionSetup(session: AcademicSession): AcademicSessionSetup {
  return {
    sessionId: session.id,
    sessionName: session.session_name,
    startDate: session.start_date,
    endDate: session.end_date,
    isCurrent: session.is_current,
    currentTerm: session.terms.find((term) => term.is_current)?.term_name ?? "",
    terms: TERMS.map((termName) => {
      const term = session.terms.find((candidate) => candidate.term_name === termName);
      return {
        termName,
        startDate: term?.start_date ?? "",
        endDate: term?.end_date ?? "",
      };
    }),
  };
}

function BrandingField({
  label,
  value,
  uploading,
  onUpload,
  onRemove,
}: {
  label: string;
  value: string | null;
  uploading: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <FormField label={label}>
      <div style={{ display: "grid", gap: 8 }}>
        {value ? <img src={value} alt={`${label} preview`} style={{ width: 96, height: 64, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }} /> : null}
        <label style={{ ...inputStyle, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: uploading ? "wait" : "pointer" }}>
          {uploading ? "Uploading..." : value ? "Replace" : "Upload"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUpload} disabled={uploading} style={{ display: "none" }} />
        </label>
        {value ? <Button type="button" variant="secondary" onClick={onRemove}>Remove</Button> : null}
      </div>
    </FormField>
  );
}

export default function ReportCardsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReportCard[]>([]);
  const [pendingImportPupils, setPendingImportPupils] = useState<PendingImportPupil[]>([]);
  const [loadingImportWorkbooks, setLoadingImportWorkbooks] = useState(true);
  const [importWorkbooksError, setImportWorkbooksError] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [importedResultIds, setImportedResultIds] = useState<Set<string>>(new Set());
  const [publicationEvidence, setPublicationEvidence] = useState<Map<string, ResultPublicationEvidence>>(() => new Map());
  const [publicationEvidenceError, setPublicationEvidenceError] = useState("");
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [publishingKey, setPublishingKey] = useState("");
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const publishInFlightPeriods = useRef(new Set<string>());
  const [unpublishingKey, setUnpublishingKey] = useState("");
  const unpublishInFlightPeriods = useRef(new Set<string>());
  const [deletingKey, setDeletingKey] = useState("");
  const deleteInFlightPeriods = useRef(new Set<string>());
  const [publishVerificationErrors, setPublishVerificationErrors] = useState<Record<string, string>>({});
  const [unpublishVerificationErrors, setUnpublishVerificationErrors] = useState<Record<string, string>>({});
  const [reportSearch, setReportSearch] = useState("");
  const [reportListView, setReportListView] = useState<"drafts" | "published" | "all">("drafts");
  const [academicYear, setAcademicYear] = useState<string>(searchParams.get("academicYear") ?? "");
  const [calendarConfig, setCalendarConfig] = useState<AcademicCalendarConfig | null>(null);
  const [academicSessions, setAcademicSessions] = useState<AcademicSession[]>([]);
  const [sessionSetup, setSessionSetup] = useState<AcademicSessionSetup>(emptySessionSetup);
  const [savingSessionSetup, setSavingSessionSetup] = useState(false);
  const [sessionSetupError, setSessionSetupError] = useState("");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [report, setReport] = useState<ReportCardData | null>(null);
  const reportPreviewRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState("");
  const [uploadingBranding, setUploadingBranding] = useState<string>("");
  const [savingComments, setSavingComments] = useState(false);
  const savingCommentsInFlight = useRef(false);
  const [editingReportDetails, setEditingReportDetails] = useState(false);

  // Preview override fields (manual, not persisted)
  const [editedTimesPresent, setEditedTimesPresent] = useState<string>("");
  const [editedTimesAbsent, setEditedTimesAbsent] = useState<string>("");
  const [editedMaximumAttendance, setEditedMaximumAttendance] = useState<string>("");
  const [editedTermEnding, setEditedTermEnding] = useState("");
  const [editedNextTermBegins, setEditedNextTermBegins] = useState("");
  const [editedClassTeacherName, setEditedClassTeacherName] = useState("");
  const [editedClassTeacherComment, setEditedClassTeacherComment] = useState<string>("");
  const [editedHeadTeacherComment, setEditedHeadTeacherComment] = useState<string>("");
  const [editedClassAverage, setEditedClassAverage] = useState<string>("");
  const [editedTotalMarksObtained, setEditedTotalMarksObtained] = useState<string>("");
  const [editedTotalMarksObtainable, setEditedTotalMarksObtainable] = useState<string>("");
  const [editedStudentPercentage, setEditedStudentPercentage] = useState<string>("");
  const [reportCalculationMode, setReportCalculationMode] = useState<"Manual" | "Automatic">("Manual");
  const isAdministrator = roles.some((role) =>
    administratorRoles.some((name) => role.name.trim().toLowerCase() === name.toLowerCase()));
  const refreshSavedReportCards = useCallback(async (): Promise<void> => {
    try {
      const records = await getSavedReportCards();
      setSavedReports(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load saved report cards.");
    }
  }, []);

  const refreshPendingImportPupils = useCallback(async (): Promise<void> => {
    setLoadingImportWorkbooks(true);
    setImportWorkbooksError("");
    try {
      const [workbooks, roster] = await Promise.all([getImportReviewWorkbooks(), getStudents()]);
      const workbookEntries = await Promise.all(workbooks.map(async (workbook) => {
        const entries = await getImportReviewDrafts(workbook.workbookKey, workbook.ownerId);
        const completedResultIds = entries.filter((entry) => Boolean(entry.workflowStatus))
          .flatMap((entry) => entry.importedResultIds ?? []);
        const pendingEntries = reconcileSavedImportStudentMatches(
          entries.filter((entry) => !entry.workflowStatus && entry.included !== false),
          roster,
        );
        const separatorIndex = workbook.workbookKey.indexOf(":");
        const sheetName = separatorIndex >= 0
          ? workbook.workbookKey.slice(separatorIndex + 1)
          : "Saved worksheet";
        return {
          completedResultIds,
          pendingEntries: pendingEntries.map((entry) => ({
            workbookKey: workbook.workbookKey,
            ownerId: workbook.ownerId,
            ownerName: workbook.ownerName,
            sheetName,
            entry,
          })),
        };
      }));
      setImportedResultIds(new Set(workbookEntries.flatMap((item) => item.completedResultIds)));
      setPendingImportPupils(workbookEntries.flatMap((item) => item.pendingEntries).sort((left, right) =>
        left.entry.studentName.localeCompare(right.entry.studentName)
        || left.entry.academicYear.localeCompare(right.entry.academicYear)
        || (left.entry.term ?? "").localeCompare(right.entry.term ?? ""),
      ));
    } catch (err) {
      setImportWorkbooksError(err instanceof Error ? err.message : "Unable to load outstanding pupil imports.");
    } finally {
      setLoadingImportWorkbooks(false);
    }
  }, []);

  const resetReportDetailsFields = useCallback((data: ReportCardData | null): void => {
    setReportCalculationMode(data?.calculationMode ?? "Manual");
    setEditedTimesPresent(data?.attendance?.timesPresent != null ? String(data.attendance.timesPresent) : "");
    setEditedTimesAbsent(data?.attendance?.timesAbsent != null ? String(data.attendance.timesAbsent) : "");
    setEditedMaximumAttendance(data?.attendance?.maximumAttendance != null ? String(data.attendance.maximumAttendance) : "");
    setEditedTermEnding(data?.termEnding ?? "");
    setEditedNextTermBegins(data?.nextTermBegins ?? "");
    setEditedClassTeacherName(data?.classTeacherName ?? "");
    setEditedClassTeacherComment(data?.classTeacherComment ?? "");
    setEditedHeadTeacherComment(data?.headTeacherComment ?? "");
    setEditedClassAverage(data?.classAverage != null ? String(data.classAverage) : "");
    setEditedTotalMarksObtained(data?.reportTotalMarksObtained != null ? String(data.reportTotalMarksObtained) : "");
    setEditedTotalMarksObtainable(data?.reportTotalMarksObtainable != null ? String(data.reportTotalMarksObtainable) : "");
    setEditedStudentPercentage(data?.reportStudentPercentage != null ? String(data.reportStudentPercentage) : "");
  }, [
    setEditedClassAverage,
    setEditedClassTeacherComment,
    setEditedClassTeacherName,
    setEditedHeadTeacherComment,
    setEditedMaximumAttendance,
    setEditedNextTermBegins,
    setEditedStudentPercentage,
    setEditedTermEnding,
    setEditedTimesAbsent,
    setEditedTimesPresent,
    setEditedTotalMarksObtainable,
    setEditedTotalMarksObtained,
    setReportCalculationMode,
  ]);

  const reportDetailsDirty = Boolean(report && (
    reportCalculationMode !== report.calculationMode
    || editedTimesPresent !== (report.attendance?.timesPresent != null ? String(report.attendance.timesPresent) : "")
    || editedTimesAbsent !== (report.attendance?.timesAbsent != null ? String(report.attendance.timesAbsent) : "")
    || editedMaximumAttendance !== (report.attendance?.maximumAttendance != null ? String(report.attendance.maximumAttendance) : "")
    || editedTermEnding !== report.termEnding
    || editedNextTermBegins !== report.nextTermBegins
    || editedClassTeacherName !== report.classTeacherName
    || editedClassTeacherComment !== report.classTeacherComment
    || editedHeadTeacherComment !== report.headTeacherComment
    || editedClassAverage !== (report.classAverage != null ? String(report.classAverage) : "")
    || editedTotalMarksObtained !== (report.reportTotalMarksObtained != null ? String(report.reportTotalMarksObtained) : "")
    || editedTotalMarksObtainable !== (report.reportTotalMarksObtainable != null ? String(report.reportTotalMarksObtainable) : "")
    || editedStudentPercentage !== (report.reportStudentPercentage != null ? String(report.reportStudentPercentage) : "")
  ));

  useEffect(() => {
    resetReportDetailsFields(report);
  }, [report, resetReportDetailsFields]);

  useEffect(() => {
    if (report && !editingReportDetails) {
      reportPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [report, editingReportDetails]);

  useEffect(() => {
    async function loadAcademicSessions(): Promise<void> {
      try {
        const sessions = await getAcademicSessionSetups();
        setAcademicSessions(sessions);
      } catch (err) {
        setSessionSetupError(err instanceof Error ? err.message : "Unable to load academic sessions and terms.");
      }
    }
    void loadAcademicSessions();
  }, []);

  useEffect(() => {
    async function loadClasses(): Promise<void> {
      try {
        setClasses(await getClasses());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load classes.");
      }
    }
    void loadClasses();
  }, []);

  useEffect(() => {
    void refreshSavedReportCards();
  }, [refreshSavedReportCards]);

  useEffect(() => {
    void refreshPendingImportPupils();
  }, [refreshPendingImportPupils]);

  useEffect(() => {
    async function loadStudents(): Promise<void> {
      const data = await getStudents();
      setStudents(data);
    }

    void loadStudents();
  }, []);

  useEffect(() => {
    async function loadSchoolSettings(): Promise<void> {
      try {
        const data = await getSchoolSettings();
        setSchoolSettings(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load school settings.";
        setError(message);
      }
    }

    void loadSchoolSettings();
  }, []);

  useEffect(() => {
    if (!academicYear) {
      setCalendarConfig(null);
      return;
    }

    async function loadCalendar(): Promise<void> {
      try {
        const data = await getAcademicCalendarByYear(academicYear);
        setCalendarConfig(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load academic calendar.";
        setError(message);
      }
    }

    void loadCalendar();
  }, [academicYear]);

  useEffect(() => {
    let active = true;
    async function loadPeriods(): Promise<void> {
      setLoadingPeriods(true);
      try {
        const [loadedResults, loadedReports] = await Promise.all([
          getResults(),
          getSavedReportCards(),
        ]);
        if (!active) return;
        setResults(loadedResults);
        setSavedReports(loadedReports);
        setError("");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load available report periods.");
      } finally {
        if (active) setLoadingPeriods(false);
      }
    }
    void loadPeriods();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const refreshWorkspace = (): void => {
      void Promise.all([getResults(), getSavedReportCards()])
        .then(([loadedResults, loadedReports]) => {
          if (!active) return;
          setResults(loadedResults);
          setSavedReports(loadedReports);
          setError("");
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : "Unable to refresh saved results.");
        });
      void refreshPendingImportPupils();
    };
    window.addEventListener("grandessa:results-updated", refreshWorkspace);
    return () => {
      active = false;
      window.removeEventListener("grandessa:results-updated", refreshWorkspace);
    };
  }, [refreshPendingImportPupils]);

  useEffect(() => {
    let active = true;
    const candidates = results.filter((result) => result.status === "Returned" && !result.published_at);
    if (!isAdministrator || candidates.length === 0) {
      setPublicationEvidence(new Map());
      setPublicationEvidenceError("");
      return () => { active = false; };
    }

    setPublicationEvidence(new Map());
    setPublicationEvidenceError("");
    void getResultPublicationEvidence(candidates)
      .then((evidence) => { if (active) setPublicationEvidence(evidence); })
      .catch((err: unknown) => {
        if (!active) return;
        setPublicationEvidence(new Map());
        setPublicationEvidenceError(err instanceof Error ? err.message : "Unable to verify publication audit history.");
      });
    return () => { active = false; };
  }, [isAdministrator, results]);

  const reportPeriods = useMemo(
    () => discoverReportCenterPeriods(results, savedReports),
    [results, savedReports],
  );
  const filteredReportPeriods = useMemo(() => reportPeriods.filter((period) => {
    const student = students.find((candidate) => candidate.id === period.studentId);
    const pupilName = `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim().toLowerCase();
    const admissionNumber = student?.admission_number?.toLowerCase() ?? "";
    const className = classes.find((candidate) => candidate.id === period.classId)?.class_name
      ?? results.find((result) => result.class_id === period.classId)?.class_name
      ?? "";
    const query = reportSearch.trim().toLowerCase();
    return !query || pupilName.includes(query) || admissionNumber.includes(query) || className.toLowerCase().includes(query);
  }), [classes, reportPeriods, reportSearch, results, students]);

  const needsAttentionReportPeriods = useMemo(
    () => filteredReportPeriods.filter((period) => getReportCenterPeriodStatus(period) !== "Published"),
    [filteredReportPeriods],
  );
  const publishedReportPeriods = useMemo(
    () => filteredReportPeriods.filter((period) => getReportCenterPeriodStatus(period) === "Published"),
    [filteredReportPeriods],
  );
  const publishableReportPeriods = useMemo(
    () => needsAttentionReportPeriods.filter((period) =>
      isAdministrator
      && !getPublicationEvidenceErrorForPeriod(period)
      && !getReportCenterPublishBlockReason(period, results, isAdministrator, publicationEvidence),
    ),
    [needsAttentionReportPeriods, isAdministrator, results, publicationEvidence, publicationEvidenceError],
  );
  const filteredPendingImportPupils = useMemo(() => pendingImportPupils.filter((review) => {
    const originalName = (review.entry as ResultImportPreviewEntry & { sourceStudentName?: string }).sourceStudentName
      ?? review.entry.studentName;
    const searchName = reportSearch.trim().toLowerCase();
    const student = students.find((candidate) => candidate.id === review.entry.selectedStudentId);
    const registeredName = student ? `${student.first_name} ${student.last_name}`.trim() : "";
    const className = review.entry.className ?? "";
    return !searchName
      || originalName.toLowerCase().includes(searchName)
      || review.entry.studentName.toLowerCase().includes(searchName)
      || registeredName.toLowerCase().includes(searchName)
      || review.entry.admissionNumber.toLowerCase().includes(searchName)
      || className.toLowerCase().includes(searchName);
  }), [pendingImportPupils, reportSearch, students]);

  const blockedReportPeriodsCount = Math.max(0, needsAttentionReportPeriods.length - publishableReportPeriods.length);
  const dashboardStatusMessage = loadingPeriods || loadingImportWorkbooks
    ? "Checking saved imports and report publication status…"
    : error || importWorkbooksError
      ? "The dashboard could not confirm every status. Review the alert above or refresh before treating this list as clear."
      : reportSearch.trim() && filteredPendingImportPupils.length === 0 && needsAttentionReportPeriods.length === 0
        ? `No outstanding imports or unpublished drafts match “${reportSearch.trim()}”. Clear the search to review the full school list.`
        : filteredPendingImportPupils.length === 0 && needsAttentionReportPeriods.length === 0
          ? reportPeriods.length > 0
            ? "All pupil reports in this workspace are published. No imports or unpublished drafts are outstanding."
            : "No imports or unpublished drafts are outstanding. Import a workbook or enter results to start the next reporting cycle."
          : publishableReportPeriods.length > 0
            ? `${publishableReportPeriods.length} pupil report(s) are ready to publish now. ${blockedReportPeriodsCount > 0 ? `${blockedReportPeriodsCount} draft(s) still need attention. ` : ""}${filteredPendingImportPupils.length > 0 ? `${filteredPendingImportPupils.length} saved import(s) await review.` : "No other drafts or imports are outstanding."}`
            : `${filteredPendingImportPupils.length} saved import(s) are waiting for review, and ${blockedReportPeriodsCount} unpublished report draft(s) still need attention before they can be released. Open an item below to see the next step.`;

  async function openReportPeriod(period: ReportCenterPeriod, editDetails = false): Promise<void> {
    const student = students.find((candidate) => candidate.id === period.studentId);
    if (!student) {
      setError("The pupil for this report period is no longer available.");
      return;
    }
    if (period.results.length === 0) {
      setError("Saved report details exist, but there are no subject-result rows to preview. Review the pupil's results first.");
      return;
    }

    setAcademicYear(period.academicYear);
    setEditingReportDetails(editDetails);
    setReport(null);
    setLoading(true);
    setError("");
    setSuccess("");
    setSearchParams({
      studentId: period.studentId,
      academicYear: period.academicYear,
      term: period.term,
      reportType: period.reportType,
    });
    try {
      const data = await buildStudentReportCard(
        period.studentId,
        period.academicYear,
        period.term,
        {
          reportType: period.reportType,
          classId: period.classId,
          includeUnpublished: isAdministrator,
        },
      );
      if (!data) {
        throw new Error("No report preview is available from the subject results in this period.");
      }
      setReport(data);
      setSuccess(editDetails
        ? `Opened report details for ${student.first_name} ${student.last_name} · ${period.academicYear} · ${period.term} Term.`
        : `Opened report card preview for ${student.first_name} ${student.last_name} · ${period.academicYear} · ${period.term} Term.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to build this report preview.");
    } finally {
      setLoading(false);
    }
  }

  function navigateToResults(period: ReportCenterPeriod): void {
    const student = students.find((candidate) => candidate.id === period.studentId);
    const params = new URLSearchParams({
      session: period.academicYear,
      term: period.term,
      reportType: period.reportType,
      classId: period.classId,
      search: student ? `${student.first_name} ${student.last_name}`.trim() : "",
    });
    navigate(`/admin/results?${params.toString()}`);
  }

  function getPublicationEvidenceErrorForPeriod(period: ReportCenterPeriod): string {
    return period.results.some((result) => result.status === "Returned" && !result.published_at)
      ? publicationEvidenceError
      : "";
  }

  async function markPublishedImportEntry(
    period: ReportCenterPeriod,
    refreshedResults: Result[],
  ): Promise<boolean> {
    const publishedResultIdsInPeriod = new Set(
      refreshedResults
        .filter((result) => result.student_id === period.studentId
          && result.class_id === period.classId
          && result.academic_year === period.academicYear
          && result.term === period.term
          && result.status === "Published")
        .map((result) => result.id),
    );
    const workbooks = await getImportReviewWorkbooks();
    for (const workbook of workbooks) {
      const entries = await getImportReviewDrafts(workbook.workbookKey, workbook.ownerId);
      const entry = entries.find((candidate) =>
        candidate.workflowStatus === "imported_draft"
        && candidate.resultImportStudentId === period.studentId
        && candidate.resultImportClassId === period.classId
        && candidate.academicYear === period.academicYear
        && candidate.term === period.term
        && (candidate.reportKind === "Midterm / Continuous Assessment"
          ? period.reportType === "Midterm"
          : candidate.reportKind === "End-of-Term / Year Report Card" && period.reportType === "End-of-Term")
        && Boolean(candidate.importedResultIds?.length)
        && candidate.importedResultIds!.every((id) => publishedResultIdsInPeriod.has(id)),
      );
      if (!entry?.importedResultIds?.length) continue;
      await markImportReviewDraftStatus({
        workbookKey: workbook.workbookKey,
        entryKey: entry.studentKey,
        ownerId: workbook.ownerId,
        studentId: period.studentId,
        classId: period.classId,
        workflowStatus: "published",
        resultIds: entry.importedResultIds,
      });
      return true;
    }
    return false;
  }

  async function publishReportPeriod(
    period: ReportCenterPeriod,
    requireConfirmation = true,
    refreshImportQueue = true,
  ): Promise<{ ok: boolean; message: string; cancelled?: boolean; warning?: string }> {
    const releasePublishLock = acquireReportPublishLock(publishInFlightPeriods.current, period.key);
    if (!releasePublishLock) return { ok: false, message: "This report is already being processed." };
    try {
      if (!isAdministrator) return { ok: false, message: "Only an authorised administrator can publish reports." };
      const publishBlockReason = getPublicationEvidenceErrorForPeriod(period)
        || getReportCenterPublishBlockReason(period, results, isAdministrator, publicationEvidence);
      if (publishBlockReason) {
        const message = "Publishing unavailable: " + publishBlockReason;
        if (requireConfirmation) setError(message);
        return { ok: false, message };
      }
      const student = students.find((candidate) => candidate.id === period.studentId);
      if (!student) {
        const message = "The pupil for this report period is no longer available.";
        if (requireConfirmation) setError(message);
        return { ok: false, message };
      }
      const pupilName = (student.first_name + " " + student.last_name).trim();
      const publishableResults = getReportCenterResultsWithRecordedMarks(period.results);
      if (publishableResults.length === 0) {
        const message = "No complete subject marks are available to publish yet. Incomplete subject rows remain drafts; add their marks later.";
        if (requireConfirmation) setError(message);
        return { ok: false, message };
      }
      const pendingResults = publishableResults.filter((result) => result.status !== "Published");
      if (pendingResults.length === 0) return { ok: true, message: pupilName + " has no complete unpublished subject results. Incomplete subject rows remain drafts." };
      const className = classes.find((candidate) => candidate.id === period.classId)?.class_name
        ?? period.results.find((result) => result.class_name)?.class_name
        ?? "Class unavailable";
      if (requireConfirmation) {
        const confirmed = window.confirm(
          `Publish subject results for ${student.first_name} ${student.last_name}?\n\nClass: ${className}\nSession: ${period.academicYear}\nTerm: ${period.term}\nSubject results to publish: ${pendingResults.length}\n\nOnly this pupil's subject results will be published after the existing checks pass. This does not send emails.`,
        );
        if (!confirmed) return { ok: false, message: "Publication was cancelled.", cancelled: true };
      }
      setPublishingKey(period.key);
      if (requireConfirmation) {
        setError("");
        setSuccess("");
      }
      setPublishVerificationErrors((current) => {
        const next = { ...current };
        delete next[period.key];
        return next;
      });
      setUnpublishVerificationErrors((current) => {
        const next = { ...current };
        delete next[period.key];
        return next;
      });
      const outcome = await publishReportResultsAndVerify(pendingResults, publishResult, getResults);
      if (!outcome.refreshedResults) {
        const message = "The publish outcome for " + pupilName + " could not be verified: "
          + (outcome.verificationError ?? "Unable to reload saved statuses.")
          + " Refresh the saved status before retrying.";
        setPublishVerificationErrors((current) => ({ ...current, [period.key]: message }));
        if (requireConfirmation) setError(message);
        return { ok: false, message };
      }
      setResults(outcome.refreshedResults);

      const publishedCount = outcome.publishedResultIds.length;
      if (publishedCount === pendingResults.length) {
        let importQueueMessage = "";
        try {
          const importEntryUpdated = await markPublishedImportEntry(period, outcome.refreshedResults);
          if (importEntryUpdated && refreshImportQueue) await refreshPendingImportPupils();
        } catch (statusError) {
          importQueueMessage = statusError instanceof Error
            ? statusError.message
            : "Unable to refresh the saved import status.";
        }
        const message = "Verified: published " + publishedCount + " subject result(s) for " + pupilName + ".";
        if (requireConfirmation) setSuccess(message);
        if (importQueueMessage && requireConfirmation) {
          setError("The report is published, but its saved import queue status could not be updated. Do not import this pupil again. " + importQueueMessage);
        }
        return { ok: true, message, warning: importQueueMessage || undefined };
      }

      const resultNames = new Map(pendingResults.map((result) => [
        result.id,
        result.subject_name?.trim() || result.id,
      ]));
      const failureDetails = outcome.failures
        .map((failure) => (resultNames.get(failure.resultId) ?? failure.resultId) + ": " + failure.message)
        .join(" ");
      const message = "Verified " + publishedCount + " of " + pendingResults.length
        + " subject result(s) as Published for " + pupilName + "; "
        + (pendingResults.length - publishedCount) + " remain unpublished. " + failureDetails;
      if (requireConfirmation) setError(message);
      return { ok: false, message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to publish this report period.";
      if (requireConfirmation) setError(message);
      return { ok: false, message };
    } finally {
      setPublishingKey((current) => current === period.key ? "" : current);
      releasePublishLock();
    }
  }

  async function publishAllReadyReports(): Promise<void> {
    if (!isAdministrator || bulkPublishing) return;
    const batch = [...publishableReportPeriods];
    if (batch.length === 0) {
      setError("No report currently passes every publishing check.");
      return;
    }
    const subjectCount = batch.reduce(
      (total, period) => total + period.results.filter((result) => result.status !== "Published").length,
      0,
    );
    const confirmed = window.confirm(
      "Publish all " + batch.length + " ready pupil report(s)?\n\n"
      + "Subject results to publish: " + subjectCount + "\n\n"
      + "The system will check and verify each pupil's saved Published status. Reports that fail a check will remain unpublished and be listed afterward. This does not send emails.",
    );
    if (!confirmed) return;

    setBulkPublishing(true);
    setError("");
    setSuccess("");
    const successfulPupils: string[] = [];
    const failedPupils: string[] = [];
    const queueWarnings: string[] = [];
    try {
      for (const period of batch) {
        const student = students.find((candidate) => candidate.id === period.studentId);
        const pupilName = student
          ? (student.first_name + " " + student.last_name).trim()
          : "Pupil " + period.studentId;
        const outcome = await publishReportPeriod(period, false, false);
        if (outcome.ok) {
          successfulPupils.push(pupilName);
          if (outcome.warning) queueWarnings.push(pupilName + ": " + outcome.warning);
        } else {
          failedPupils.push(pupilName + ": " + outcome.message);
        }
      }

      try {
        setResults(await getResults());
      } catch (refreshError) {
        failedPupils.push("Final status refresh: " + (refreshError instanceof Error ? refreshError.message : "Unable to reload results."));
      }
      await refreshPendingImportPupils();

      setSuccess(
        "Bulk publishing completed: verified " + successfulPupils.length + " of " + batch.length
        + " pupil report(s) in Published status. " + subjectCount + " subject result(s) were targeted. No emails were sent.",
      );
      const problems: string[] = [];
      if (failedPupils.length > 0) {
        problems.push("Not published or not verified (" + failedPupils.length + "): " + failedPupils.join("; "));
      }
      if (queueWarnings.length > 0) {
        problems.push("Publication succeeded, but import tracking needs attention: " + queueWarnings.join("; "));
      }
      if (problems.length > 0) setError(problems.join("\n"));
    } finally {
      setBulkPublishing(false);
    }
  }

  async function verifyPublishStatus(period: ReportCenterPeriod): Promise<void> {
    setError("");
    try {
      const refreshedResults = await getResults();
      setResults(refreshedResults);
      setPublishVerificationErrors((current) => {
        const next = { ...current };
        delete next[period.key];
        return next;
      });
      const periodResultIds = new Set(period.results.map((result) => result.id));
      const savedPeriodResults = refreshedResults.filter((result) => periodResultIds.has(result.id));
      const publishedCount = savedPeriodResults.filter((result) => result.status === "Published").length;
      const returnedCount = savedPeriodResults.filter((result) => result.status === "Returned").length;
      const pupil = students.find((student) => student.id === period.studentId);
      setSuccess(`Verified saved status for ${pupil ? `${pupil.first_name} ${pupil.last_name}` : "this pupil"}: ${publishedCount} Published, ${returnedCount} Returned, ${savedPeriodResults.length - publishedCount - returnedCount} other subject result(s).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to reload saved result statuses.";
      setPublishVerificationErrors((current) => ({ ...current, [period.key]: message }));
      setError(`The saved publish status could not be verified: ${message}. Do not retry until the status can be refreshed.`);
    }
  }

  function updateCalendar(path: "firstTerm" | "secondTerm" | "thirdTerm", field: "startDate" | "endDate" | "termEnding" | "nextTermBegins", value: string): void {
    setCalendarConfig((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        [path]: {
          ...previous[path],
          [field]: value,
        },
      };
    });
  }

  async function saveCalendar(): Promise<void> {
    if (!calendarConfig) {
      return;
    }

    try {
      setError("");
      const saved = await saveAcademicCalendar(calendarConfig);
      setCalendarConfig(saved);
      setReport(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save academic calendar.";
      setError(message);
    }
  }

  function selectSessionForEditing(sessionId: string): void {
    const session = academicSessions.find((candidate) => candidate.id === sessionId);
    setSessionSetup(session ? toSessionSetup(session) : emptySessionSetup());
  }

  function updateSessionTerm(
    termName: AcademicTermName,
    field: "startDate" | "endDate",
    value: string,
  ): void {
    setSessionSetup((previous) => ({
      ...previous,
      terms: previous.terms.map((term) => term.termName === termName ? { ...term, [field]: value } : term),
    }));
  }

  async function saveSessionSetup(): Promise<void> {
    try {
      setSavingSessionSetup(true);
      setSessionSetupError("");
      const sessionId = await saveAcademicSessionSetup(sessionSetup);
      const sessions = await getAcademicSessionSetups();
      setAcademicSessions(sessions);
      const savedSession = sessions.find((session) => session.id === sessionId);
      if (!savedSession) throw new Error("Saved academic session was not returned when reloading session records.");
      setSessionSetup(toSessionSetup(savedSession));
      setAcademicYear(savedSession.session_name);
      setSessionSetupError("");
      setError("");
      setSuccess(`Saved ${savedSession.session_name} session and all three term dates.`);
    } catch (err) {
      setSessionSetupError(err instanceof Error ? err.message : "Unable to save academic session and terms.");
    } finally {
      setSavingSessionSetup(false);
    }
  }

  function updateSchoolSetting(field: keyof SchoolSettings, value: string): void {
    setSchoolSettings((previous) => {
      if (!previous) {
        return previous;
      }

      if (field === "kindergarten_class_patterns" || field === "basic_class_patterns") {
        const normalized = value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

        return {
          ...previous,
          [field]: normalized,
        };
      }

      if (field === "school_name") {
        return {
          ...previous,
          school_name: value,
        };
      }

      return {
        ...previous,
        [field]: value || null,
      };
    });
  }

  async function saveSettings(): Promise<void> {
    if (!schoolSettings) {
      return;
    }

    try {
      setError("");
      const saved = await saveSchoolSettings(schoolSettings);
      setSchoolSettings(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save school settings.";
      setError(message);
    }
  }

  async function saveReportDetails(): Promise<void> {
    if (!report || savingCommentsInFlight.current) return;
    const numericFields: Array<{ label: string; value: string; minimum?: number; maximum?: number }> = [
      { label: "Class average", value: editedClassAverage, minimum: 0, maximum: 100 },
      { label: "Total marks obtained", value: editedTotalMarksObtained, minimum: 0 },
      { label: "Total marks obtainable", value: editedTotalMarksObtainable, minimum: 0 },
      { label: "Student percentage", value: editedStudentPercentage, minimum: 0, maximum: 100 },
      { label: "Maximum attendance", value: editedMaximumAttendance, minimum: 0 },
      { label: "Times present", value: editedTimesPresent, minimum: 0 },
      { label: "Times absent", value: editedTimesAbsent, minimum: 0 },
    ];
    const invalidField = numericFields.find(({ value, minimum, maximum }) => {
      if (!value.trim()) return false;
      const numericValue = Number(value);
      return !Number.isFinite(numericValue)
        || (minimum !== undefined && numericValue < minimum)
        || (maximum !== undefined && numericValue > maximum);
    });
    if (invalidField) {
      setError(`${invalidField.label} must be a valid number${invalidField.maximum !== undefined ? ` between ${invalidField.minimum} and ${invalidField.maximum}` : " greater than or equal to zero"}.`);
      return;
    }

    savingCommentsInFlight.current = true;
    try {
      setSavingComments(true);
      setError("");
      setSuccess("");
      await saveReportCardDetails({
        studentId: report.student.id,
        academicYear: report.academicYear,
        term: report.term,
        classId: report.classId,
        reportType: report.reportType,
        calculationMode: reportCalculationMode,
        classTeacherName: editedClassTeacherName,
        classTeacherComment: editedClassTeacherComment,
        headTeacherComment: editedHeadTeacherComment,
        classAverage: editedClassAverage === "" ? null : Number(editedClassAverage),
        totalMarksObtained: editedTotalMarksObtained === "" ? null : Number(editedTotalMarksObtained),
        totalMarksObtainable: editedTotalMarksObtainable === "" ? null : Number(editedTotalMarksObtainable),
        studentPercentage: editedStudentPercentage === "" ? null : Number(editedStudentPercentage),
        maximumAttendance: editedMaximumAttendance === "" ? null : Number(editedMaximumAttendance),
        timesPresent: editedTimesPresent === "" ? null : Number(editedTimesPresent),
        timesAbsent: editedTimesAbsent === "" ? null : Number(editedTimesAbsent),
        termEnding: editedTermEnding,
        nextTermBegins: editedNextTermBegins,
      });
      const refreshed = await buildStudentReportCard(report.student.id, report.academicYear, report.term, {
        reportType: report.reportType,
        classId: report.classId,
        includeUnpublished: isAdministrator,
      });
      if (!refreshed) throw new Error("The saved report details could not be reloaded for verification.");
      setReport(refreshed);
      await refreshSavedReportCards();
      setEditingReportDetails(false);
      setSuccess(`${report.reportType === "Midterm" ? "Midterm" : "End-of-Term"} report details saved for ${report.student.first_name} ${report.student.last_name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save report comments.");
    } finally {
      setSavingComments(false);
      savingCommentsInFlight.current = false;
    }
  }

  function cancelReportDetails(): void {
    if (savingComments) return;
    if (reportDetailsDirty && !window.confirm("Discard unsaved report-card detail changes?")) return;
    resetReportDetailsFields(report);
    setEditingReportDetails(false);
  }

  async function unpublishReportPeriod(period: ReportCenterPeriod): Promise<void> {
    const releaseLock = acquireReportPublishLock(unpublishInFlightPeriods.current, period.key);
    if (!releaseLock) return;
    if (!isAdministrator || !period.results.length
      || period.results.some((result) => result.status !== "Published")) {
      releaseLock();
      return;
    }

    const pupil = students.find((candidate) => candidate.id === period.studentId);
    const pupilName = pupil ? `${pupil.first_name} ${pupil.last_name}`.trim() : "this pupil";
    if (!window.confirm(`Unpublish the ${period.reportType === "Midterm" ? "Midterm" : "End-of-Term"} report card for ${pupilName}? Every subject result will move to Returned and remain unpublished until explicitly published again.`)) {
      releaseLock();
      return;
    }
    const reason = window.prompt("Optional internal note for unpublishing (up to 250 characters):");
    if (reason === null) {
      releaseLock();
      return;
    }
    if (reason.trim().length > 250) {
      setError("The internal note must be no more than 250 characters.");
      releaseLock();
      return;
    }

    setUnpublishingKey(period.key);
    setError("");
    setSuccess("");
    try {
      const outcome = await unpublishReportResultsAndVerify(
        period.results,
        (resultId, note) => reviewResult(resultId, "unpublish", note),
        getResults,
        reason.trim() || undefined,
      );
      if (!outcome.refreshedResults) {
        const message = `Unpublish status could not be verified: ${outcome.verificationError ?? "Unable to reload saved result statuses."}`;
        setUnpublishVerificationErrors((current) => ({ ...current, [period.key]: message }));
        setError(`${message} Refresh the saved status before retrying.`);
        return;
      }
      setResults(outcome.refreshedResults);
      const returnedCount = outcome.returnedResultIds.length;
      if (returnedCount === period.results.length) {
        setUnpublishVerificationErrors((current) => {
          const next = { ...current };
          delete next[period.key];
          return next;
        });
        setSuccess(`Verified: unpublished ${returnedCount} subject result(s) for ${pupilName}. They remain Returned until explicitly republished.`);
        return;
      }
      const resultNames = new Map(period.results.map((result) => [result.id, result.subject_name?.trim() || result.id]));
      const failureDetails = outcome.failures
        .map((failure) => `${resultNames.get(failure.resultId) ?? failure.resultId}: ${failure.message}`)
        .join(" ");
      const message = `Verified ${returnedCount} of ${period.results.length} subject result(s) as Returned for ${pupilName}; ${period.results.length - returnedCount} remain Published. ${failureDetails}`;
      setUnpublishVerificationErrors((current) => ({ ...current, [period.key]: message }));
      setError(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to unpublish this report period.");
    } finally {
      setUnpublishingKey((current) => current === period.key ? "" : current);
      releaseLock();
    }
  }

  async function deleteDraftPeriod(period: ReportCenterPeriod): Promise<void> {
    if (!canDeleteDraftReportPeriod(period, isAdministrator)) return;
    const releaseLock = acquireReportPublishLock(deleteInFlightPeriods.current, period.key);
    if (!releaseLock) return;
    const pupil = students.find((candidate) => candidate.id === period.studentId);
    const pupilName = pupil ? `${pupil.first_name} ${pupil.last_name}`.trim() : "this pupil";
    const confirmed = window.confirm(
      `Delete all ${period.results.length} draft subject result(s) for ${pupilName}?${period.savedReport ? " The saved report-card details for this draft period will also be deleted." : ""}\n\nClass: ${classes.find((candidate) => candidate.id === period.classId)?.class_name ?? "Class unavailable"}\nSession: ${period.academicYear}\nTerm: ${period.term}\nReport type: ${period.reportType}\n\nThis cannot be undone.`,
    );
    if (!confirmed) {
      releaseLock();
      return;
    }

    setDeletingKey(period.key);
    setError("");
    setSuccess("");
    try {
      const failures: string[] = [];
      for (const result of period.results) {
        try {
          await deleteResult(result.id);
        } catch (err) {
          failures.push(`${result.subject_name ?? result.id}: ${err instanceof Error ? err.message : "Delete failed."}`);
        }
      }
      if (failures.length === 0 && period.savedReport) {
        try {
          await deleteReportCard(period.savedReport.id);
        } catch (err) {
          failures.push(`Saved report-card details: ${err instanceof Error ? err.message : "Delete failed."}`);
        }
      }
      const refreshedResults = await getResults();
      setResults(refreshedResults);
      setSavedReports(await getSavedReportCards());
      if (report?.student.id === period.studentId
        && report.classId === period.classId
        && report.academicYear === period.academicYear
        && report.term === period.term
        && report.reportType === period.reportType) setReport(null);
      if (failures.length > 0) {
        setError(`Some draft results could not be deleted: ${failures.join(" ")}`);
      } else {
        setSuccess(`Deleted ${period.results.length} draft subject result(s)${period.savedReport ? " and their saved report-card details" : ""} for ${pupilName}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh draft result status after deletion.");
    } finally {
      setDeletingKey((current) => current === period.key ? "" : current);
      releaseLock();
    }
  }

  async function deleteReportPeriod(period: ReportCenterPeriod): Promise<void> {
    if (!canDeleteReportPeriod(period, isAdministrator)) return;
    const releaseLock = acquireReportPublishLock(deleteInFlightPeriods.current, period.key);
    if (!releaseLock) return;
    let deletionOutcome: Awaited<ReturnType<typeof deleteReportPeriodRecords>> | null = null;
    let affectedResultCount = period.results.length;

    try {
      const [allResults, savedReportCards] = await Promise.all([
        getResults(),
        getSavedReportCards({
          academicYear: period.academicYear,
          term: period.term,
          reportType: period.reportType,
          classId: period.classId,
        }),
      ]);
      const exactSavedReports = savedReportCards.filter((savedReport) =>
        savedReport.student_id === period.studentId
        && savedReport.class_id === period.classId
        && savedReport.academic_year === period.academicYear
        && savedReport.term === period.term
        && savedReport.report_type === period.reportType,
      );
      if (exactSavedReports.length > 1) {
        throw new Error("Multiple saved report cards match this pupil and period. No records were deleted.");
      }

      const currentPeriod: ReportCenterPeriod = {
        ...period,
        results: getReportPeriodResults(period, allResults),
        savedReport: exactSavedReports[0],
      };
      affectedResultCount = currentPeriod.results.length;
      if (!canDeleteReportPeriod(currentPeriod, isAdministrator)) {
        throw new Error("This report period no longer has subject results or saved report-card details to delete.");
      }

      const pupil = students.find((candidate) => candidate.id === period.studentId);
      const pupilName = pupil
        ? `${pupil.first_name} ${pupil.last_name}`.trim()
        : "Pupil unavailable";
      const admissionNumber = pupil?.admission_number || "Unavailable";
      const className = classes.find((candidate) => candidate.id === period.classId)?.class_name
        ?? currentPeriod.results.find((result) => result.class_name)?.class_name
        ?? "Class unavailable";
      const currentStatus = getReportCenterPeriodStatus(currentPeriod);
      const outcome = await deleteReportPeriodRecords(
        currentPeriod,
        isAdministrator,
        () => {
          const confirmed = window.confirm(
            `Permanently delete this report card for ${pupilName}?\n\nAdmission number: ${admissionNumber}\nClass: ${className}\nAcademic session: ${period.academicYear}\nTerm: ${period.term} Term\nReport type: ${period.reportType}\nCurrent publication status: ${currentStatus}\nSubject-result records affected: ${currentPeriod.results.length}\nSaved report-card details: ${currentPeriod.savedReport ? "Yes" : "No"}\n\nThis permanently deletes the listed subject-result records and saved report-card details for this period only. Existing subject-result audit history is retained. This cannot be undone.`,
          );
          if (confirmed) {
            setDeletingKey(period.key);
            setError("");
            setSuccess("");
          }
          return confirmed;
        },
        deleteResult,
        deleteReportCard,
      );
      if (outcome.cancelled) return;
      deletionOutcome = outcome;

      const [refreshedResults, refreshedSavedReports] = await Promise.all([
        getResults(),
        getSavedReportCards(),
      ]);
      setResults(refreshedResults);
      setSavedReports(refreshedSavedReports);
      if (report?.student.id === period.studentId
        && report.classId === period.classId
        && report.academicYear === period.academicYear
        && report.term === period.term
        && report.reportType === period.reportType) setReport(null);

      if (outcome.failures.length > 0) {
        const failureDetails = outcome.failures
          .map((failure) => failure.message)
          .join(" ");
        setError(
          `Deleted ${outcome.deletedResultIds.length} of ${currentPeriod.results.length} subject-result record(s). Saved report-card details ${outcome.deletedSavedReport ? "were deleted" : "were retained because one or more deletions failed"}. ${failureDetails}`,
        );
      } else {
        setSuccess(
          `Deleted the ${period.reportType} report card for ${pupilName}, including ${outcome.deletedResultIds.length} subject-result record(s)${outcome.deletedSavedReport ? " and saved report-card details" : ""}.`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      if (deletionOutcome) {
        const deletionFailures = deletionOutcome.failures.map((failure) => failure.message).join(" ");
        setError(
          `Deletion requests completed (${deletionOutcome.deletedResultIds.length} of ${affectedResultCount} subject-result records removed), but the affected report-card list could not be refreshed: ${message} ${deletionFailures}`,
        );
      } else {
        setError(`Unable to delete this report card: ${message}`);
      }
    } finally {
      setDeletingKey((current) => current === period.key ? "" : current);
      releaseLock();
    }
  }

  async function deleteSavedReportDetails(period: ReportCenterPeriod): Promise<void> {
    if (!isAdministrator || period.results.length > 0 || !period.savedReport) return;
    const releaseLock = acquireReportPublishLock(deleteInFlightPeriods.current, period.key);
    if (!releaseLock) return;
    const pupil = students.find((candidate) => candidate.id === period.studentId);
    const pupilName = pupil ? `${pupil.first_name} ${pupil.last_name}`.trim() : "this pupil";
    if (!window.confirm(`Delete the saved report-card details for ${pupilName}? There are no subject-result rows in this period.`)) {
      releaseLock();
      return;
    }

    setDeletingKey(period.key);
    setError("");
    setSuccess("");
    try {
      await deleteReportCard(period.savedReport.id);
      const saved = await getSavedReportCards();
      setSavedReports(saved);
      if (report?.student.id === period.studentId
        && report.classId === period.classId
        && report.academicYear === period.academicYear
        && report.term === period.term
        && report.reportType === period.reportType) setReport(null);
      setSuccess(`Deleted saved report-card details for ${pupilName}. No subject results were changed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete saved report-card details.");
    } finally {
      setDeletingKey((current) => current === period.key ? "" : current);
      releaseLock();
    }
  }

  async function handleBrandingUpload(
    event: React.ChangeEvent<HTMLInputElement>,
    field: "logo_url" | "principal_signature_url" | "school_stamp_url",
    assetName: "logo" | "signature" | "stamp"
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setUploadingBranding(field);
      setError("");
      const imageUrl = await uploadSchoolBrandingAsset(file, assetName);
      updateSchoolSetting(field, imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The image could not be uploaded. Please try again.");
    } finally {
      setUploadingBranding("");
    }
  }

  function renderReportPeriodCard(period: ReportCenterPeriod) {
                const pupil = students.find((candidate) => candidate.id === period.studentId);
                const pupilName = pupil ? `${pupil.first_name} ${pupil.last_name}`.trim() : "Pupil unavailable";
                const className = classes.find((candidate) => candidate.id === period.classId)?.class_name
                  ?? period.results.find((result) => result.class_name)?.class_name
                  ?? "Class unavailable";
                const statusLabel = getReportCenterPeriodStatus(period);
                const sourceLabel = period.results.length > 0 && period.results.every((result) => importedResultIds.has(result.id))
                  ? "Imported"
                  : period.results.some((result) => importedResultIds.has(result.id)) ? "Mixed" : "Manual";
                const completeness = getReportCenterCompleteness(period, results);
                const periodEvidenceError = getPublicationEvidenceErrorForPeriod(period);
                const publishBlockReason = periodEvidenceError
                  || getReportCenterPublishBlockReason(period, results, isAdministrator, publicationEvidence);
                const isPublishing = publishingKey === period.key;
                const publishAction = getReportCenterPublishActionState(
                  period,
                  results,
                  isAdministrator,
                  Boolean(publishingKey) || bulkPublishing,
                  publishVerificationErrors[period.key],
                  publicationEvidence,
                  periodEvidenceError,
                );
                const showPublishAction = publishAction.visible && statusLabel !== "Published";
                const isUnpublishing = unpublishingKey === period.key;
                const isDeleting = deletingKey === period.key;
                const canUnpublish = isAdministrator && period.results.length > 0
                  && period.results.every((result) => result.status === "Published");
                const canDeleteDraft = canDeleteDraftReportPeriod(period, isAdministrator);
                const canDeleteReport = canDeleteReportPeriod(period, isAdministrator);
                return (
                  <article key={period.key} aria-labelledby={`report-period-${period.key}`} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "grid", gap: 12, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                          <h2 id={`report-period-${period.key}`} style={{ margin: 0, fontSize: 19 }}>{pupilName}</h2>
                          <span style={statusBadgeStyle(statusLabel)}>{statusLabel}</span>
                          <span style={{ borderRadius: 999, padding: "3px 8px", background: "#f1f5f9", color: "#475569", fontSize: 11, fontWeight: 800 }}>{sourceLabel}</span>
                        </div>
                        <p style={{ color: "#64748b", fontSize: 13, margin: "5px 0 0" }}>
                          Admission no.: {pupil?.admission_number || "Unavailable"} · Class: {className}
                        </p>
                        <p style={{ color: "#334155", fontSize: 13, margin: "3px 0 0" }}>
                          {period.academicYear} · {period.term} Term · {period.reportType === "Midterm" ? "Midterm (CA)" : "End-of-Term"}
                        </p>
                      </div>
                      {period.savedReport ? <span style={savedBadgeStyle}>Report details saved</span> : null}
                    </div>

                    <div style={{ display: "grid", gap: 4, padding: "11px 13px", borderRadius: 10, border: completeness.complete ? "1px solid #bbf7d0" : "1px solid #fed7aa", background: completeness.complete ? "#f0fdf4" : "#fff7ed" }}>
                      <p style={{ margin: 0, color: completeness.complete ? "#166534" : "#92400e", fontSize: 13, fontWeight: 700 }}>
                        {completeness.complete ? `Subject marks checked · ${period.results.length} result(s)` : `Needs attention · ${period.results.length} subject result(s)`}
                      </p>
                      <p style={{ margin: 0, color: completeness.complete ? "#166534" : "#92400e", fontSize: 13 }}>
                        {completeness.complete ? "All available subject marks are present and valid." : formatPublicationBlocker(completeness.reason)}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {showPublishAction ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          aria-label={"Publish " + pupilName + "'s report for " + period.academicYear + ", " + period.term + " Term"}
                          onClick={() => void publishReportPeriod(period)}
                          disabled={publishAction.disabled}
                          title={publishAction.reason ? formatPublicationBlocker(publishAction.reason) : "Publish this pupil's report after all checks pass."}
                          style={{ minHeight: 46, padding: "12px 18px", borderRadius: 12, background: "#0f766e", borderColor: "#0f766e", color: "#fff", fontSize: 14, fontWeight: 800, boxShadow: "none" }}
                        >
                          {isPublishing ? "Publishing report…" : "Publish report"}
                        </Button>
                      ) : null}
                      <Button type="button" variant="secondary" onClick={() => void openReportPeriod(period)} disabled={period.results.length === 0} title={period.results.length === 0 ? "Subject results are required to preview a report card." : undefined}>
                        Preview report
                      </Button>
                      <details style={{ position: "relative", minWidth: 150 }}>
                        <summary style={{ listStyle: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 42, padding: "10px 13px", border: "1px solid #d6dee8", borderRadius: 11, background: "#fff", color: "#334155", fontWeight: 750, fontSize: 13, cursor: "pointer" }}>
                          More actions
                        </summary>
                        <div style={{ display: "grid", gap: 7, marginTop: 8, padding: 12, border: "1px solid #dbe3ec", borderRadius: 12, background: "#fff", boxShadow: "0 6px 18px rgba(23,43,77,0.07)" }}>
                          <Button type="button" variant="secondary" onClick={() => void openReportPeriod(period, true)} disabled={period.results.length === 0 || !isAdministrator} title={!isAdministrator ? "Only an administrator can edit report-card details." : period.results.length === 0 ? "Subject results are required to open report-card details." : undefined}>
                            Edit report details
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => navigateToResults(period)} disabled={period.results.length === 0} title={period.results.length === 0 ? "No subject results are available to edit." : undefined}>
                            Edit subject marks
                          </Button>
                          {canUnpublish ? (
                            <Button type="button" variant="secondary" onClick={() => void unpublishReportPeriod(period)} disabled={Boolean(unpublishingKey) || Boolean(publishingKey) || Boolean(unpublishVerificationErrors[period.key])} title={unpublishVerificationErrors[period.key] || "Move each published subject result to Returned through the existing review workflow."}>
                              {isUnpublishing ? "Unpublishing…" : "Unpublish results"}
                            </Button>
                          ) : null}
                          {canDeleteReport ? (
                            <Button type="button" variant="secondary" onClick={() => void deleteReportPeriod(period)} disabled={Boolean(deletingKey) || Boolean(publishingKey) || Boolean(unpublishingKey)} style={{ color: "#b91c1c", borderColor: "#fecaca" }}>
                              {isDeleting ? "Deleting report card…" : "Delete report card"}
                            </Button>
                          ) : null}
                          {canDeleteDraft ? (
                            <Button type="button" variant="secondary" onClick={() => void deleteDraftPeriod(period)} disabled={Boolean(deletingKey) || Boolean(publishingKey) || Boolean(unpublishingKey)} style={{ color: "#b91c1c", borderColor: "#fecaca" }}>
                              {isDeleting ? "Deleting draft…" : "Delete draft"}
                            </Button>
                          ) : null}
                          {isAdministrator && period.results.length === 0 && period.savedReport ? (
                            <Button type="button" variant="secondary" onClick={() => void deleteSavedReportDetails(period)} disabled={Boolean(deletingKey)} style={{ color: "#b91c1c", borderColor: "#fecaca" }}>
                              {isDeleting ? "Deleting details…" : "Delete saved details"}
                            </Button>
                          ) : null}
                          {isAdministrator && (publishVerificationErrors[period.key] || unpublishVerificationErrors[period.key]) ? (
                            <Button type="button" variant="secondary" onClick={() => void verifyPublishStatus(period)} disabled={Boolean(publishingKey)}>
                              Verify saved status
                            </Button>
                          ) : null}
                        </div>
                      </details>
                    </div>

                    {isAdministrator && statusLabel !== "Published" && publishAction.disabled && publishBlockReason && publishBlockReason !== completeness.reason ? (
                      <p role="status" style={{ color: "#92400e", fontSize: 13, margin: 0 }}>
                        Action needed before publishing: {formatPublicationBlocker(publishBlockReason)}
                      </p>
                    ) : null}
                    {statusLabel === "Published" ? (
                      <p role="status" style={{ color: "#475569", fontSize: 13, margin: 0 }}>
                        To change published marks, choose Unpublish results first. Publish again after the corrections have been reviewed.
                      </p>
                    ) : null}
                    {isAdministrator && publishVerificationErrors[period.key] ? (
                      <p role="alert" style={{ color: "#991b1b", fontSize: 13, margin: 0 }}>
                        {publishVerificationErrors[period.key]} Publication retry is blocked until status is verified.
                      </p>
                    ) : null}
                    {isAdministrator && unpublishVerificationErrors[period.key] ? (
                      <p role="alert" style={{ color: "#991b1b", fontSize: 13, margin: 0 }}>
                        {unpublishVerificationErrors[period.key]} Unpublish retry is blocked until status is refreshed.
                      </p>
                    ) : null}
                  </article>
                );

  }

  return (
    <div id="publish-arena-reports" style={{ display: "grid", gap: 20, scrollMarginTop: 16 }}>
      {!embedded ? (
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 340px" }}>
          <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 30 }}>Results &amp; reports</h1>
          <p style={{ color: "#475569", marginTop: 8 }}>
            Review pupil reports, clear any blockers, and confirm what has already been published.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => navigate("/admin/results")}>
          Manage subject marks
        </Button>
      </div>
      ) : null}

      {error ? (
        <div role="alert" style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12, color: "#991b1b" }}>
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" style={{ padding: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 12, color: "#166534" }}>
          {success}
        </div>
      ) : null}

      <section aria-labelledby="results-progress-heading" style={{ padding: 20, border: "1px solid #dfe7ef", borderRadius: 18, background: "#ffffff", display: "grid", gap: 16, boxShadow: "0 4px 18px rgba(23,43,77,0.035)" }}>
        <div>
          <h2 id="results-progress-heading" style={{ margin: 0, fontSize: 21 }}>Results publishing progress</h2>
          <p style={{ color: "#475569", margin: "5px 0 0" }}>
            Follow each pupil from import review to a published report. Ready reports are separate from drafts that still need work.
          </p>
        </div>
        <p role="status" aria-live="polite" style={{ margin: 0, padding: "12px 14px", borderRadius: 10, background: error || importWorkbooksError ? "#fff7ed" : "#f0fdf4", color: error || importWorkbooksError ? "#9a3412" : "#166534", fontWeight: 750 }}>
          {dashboardStatusMessage}
        </p>
        <div role="group" aria-label="Results status counts" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 10 }}>
          {[
            { label: "Imports to review", count: filteredPendingImportPupils.length, note: "Pupils needing a match or mark check", color: "#9a3412" },
            { label: "Ready to publish", count: publishableReportPeriods.length, note: "Passed publishing checks", color: "#047857" },
            { label: "Need attention", count: blockedReportPeriodsCount, note: "Drafts with a blocker", color: "#b91c1c" },
            { label: "Published", count: publishedReportPeriods.length, note: "Reports already released", color: "#1d4ed8" },
          ].map((item) => (
            <div key={item.label} style={{ minWidth: 0, padding: 13, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff" }}>
              <div style={{ color: "#475569", fontSize: 12, fontWeight: 800 }}>{item.label}</div>
              <div style={{ color: item.color, fontSize: 30, lineHeight: 1.2, fontWeight: 900, fontVariantNumeric: "tabular-nums", margin: "5px 0" }}>{item.count}</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>{item.note}</div>
            </div>
          ))}
        </div>
        <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>
          {reportSearch.trim()
            ? `Counts are for the pupil search “${reportSearch.trim()}”. Clear the search to see school-wide progress.`
            : "Counts cover all pupils. A report marked “Ready to publish” still needs to be published; published reports are counted separately."}
        </p>
      </section>

      {isAdministrator ? (
        <section aria-label="Publishing actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", padding: 18, border: "1px solid #dfe7ef", borderRadius: 16, background: "#f8fafc" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <h2 style={{ margin: "0 0 5px", fontSize: 19, color: "#172b4d" }}>Ready to publish</h2>
            <p style={{ margin: "0 0 7px", color: "#526277", lineHeight: 1.55 }}>
              Publish only reports that have passed the checks. Publishing makes a report visible to the intended users; it does not send emails to parents.
            </p>
            <p role="status" style={{ margin: 0, fontWeight: 750, color: "#0f766e", fontSize: 13 }}>
              {loadingPeriods || loadingImportWorkbooks ? "Checking report readiness…" : publishableReportPeriods.length > 0
                ? `${publishableReportPeriods.length} pupil report${publishableReportPeriods.length === 1 ? "" : "s"} ready to publish`
                : filteredPendingImportPupils.length === 0 && needsAttentionReportPeriods.length === 0
                  ? reportSearch.trim() ? "No outstanding work matches this search." : reportPeriods.length > 0 ? "All reports in this view are published. Nothing is outstanding." : "Nothing is waiting to publish yet. Enter or import marks to begin."
                  : `${blockedReportPeriodsCount} report draft(s) need attention and ${filteredPendingImportPupils.length} imported pupil(s) need review.`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Button
              type="button"
              onClick={() => void publishAllReadyReports()}
              disabled={loadingPeriods || publishableReportPeriods.length === 0 || bulkPublishing || Boolean(publishingKey)}
              style={{ minHeight: 46, padding: "12px 18px", background: "#0f766e", borderColor: "#0f766e", fontWeight: 800, fontSize: 14, boxShadow: "none" }}
            >
              {bulkPublishing ? "Publishing ready reports…" : "Publish all ready reports"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setReportListView("drafts")}>
              View unpublished reports
            </Button>
          </div>
        </section>
      ) : null}

      <SectionCard>
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 5, border: "1px solid #e2e8ef", borderRadius: 13, background: "#f8fafc" }} role="group" aria-label="Filter pupil report list">
            <Button type="button" variant={reportListView === "drafts" ? "primary" : "secondary"} aria-pressed={reportListView === "drafts"} onClick={() => setReportListView("drafts")}>
              Unpublished
            </Button>
            <Button type="button" variant={reportListView === "all" ? "primary" : "secondary"} aria-pressed={reportListView === "all"} onClick={() => setReportListView("all")}>
              All reports
            </Button>
            <Button type="button" variant={reportListView === "published" ? "primary" : "secondary"} aria-pressed={reportListView === "published"} onClick={() => setReportListView("published")}>
              Published
            </Button>
          </div>

          <FormField label="Find a pupil">
            <input
              style={{ ...inputStyle, fontSize: 16, padding: "14px 16px" }}
              value={reportSearch}
              onChange={(event) => setReportSearch(event.target.value)}
              placeholder="Type a pupil name or admission number"
              aria-label="Search pupil by name or admission number"
            />
          </FormField>

          {reportListView === "drafts" ? (
            <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
              {!embedded ? (
              <section aria-labelledby="imports-awaiting-reconciliation" style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <div>
                  <h2 id="imports-awaiting-reconciliation" style={{ margin: 0, fontSize: 19 }}>Imports awaiting reconciliation</h2>
                  <p style={{ color: "#64748b", margin: "5px 0 0", fontSize: 13 }}>Each row is one pupil still waiting to be checked or imported. Open that pupil directly to continue.</p>
                </div>
                {importWorkbooksError ? (
                  <div role="alert" style={{ padding: 10, border: "1px solid #fecaca", borderRadius: 10, background: "#fef2f2", color: "#991b1b" }}>{importWorkbooksError}</div>
                ) : null}
                {loadingImportWorkbooks ? (
                  <p role="status" style={{ color: "#64748b", margin: 0 }}>Loading outstanding pupil imports…</p>
                ) : filteredPendingImportPupils.length === 0 ? (
                  <p style={{ color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, margin: 0 }}>
                    {reportSearch ? "No outstanding import matches this search." : "No outstanding imports to reconcile."}
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                    {filteredPendingImportPupils.map((review) => {
                      const entry = review.entry;
                      const entryWithSource = entry as ResultImportPreviewEntry & { sourceStudentName?: string };
                      const worksheetName = entryWithSource.sourceStudentName?.trim() || entry.studentName;
                      const possiblePupil = students.find((candidate) => candidate.id === entry.matchedStudentId);
                      const confirmedPupil = students.find((candidate) => candidate.id === entry.selectedStudentId);
                      const displayName = entry.matchStatus === "matched" && confirmedPupil
                        ? `${confirmedPupil.first_name} ${confirmedPupil.last_name}`.trim()
                        : worksheetName;
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
                        <article key={`${review.ownerId}::${review.workbookKey}::${entry.studentKey}`} style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 10, padding: 13, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 0 }}>
                              <h3 style={{ margin: 0, fontSize: 17, overflowWrap: "anywhere" }}>{displayName}</h3>
                              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                                {entry.admissionNumber ? `Admission no.: ${entry.admissionNumber} · ` : ""}Worksheet class: {entry.className || "Needs confirmation"}
                              </p>
                              <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 13 }}>
                                {entry.academicYear || "Session to confirm"} · {entry.term ? `${entry.term} Term` : "Term to confirm"} · {reportTypeLabel}
                              </p>
                              {entry.matchStatus !== "matched" && possiblePupil ? (
                                <p style={{ margin: "4px 0 0", color: "#92400e", fontSize: 13 }}>Possible registered match: {possiblePupil.first_name} {possiblePupil.last_name}. Confirm before importing.</p>
                              ) : null}
                              {worksheetName !== displayName ? (
                                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Name on worksheet: {worksheetName}</p>
                              ) : null}
                            </div>
                            <span style={{ ...statusBadgeStyle(progress.label), flexShrink: 0 }}>{progress.label}</span>
                          </div>
                          <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>{progress.explanation}</p>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" onClick={() => navigate(`/admin/results?${params.toString()}`)}>Reconcile this pupil</Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>


              ) : null}

              <section aria-labelledby="draft-pupil-results" style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <div>
                  <h2 id="draft-pupil-results" style={{ margin: 0, fontSize: 19 }}>Unpublished pupil reports</h2>
                  <p style={{ color: "#64748b", margin: "5px 0 0", fontSize: 13 }}>Reports that are not yet published, including reports that need a correction before release.</p>
                </div>
                {loadingPeriods ? (
                  <p role="status" style={{ color: "#64748b", margin: 0 }}>Loading draft pupil results…</p>
                ) : needsAttentionReportPeriods.length === 0 ? (
                  <p style={{ color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, margin: 0 }}>
                    {reportSearch ? "No unpublished reports match this search." : "No unpublished reports need attention."}
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                    {needsAttentionReportPeriods.map((period) => renderReportPeriodCard(period))}
                  </div>
                )}
              </section>
            </div>
          ) : reportListView === "all" ? (
            <section aria-labelledby="all-pupil-results" style={{ display: "grid", gap: 10, minWidth: 0 }}>
              <div>
                <h2 id="all-pupil-results" style={{ margin: 0, fontSize: 19 }}>All pupil reports</h2>
                <p style={{ color: "#64748b", margin: "5px 0 0", fontSize: 13 }}>Published and unpublished reports in one list. Each pupil’s source is marked Imported, Manual or Mixed.</p>
              </div>
              {loadingPeriods ? (
                <p role="status" style={{ color: "#64748b", margin: 0 }}>Loading pupil reports…</p>
              ) : filteredReportPeriods.length === 0 ? (
                <p style={{ color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, margin: 0 }}>
                  {reportSearch ? "No pupil reports match this search." : "No pupil reports have been entered yet."}
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                  {[...filteredReportPeriods].sort((left, right) => {
                    const leftPublished = getReportCenterPeriodStatus(left) === "Published";
                    const rightPublished = getReportCenterPeriodStatus(right) === "Published";
                    return Number(leftPublished) - Number(rightPublished)
                      || left.academicYear.localeCompare(right.academicYear)
                      || left.term.localeCompare(right.term);
                  }).map((period) => renderReportPeriodCard(period))}
                </div>
              )}
            </section>
          ) : (
            <section aria-labelledby="published-pupil-results" style={{ display: "grid", gap: 10, minWidth: 0 }}>
              <div>
                <h2 id="published-pupil-results" style={{ margin: 0, fontSize: 19 }}>Published student list</h2>
                <p style={{ color: "#64748b", margin: "5px 0 0", fontSize: 13 }}>Only pupil results whose subject records are Published appear here.</p>
              </div>
              {loadingPeriods ? (
                <p role="status" style={{ color: "#64748b", margin: 0 }}>Loading published pupil results…</p>
              ) : publishedReportPeriods.length === 0 ? (
                <p style={{ color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, margin: 0 }}>
                  {reportSearch ? "No published pupil results match this search." : "No published pupil results yet."}
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                  {publishedReportPeriods.map((period) => renderReportPeriodCard(period))}
                </div>
              )}
            </section>
          )}
        </div>
      </SectionCard>

      {!isAdministrator && sessionSetupError ? (
        <div role="alert" style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12, color: "#991b1b" }}>
          {sessionSetupError}
        </div>
      ) : null}

      {isAdministrator ? (
        <details className="card" style={{ padding: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Academic calendar, sessions and school settings</summary>
          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
      {isAdministrator ? (
        <SectionCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Academic Sessions and Terms</h2>
              <p style={{ color: "#666", marginTop: 6 }}>
                Enter official session and term dates. These records are separate from the attendance display calendar.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="button" variant="secondary" onClick={() => setSessionSetup(emptySessionSetup())}>
                New Session
              </Button>
              <Button type="button" onClick={() => void saveSessionSetup()} disabled={savingSessionSetup}>
                {savingSessionSetup ? "Saving..." : "Save Session and Terms"}
              </Button>
            </div>
          </div>

          {sessionSetupError ? (
            <p role="alert" style={{ color: "#991b1b" }}>{sessionSetupError}</p>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
            <FormField label="Session to maintain">
              <select
                style={inputStyle}
                value={sessionSetup.sessionId ?? ""}
                onChange={(event) => selectSessionForEditing(event.target.value)}
              >
                <option value="">Create a new session</option>
                {academicSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.session_name}{session.is_current ? " (Current)" : ""}{session.is_locked ? " (Locked)" : ""}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Academic session name">
              <input
                style={inputStyle}
                required
                disabled={savingSessionSetup}
                value={sessionSetup.sessionName}
                onChange={(event) => setSessionSetup((previous) => ({ ...previous, sessionName: event.target.value }))}
                placeholder="e.g. 2026/2027"
              />
            </FormField>
            <FormField label="Session start date">
              <input
                style={inputStyle}
                type="date"
                required
                disabled={savingSessionSetup}
                value={sessionSetup.startDate}
                onChange={(event) => setSessionSetup((previous) => ({ ...previous, startDate: event.target.value }))}
              />
            </FormField>
            <FormField label="Session end date">
              <input
                style={inputStyle}
                type="date"
                required
                disabled={savingSessionSetup}
                value={sessionSetup.endDate}
                onChange={(event) => setSessionSetup((previous) => ({ ...previous, endDate: event.target.value }))}
              />
            </FormField>
            <FormField label="Current session">
              <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
                <input
                  type="checkbox"
                  disabled={savingSessionSetup}
                  checked={sessionSetup.isCurrent}
                  onChange={(event) => setSessionSetup((previous) => ({
                    ...previous,
                    isCurrent: event.target.checked,
                    currentTerm: event.target.checked ? previous.currentTerm : "",
                  }))}
                />
                Mark this as the current academic session
              </label>
            </FormField>
            <FormField label="Current term">
              <select
                style={inputStyle}
                disabled={!sessionSetup.isCurrent || savingSessionSetup}
                value={sessionSetup.currentTerm}
                onChange={(event) => setSessionSetup((previous) => ({
                  ...previous,
                  currentTerm: event.target.value as AcademicSessionSetup["currentTerm"],
                }))}
              >
                <option value="">Not set</option>
                {TERMS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </FormField>
          </div>

          {academicSessions.find((session) => session.id === sessionSetup.sessionId)?.is_locked ? (
            <p role="status" style={{ color: "#92400e" }}>This session is marked locked. Administrators may still correct its details.</p>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 16 }}>
            {sessionSetup.terms.map((term) => (
              <div key={term.termName} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fafafa" }}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>{term.termName} Term</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <FormField label="Term start date">
                    <input
                      style={inputStyle}
                      type="date"
                      required
                      disabled={savingSessionSetup}
                      value={term.startDate}
                      onChange={(event) => updateSessionTerm(term.termName, "startDate", event.target.value)}
                    />
                  </FormField>
                  <FormField label="Term end date">
                    <input
                      style={inputStyle}
                      type="date"
                      required
                      disabled={savingSessionSetup}
                      value={term.endDate}
                      onChange={(event) => updateSessionTerm(term.termName, "endDate", event.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {calendarConfig ? (
        <SectionCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Academic Calendar</h2>
              <p style={{ color: "#666", marginTop: 6 }}>Set actual term dates for attendance, term ending and next term begins.</p>
            </div>
            <Button type="button" onClick={saveCalendar}>Save Calendar</Button>
          </div>

          <FormField label="Academic Session">
            <input
              style={inputStyle}
              value={calendarConfig.academicYear}
              onChange={(event) => setCalendarConfig((previous) => previous ? { ...previous, academicYear: event.target.value } : previous)}
              placeholder="e.g. 2026/2027"
            />
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
            {([
              ["firstTerm", "First Term"],
              ["secondTerm", "Second Term"],
              ["thirdTerm", "Third Term"],
            ] as const).map(([key, label]) => (
              <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fafafa" }}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>{label}</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <FormField label="Start Date"><input style={inputStyle} type="date" value={calendarConfig[key].startDate} onChange={(event) => updateCalendar(key, "startDate", event.target.value)} /></FormField>
                  <FormField label="End Date"><input style={inputStyle} type="date" value={calendarConfig[key].endDate} onChange={(event) => updateCalendar(key, "endDate", event.target.value)} /></FormField>
                  <FormField label="Term Ending"><input style={inputStyle} type="date" value={calendarConfig[key].termEnding} onChange={(event) => updateCalendar(key, "termEnding", event.target.value)} /></FormField>
                  <FormField label="Next Term Begins"><input style={inputStyle} type="date" value={calendarConfig[key].nextTermBegins} onChange={(event) => updateCalendar(key, "nextTermBegins", event.target.value)} /></FormField>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {schoolSettings ? (
        <SectionCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>School Settings</h2>
              <p style={{ color: "#666", marginTop: 6 }}>These details appear on report cards and school contact information.</p>
            </div>
            <Button type="button" onClick={saveSettings}>Save Settings</Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
            <FormField label="School Name"><input style={inputStyle} value={schoolSettings.school_name ?? ""} onChange={(event) => updateSchoolSetting("school_name", event.target.value)} /></FormField>
            <FormField label="Motto"><input style={inputStyle} value={schoolSettings.motto ?? ""} onChange={(event) => updateSchoolSetting("motto", event.target.value)} /></FormField>
            <BrandingField label="School Logo" value={schoolSettings.logo_url} uploading={uploadingBranding === "logo_url"} onUpload={(event) => void handleBrandingUpload(event, "logo_url", "logo")} onRemove={() => updateSchoolSetting("logo_url", "")} />
            <BrandingField label="Head Teacher / Principal Signature" value={schoolSettings.principal_signature_url} uploading={uploadingBranding === "principal_signature_url"} onUpload={(event) => void handleBrandingUpload(event, "principal_signature_url", "signature")} onRemove={() => updateSchoolSetting("principal_signature_url", "")} />
            <BrandingField label="School Stamp" value={schoolSettings.school_stamp_url} uploading={uploadingBranding === "school_stamp_url"} onUpload={(event) => void handleBrandingUpload(event, "school_stamp_url", "stamp")} onRemove={() => updateSchoolSetting("school_stamp_url", "")} />
            <FormField label="Address"><input style={inputStyle} value={schoolSettings.address ?? ""} onChange={(event) => updateSchoolSetting("address", event.target.value)} /></FormField>
            <FormField label="Phone"><input style={inputStyle} value={schoolSettings.phone ?? ""} onChange={(event) => updateSchoolSetting("phone", event.target.value)} /></FormField>
            <FormField label="Email"><input style={inputStyle} value={schoolSettings.email ?? ""} onChange={(event) => updateSchoolSetting("email", event.target.value)} /></FormField>
            <FormField label="Website"><input style={inputStyle} value={schoolSettings.website ?? ""} onChange={(event) => updateSchoolSetting("website", event.target.value)} /></FormField>
            <FormField label="Head Teacher Name"><input style={inputStyle} value={schoolSettings.head_teacher_name ?? ""} onChange={(event) => updateSchoolSetting("head_teacher_name", event.target.value)} /></FormField>
            <FormField label="Report Footer / Closing Note"><input style={inputStyle} value={schoolSettings.report_footer ?? ""} onChange={(event) => updateSchoolSetting("report_footer", event.target.value)} /></FormField>
          </div>
        </SectionCard>
      ) : null}
          </div>
        </details>
      ) : null}

      {loading ? (
        <EmptyState title="Building report card" description="Please wait while report data is generated." />
      ) : report ? (
        <div ref={reportPreviewRef} style={{ scrollMarginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Report preview</h2>
              <p style={{ color: "#64748b", margin: "4px 0 0" }}>
                {report.student.first_name} {report.student.last_name} · {report.academicYear} · {report.term} Term · {report.reportType === "Midterm" ? "Midterm" : "End-of-Term"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <ReportCardToolbar
                previewId="report-card-preview"
                fileName={`Report-${report.student.id}-${report.academicYear}-${report.term}-${report.reportType}.pdf`}
              />
            </div>
          </div>
          {isAdministrator && report.lines.some((line) => results.find((result) => result.id === line.resultId)?.status !== "Published") ? (
            <div style={{ padding: 12, border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 12, color: "#92400e", marginBottom: 12 }}>
              This preview includes unpublished subject results. It is not available to parents until the existing results review workflow publishes them.
            </div>
          ) : null}
          {editingReportDetails && isAdministrator ? <AppModal
            open={editingReportDetails && isAdministrator}
            title={`Edit report details · ${report.student.first_name} ${report.student.last_name}`}
            size="lg"
            dialogStyle={{
              height: "calc(100dvh - 32px)",
              maxHeight: "calc(100dvh - 32px)",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
            }}
            bodyStyle={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}
            footerStyle={{ flexWrap: "wrap", gap: 8 }}
            footer={
              <>
                <Button type="button" variant="secondary" onClick={cancelReportDetails} disabled={savingComments}>Cancel</Button>
                <Button type="button" onClick={() => void saveReportDetails()} disabled={savingComments}>
                  {savingComments ? "Saving Changes…" : "Save Changes"}
                </Button>
              </>
            }
            onClose={cancelReportDetails}
          >
            {error ? <div role="alert" style={{ marginBottom: 12, padding: 10, background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>{error}</div> : null}
            <div
              role="region"
              aria-label="Report-card details form; scroll vertically to view all fields"
              tabIndex={0}
              style={{ height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", paddingRight: 4 }}
            >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <FormField label="Calculation mode">
                <select
                  style={inputStyle}
                  value={reportCalculationMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as "Manual" | "Automatic";
                    setReportCalculationMode(nextMode);
                  }}
                >
                  <option value="Manual">Manual entry (recommended)</option>
                  <option value="Automatic">Automatic calculation</option>
                </select>
              </FormField>
              <FormField label="Class teacher">
                <input style={inputStyle} value={editedClassTeacherName} onChange={(event) => setEditedClassTeacherName(event.target.value)} />
              </FormField>
              <FormField label="Term ending on">
                <input style={inputStyle} type="date" value={editedTermEnding} onChange={(event) => setEditedTermEnding(event.target.value)} />
              </FormField>
              <FormField label="Next term begins">
                <input style={inputStyle} type="date" value={editedNextTermBegins} onChange={(event) => setEditedNextTermBegins(event.target.value)} />
              </FormField>
              <FormField label="Maximum attendance">
                <input style={inputStyle} type="number" min={0} value={editedMaximumAttendance} onChange={(event) => setEditedMaximumAttendance(event.target.value)} />
              </FormField>
              <FormField label="Time Present">
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  value={editedTimesPresent}
                  onChange={(e) => setEditedTimesPresent(e.target.value)}
                />
              </FormField>

              <FormField label="Time Absent">
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  value={editedTimesAbsent}
                  onChange={(e) => setEditedTimesAbsent(e.target.value)}
                />

              </FormField>

              <FormField label="Class Average">
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={editedClassAverage}
                  onChange={(e) => setEditedClassAverage(e.target.value)}
                />
              </FormField>

              <FormField label="Total marks obtained">
                <input style={inputStyle} type="number" step={0.01} readOnly={reportCalculationMode === "Automatic"} value={reportCalculationMode === "Automatic" ? String(report.totalMarksObtained ?? "") : editedTotalMarksObtained} onChange={(event) => setEditedTotalMarksObtained(event.target.value)} />
              </FormField>
              <FormField label="Total marks obtainable">
                <input style={inputStyle} type="number" step={0.01} readOnly={reportCalculationMode === "Automatic"} value={reportCalculationMode === "Automatic" ? String(report.totalMarksObtainable ?? "") : editedTotalMarksObtainable} onChange={(event) => setEditedTotalMarksObtainable(event.target.value)} />
              </FormField>
              <FormField label="Student percentage">
                <input style={inputStyle} type="number" min={0} max={100} step={0.01} readOnly={reportCalculationMode === "Automatic"} value={reportCalculationMode === "Automatic" ? String(report.studentPercentage ?? "") : editedStudentPercentage} onChange={(event) => setEditedStudentPercentage(event.target.value)} />
              </FormField>

              <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }}>
                <FormField label="Class Teacher's Comment">
                  <textarea style={{ ...inputStyle, height: 80 }} value={editedClassTeacherComment} onChange={(e) => setEditedClassTeacherComment(e.target.value)} />
                </FormField>
                <FormField label="Head Teacher's Comment">
                  <textarea style={{ ...inputStyle, height: 80 }} value={editedHeadTeacherComment} onChange={(e) => setEditedHeadTeacherComment(e.target.value)} />
                </FormField>
              </div>
            </div>
            </div>
          </AppModal>
          : null}

          <ReportCardDocument report={report} />
        </div>
      ) : (
        <EmptyState title="Choose a report period" description="Search for a pupil above, then preview an available period from their existing results." />
      )}
    </div>
  );
}
