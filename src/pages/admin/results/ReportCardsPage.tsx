/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import ReportCardDocument from "../../../components/reports/ReportCardDocument";
import ReportCardToolbar from "../../../components/reports/ReportCardToolbar";
import EmptyState from "../../../components/ui/EmptyState";
import FormField, { inputStyle } from "../../../components/forms/FormField";
import SectionCard from "../../../components/ui/SectionCard";
import Button from "../../../components/ui/Button";
import { type AcademicCalendarConfig } from "../../../config/grandessaCalendar";
import { buildStudentReportCard, deleteReportCard, getSavedReportCards, saveReportCardDetails, type SavedReportCard } from "../../../services/reportCardService";
import { getAcademicSessionSetups, saveAcademicSessionSetup } from "../../../services/academicSessionService";
import { getClasses } from "../../../services/classService";
import { getResults, publishResult } from "../../../services/resultService";
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
import {
  canPublishReportCenterPeriod,
  acquireReportPublishLock,
  discoverReportCenterPeriods,
  getReportCenterCompleteness,
  getReportCenterPublishBlockReason,
  getReportCenterPeriodStatus,
  publishReportResultsAndVerify,
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
  const [results, setResults] = useState<Result[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [publishingKey, setPublishingKey] = useState("");
  const publishInFlightPeriods = useRef(new Set<string>());
  const [publishVerificationErrors, setPublishVerificationErrors] = useState<Record<string, string>>({});
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
  // Initialize preview overrides when a report is loaded
  useEffect(() => {
    if (!report) {
      setEditedTimesPresent("");
      setEditedTimesAbsent("");
      setEditedMaximumAttendance("");
      setEditedTermEnding("");
      setEditedNextTermBegins("");
      setEditedClassTeacherName("");
      setEditedClassTeacherComment("");
      setEditedHeadTeacherComment("");
      setEditedClassAverage("");
      setEditedTotalMarksObtained("");
      setEditedTotalMarksObtainable("");
      setEditedStudentPercentage("");
      setReportCalculationMode("Manual");
      return;
    }

    setReportCalculationMode(report.calculationMode);
    setEditedTimesPresent(report.attendance?.timesPresent != null ? String(report.attendance.timesPresent) : "");
    setEditedTimesAbsent(report.attendance?.timesAbsent != null ? String(report.attendance.timesAbsent) : "");
    setEditedMaximumAttendance(report.attendance?.maximumAttendance != null ? String(report.attendance.maximumAttendance) : "");
    setEditedTermEnding(report.termEnding);
    setEditedNextTermBegins(report.nextTermBegins);
    setEditedClassTeacherName(report.classTeacherName);
    setEditedClassTeacherComment(report.classTeacherComment ?? "");
    setEditedHeadTeacherComment(report.headTeacherComment ?? "");
    setEditedClassAverage(report.classAverage !== null ? String(report.classAverage) : "");
    setEditedTotalMarksObtained(String(report.reportTotalMarksObtained ?? ""));
    setEditedTotalMarksObtainable(String(report.reportTotalMarksObtainable ?? ""));
    setEditedStudentPercentage(String(report.reportStudentPercentage ?? ""));
  }, [report]);

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
      setSuccess(`Opened ${student.first_name} ${student.last_name} · ${period.academicYear} · ${period.term} Term · ${period.reportType === "Midterm" ? "Midterm" : "End-of-Term"}.`);
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

  async function publishReportPeriod(period: ReportCenterPeriod): Promise<void> {
    const releasePublishLock = acquireReportPublishLock(publishInFlightPeriods.current, period.key);
    if (!releasePublishLock) return;
    try {
      if (!isAdministrator || !canPublishReportCenterPeriod(period, results, isAdministrator)) return;
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
      const pupil = students.find((student) => student.id === period.studentId);
      setSuccess(`Verified saved status for ${pupil ? `${pupil.first_name} ${pupil.last_name}` : "this pupil"}: ${publishedCount} of ${period.results.length} subject result(s) are Published.`);
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
    if (!report) return;
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
      setReport(refreshed);
      await refreshSavedReportCards();
      setSuccess(`${report.reportType === "Midterm" ? "Midterm" : "End-of-Term"} report details saved for ${report.student.first_name} ${report.student.last_name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save report comments.");
    } finally {
      setSavingComments(false);
    }
  }

  async function removeSavedReportCard(record: SavedReportCard): Promise<void> {
    if (!isAdministrator) return;
    const pupil = students.find((candidate) => candidate.id === record.student_id);
    const className = classes.find((candidate) => candidate.id === record.class_id)?.class_name ?? "selected class";
    const confirmed = window.confirm(
      `Delete 1 saved report-card presentation record?\n\nSession: ${record.academic_year}\nTerm: ${record.term}\nReport type: ${record.report_type === "Midterm" ? "Midterm Report" : "End-of-Term Report"}\nClass: ${className}\nPupil: ${pupil ? `${pupil.first_name} ${pupil.last_name}` : "Unknown pupil"}\n\nSubject marks will not be deleted.`,
    );
    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");
      await deleteReportCard(record.id);
      if (report?.student.id === record.student_id
        && report.classId === record.class_id
        && report.academicYear === record.academic_year
        && report.term === record.term
        && report.reportType === record.report_type) {
        setReport(null);
      }
      await refreshSavedReportCards();
      setSuccess("Saved report-card presentation record deleted. Subject marks were not changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete the saved report card.");
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
                const publishBlockReason = getReportCenterPublishBlockReason(period, results, isAdministrator);
                const canPublish = canPublishReportCenterPeriod(period, results, isAdministrator);
                const isPublishing = publishingKey === period.key;
                return (
                  <article key={period.key} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ fontSize: 16 }}>{pupilName}</strong>
                        <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                          {pupil?.admission_number ? `${pupil.admission_number} · ` : ""}{className} · {period.academicYear} · {period.term} Term · {period.reportType === "Midterm" ? "Midterm" : "End-of-Term"}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          <span style={statusBadgeStyle(statusLabel)}>{statusLabel}</span>
                          {period.savedReport ? <span style={savedBadgeStyle}>Report details saved</span> : null}
                          {period.results.length > 0 ? <span style={{ color: "#64748b", fontSize: 12 }}>{period.results.length} subject result(s)</span> : null}
                        </div>
                        {period.results.length > 0 ? (
                          <p style={{ color: completeness.complete ? "#166534" : "#92400e", fontSize: 13, margin: "8px 0 0" }}>
                            {completeness.reason}
                          </p>
                        ) : (
                          <p style={{ color: "#92400e", fontSize: 13, margin: "8px 0 0" }}>
                            Saved report details have no matching subject results to render.
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void openReportPeriod(period)}
                          disabled={period.results.length === 0}
                        >
                          Preview
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void openReportPeriod(period, true)}
                          disabled={period.results.length === 0 || !isAdministrator}
                        >
                          Edit
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => navigateToResults(period)}>
                          Edit results
                        </Button>
                        {isAdministrator ? (
                          <Button
                            type="button"
                            onClick={() => void publishReportPeriod(period)}
                            disabled={!canPublish || Boolean(publishingKey) || Boolean(publishVerificationErrors[period.key])}
                            title={publishVerificationErrors[period.key] || publishBlockReason || "Publish each eligible subject result through the existing review workflow."}
                          >
                            {isPublishing ? "Publishing…" : "Publish Report Card"}
                          </Button>
                        ) : null}
                        {isAdministrator && publishVerificationErrors[period.key] ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void verifyPublishStatus(period)}
                            disabled={Boolean(publishingKey)}
                          >
                            Verify saved status
                          </Button>
                        ) : null}
                        {isAdministrator && period.savedReport ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void removeSavedReportCard(period.savedReport!)}
                            style={{ color: "#b91c1c", borderColor: "#fecaca" }}
                          >
                            Delete saved details
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {isAdministrator && publishBlockReason ? (
                      <p role="status" style={{ color: "#92400e", fontSize: 13, margin: 0 }}>
                        Publishing unavailable: {publishBlockReason}
                      </p>
                    ) : null}
                    {isAdministrator && publishVerificationErrors[period.key] ? (
                      <p role="alert" style={{ color: "#991b1b", fontSize: 13, margin: 0 }}>
                        {publishVerificationErrors[period.key]} Publication retry is blocked until status is verified.
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
              {isAdministrator ? (
                <Button type="button" variant="secondary" onClick={() => setEditingReportDetails((editing) => !editing)}>
                  {editingReportDetails ? "Close edit details" : "Edit report details"}
                </Button>
              ) : null}
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
          {editingReportDetails && isAdministrator ? <SectionCard>
            <h3 style={{ marginTop: 0 }}>Report details</h3>
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
                <Button type="button" onClick={() => void saveReportDetails()} disabled={savingComments}>
                  {savingComments ? "Saving report details..." : "Save Report Details"}
                </Button>
              </div>
            </div>
          </SectionCard>
          : null}

          <ReportCardDocument
            report={{
              ...report,
              attendance: {
                ...report.attendance,
                maximumAttendance: editedMaximumAttendance === "" ? null : Number(editedMaximumAttendance),
                timesPresent: editedTimesPresent === "" ? null : Number(editedTimesPresent),
                timesAbsent: editedTimesAbsent === "" ? null : Number(editedTimesAbsent),
              },
              calculationMode: reportCalculationMode,
              classTeacherName: editedClassTeacherName,
              termEnding: editedTermEnding,
              nextTermBegins: editedNextTermBegins,
              classTeacherComment: editedClassTeacherComment,
              headTeacherComment: editedHeadTeacherComment,
              classAverage: editedClassAverage === "" ? null : Number(editedClassAverage),
              reportTotalMarksObtained: editedTotalMarksObtained === "" ? null : Number(editedTotalMarksObtained),
              reportTotalMarksObtainable: editedTotalMarksObtainable === "" ? null : Number(editedTotalMarksObtainable),
              reportStudentPercentage: editedStudentPercentage === "" ? null : Number(editedStudentPercentage),
            }}
          />
        </div>
      ) : (
        <EmptyState title="Choose a report period" description="Search for a pupil above, then preview an available period from their existing results." />
      )}
    </div>
  );
}
