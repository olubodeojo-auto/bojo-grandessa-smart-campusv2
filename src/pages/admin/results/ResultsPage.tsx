/* eslint-disable react-hooks/set-state-in-effect */

import { motion } from "framer-motion";
import { FilePlus2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppModal from "../../../components/modals/AppModal";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import { useAuth } from "../../../hooks/useAuth";
import { createResult, deleteResult, getResults, updateResult } from "../../../services/resultService";
import { parseResultWorkbook, summarizeImportPreview, type ResultImportPreviewEntry } from "../../../services/resultImportService";
import { getStudents } from "../../../services/studentService";
import { getSubjects } from "../../../services/subjectService";
import { getClasses } from "../../../services/classService";
import type { Result } from "../../../types/result";
import type { Student } from "../../../types/student";
import type { Subject } from "../../../types/subject";
import type { SchoolClass } from "../../../types/class";
import ResultFilters from "./ResultFilters";
import ResultForm from "./ResultForm";
import ResultTableGrouped from "./ResultTableGrouped";
import type { ResultRow } from "./ResultTable";

type FilterTerm = "All" | "First" | "Second" | "Third";
type FilterStatus = "All" | "Draft" | "Published" | "Approved";

function normalizeRole(roleName: string | undefined): string {
  return roleName
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_]/g, "") ?? "";
}

function formatName(firstName?: string, lastName?: string): string {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || "Unknown";
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
      <Detail label="CA" value={String(row.continuousAssessment)} />
      <Detail label="Exam" value={String(row.examination)} />
      <Detail label="Total" value={String(row.totalScore)} />
      <Detail label="Grade" value={row.grade} />
      <Detail label="Remark" value={row.remark} />
      <Detail label="Status" value={row.status} />
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

export default function ResultsPage() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const normalizedRole = normalizeRole(role?.name);
  const canManage = ["teacher", "school_admin", "super_admin", "admin", "administrator"].includes(normalizedRole);
  const canPublish = ["teacher", "school_admin", "super_admin", "admin", "administrator"].includes(normalizedRole);

  const [loading, setLoading] = useState<boolean>(true);
  const [results, setResults] = useState<Result[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState<string>("");
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [importEntries, setImportEntries] = useState<ResultImportPreviewEntry[]>([]);
  const [importFileName, setImportFileName] = useState<string>("");
  const [importSubmitting, setImportSubmitting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<string>("");

  const [search, setSearch] = useState<string>("");
  const [term, setTerm] = useState<FilterTerm>("All");
  const [session, setSession] = useState<string>("");
  const [status, setStatus] = useState<FilterStatus>("All");

  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
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
      const [resultsData, studentsData, classesData, subjectsData] = await Promise.all([
        loadWithDiagnostics("getResults", () => getResults()),
        loadWithDiagnostics("getStudents", () => getStudents()),
        loadWithDiagnostics("getClasses", () => getClasses()),
        loadWithDiagnostics("getSubjects", () => getSubjects()),
      ]);

      setResults(resultsData);
      setStudents(studentsData);
      setClasses(classesData);
      setSubjects(subjectsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load results module.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const studentsMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((student) => map.set(student.id, student));
    return map;
  }, [students]);

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
          studentName: student
            ? `${formatName(student.first_name, student.last_name)} (${student.admission_number})`
            : "Unknown student",
          className: classNameValue,
          subjectName: subjectNameValue,
          teacherName: teacherNameValue,
          academicYear: result.academic_year,
          term: result.term,
          continuousAssessment: result.continuous_assessment,
          examination: result.examination,
          totalScore: result.total_score,
          grade: result.grade,
          remark: result.remark,
          status: result.status,
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

        return matchesSearch && matchesTerm && matchesStatus && matchesSession;
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [results, studentsMap, search, term, status, session]);

  const handleAdd = (): void => {
    setFormMode("add");
    setEditingResult(null);
    setIsFormOpen(true);
  };

  const handleEdit = (row: ResultRow): void => {
    const target = results.find((result) => result.id === row.id) ?? null;
    setFormMode("edit");
    setEditingResult(target);
    setIsFormOpen(true);
  };

  const handleView = (row: ResultRow): void => {
    setSelectedRow(row);
    setIsDetailOpen(true);
  };

  const handlePublish = async (row: ResultRow): Promise<void> => {
    if (!canPublish) {
      return;
    }

    try {
      await updateResult(row.id, { status: "Published" });
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to publish result.";
      setError(message);
    }
  };

  const handleDelete = async (row: ResultRow): Promise<void> => {
    if (!canManage) {
      return;
    }

    const confirmed = window.confirm(`Delete result for ${row.studentName}?`);

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

  const handlePublishFilteredDrafts = async (): Promise<void> => {
    if (!canPublish) {
      return;
    }

    const drafts = rows.filter((row) => row.status === "Draft");

    if (drafts.length === 0) {
      return;
    }

    const confirmed = window.confirm(`Publish ${drafts.length} draft result(s)?`);

    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(drafts.map((row) => updateResult(row.id, { status: "Published" })));
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to publish draft results.";
      setError(message);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setImportFileName(file.name);

    try {
      const entries = await parseResultWorkbook(file, students);
      setImportEntries(entries);
      setIsImportOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to parse workbook.";
      setError(message);
    } finally {
      event.target.value = "";
    }
  };

  const handleImportSelection = (entryIndex: number, studentId: string): void => {
    setImportEntries((current) =>
      current.map((entry, index) =>
        index === entryIndex
          ? {
              ...entry,
              selectedStudentId: studentId,
              matchStatus: studentId ? "matched" : "unmatched",
            }
          : entry
      )
    );
  };

  const handleConfirmImport = async (): Promise<void> => {
    const validEntries = importEntries.filter((entry) => {
      const studentId = entry.selectedStudentId ?? entry.matchedStudentId;
      return Boolean(studentId) && entry.items.length > 0;
    });

    if (validEntries.length === 0) {
      setError("No valid students were matched for import.");
      return;
    }

    setImportSubmitting(true);
    setError("");

    try {
      const classByName = new Map(classes.map((schoolClass) => [schoolClass.class_name.trim().toLowerCase(), schoolClass]));
      const subjectByName = new Map(subjects.map((subject) => [subject.subject_name.trim().toLowerCase(), subject]));
      let skipped = 0;
      const payloads = validEntries.flatMap((entry) => {
        const studentId = entry.selectedStudentId ?? entry.matchedStudentId;

        if (!studentId) {
          return [];
        }

        const student = studentsMap.get(studentId);
        const schoolClass = (item: ResultImportPreviewEntry["items"][number]) =>
          classByName.get((item.className || entry.className || student?.class_name || "").trim().toLowerCase())
          ?? (student?.class_id ? classes.find((schoolClass) => schoolClass.id === student.class_id) : undefined);

        return entry.items.flatMap((item) => {
          const classEntity = schoolClass(item);
          const subject = subjectByName.get(item.subjectName.trim().toLowerCase());
          const teacherName = (item.teacherName || entry.teacherName || [classEntity?.class_teacher?.first_name, classEntity?.class_teacher?.last_name].filter(Boolean).join(" ") || "").trim();

          if (!student || !classEntity || !subject || !teacherName) {
            skipped += 1;
            return [];
          }

          return [{
            student_id: student.id,
            class_id: classEntity.id,
            subject_id: subject.id,
            class_name: classEntity.class_name,
            subject_name: subject.subject_name,
            teacher_name: teacherName,
            academic_year: item.academicYear || entry.academicYear,
            term: item.term || entry.term,
            continuous_assessment: item.continuousAssessment,
            examination: item.examination,
            total_score: item.totalScore,
            grade: item.grade,
            remark: item.remark,
            teacher_id: undefined,
            status: "Draft" as const,
          }];
        });
      });

      const existingKeys = new Set(results.map((result) => `${result.student_id}|${result.subject_id}|${result.academic_year}|${result.term}`));
      await Promise.all(payloads.map((payload) => {
        const key = `${payload.student_id}|${payload.subject_id}|${payload.academic_year}|${payload.term}`;
        const existing = results.find((result) => existingKeys.has(key) && `${result.student_id}|${result.subject_id}|${result.academic_year}|${result.term}` === key);
        return existing ? updateResult(existing.id, payload) : createResult(payload);
      }));
      const unmatchedStudents = importEntries.filter((entry) => !(entry.selectedStudentId ?? entry.matchedStudentId)).length;
      setImportSummary(`Import complete. Imported: ${payloads.length}. Skipped: ${unmatchedStudents + skipped}.`);
      setImportEntries([]);
      setIsImportOpen(false);
      setImportFileName("");
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to import results.";
      setError(message);
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
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
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
            <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 32 }}>Results</h1>
            <p style={{ marginTop: 8, color: "#666", fontFamily: "Poppins" }}>
              Enter, validate, edit and publish academic results.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button type="button" variant="secondary" onClick={() => void loadData()} disabled={loading}>
              Refresh
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/admin/reports")}>Report Center</Button>
            <Button type="button" variant="secondary" onClick={() => void handlePublishFilteredDrafts()} disabled={loading}>
              <Upload size={16} />
              Publish Drafts
            </Button>
            <label style={{ display: "inline-flex" }}>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void handleImportFile(event)} hidden />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "#e2e8f0", color: "#0f172a", fontWeight: 700, cursor: "pointer" }}>
                <Upload size={16} />
                Import Excel
              </span>
            </label>
            <Button type="button" onClick={handleAdd} disabled={loading}>
              <FilePlus2 size={16} />
              Add Result
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

        {importSummary ? (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" }}>
            {importSummary}
          </div>
        ) : null}

        <ResultFilters
          search={search}
          term={term}
          session={session}
          status={status}
          onSearchChange={setSearch}
          onTermChange={setTerm}
          onSessionChange={setSession}
          onStatusChange={setStatus}
        />

        <div style={{ marginTop: 24 }}>
          <ResultTableGrouped
            rows={rows}
            loading={loading}
            canManage={canManage}
            canPublish={canPublish}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPublish={handlePublish}
          />
        </div>
      </motion.div>

      <AppModal
        open={isFormOpen}
        title={formMode === "edit" ? "Edit Result" : "Add Result"}
        size="xl"
        onClose={() => {
          setIsFormOpen(false);
          setEditingResult(null);
        }}
      >
        <ResultForm
          key={`${formMode}-${editingResult?.id ?? "new"}`}
          mode={formMode}
          result={editingResult}
          students={students}
          classes={classes}
          subjects={subjects}
          teachers={[]}
          onClose={() => {
            setIsFormOpen(false);
            setEditingResult(null);
          }}
          onSaved={loadData}
        />
      </AppModal>

      <AppModal
        open={isImportOpen}
        title="Excel Result Import Preview"
        size="xl"
        onClose={() => {
          setIsImportOpen(false);
          setImportEntries([]);
          setImportFileName("");
        }}
        footer={
          <div style={{ display: "flex", gap: 12 }}>
            <Button type="button" variant="secondary" onClick={() => {
              setIsImportOpen(false);
              setImportEntries([]);
              setImportFileName("");
            }}>
              Close
            </Button>
            <Button type="button" onClick={() => void handleConfirmImport()} disabled={importSubmitting}>
              {importSubmitting ? "Importing..." : "Confirm Import"}
            </Button>
          </div>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Workbook: {importFileName || "Uploaded file"}</div>
          <div style={{ color: "#475569" }}>
            {summarizeImportPreview(importEntries).totalStudents} student block(s) detected.
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, maxHeight: 520, overflow: "auto" }}>
          {importEntries.length === 0 ? (
            <EmptyState title="No import preview" description="Upload a workbook to preview result rows." />
          ) : (
            importEntries.map((entry, index) => {
              const studentId = entry.selectedStudentId ?? entry.matchedStudentId;

              return (
                <div key={`${entry.studentKey}-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{entry.studentName || "Unknown student"}</div>
                      <div style={{ color: "#475569" }}>
                        {entry.admissionNumber ? `Admission: ${entry.admissionNumber}` : "No admission number found"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ padding: "6px 10px", borderRadius: 999, background: entry.matchStatus === "matched" ? "#dcfce7" : entry.matchStatus === "manual-review" ? "#fef3c7" : "#fee2e2", color: entry.matchStatus === "matched" ? "#166534" : entry.matchStatus === "manual-review" ? "#92400e" : "#991b1b", fontSize: 12, fontWeight: 700 }}>
                        {entry.matchStatus === "matched" ? "Matched" : entry.matchStatus === "manual-review" ? "Review" : "Unmatched"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 12 }}>
                    <div><strong>Session:</strong> {entry.academicYear || "Not provided"}</div>
                    <div><strong>Term:</strong> {entry.term}</div>
                    <div><strong>Class:</strong> {entry.className || "Not provided"}</div>
                    <div><strong>Teacher:</strong> {entry.teacherName || "Not provided"}</div>
                  </div>

                  {entry.matchStatus !== "matched" ? (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Match student</label>
                      <select
                        value={studentId ?? ""}
                        onChange={(event) => handleImportSelection(index, event.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                      >
                        <option value="">Select matching student</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.first_name} {student.last_name} ({student.admission_number})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {entry.warnings.length > 0 ? (
                    <div style={{ marginBottom: 12, color: "#b45309", fontSize: 13 }}>
                      {entry.warnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gap: 8 }}>
                    {entry.items.map((item, itemIndex) => (
                      <div key={`${entry.studentKey}-${item.subjectName}-${itemIndex}`} style={{ background: "#f8fafc", borderRadius: 10, padding: 10, border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <strong>{item.subjectName}</strong>
                          <span>{item.grade} · {item.totalScore}/100</span>
                        </div>
                        <div style={{ color: "#475569", fontSize: 13 }}>
                          CA: {item.continuousAssessment} · Exam: {item.examination} · {item.remark}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </AppModal>

      <AppModal
        open={isDetailOpen}
        title="Result Details"
        size="lg"
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedRow(null);
        }}
        footer={
          <Button
            type="button"
            onClick={() => {
              setIsDetailOpen(false);
              setSelectedRow(null);
            }}
          >
            Close
          </Button>
        }
      >
        <ResultDetails row={selectedRow} />
      </AppModal>
    </>
  );
}
