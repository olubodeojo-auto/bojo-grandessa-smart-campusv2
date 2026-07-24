/* eslint-disable react-hooks/set-state-in-effect */

import { motion } from "framer-motion";
import { FilePlus2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppModal from "../../../components/modals/AppModal";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import { useAuth } from "../../../hooks/useAuth";
import { getClasses } from "../../../services/classService";
import { deleteResult, getResults, updateResult } from "../../../services/resultService";
import { getStudents } from "../../../services/studentService";
import { getSubjects } from "../../../services/subjectService";
import { getTeachers } from "../../../services/teacherService";
import type { SchoolClass } from "../../../types/class";
import type { Result } from "../../../types/result";
import type { Student } from "../../../types/student";
import type { Subject } from "../../../types/subject";
import type { Teacher } from "../../../types/teacher";
import ResultFilters from "./ResultFilters";
import ResultForm from "./ResultForm";
import ResultTable, { type ResultRow } from "./ResultTable";

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
  const canManage = ["teacher", "school_admin", "super_admin", "admin"].includes(normalizedRole);
  const canPublish = ["teacher", "school_admin", "super_admin", "admin"].includes(normalizedRole);

  const [loading, setLoading] = useState<boolean>(true);
  const [results, setResults] = useState<Result[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [error, setError] = useState<string>("");

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

    try {
      const [resultsData, studentsData, classesData, subjectsData, teachersData] = await Promise.all([
        loadWithDiagnostics("getResults", () => getResults()),
        loadWithDiagnostics("getStudents", () => getStudents()),
        loadWithDiagnostics("getClasses", () => getClasses()),
        loadWithDiagnostics("getSubjects", () => getSubjects()),
        loadWithDiagnostics("getTeachers", () => getTeachers()),
      ]);

      setResults(resultsData);
      setStudents(studentsData);
      setClasses(classesData);
      setSubjects(subjectsData);
      setTeachers(teachersData);
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

  const classesMap = useMemo(() => {
    const map = new Map<string, SchoolClass>();
    classes.forEach((schoolClass) => map.set(schoolClass.id, schoolClass));
    return map;
  }, [classes]);

  const subjectsMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((subject) => map.set(subject.id, subject));
    return map;
  }, [subjects]);

  const teachersMap = useMemo(() => {
    const map = new Map<string, Teacher>();
    teachers.forEach((teacher) => map.set(teacher.id, teacher));
    return map;
  }, [teachers]);

  const rows = useMemo<ResultRow[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return results
      .map((result) => {
        const student = studentsMap.get(result.student_id);
        const schoolClass = classesMap.get(result.class_id);
        const subject = subjectsMap.get(result.subject_id);
        const teacher = teachersMap.get(result.teacher_id);

        return {
          id: result.id,
          studentName: student
            ? `${formatName(student.first_name, student.last_name)} (${student.admission_number})`
            : "Unknown student",
          className: schoolClass
            ? `${schoolClass.class_name}${schoolClass.section ? ` - ${schoolClass.section}` : ""}`
            : "Unknown class",
          subjectName: subject ? `${subject.subject_name} (${subject.subject_code})` : "Unknown subject",
          teacherName: teacher ? formatName(teacher.first_name, teacher.last_name) : "Unknown teacher",
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
  }, [results, studentsMap, classesMap, subjectsMap, teachersMap, search, term, status, session]);

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
          <ResultTable
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
          teachers={teachers}
          onClose={() => {
            setIsFormOpen(false);
            setEditingResult(null);
          }}
          onSaved={loadData}
        />
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
