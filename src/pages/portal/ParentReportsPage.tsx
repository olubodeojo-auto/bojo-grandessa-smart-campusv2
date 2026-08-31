/* eslint-disable react-hooks/set-state-in-effect */

import { useMemo, useState } from "react";

import Button from "../../components/ui/Button";
import ReportCardDocument from "../../components/reports/ReportCardDocument";
import ReportCardToolbar from "../../components/reports/ReportCardToolbar";
import EmptyState from "../../components/ui/EmptyState";
import SectionCard from "../../components/ui/SectionCard";
import FormField, { inputStyle } from "../../components/forms/FormField";
import { buildStudentReportCard, getReportHistoryByStudent } from "../../services/reportCardService";
import { getStudentByAccessCode } from "../../services/studentService";
import type { ReportCardData, ReportHistoryBySession, ReportTerm } from "../../types/reportCard";
import type { Student } from "../../types/student";

export default function ParentReportsPage() {
  const [studentCode, setStudentCode] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [history, setHistory] = useState<ReportHistoryBySession[]>([]);
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState<ReportTerm>("First");
  const [report, setReport] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        setError("No student found for this Result Access Code. Please check the code and try again.");
        return;
      }

      const rows = await getReportHistoryByStudent(matchedStudent.id);
      setStudent(matchedStudent);
      setSelectedStudentId(matchedStudent.id);
      setHistory(rows);

      const nextYear = rows[0]?.academicYear ?? "";
      setAcademicYear(nextYear);
      const nextTerm = rows[0]?.entries[0]?.term ?? "First";
      setTerm(nextTerm);

      if (!nextYear) {
        setReport(null);
        setError("No report is available for this student yet.");
        return;
      }

      const data = await buildStudentReportCard(matchedStudent.id, nextYear, nextTerm);
      setReport(data);
      if (!data) {
        setError("No report is available for this student yet.");
      }
    } catch {
      setError("No student found for this Result Access Code. Please check the code and try again.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

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
  const studentName = student ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ") : "";
  const fileStudentName = studentName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Student";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px" }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 30 }}>Parent Report Portal</h1>
        <p style={{ marginTop: 8, color: "#666" }}>Enter the Result Access Code provided by the school.</p>
      </div>

      <SectionCard>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <FormField label="Result Access Code">
            <input
              style={inputStyle}
              value={studentCode}
              onChange={(event) => setStudentCode(event.target.value.toUpperCase())}
              placeholder="e.g. GRC-2D7F9A"
              aria-label="Result access code"
            />
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

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <Button type="button" onClick={() => void handleLookup()} disabled={loading}>
            {loading ? "Loading..." : "View Result"}
          </Button>
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
        <EmptyState title="No report available" description="No report card found for the selected student." />
      )}
    </div>
  );
}
