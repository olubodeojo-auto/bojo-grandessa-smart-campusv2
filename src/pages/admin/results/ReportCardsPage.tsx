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
import { buildStudentReportCard, deleteReportCard, getImportReviewWorkbookSummaries, getSavedReportCards, saveReportCardDetails, type ImportReviewWorkbookSummary, type SavedReportCard } from "../../../services/reportCardService";
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
  getReportPeriodResults,
  publishReportResultsAndVerify,
  unpublishReportResultsAndVerify,
  type ReportCenterPeriod,
} from "../../../utils/reportCenter";

const TERMS: ReportTerm[] = ["First", "Second", "Third"];

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

export default function ReportCardsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReportCard[]>([]);
  const [savedImportWorkbooks, setSavedImportWorkbooks] = useState<ImportReviewWorkbookSummary[]>([]);
  const [loadingImportWorkbooks, setLoadingImportWorkbooks] = useState(true);
  const [importWorkbooksError, setImportWorkbooksError] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [publicationEvidence, setPublicationEvidence] = useState<Map<string, ResultPublicationEvidence>>(() => new Map());
  const [publicationEvidenceError, setPublicationEvidenceError] = useState("");
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [publishingKey, setPublishingKey] = useState("");
  const publishInFlightPeriods = useRef(new Set<string>());
  const [unpublishingKey, setUnpublishingKey] = useState("");
  const unpublishInFlightPeriods = useRef(new Set<string>());
  const [deletingKey, setDeletingKey] = useState("");
  const deleteInFlightPeriods = useRef(new Set<string>());
  const [publishVerificationErrors, setPublishVerificationErrors] = useState<Record<string, string>>({});
  const [unpublishVerificationErrors, setUnpublishVerificationErrors] = useState<Record<string, string>>({});
  const [reportSearch, setReportSearch] = useState("");
  const [academicYear, setAcademicYear] = useState<string>(searchParams.get("academicYear") ?? "");
  const [calendarConfig, setCalendarConfig] = useState<AcademicCalendarConfig | null>(null);
  const [academicSessions, setAcademicSessions] = useState<AcademicSession[]>([]);
  const [sessionSetup, setSessionSetup] = useState<AcademicSessionSetup>(emptySessionSetup);
  const [savingSessionSetup, setSavingSessionSetup] = useState(false);
  const [sessionSetupError, setSessionSetupError] = useState("");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [report, setReport] = useState<ReportCardData | null>(null);
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

  const refreshSavedImportWorkbooks = useCallback(async (): Promise<void> => {
    setLoadingImportWorkbooks(true);
    setImportWorkbooksError("");
    try {
      setSavedImportWorkbooks(await getImportReviewWorkbookSummaries());
    } catch (err) {
      setImportWorkbooksError(err instanceof Error ? err.message : "Unable to load saved spreadsheet reviews.");
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
    void refreshSavedImportWorkbooks();
  }, [refreshSavedImportWorkbooks]);

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

  async function publishReportPeriod(period: ReportCenterPeriod): Promise<void> {
    const releasePublishLock = acquireReportPublishLock(publishInFlightPeriods.current, period.key);
    if (!releasePublishLock) return;
    try {
      if (!isAdministrator) return;
      const publishBlockReason = getPublicationEvidenceErrorForPeriod(period)
        || getReportCenterPublishBlockReason(period, results, isAdministrator, publicationEvidence);
      if (publishBlockReason) {
        setError(`Publishing unavailable: ${publishBlockReason}`);
        return;
      }
      const student = students.find((candidate) => candidate.id === period.studentId);
      if (!student) {
        setError("The pupil for this report period is no longer available.");
        return;
      }
      const pendingResults = period.results.filter((result) => result.status !== "Published");
      if (pendingResults.length === 0) return;
      const className = classes.find((candidate) => candidate.id === period.classId)?.class_name
        ?? period.results.find((result) => result.class_name)?.class_name
        ?? "Class unavailable";
      const confirmed = window.confirm(
        `Publish report card for ${student.first_name} ${student.last_name}?\n\nClass: ${className}\nSession: ${period.academicYear}\nTerm: ${period.term}\nSubject results to publish: ${pendingResults.length}\n\nEach subject result will be published using the existing authorized review and validation workflow. Report-card presentation details have no separate publication status.`,
      );
      if (!confirmed) return;

      setPublishingKey(period.key);
      setError("");
      setSuccess("");
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
      const outcome = await publishReportResultsAndVerify(
        pendingResults,
        publishResult,
        getResults,
      );
      if (!outcome.refreshedResults) {
        const message = `The publish outcome for ${student.first_name} ${student.last_name} could not be verified: ${outcome.verificationError ?? "Unable to reload saved statuses."}`;
        setPublishVerificationErrors((current) => ({ ...current, [period.key]: message }));
        setError(`${message} Refresh the saved status before retrying.`);
        return;
      }
      setResults(outcome.refreshedResults);

      const publishedCount = outcome.publishedResultIds.length;
      if (publishedCount === pendingResults.length) {
        setSuccess(`Verified: published ${publishedCount} subject result(s) for ${student.first_name} ${student.last_name}.`);
        return;
      }

      const resultNames = new Map(pendingResults.map((result) => [
        result.id,
        result.subject_name?.trim() || result.id,
      ]));
      const failureDetails = outcome.failures
        .map((failure) => `${resultNames.get(failure.resultId) ?? failure.resultId}: ${failure.message}`)
        .join(" ");
      setError(`Verified ${publishedCount} of ${pendingResults.length} subject result(s) as Published for ${student.first_name} ${student.last_name}; ${pendingResults.length - publishedCount} remain unpublished. ${failureDetails}`);
    } finally {
      setPublishingKey((current) => current === period.key ? "" : current);
      releasePublishLock();
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

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 30 }}>Report Card Publishing</h1>
          <p style={{ color: "#666", marginTop: 8 }}>Review, edit and publish pupil report cards.</p>
        </div>
      </div>

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

      <section className="card" aria-labelledby="saved-import-reviews-heading" style={{ display: "grid", gap: 14, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 id="saved-import-reviews-heading" style={{ margin: 0, fontSize: 22 }}>Saved work waiting for review</h2>
            <p style={{ color: "#64748b", margin: "6px 0 0", maxWidth: 760 }}>
              Spreadsheet reviews saved earlier appear here, even before they become result records. Continue a review to match pupils, check subject scores and import the approved records. Saving or reviewing work does not publish it or email parents.
            </p>
            <p style={{ color: "#334155", fontWeight: 700, margin: "8px 0 0" }}>
              {savedImportWorkbooks.length} saved workbook(s) · {savedImportWorkbooks.reduce((total, workbook) => total + workbook.includedEntryCount, 0)} included pupil review(s) · {savedImportWorkbooks.reduce((total, workbook) => total + workbook.subjectRowCount, 0)} subject scores
            </p>
            <p style={{ color: "#64748b", fontSize: 13, margin: "6px 0 0" }}>
              Publishing updates online access only. It does not send emails; parent notifications must be a separate action after publication.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void refreshSavedImportWorkbooks()} disabled={loadingImportWorkbooks}>
            {loadingImportWorkbooks ? "Refreshing…" : "Refresh saved work"}
          </Button>
        </div>

        {importWorkbooksError ? (
          <div role="alert" style={{ padding: 10, border: "1px solid #fecaca", borderRadius: 10, background: "#fef2f2", color: "#991b1b" }}>
            {importWorkbooksError}
          </div>
        ) : null}
        {loadingImportWorkbooks ? (
          <p role="status" style={{ color: "#64748b", margin: 0 }}>Checking for saved spreadsheet reviews…</p>
        ) : null}
        {!loadingImportWorkbooks && !importWorkbooksError && savedImportWorkbooks.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>There are no saved spreadsheet reviews available to resume. Existing result records and their publication status appear below.</p>
        ) : null}
        {savedImportWorkbooks.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {savedImportWorkbooks.map((workbook) => {
              const periodParts = [...workbook.academicYears, ...workbook.terms, ...workbook.reportKinds];
              const periodLabel = periodParts.length > 0
                ? [...new Set(periodParts)].join(" · ")
                : "Period needs review";
              const updatedAt = new Date(workbook.updatedAt);
              const lastSaved = Number.isNaN(updatedAt.getTime())
                ? "Last saved date unavailable"
                : `Last saved ${updatedAt.toLocaleString()}`;
              const isConfigured = workbook.academicYears.every((year) =>
                workbook.terms.every((termLabel) => {
                  const session = academicSessions.find((item) => item.session_name === year);
                  const termName = termLabel.replace(/ Term$/, "");
                  return Boolean(session?.terms.some((item) => item.term_name === termName));
                })
              );
              return (
                <article key={`${workbook.ownerId}::${workbook.workbookKey}`} style={{ display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17 }}>{periodLabel}</h3>
                      <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>
                        Worksheet: {workbook.sheetName} · Saved by {workbook.ownerName} · {lastSaved}
                      </p>
                    </div>
                    {workbook.includedEntryCount > 0 ? (
                      <Button type="button" onClick={() => {
                        const params = new URLSearchParams({
                          resumeWorkbook: workbook.workbookKey,
                          resumeOwner: workbook.ownerId,
                        });
                        navigate(`/admin/results?${params.toString()}`);
                      }}>
                        Continue review
                      </Button>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#334155", fontSize: 13 }}>
                    {workbook.includedEntryCount > 0 ? (
                      <>
                        <span>{workbook.includedEntryCount} pupil review(s) waiting to import</span>
                        <span>·</span>
                        <span>{workbook.subjectRowCount} score(s) waiting to import</span>
                        <span>·</span>
                        <span style={{ color: workbook.unresolvedEntryCount > 0 ? "#92400e" : "#166534", fontWeight: 700 }}>
                          {workbook.unresolvedEntryCount > 0 ? `${workbook.unresolvedEntryCount} pupil match(es) need review` : "Pupil matches resolved"}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: workbook.importedEntryCount > 0 ? "#166534" : "#64748b", fontWeight: 700 }}>
                        {workbook.importedEntryCount > 0 ? "All included pupil entries have already been imported" : "No included pupil entries are waiting to import"}
                      </span>
                    )}
                    {workbook.excludedEntryCount > 0 ? <><span>·</span><span>{workbook.excludedEntryCount} excluded duplicate/ignored review(s)</span></> : null}
                    {workbook.publishedEntryCount > 0 ? (
                      <>
                        <span>·</span>
                        <span style={{ color: "#166534", fontWeight: 700 }}>Published: {workbook.publishedEntryCount} pupil(s), {workbook.publishedSubjectRowCount} result(s)</span>
                      </>
                    ) : null}
                    {workbook.draftImportedEntryCount > 0 ? (
                      <>
                        <span>·</span>
                        <span style={{ color: "#92400e", fontWeight: 700 }}>Imported as Draft: {workbook.draftImportedEntryCount} pupil(s), {workbook.draftImportedSubjectRowCount} result(s)</span>
                      </>
                    ) : null}
                  </div>
                  {workbook.includedEntryCount > 0 ? (
                    <div role="note" style={{ display: "grid", gap: 6, padding: "11px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #cbd5e1", color: "#334155", fontSize: 13 }}>
                      <p style={{ margin: 0, fontWeight: 700 }}>What needs to happen next</p>
                      {workbook.unresolvedPupilNames.length > 0 ? (
                        <p style={{ margin: 0 }}>
                          <strong>Confirm pupil matches:</strong> {workbook.unresolvedPupilNames.join(", ")}.
                        </p>
                      ) : (
                        <p style={{ margin: 0 }}>Pupil names are linked to school records.</p>
                      )}
                      {workbook.reportTypeReviewPupilNames.length > 0 ? (
                        <p style={{ margin: 0 }}>
                          <strong>Choose Midterm (CA) or End-of-Term for:</strong> {workbook.reportTypeReviewPupilNames.join(", ")}.
                        </p>
                      ) : null}
                      {workbook.missingScorePupilNames.length > 0 ? (
                        <p style={{ margin: 0 }}>
                          <strong>No subject rows were found for:</strong> {workbook.missingScorePupilNames.join(", ")}. Check the original worksheet before importing.
                        </p>
                      ) : null}
                      {workbook.subjectReviewPupilNames.length > 0 ? (
                        <p style={{ margin: 0 }}>
                          <strong>Resolve subject names before importing:</strong> {workbook.subjectReviewPupilNames.join(", ")}.
                        </p>
                      ) : null}
                      <p style={{ margin: 0 }}>Then check the marks and import the verified entries. Publishing is a separate step, and neither review nor publishing sends parent emails.</p>
                    </div>
                  ) : null}
                  {workbook.duplicatePupilCount > 0 ? (
                    <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 8, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", fontSize: 13 }}>
                      Possible duplicate across saved uploads: {workbook.duplicatePupilNames.join(", ")} {workbook.duplicatePupilCount === 1 ? "also has" : "also have"} an included draft for this same session, term and report type. Compare the versions and import only the school-approved one.
                    </p>
                  ) : null}
                  {workbook.classes.length > 0 ? (
                    <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>Classes: {workbook.classes.join(", ")}</p>
                  ) : null}
                  {!isConfigured ? (
                    <p role="alert" style={{ margin: 0, padding: "9px 11px", borderRadius: 8, background: "#fff7ed", color: "#9a3412", fontSize: 13 }}>
                      This workbook&apos;s academic session or term is not configured in the school calendar yet. Enter the school&apos;s official dates before importing or publishing; do not guess dates.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <SectionCard>
        <div style={{ display: "grid", gap: 14 }}>
          <FormField label="Search pupil">
            <input
              style={{ ...inputStyle, fontSize: 16, padding: "14px 16px" }}
              value={reportSearch}
              onChange={(event) => setReportSearch(event.target.value)}
              placeholder="Search pupil by name or admission number…"
              aria-label="Search pupil by name or admission number"
            />
          </FormField>
          <div style={{ color: "#64748b", fontSize: 13 }}>
                {loadingPeriods ? "Finding report periods…" : `${filteredReportPeriods.length} report period(s)`}
          </div>
          {loadingPeriods ? (
            <EmptyState title="Finding reports" description="Checking existing result rows and saved report details." />
          ) : filteredReportPeriods.length === 0 ? (
            <EmptyState
              title={reportSearch ? "No pupil report periods found" : "No report periods available"}
              description={reportSearch
                ? "Try a different pupil name or admission number."
                : savedImportWorkbooks.length > 0
                  ? "No result records are ready to publish yet. Saved spreadsheet reviews are listed above; continue one, reconcile the pupil matches and scores, and import the checked records before publishing."
                  : "Periods appear here when result rows or saved report-card details exist. Add or complete subject results to begin."}
            />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredReportPeriods.map((period) => {
                const pupil = students.find((candidate) => candidate.id === period.studentId);
                const pupilName = pupil ? `${pupil.first_name} ${pupil.last_name}`.trim() : "Pupil unavailable";
                const className = classes.find((candidate) => candidate.id === period.classId)?.class_name
                  ?? period.results.find((result) => result.class_name)?.class_name
                  ?? "Class unavailable";
                const statusLabel = getReportCenterPeriodStatus(period);
                const completeness = getReportCenterCompleteness(period, results);
                const periodEvidenceError = getPublicationEvidenceErrorForPeriod(period);
                const publishBlockReason = periodEvidenceError
                  || getReportCenterPublishBlockReason(period, results, isAdministrator, publicationEvidence);
                const isPublishing = publishingKey === period.key;
                const publishAction = getReportCenterPublishActionState(
                  period,
                  results,
                  isAdministrator,
                  Boolean(publishingKey),
                  publishVerificationErrors[period.key],
                  publicationEvidence,
                  periodEvidenceError,
                );
                const isUnpublishing = unpublishingKey === period.key;
                const isDeleting = deletingKey === period.key;
                const canUnpublish = isAdministrator && period.results.length > 0
                  && period.results.every((result) => result.status === "Published");
                const canDeleteDraft = canDeleteDraftReportPeriod(period, isAdministrator);
                const canDeleteReport = canDeleteReportPeriod(period, isAdministrator);
                return (
                  <article key={period.key} aria-labelledby={`report-period-${period.key}`} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "start" }}>
                      <div>
                        <h2 id={`report-period-${period.key}`} style={{ margin: 0, fontSize: 20 }}>{pupilName}</h2>
                        <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>
                          Admission number: {pupil?.admission_number || "Unavailable"} · Class: {className}
                        </p>
                        <p style={{ color: "#334155", fontSize: 13, margin: "3px 0 0" }}>
                          {period.academicYear} · {period.term} Term · {period.reportType === "Midterm" ? "Midterm" : "End-of-Term"}
                        </p>
                      </div>
                      {period.savedReport ? <span style={savedBadgeStyle}>Report details saved</span> : null}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
                      <div>
                        <div style={{ color: "#64748b", fontSize: 12, marginBottom: 5 }}>Publication status</div>
                        <span style={statusBadgeStyle(statusLabel)}>{statusLabel}</span>
                      </div>
                      <div>
                        <div style={{ color: "#64748b", fontSize: 12, marginBottom: 5 }}>Subject-result completeness</div>
                        <strong style={{ color: completeness.complete ? "#166534" : "#92400e" }}>
                          {completeness.complete ? "Complete" : "Incomplete"} · {period.results.length} subject result(s)
                        </strong>
                        <p style={{ color: completeness.complete ? "#166534" : "#92400e", fontSize: 13, margin: "4px 0 0" }}>
                          {completeness.reason}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button type="button" variant="secondary" onClick={() => void openReportPeriod(period)} disabled={period.results.length === 0} title={period.results.length === 0 ? "Subject results are required to preview a report card." : undefined}>
                        Preview Report Card
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => void openReportPeriod(period, true)} disabled={period.results.length === 0 || !isAdministrator} title={!isAdministrator ? "Only an administrator can edit report-card details." : period.results.length === 0 ? "Subject results are required to open report-card details." : undefined}>
                        Edit Report Card Comments
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => navigateToResults(period)} disabled={period.results.length === 0} title={period.results.length === 0 ? "No subject results are available to edit." : undefined}>
                        Edit Subject Results
                      </Button>
                      {publishAction.visible ? (
                        <Button type="button" onClick={() => void publishReportPeriod(period)} disabled={publishAction.disabled} title={publishAction.reason || "Publish each eligible subject result through the authorized review workflow."}>
                          {isPublishing ? "Publishing…" : "Publish Report Card"}
                        </Button>
                      ) : null}
                      {canUnpublish ? (
                        <Button type="button" variant="secondary" onClick={() => void unpublishReportPeriod(period)} disabled={Boolean(unpublishingKey) || Boolean(publishingKey) || Boolean(unpublishVerificationErrors[period.key])} title={unpublishVerificationErrors[period.key] || "Move each published subject result to Returned through the existing review workflow."}>
                          {isUnpublishing ? "Unpublishing…" : "Unpublish Report Card"}
                        </Button>
                      ) : null}
                      {canDeleteReport ? (
                        <Button type="button" variant="secondary" onClick={() => void deleteReportPeriod(period)} disabled={Boolean(deletingKey) || Boolean(publishingKey) || Boolean(unpublishingKey)} style={{ color: "#b91c1c", borderColor: "#fecaca" }}>
                          {isDeleting ? "Deleting report card…" : "Delete Report Card"}
                        </Button>
                      ) : null}
                      {canDeleteDraft ? (
                        <Button type="button" variant="secondary" onClick={() => void deleteDraftPeriod(period)} disabled={Boolean(deletingKey) || Boolean(publishingKey) || Boolean(unpublishingKey)} style={{ color: "#b91c1c", borderColor: "#fecaca" }}>
                          {isDeleting ? "Deleting draft…" : "Delete Draft"}
                        </Button>
                      ) : null}
                      {isAdministrator && period.results.length === 0 && period.savedReport ? (
                        <Button type="button" variant="secondary" onClick={() => void deleteSavedReportDetails(period)} disabled={Boolean(deletingKey)} style={{ color: "#b91c1c", borderColor: "#fecaca" }}>
                          {isDeleting ? "Deleting details…" : "Delete Saved Details"}
                        </Button>
                      ) : null}
                      {isAdministrator && (publishVerificationErrors[period.key] || unpublishVerificationErrors[period.key]) ? (
                        <Button type="button" variant="secondary" onClick={() => void verifyPublishStatus(period)} disabled={Boolean(publishingKey)}>
                          Verify saved status
                        </Button>
                      ) : null}
                    </div>

                    {isAdministrator && publishAction.disabled && publishBlockReason ? (
                      <p role="status" style={{ color: "#92400e", fontSize: 13, margin: 0 }}>
                        Publishing unavailable: {publishBlockReason}
                      </p>
                    ) : null}
                    {statusLabel === "Published" ? (
                      <p role="status" style={{ color: "#475569", fontSize: 13, margin: 0 }}>
                        To correct subject results, unpublish this report first. Corrections remain Returned until explicitly published again.
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
              })}
            </div>
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
        <div>
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
            title={`Edit Report Card Comments · ${report.student.first_name} ${report.student.last_name}`}
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
