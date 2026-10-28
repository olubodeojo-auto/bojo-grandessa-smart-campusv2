import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Button from "../../../components/ui/Button";
import type { Result } from "../../../types/result";
import type { SchoolClass } from "../../../types/class";
import type { Student } from "../../../types/student";
import type { Subject } from "../../../types/subject";
import { calculateResult, validateAssessmentMarks } from "../../../utils/resultCalculations";
import { createResults, updateResult } from "../../../services/resultService";
import { grandessaGradingScale } from "../../../config/grandessaGrading";
import { getResultBatchDraftResume } from "../../../utils/resultDraftRecovery";

type BatchReportType = "Midterm" | "End-of-Term";
type BatchTerm = "First" | "Second" | "Third";
type BatchEntry = {
  continuousAssessment: string;
  examination: string;
  totalScore: string;
  grade: string;
  remark: string;
  maximumScore: string;
  dirty?: boolean;
};
type BatchDraft = {
  studentId: string;
  academicYear: string;
  term: BatchTerm | "";
  reportType: BatchReportType;
  calculationMode: "Manual" | "Automatic";
  entries: Record<string, Record<string, BatchEntry>>;
};

type ResultBatchEntryProps = {
  students: Student[];
  classes: SchoolClass[];
  subjects: Subject[];
  results: Result[];
  academicYears: string[];
  userId?: string;
  resumeResult?: Result | null;
  onSaved: () => Promise<void>;
  canPublish?: boolean;
  onSaveAndPublish?: (params: { studentId: string; classId: string; academicYear: string; term: BatchTerm; reportType: BatchReportType }) => Promise<void>;
  onEditExisting: (result: Result) => void;
};

function numberValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isBatchDraft(value: unknown): value is BatchDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<BatchDraft>;
  return typeof draft.studentId === "string"
    && typeof draft.academicYear === "string"
    && (draft.term === "" || draft.term === "First" || draft.term === "Second" || draft.term === "Third")
    && (draft.reportType === "Midterm" || draft.reportType === "End-of-Term")
    && (draft.calculationMode === "Manual" || draft.calculationMode === "Automatic")
    && Boolean(draft.entries && typeof draft.entries === "object");
}

export default function ResultBatchEntry({
  students,
  classes,
  subjects,
  results,
  academicYears,
  userId,
  resumeResult,
  onSaved,
  canPublish = false,
  onSaveAndPublish,
  onEditExisting,
}: ResultBatchEntryProps) {
  const [draft, setDraft] = useState<BatchDraft>(() => ({
    studentId: students[0]?.id ?? "",
    academicYear: academicYears[0] ?? "",
    term: "",
    reportType: "End-of-Term",
    calculationMode: "Manual",
    entries: {},
  }));
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftRestoreFailed, setDraftRestoreFailed] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"loading" | "saved" | "failed">("loading");
  const [draftError, setDraftError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const entrySectionRef = useRef<HTMLElement | null>(null);
  const lastResumedResultId = useRef<string | null>(null);

  const storageKey = userId ? `grandessa:result-entry-draft:${userId}` : "";
  const selectedStudent = students.find((student) => student.id === draft.studentId);
  const classId = selectedStudent?.class_id ?? "";
  const selectedClass = classes.find((schoolClass) => schoolClass.id === classId);
  const assignedTeacherName = selectedClass?.class_teacher
    ? [selectedClass.class_teacher.first_name, selectedClass.class_teacher.last_name].filter(Boolean).join(" ")
    : selectedStudent?.class_teacher_name
      || [selectedStudent?.class_teacher?.first_name, selectedStudent?.class_teacher?.last_name].filter(Boolean).join(" ")
      || "";
  const assessmentType = draft.reportType === "Midterm" ? "CA" : "Combined";
  const scopeKey = [draft.studentId, draft.academicYear, draft.term, draft.reportType].join("|");
  const visibleStudents = useMemo(
    () => students.filter((student) => student.status === "Active" || student.id === draft.studentId),
    [draft.studentId, students],
  );

  useEffect(() => {
    const section = entrySectionRef.current;
    if (!section) return;

    const handleWheel = (event: WheelEvent): void => {
      if (!(event.target instanceof HTMLInputElement) || event.target.type !== "number") return;
      event.preventDefault();
      const scrollContainer = section.parentElement;
      if (scrollContainer) scrollContainer.scrollTop += event.deltaY;
    };

    section.addEventListener("wheel", handleWheel, { passive: false });
    return () => section.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (!isBatchDraft(parsed)) throw new Error("The saved result-entry draft is malformed.");
          setDraft(parsed);
        }
        setDraftStatus("saved");
        setDraftLoaded(true);
      } catch (storageError) {
        setDraftRestoreFailed(true);
        setDraftStatus("failed");
        setDraftError(storageError instanceof Error ? storageError.message : "Unable to restore the result-entry draft.");
        setDraftLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!draftLoaded || !storageKey || draftRestoreFailed) return;
    const saveDraftToBrowser = (): void => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
        setDraftStatus("saved");
        setDraftError("");
      } catch (storageError) {
        setDraftStatus("failed");
        setDraftError(storageError instanceof Error ? storageError.message : "Unable to save the result-entry draft in this browser.");
      }
    };
    saveDraftToBrowser();
    window.addEventListener("pagehide", saveDraftToBrowser);
    document.addEventListener("visibilitychange", saveDraftToBrowser);
    return () => {
      window.removeEventListener("pagehide", saveDraftToBrowser);
      document.removeEventListener("visibilitychange", saveDraftToBrowser);
    };
  }, [draft, draftLoaded, draftRestoreFailed, storageKey]);

  useEffect(() => {
    if (!resumeResult) {
      lastResumedResultId.current = null;
      return;
    }
    if (!draftLoaded || lastResumedResultId.current === resumeResult.id) return;

    const recovered = getResultBatchDraftResume(resumeResult);
    if (!recovered) return;
    lastResumedResultId.current = resumeResult.id;
    const recoveredScope = [
      recovered.studentId,
      recovered.academicYear,
      recovered.term,
      recovered.reportType,
    ].join("|");
    void Promise.resolve().then(() => {
      setDraft((current) => ({
        ...current,
        studentId: recovered.studentId,
        academicYear: recovered.academicYear,
        term: recovered.term,
        reportType: recovered.reportType,
        calculationMode: recovered.calculationMode,
        entries: {
          ...current.entries,
          [recoveredScope]: {
            ...(current.entries[recoveredScope] ?? {}),
            [recovered.subjectId]: recovered.entry,
          },
        },
      }));
      setDraftStatus("saved");
      setDraftError("");
    });
  }, [draftLoaded, resumeResult]);

  function changeDraft(updater: (current: BatchDraft) => BatchDraft): void {
    setDraft(updater);
    setDraftRestoreFailed(false);
    setDraftStatus("saved");
    setDraftError("");
  }

  function existingFor(subjectId: string): Result[] {
    if (!draft.studentId || !classId || !draft.term) return [];
    return results.filter((result) =>
      result.student_id === draft.studentId
      && result.class_id === classId
      && result.subject_id === subjectId
      && result.academic_year === draft.academicYear
      && result.term === draft.term
      && (draft.reportType === "Midterm"
        ? result.assessment_type === "CA"
        : result.assessment_type === "Combined" || result.assessment_type === "Examination")
    );
  }

  function entryFor(subjectId: string): BatchEntry {
    const saved = draft.entries[scopeKey]?.[subjectId];
    if (saved) return saved;
    const existing = existingFor(subjectId)[0];
    return existing ? {
      continuousAssessment: existing.continuous_assessment === null ? "" : String(existing.continuous_assessment),
      examination: existing.examination === null ? "" : String(existing.examination),
      totalScore: existing.total_score === null ? "" : String(existing.total_score),
      grade: existing.grade ?? "",
      remark: existing.remark ?? "",
      maximumScore: existing.maximum_score === null || existing.maximum_score === undefined ? "" : String(existing.maximum_score),
    } : {
      continuousAssessment: "",
      examination: "",
      totalScore: "",
      grade: "",
      remark: "",
      maximumScore: "",
    };
  }

  function updateEntry(subjectId: string, field: keyof BatchEntry, value: string): void {
    changeDraft((current) => {
      const currentScope = [current.studentId, current.academicYear, current.term, current.reportType].join("|");
      const currentEntries = current.entries[currentScope] ?? {};
      const entry = currentEntries[subjectId] ?? entryFor(subjectId);
      return {
        ...current,
        entries: {
          ...current.entries,
          [currentScope]: {
            ...currentEntries,
            [subjectId]: { ...entry, [field]: value, dirty: true },
          },
        },
      };
    });
  }

  function rowValues(subjectId: string, entry: BatchEntry) {
    const ca = numberValue(entry.continuousAssessment);
    const exam = draft.reportType === "End-of-Term" ? numberValue(entry.examination) : null;
    const maximum = draft.reportType === "Midterm" ? numberValue(entry.maximumScore) : null;
    const calculated = draft.calculationMode === "Automatic"
      ? calculateResult(assessmentType, ca, exam)
      : null;
    const total = draft.reportType === "Midterm"
      ? null
      : draft.calculationMode === "Automatic"
        ? calculated?.total ?? null
        : numberValue(entry.totalScore);
    const grade = draft.reportType === "Midterm"
      ? null
      : draft.calculationMode === "Automatic"
        ? calculated?.grade ?? null
        : entry.grade || null;
    const remark = draft.reportType === "Midterm"
      ? null
      : draft.calculationMode === "Automatic"
        ? calculated?.remark ?? null
        : entry.remark || null;
    const errors = validateAssessmentMarks({
      assessment_type: assessmentType,
      continuous_assessment: ca,
      maximum_score: maximum,
      examination: exam,
      total_score: total,
      grade: grade ?? "",
      remark: remark ?? "",
    });
    const hasValue = [
      entry.continuousAssessment,
      entry.examination,
      entry.totalScore,
      entry.grade,
      entry.remark,
      entry.maximumScore,
    ].some((value) => value.trim() !== "");
    const matches = existingFor(subjectId);
    return { ca, exam, maximum, total, grade, remark, errors, hasValue, matches };
  }

  async function saveDrafts(publishAfterSave = false): Promise<void> {
    setMessage("");
    setError("");
    if (!selectedStudent || !classId || !draft.academicYear.trim() || !draft.term) {
      setError("Choose a student with an assigned class, session and term before saving.");
      return;
    }

    const rows = subjects.map((subject) => {
      const entry = entryFor(subject.id);
      return { subject, entry, ...rowValues(subject.id, entry) };
    });
    const publishedEdit = rows.find((row) => row.entry.dirty
      && row.matches.some((match) => match.status === "Published"));
    if (publishedEdit) {
      setError(`${publishedEdit.subject.subject_name}: unpublish the existing result before editing it.`);
      return;
    }
    const invalid = rows.find((row) => row.errors.length > 0 && (row.hasValue || row.entry.dirty));
    if (invalid) {
      setError(`${invalid.subject.subject_name}: ${invalid.errors.join(" ")}`);
      return;
    }
    const duplicate = rows.find((row) => row.matches.length > 1 && (row.hasValue || row.entry.dirty));
    if (duplicate) {
      setError(`${duplicate.subject.subject_name}: multiple existing records match this pupil, period and report type. Resolve the duplicates before saving.`);
      return;
    }
    const rowsToSave = rows.filter((row) =>
      (row.hasValue || row.entry.dirty) && row.errors.length === 0,
    );
    if (rowsToSave.length === 0) {
      setError("Enter at least one subject mark before saving a draft.");
      return;
    }

    setSaving(true);
    let savedCount = 0;
    try {
      const updates = rowsToSave.filter((row) => row.matches.length === 1 && row.entry.dirty);
      const inserts = rowsToSave.filter((row) => row.matches.length === 0 && row.hasValue);
      for (const row of updates) {
        await updateResult(row.matches[0].id, {
          continuous_assessment: row.ca,
          maximum_score: row.maximum,
          examination: row.exam,
          total_score: row.total,
          grade: row.grade,
          remark: row.remark,
          calculation_mode: draft.calculationMode,
        });
        savedCount += 1;
      }
      if (inserts.length > 0) {
        await createResults(inserts.map((row) => ({
          student_id: selectedStudent.id,
          class_id: classId,
          subject_id: row.subject.id,
          teacher_id: selectedClass?.class_teacher_id ?? undefined,
          class_name: selectedClass?.class_name ?? selectedStudent.class_name ?? "",
          subject_name: row.subject.subject_name,
          teacher_name: assignedTeacherName,
          academic_year: draft.academicYear.trim(),
          term: draft.term as BatchTerm,
          assessment_type: assessmentType,
          calculation_mode: draft.calculationMode,
          continuous_assessment: row.ca,
          maximum_score: row.maximum,
          examination: row.exam,
          total_score: row.total,
          grade: row.grade,
          remark: row.remark,
          status: "Draft",
        })));
        savedCount += inserts.length;
      }

      changeDraft((current) => {
        const entries = { ...current.entries };
        const savedEntries = { ...(entries[scopeKey] ?? {}) };
        rowsToSave.forEach(({ subject, entry }) => {
          if (entry.dirty) savedEntries[subject.id] = { ...entry, dirty: false };
        });
        entries[scopeKey] = savedEntries;
        return { ...current, entries };
      });
      await onSaved();
      window.dispatchEvent(new Event("grandessa:results-updated"));
      if (publishAfterSave && canPublish && onSaveAndPublish) {
        try {
          await onSaveAndPublish({
            studentId: selectedStudent.id, classId, academicYear: draft.academicYear.trim(),
            term: draft.term as BatchTerm, reportType: draft.reportType,
          });
          setMessage(`Saved and published ${selectedStudent.first_name} ${selectedStudent.last_name}'s ${draft.reportType === "Midterm" ? "midterm" : "end-of-term"} results. No parent messages were sent.`);
        } catch (publishError) {
          setError(`Saved ${savedCount} subject result(s), but publication did not complete: ${publishError instanceof Error ? publishError.message : "Unable to publish this pupil's results."}`);
        }
      } else {
        setMessage(`Saved ${savedCount} ${savedCount === 1 ? "subject draft" : "subject drafts"} for ${selectedStudent.first_name} ${selectedStudent.last_name}.`);
      }
    } catch (saveError) {
      const partialNote = savedCount > 0 ? ` ${savedCount} subject row(s) saved before the failure; retry only after refreshing the results.` : "";
      setError(`${saveError instanceof Error ? saveError.message : "Unable to save result drafts."}${partialNote}`);
      if (savedCount > 0) await onSaved();
    } finally {
      setSaving(false);
    }
  }

  function selectMode(mode: "Manual" | "Automatic"): void {
    if (mode === draft.calculationMode) return;
    if (mode === "Automatic" && subjects.some((subject) => {
      const entry = entryFor(subject.id);
      return Boolean(entry.totalScore || entry.grade || entry.remark);
    }) && !window.confirm("Automatic calculation will replace entered totals, grades and remarks where marks allow. Continue?")) {
      return;
    }
    changeDraft((current) => ({ ...current, calculationMode: mode }));
  }

  return (
    <section
      ref={entrySectionRef}
      style={{ display: "grid", gap: 16 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <label>Student
          <select
            value={draft.studentId}
            onChange={(event) => changeDraft((current) => ({ ...current, studentId: event.target.value }))}
            aria-label="Select student for subject results"
          >
            <option value="">Choose student</option>
            {visibleStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name} · {student.admission_number}
              </option>
            ))}
          </select>
        </label>
        <label>Class
          <input readOnly value={selectedClass?.class_name ?? selectedStudent?.class_name ?? ""} placeholder="Student class not assigned" />
        </label>
        <label>Assigned teacher
          <input readOnly value={assignedTeacherName} placeholder="No assigned teacher" />
        </label>
        <label>Session
          <input
            list="result-batch-sessions"
            value={draft.academicYear}
            onChange={(event) => changeDraft((current) => ({ ...current, academicYear: event.target.value }))}
            placeholder="e.g. 2025/2026"
          />
          <datalist id="result-batch-sessions">
            {academicYears.map((year) => <option key={year} value={year} />)}
          </datalist>
        </label>
        <label>Term
          <select value={draft.term} onChange={(event) => changeDraft((current) => ({ ...current, term: event.target.value as BatchTerm | "" }))}>
            <option value="">Choose term</option>
            <option value="First">First</option>
            <option value="Second">Second</option>
            <option value="Third">Third</option>
          </select>
        </label>
        <label>Report type
          <select value={draft.reportType} onChange={(event) => changeDraft((current) => ({ ...current, reportType: event.target.value as BatchReportType }))}>
            <option value="Midterm">Midterm</option>
            <option value="End-of-Term">End-of-Term</option>
          </select>
        </label>
        <label>Calculation mode
          <select value={draft.calculationMode} onChange={(event) => selectMode(event.target.value as "Manual" | "Automatic")}>
            <option value="Manual">Manual entry</option>
            <option value="Automatic">Automatic calculation</option>
          </select>
        </label>
      </div>

      <div role="status" style={{ color: draftStatus === "failed" ? "#991b1b" : "#475569" }}>
        {draftStatus === "loading" ? "Restoring saved entry…" : draftStatus === "saved" ? "Entry autosaved in this browser." : `Autosave failed: ${draftError}`}
      </div>
      {message ? <div role="status" style={{ color: "#166534" }}>{message}</div> : null}
      {error ? <div role="alert" style={{ color: "#991b1b" }}>{error}</div> : null}

      {selectedStudent && subjects.length > 0 ? (
        <div
          role="region"
          aria-label="Batch subject results; scroll horizontally to see all columns"
          tabIndex={0}
          style={{ minWidth: 0, overflowX: "scroll", overflowY: "hidden", scrollbarGutter: "stable", overscrollBehaviorX: "contain", paddingBottom: 8 }}
        >
          <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cellStyle}>Subject</th>
                {draft.reportType === "Midterm"
                  ? <><th style={cellStyle}>CA mark</th><th style={cellStyle}>Maximum</th></>
                  : <><th style={cellStyle}>CA /40</th><th style={cellStyle}>Exam /60</th><th style={cellStyle}>Total /100</th><th style={cellStyle}>Grade</th><th style={cellStyle}>Remark</th></>}
                <th style={cellStyle}>Current record</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => {
                const entry = entryFor(subject.id);
                const values = rowValues(subject.id, entry);
                const existing = values.matches[0];
                const publishedExisting = values.matches.some((match) => match.status === "Published");
                const disabled = saving || !draftLoaded || publishedExisting;
                return (
                  <tr key={subject.id}>
                    <td style={cellStyle}>{subject.subject_name}</td>
                    {draft.reportType === "Midterm" ? (
                      <>
                        <td style={cellStyle}>
                          <input
                            aria-label={`${subject.subject_name} midterm CA mark`}
                            type="number"
                            step="0.01"
                            value={entry.continuousAssessment}
                            onChange={(event) => updateEntry(subject.id, "continuousAssessment", event.target.value)}
                            disabled={disabled}
                          />
                          {values.errors.length > 0 ? <div role="alert" style={errorStyle}>{values.errors.join(" ")}</div> : null}
                        </td>
                        <td style={cellStyle}>
                          <input
                            aria-label={`${subject.subject_name} midterm maximum`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={entry.maximumScore}
                            onChange={(event) => updateEntry(subject.id, "maximumScore", event.target.value)}
                            disabled={disabled}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={cellStyle}>
                          <input
                            aria-label={`${subject.subject_name} CA mark`}
                            type="number"
                            min="0"
                            max="40"
                            step="0.01"
                            value={entry.continuousAssessment}
                            onChange={(event) => updateEntry(subject.id, "continuousAssessment", event.target.value)}
                            disabled={disabled}
                          />
                          {values.errors.some((item) => item.includes("CA")) ? <div role="alert" style={errorStyle}>{values.errors.filter((item) => item.includes("CA")).join(" ")}</div> : null}
                        </td>
                        <td style={cellStyle}>
                          <input
                            aria-label={`${subject.subject_name} examination mark`}
                            type="number"
                            min="0"
                            max="60"
                            step="0.01"
                            value={entry.examination}
                            onChange={(event) => updateEntry(subject.id, "examination", event.target.value)}
                            disabled={disabled}
                          />
                          {values.errors.some((item) => item.includes("Examination")) ? <div role="alert" style={errorStyle}>{values.errors.filter((item) => item.includes("Examination")).join(" ")}</div> : null}
                        </td>
                        <td style={cellStyle}>
                          <input
                            aria-label={`${subject.subject_name} total`}
                            type="number"
                            step="0.01"
                            value={draft.calculationMode === "Automatic" ? values.total ?? "" : entry.totalScore}
                            readOnly={draft.calculationMode === "Automatic"}
                            onChange={(event) => updateEntry(subject.id, "totalScore", event.target.value)}
                            disabled={disabled}
                          />
                        </td>
                        <td style={cellStyle}>
                          <select
                            aria-label={`${subject.subject_name} grade`}
                            value={draft.calculationMode === "Automatic" ? values.grade ?? "" : entry.grade}
                            disabled={disabled || draft.calculationMode === "Automatic"}
                            onChange={(event) => updateEntry(subject.id, "grade", event.target.value)}
                          >
                            <option value="">Select grade</option>
                            {grandessaGradingScale.map((band) => <option key={band.grade} value={band.grade}>{band.grade}</option>)}
                            {entry.grade && !grandessaGradingScale.some((band) => band.grade === entry.grade) ? <option value={entry.grade}>{entry.grade} (saved)</option> : null}
                          </select>
                        </td>
                        <td style={cellStyle}>
                          <select
                            aria-label={`${subject.subject_name} remark`}
                            value={draft.calculationMode === "Automatic" ? values.remark ?? "" : entry.remark}
                            disabled={disabled || draft.calculationMode === "Automatic"}
                            onChange={(event) => updateEntry(subject.id, "remark", event.target.value)}
                          >
                            <option value="">Select remark</option>
                            {grandessaGradingScale.map((band) => <option key={band.remark} value={band.remark}>{band.remark}</option>)}
                            {entry.remark && !grandessaGradingScale.some((band) => band.remark === entry.remark) ? <option value={entry.remark}>{entry.remark} (saved)</option> : null}
                          </select>
                        </td>
                      </>
                    )}
                    <td style={cellStyle}>
                      {values.matches.length > 1
                        ? <span role="alert" style={errorStyle}>Multiple matching records</span>
                        : existing
                          ? <button type="button" onClick={() => onEditExisting(existing)} disabled={existing.status === "Published"}>
                            {existing.status === "Published" ? "Existing Published · unpublish before editing" : `Existing ${existing.status}`}
                          </button>
                          : values.hasValue ? "New draft" : "Not entered"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Select a student with a class to enter all subject results.</p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        {canPublish && onSaveAndPublish ? (
          <Button type="button" onClick={() => void saveDrafts(true)} disabled={saving || !draftLoaded || !selectedStudent} style={{ background: "#047857", borderColor: "#047857", fontWeight: 900 }}>
            {saving ? "SAVING & PUBLISHING…" : "SAVE & PUBLISH"}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={() => void saveDrafts(false)} disabled={saving || !draftLoaded || !selectedStudent}>
          {saving ? "Saving…" : "Save Draft"}
        </Button>
      </div>
    </section>
  );
}

const cellStyle: CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  padding: 8,
  textAlign: "left",
  verticalAlign: "top",
};

const errorStyle: CSSProperties = {
  color: "#991b1b",
  fontSize: 12,
  marginTop: 4,
};
