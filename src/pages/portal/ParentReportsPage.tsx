/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";

import ReportCardDocument from "../../components/reports/ReportCardDocument";
import ReportCardToolbar from "../../components/reports/ReportCardToolbar";
import EmptyState from "../../components/ui/EmptyState";
import SectionCard from "../../components/ui/SectionCard";
import FormField, { inputStyle } from "../../components/forms/FormField";
import { useAuth } from "../../hooks/useAuth";
import { getParentChildren } from "../../services/parentPortalService";
import { buildStudentReportCard, getReportHistoryByStudent } from "../../services/reportCardService";
import type { ReportCardData, ReportHistoryBySession, ReportTerm } from "../../types/reportCard";
import type { Student } from "../../types/student";

const TERMS: ReportTerm[] = ["First", "Second", "Third"];

export default function ParentReportsPage() {
  const { fullName, profile } = useAuth();

  const [children, setChildren] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [history, setHistory] = useState<ReportHistoryBySession[]>([]);
  const [academicYear, setAcademicYear] = useState<string>("");
  const [term, setTerm] = useState<ReportTerm>("First");
  const [report, setReport] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadChildren(): Promise<void> {
      setLoading(true);
      setError("");

      try {
        const rows = await getParentChildren({ fullName, phone: profile?.phone ?? "" });
        setChildren(rows);

        if (rows.length > 0) {
          setSelectedStudentId(rows[0].id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load linked students.";
        setError(message);
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

        if (rows.length > 0) {
          setAcademicYear(rows[0].academicYear);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load report history.";
        setError(message);
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
        const data = await buildStudentReportCard(selectedStudentId, academicYear, term);
        setReport(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load report card.";
        setError(message);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, [selectedStudentId, academicYear, term]);

  const availableYears = useMemo(() => history.map((item) => item.academicYear), [history]);

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
              {children.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Session">
            <select
              style={inputStyle}
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
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
              onChange={(event) => setTerm(event.target.value as ReportTerm)}
            >
              {TERMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </SectionCard>

      <div className="card report-toolbar" style={{ marginTop: 16, marginBottom: 16 }}>
        <ReportCardToolbar
          previewId="report-card-preview"
          fileName={`Parent-Report-${selectedStudentId || "student"}-${academicYear || "session"}-${term}.pdf`}
        />
      </div>

      {error ? (
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12, color: "#991b1b", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <EmptyState title="Loading report" description="Preparing report card data from live records." />
      ) : report ? (
        <ReportCardDocument report={report} />
      ) : (
        <EmptyState title="No report available" description="No report card found for the selected child/session/term." />
      )}
    </div>
  );
}
