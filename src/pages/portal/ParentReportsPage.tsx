/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";

import ReportCardDocument from "../../components/reports/ReportCardDocument";
import ReportCardToolbar from "../../components/reports/ReportCardToolbar";
import EmptyState from "../../components/ui/EmptyState";
import SectionCard from "../../components/ui/SectionCard";
import FormField, { inputStyle } from "../../components/forms/FormField";
import { buildStudentReportCard, getReportHistoryByStudent } from "../../services/reportCardService";
import { useAuth } from "../../hooks/useAuth";
import { getParentChildren } from "../../services/parentPortalService";
import type { ReportCardData, ReportHistoryBySession, ReportTerm } from "../../types/reportCard";
import type { Student } from "../../types/student";

export default function ParentReportsPage() {
  const { fullName, profile } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [history, setHistory] = useState<ReportHistoryBySession[]>([]);
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState<ReportTerm>("First");
  const [report, setReport] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadChildren(): Promise<void> {
      setLoading(true);
      setError("");
      try {
        const rows = await getParentChildren({ fullName, phone: profile?.phone ?? "" });
        setChildren(rows);
        if (rows.length > 0) setSelectedStudentId(rows[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load linked students.");
      } finally {
        setLoading(false);
      }
    }
    void loadChildren();
  }, [fullName, profile?.phone]);

  useEffect(() => {
    if (!selectedStudentId) {
      setHistory([]);
      setAcademicYear("");
      setReport(null);
      return;
    }
    async function loadHistory(): Promise<void> {
      try {
        const rows = await getReportHistoryByStudent(selectedStudentId);
        setHistory(rows);
        if (rows.length > 0) setAcademicYear(rows[0].academicYear);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load report history.");
      }
    }
    void loadHistory();
  }, [selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId || !academicYear) {
      setReport(null);
      return;
    }
    async function loadReport(): Promise<void> {
      setLoading(true);
      setError("");
      try {
        setReport(await buildStudentReportCard(selectedStudentId, academicYear, term));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load report card.");
        setReport(null);
      } finally {
        setLoading(false);
      }
    }
    void loadReport();
  }, [selectedStudentId, academicYear, term]);

  async function handleTermChange(nextTerm: ReportTerm): Promise<void> {
    setTerm(nextTerm);

    if (!selectedStudentId || !academicYear) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await buildStudentReportCard(selectedStudentId, academicYear, nextTerm);
      setReport(data);
      if (!data) {
        setError("No report is available for this session and term.");
      }
    } catch {
      setError("No report is available for this session and term.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSessionChange(nextYear: string): Promise<void> {
    setAcademicYear(nextYear);

    const nextTerm = history.find((item) => item.academicYear === nextYear)?.entries[0]?.term;

    if (!selectedStudentId || !nextYear || !nextTerm) {
      setTerm("First");
      setReport(null);
      return;
    }

    setTerm(nextTerm);
    setLoading(true);
    setError("");

    try {
      const data = await buildStudentReportCard(selectedStudentId, nextYear, nextTerm);
      setReport(data);
      if (!data) {
        setError("No report is available for this session and term.");
      }
    } catch {
      setError("No report is available for this session and term.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  const availableYears = useMemo(() => history.map((item) => item.academicYear), [history]);
  const availableTerms = useMemo(
    () => history.find((item) => item.academicYear === academicYear)?.entries.map((entry) => entry.term) ?? [],
    [academicYear, history]
  );
  const student = children.find((item) => item.id === selectedStudentId) ?? null;
  const studentName = student ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ") : "";
  const fileStudentName = studentName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Student";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px" }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 30 }}>Parent Report Portal</h1>
        <p style={{ marginTop: 8, color: "#666" }}>View your child&apos;s report history and download printable report cards.</p>
      </div>

      <SectionCard>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <FormField label="Child">
            <select
              style={inputStyle}
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.first_name} {child.last_name}
                </option>
              ))}
            </select>
          </FormField>

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
            fileName={`Grandessa-Report-${fileStudentName}-${academicYear || "session"}-${term}-Term.pdf`}
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
        <EmptyState title="No report available" description="No report card found for the selected child/session/term." />
      )}
    </div>
  );
}
