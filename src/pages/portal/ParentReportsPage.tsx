/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";

import Button from "../../components/ui/Button";
import ReportCardDocument from "../../components/reports/ReportCardDocument";
import ReportCardToolbar from "../../components/reports/ReportCardToolbar";
import EmptyState from "../../components/ui/EmptyState";
import SectionCard from "../../components/ui/SectionCard";
import FormField, { inputStyle } from "../../components/forms/FormField";
import { buildStudentReportCard, getReportHistoryByStudent } from "../../services/reportCardService";
import { getStudentByAccessCode, getParentStudents } from "../../services/studentService";
import { useAuth } from "../../hooks/useAuth";
import { findLatestAvailableReportPeriod } from "../../utils/resultPresentation";
import type { ReportCardData, ReportHistoryBySession, ReportTerm, ReportType } from "../../types/reportCard";
import type { Student } from "../../types/student";

export default function ParentReportsPage() {
  const { isAuthenticated } = useAuth();
  const [studentCode, setStudentCode] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [linkedStudents, setLinkedStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [history, setHistory] = useState<ReportHistoryBySession[]>([]);
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState<ReportTerm>("First");
  const [classId, setClassId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("End-of-Term");
  const reportTypeRef = useRef(reportType);
  const [report, setReport] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function applyReportPeriod(period: { academicYear: string; period: { term: ReportTerm; classId: string; reportType: ReportType } } | null): void {
    if (!period) return;
    reportTypeRef.current = period.period.reportType;
    setReportType(period.period.reportType);
    setAcademicYear(period.academicYear);
    setTerm(period.period.term);
    setClassId(period.period.classId);
  }

  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;
    setLoading(true);
    void getParentStudents()
      .then((students) => {
        if (!active) return;
        setLinkedStudents(students);
        const firstStudent = students[0] ?? null;
        setStudent(firstStudent);
        setSelectedStudentId(firstStudent?.id ?? "");
        if (!firstStudent) setError("No linked student is available for this parent account.");
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load linked students.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !selectedStudentId) return;

    let active = true;
    setLoading(true);
    setError("");

    void getReportHistoryByStudent(selectedStudentId, { parentScoped: true })
      .then(async (rows) => {
        if (!active) return;
        setHistory(rows);
        const selectedPeriod = findLatestAvailableReportPeriod(rows, reportTypeRef.current);
        applyReportPeriod(selectedPeriod);
        if (!selectedPeriod) {
          setReport(null);
          setError("No published reports are available for this child yet. Please contact the school.");
          return;
        }
        const data = await buildStudentReportCard(selectedStudentId, selectedPeriod.academicYear, selectedPeriod.period.term, {
          parentScoped: true,
          reportType: selectedPeriod.period.reportType,
          classId: selectedPeriod.period.classId,
        });
        if (!active) return;
        setReport(data);
        if (!data) setError("The published result could not be prepared. Please contact the school.");
      })
      .catch((loadError) => {
        if (active) {
          setReport(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load this report.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, selectedStudentId]);

  function handleLinkedStudentChange(nextStudentId: string): void {
    const nextStudent = linkedStudents.find((item) => item.id === nextStudentId) ?? null;
    setStudent(nextStudent);
    setSelectedStudentId(nextStudentId);
    setHistory([]);
    setAcademicYear("");
    setClassId("");
    setReport(null);
  }

  async function handleLookup(): Promise<void> {
    const normalizedCode = studentCode.trim().toUpperCase();

    if (!normalizedCode) {
      setError("Enter the Result Access Code provided by the school.");
      setStudent(null);
      setSelectedStudentId("");
      setHistory([]);
      setReport(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const matchedStudent = await getStudentByAccessCode(normalizedCode);

      if (!matchedStudent) {
        setStudent(null);
        setSelectedStudentId("");
        setHistory([]);
        setAcademicYear("");
        setReport(null);
        setError("No student was found for that Result Access Code.");
        return;
      }

      const rows = await getReportHistoryByStudent(matchedStudent.id, { parentScoped: true });
      setStudent(matchedStudent);
      setSelectedStudentId(matchedStudent.id);
      setHistory(rows);

      const selectedPeriod = findLatestAvailableReportPeriod(rows, reportTypeRef.current);
      applyReportPeriod(selectedPeriod);
      if (!selectedPeriod) {
        setReport(null);
        setError("No published reports are available for this child yet. Please contact the school.");
        return;
      }

      const data = await buildStudentReportCard(matchedStudent.id, selectedPeriod.academicYear, selectedPeriod.period.term, {
        parentScoped: true,
        reportType: selectedPeriod.period.reportType,
        classId: selectedPeriod.period.classId,
      });
      setReport(data);
      if (!data) setError("The published result could not be prepared. Please contact the school.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the selected report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleTermChange(nextTerm: ReportTerm): Promise<void> {
    setTerm(nextTerm);
    if (!selectedStudentId || !academicYear) return;

    setLoading(true);
    setError("");
    try {
      const period = history.find((item) => item.academicYear === academicYear)?.entries
        .find((entry) => entry.term === nextTerm && entry.reportType === reportType);
      const data = period ? await buildStudentReportCard(selectedStudentId, academicYear, nextTerm, {
        parentScoped: true,
        reportType,
        classId: period.classId,
      }) : null;
      setReport(data);
      setClassId(period?.classId ?? "");
      if (!data) setError("No published report is available for that term and report type.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the selected report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleReportTypeChange(nextReportType: ReportType): Promise<void> {
    reportTypeRef.current = nextReportType;
    setReportType(nextReportType);
    if (!selectedStudentId || !academicYear) return;
    setLoading(true);
    setError("");

    try {
      const yearPeriods = history.find((item) => item.academicYear === academicYear)?.entries ?? [];
      const period = yearPeriods.find((entry) => entry.term === term && entry.reportType === nextReportType)
        ?? yearPeriods.find((entry) => entry.reportType === nextReportType);
      if (period) {
        setTerm(period.term);
        setClassId(period.classId);
      } else {
        setClassId("");
      }
      const data = period ? await buildStudentReportCard(selectedStudentId, academicYear, period.term, {
        parentScoped: true,
        reportType: nextReportType,
        classId: period.classId,
      }) : null;
      setReport(data);
      if (!data) setError("No published report is available for that report type in this session.");
    } catch (loadError) {
      setReport(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load published results.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSessionChange(nextYear: string): Promise<void> {
    const yearPeriods = history.find((item) => item.academicYear === nextYear)?.entries ?? [];
    const nextPeriod = yearPeriods.find((entry) => entry.reportType === reportType) ?? yearPeriods[0];
    setAcademicYear(nextYear);

    if (!selectedStudentId || !nextYear || !nextPeriod) {
      setTerm("First");
      setClassId("");
      setReport(null);
      setError("No published reports are available for this session.");
      return;
    }

    reportTypeRef.current = nextPeriod.reportType;
    setReportType(nextPeriod.reportType);
    setTerm(nextPeriod.term);
    setClassId(nextPeriod.classId);
    setLoading(true);
    setError("");

    try {
      const data = await buildStudentReportCard(selectedStudentId, nextYear, nextPeriod.term, {
        parentScoped: true,
        reportType: nextPeriod.reportType,
        classId: nextPeriod.classId,
      });
      setReport(data);
      if (!data) setError("The published result could not be prepared. Please contact the school.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the selected report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleClassChange(nextClassId: string): Promise<void> {
    setClassId(nextClassId);
    if (!selectedStudentId || !academicYear) return;
    setLoading(true);
    setError("");
    try {
      const data = await buildStudentReportCard(selectedStudentId, academicYear, term, {
        parentScoped: true,
        reportType,
        classId: nextClassId,
      });
      setReport(data);
      if (!data) setError("The published result could not be prepared. Please contact the school.");
    } catch (loadError) {
      setReport(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load the selected report.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshReport(): Promise<void> {
    if (!selectedStudentId) return;
    setLoading(true);
    setError("");

    try {
      const rows = await getReportHistoryByStudent(selectedStudentId, { parentScoped: true });
      setHistory(rows);
      const currentYear = rows.find((item) => item.academicYear === academicYear);
      const period = currentYear?.entries.find((entry) =>
        entry.term === term
        && entry.reportType === reportType
        && (!classId || entry.classId === classId)
      ) ?? currentYear?.entries.find((entry) => entry.reportType === reportType)
        ?? findLatestAvailableReportPeriod(rows, reportType)?.period;
      const resolvedYear = period && currentYear?.entries.includes(period)
        ? academicYear
        : findLatestAvailableReportPeriod(rows, reportType)?.academicYear ?? "";
      if (!period) {
        setReport(null);
        setClassId("");
        setError("No published reports are available for this child yet. Please contact the school.");
        return;
      }
      reportTypeRef.current = period.reportType;
      setReportType(period.reportType);
      const data = await buildStudentReportCard(selectedStudentId, resolvedYear, period.term, {
        parentScoped: true,
        reportType: period.reportType,
        classId: period.classId,
      });
      setReport(data);
      setAcademicYear(resolvedYear);
      setTerm(period.term);
      setClassId(period.classId);
      if (!data) setError("The published result could not be prepared. Please contact the school.");
    } catch (loadError) {
      setReport(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to refresh the selected report.");
    } finally {
      setLoading(false);
    }
  }

  const availableYears = useMemo(() => history.map((item) => item.academicYear), [history]);
  const selectedYearAllEntries = useMemo(
    () => history.find((item) => item.academicYear === academicYear)?.entries ?? [],
    [academicYear, history],
  );
  const selectedYearEntries = useMemo(
    () => selectedYearAllEntries.filter((entry) => entry.reportType === reportType),
    [selectedYearAllEntries, reportType],
  );
  const availableReportTypes = useMemo(
    () => new Set(selectedYearAllEntries.map((entry) => entry.reportType)),
    [selectedYearAllEntries],
  );
  const availableTerms = useMemo(
    () => [...new Set(selectedYearEntries.map((entry) => entry.term))],
    [selectedYearEntries],
  );
  const availableClasses = useMemo(
    () => selectedYearEntries.filter((entry) => entry.term === term),
    [selectedYearEntries, term],
  );
  const studentName = student ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ") : "";
  const fileStudentName = studentName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Student";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px" }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 30 }}>Parent Report Portal</h1>
        <p style={{ marginTop: 8, color: "#666" }}>{isAuthenticated ? "Reports for your linked children." : "Enter the Result Access Code provided by the school."}</p>
      </div>

      <SectionCard>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {isAuthenticated ? (
            <FormField label="Child">
              <select
                style={inputStyle}
                value={selectedStudentId}
                onChange={(event) => handleLinkedStudentChange(event.target.value)}
                disabled={!linkedStudents.length || loading}
                aria-label="Select child"
              >
                {linkedStudents.map((linkedStudent) => (
                  <option key={linkedStudent.id} value={linkedStudent.id}>
                    {[linkedStudent.first_name, linkedStudent.last_name].filter(Boolean).join(" ")}
                  </option>
                ))}
              </select>
            </FormField>
          ) : (
            <FormField label="Result Access Code">
              <input
                style={inputStyle}
                value={studentCode}
                onChange={(event) => setStudentCode(event.target.value.toUpperCase())}
                placeholder="e.g. GRC-2D7F9A"
                aria-label="Result access code"
              />
            </FormField>
          )}

          <FormField label="Session">
            <select
              style={inputStyle}
              value={academicYear}
              onChange={(event) => void handleSessionChange(event.target.value)}
              disabled={!availableYears.length || loading}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Term">
            <select
              style={inputStyle}
              value={term}
              onChange={(event) => void handleTermChange(event.target.value as ReportTerm)}
              disabled={!availableTerms.length || loading}
            >
              {availableTerms.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Report type">
            <select
              style={inputStyle}
              value={reportType}
              onChange={(event) => void handleReportTypeChange(event.target.value as ReportType)}
              disabled={!selectedStudentId || loading}
            >
              <option value="Midterm" disabled={!availableReportTypes.has("Midterm")}>Midterm</option>
              <option value="End-of-Term" disabled={!availableReportTypes.has("End-of-Term")}>End-of-Term</option>
            </select>
          </FormField>

          {availableClasses.length > 1 ? (
            <FormField label="Class">
              <select style={inputStyle} value={classId} onChange={(event) => void handleClassChange(event.target.value)} disabled={loading}>
                {availableClasses.map((entry) => (
                  <option key={entry.classId} value={entry.classId}>{entry.className}</option>
                ))}
              </select>
            </FormField>
          ) : null}
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          {student ? (
            <Button type="button" variant="secondary" onClick={() => void handleRefreshReport()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh report"}
            </Button>
          ) : null}
          {!isAuthenticated ? (
            <Button type="button" onClick={() => void handleLookup()} disabled={loading}>
              {loading ? "Loading..." : "View Result"}
            </Button>
          ) : null}
        </div>
      </SectionCard>

      {student ? (
        <SectionCard>
          <p style={{ margin: 0, color: "#666", fontSize: 12 }}>REPORT FOR</p>
          <h2 style={{ margin: "4px 0 2px" }}>{studentName.toUpperCase()}</h2>
          <p style={{ margin: 0 }}>{student.admission_number}</p>
        </SectionCard>
      ) : null}

      {report ? (
        <div className="card report-toolbar" style={{ marginTop: 16, marginBottom: 16 }}>
          <ReportCardToolbar
            previewId="report-card-preview"
            fileName={`Grandessa-Report-${fileStudentName}-${academicYear || "session"}-${term}-${reportType}.pdf`}
          />
        </div>
      ) : null}

      {error ? (
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12, color: "#991b1b", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <EmptyState title="Loading report" description="Preparing the selected student result." />
      ) : report ? (
        <ReportCardDocument report={report} />
      ) : (
        <EmptyState title="Report not published" description="This report has not been published yet. Please check back later or contact the school." />
      )}
    </div>
  );
}
