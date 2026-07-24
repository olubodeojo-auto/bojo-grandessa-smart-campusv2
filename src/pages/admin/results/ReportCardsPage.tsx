/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import ReportCardDocument from "../../../components/reports/ReportCardDocument";
import ReportCardToolbar from "../../../components/reports/ReportCardToolbar";
import EmptyState from "../../../components/ui/EmptyState";
import FormField, { inputStyle } from "../../../components/forms/FormField";
import SectionCard from "../../../components/ui/SectionCard";
import Button from "../../../components/ui/Button";
import { type AcademicCalendarConfig } from "../../../config/grandessaCalendar";
import { buildStudentReportCard, getReportHistoryByStudent } from "../../../services/reportCardService";
import {
  getAcademicCalendarByYear,
  getSchoolSettings,
  saveAcademicCalendar,
  saveSchoolSettings,
} from "../../../services/schoolSettingsService";
import { getStudents } from "../../../services/studentService";
import type { ReportCardData, ReportHistoryBySession, ReportTerm } from "../../../types/reportCard";
import type { SchoolSettings } from "../../../types/schoolSettings";
import type { Student } from "../../../types/student";

const TERMS: ReportTerm[] = ["First", "Second", "Third"];

function extractInitialTerm(input: string | null): ReportTerm {
  if (input === "First" || input === "Second" || input === "Third") {
    return input;
  }

  return "First";
}

export default function ReportCardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(searchParams.get("studentId") ?? "");
  const [academicYear, setAcademicYear] = useState<string>(searchParams.get("academicYear") ?? "");
  const [term, setTerm] = useState<ReportTerm>(extractInitialTerm(searchParams.get("term")));
  const [history, setHistory] = useState<ReportHistoryBySession[]>([]);
  const [calendarConfig, setCalendarConfig] = useState<AcademicCalendarConfig | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [report, setReport] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadStudents(): Promise<void> {
      const data = await getStudents();
      setStudents(data);

      if (!selectedStudentId && data.length > 0) {
        setSelectedStudentId(data[0].id);
      }
    }

    void loadStudents();
  }, [selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId) {
      setHistory([]);
      return;
    }

    async function loadHistory(): Promise<void> {
      try {
        const data = await getReportHistoryByStudent(selectedStudentId);
        setHistory(data);

        if (!academicYear && data.length > 0) {
          setAcademicYear(data[0].academicYear);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load report history.";
        setError(message);
      }
    }

    void loadHistory();
  }, [selectedStudentId, academicYear]);

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
    if (!selectedStudentId || !academicYear || !term) {
      setReport(null);
      return;
    }

    setSearchParams({
      studentId: selectedStudentId,
      academicYear,
      term,
    });

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
  }, [selectedStudentId, academicYear, term, setSearchParams]);

  const availableYears = useMemo(
    () => history.map((item) => item.academicYear),
    [history]
  );

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
      setReport(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save school settings.";
      setError(message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 30 }}>Report Cards</h1>
          <p style={{ color: "#666", marginTop: 8 }}>Generate, preview, print and export report cards from live results.</p>
        </div>
        <div className="report-toolbar">
          <ReportCardToolbar
            previewId="report-card-preview"
            fileName={`Report-${selectedStudentId || "student"}-${academicYear || "session"}-${term}.pdf`}
          />
        </div>
      </div>

      <SectionCard>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <FormField label="Student">
            <select
              style={inputStyle}
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} ({student.admission_number})
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

          <FormField label="Actions">
            <Button type="button" variant="secondary" onClick={() => setReport(null)}>
              Clear Preview
            </Button>
          </FormField>
        </div>
      </SectionCard>

      {calendarConfig ? (
        <SectionCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Academic Calendar</h2>
              <p style={{ color: "#666", marginTop: 6 }}>Set actual term dates for attendance, term ending and next term begins.</p>
            </div>
            <Button type="button" onClick={saveCalendar}>Save Calendar</Button>
          </div>

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
              <p style={{ color: "#666", marginTop: 6 }}>Report identity, contact and template mapping are shared from Supabase.</p>
            </div>
            <Button type="button" onClick={saveSettings}>Save Settings</Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
            <FormField label="School Name"><input style={inputStyle} value={schoolSettings.school_name ?? ""} onChange={(event) => updateSchoolSetting("school_name", event.target.value)} /></FormField>
            <FormField label="Motto"><input style={inputStyle} value={schoolSettings.motto ?? ""} onChange={(event) => updateSchoolSetting("motto", event.target.value)} /></FormField>
            <FormField label="Logo URL"><input style={inputStyle} value={schoolSettings.logo_url ?? ""} onChange={(event) => updateSchoolSetting("logo_url", event.target.value)} /></FormField>
            <FormField label="Address"><input style={inputStyle} value={schoolSettings.address ?? ""} onChange={(event) => updateSchoolSetting("address", event.target.value)} /></FormField>
            <FormField label="Phone"><input style={inputStyle} value={schoolSettings.phone ?? ""} onChange={(event) => updateSchoolSetting("phone", event.target.value)} /></FormField>
            <FormField label="Email"><input style={inputStyle} value={schoolSettings.email ?? ""} onChange={(event) => updateSchoolSetting("email", event.target.value)} /></FormField>
            <FormField label="Website"><input style={inputStyle} value={schoolSettings.website ?? ""} onChange={(event) => updateSchoolSetting("website", event.target.value)} /></FormField>
            <FormField label="Head Teacher Name"><input style={inputStyle} value={schoolSettings.head_teacher_name ?? ""} onChange={(event) => updateSchoolSetting("head_teacher_name", event.target.value)} /></FormField>
            <FormField label="Report Footer"><input style={inputStyle} value={schoolSettings.report_footer ?? ""} onChange={(event) => updateSchoolSetting("report_footer", event.target.value)} /></FormField>
            <FormField label="Kindergarten Class Patterns (comma separated)"><input style={inputStyle} value={schoolSettings.kindergarten_class_patterns.join(", ")} onChange={(event) => updateSchoolSetting("kindergarten_class_patterns", event.target.value)} /></FormField>
            <FormField label="Basic Class Patterns (comma separated)"><input style={inputStyle} value={schoolSettings.basic_class_patterns.join(", ")} onChange={(event) => updateSchoolSetting("basic_class_patterns", event.target.value)} /></FormField>
          </div>
        </SectionCard>
      ) : null}

      {error ? (
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12, color: "#991b1b" }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <EmptyState title="Building report card" description="Please wait while report data is generated." />
      ) : report ? (
        <ReportCardDocument report={report} />
      ) : (
        <EmptyState title="No report card" description="Select a student session and term with saved results." />
      )}
    </div>
  );
}
