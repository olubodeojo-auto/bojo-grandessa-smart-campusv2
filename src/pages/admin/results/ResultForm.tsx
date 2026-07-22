import { useMemo, useState, type FormEvent } from "react";
import Button from "../../../components/ui/Button";
import FormField, { inputStyle } from "../../../components/forms/FormField";
import { defaultAcademicCalendar } from "../../../config/grandessaCalendar";
import { useAuth } from "../../../hooks/useAuth";
import { createResult, updateResult } from "../../../services/resultService";
import type { SchoolClass } from "../../../types/class";
import type { Result } from "../../../types/result";
import type { Student } from "../../../types/student";
import type { Subject } from "../../../types/subject";
import type { Teacher } from "../../../types/teacher";
import { computeTotal, gradeFromTotal, remarkFromGrade } from "../../../utils/resultCalculations";

type ResultFormProps = {
  mode: "add" | "edit";
  result?: Result | null;
  students: Student[];
  classes: SchoolClass[];
  subjects: Subject[];
  teachers: Teacher[];
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

type ResultFormState = {
  student_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  academic_year: string;
  term: "First" | "Second" | "Third";
  continuous_assessment: number;
  examination: number;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function resolvePreferredTeacherId(teachers: Teacher[], fullName: string): string {
  const match = teachers.find((teacher) => normalize(`${teacher.first_name} ${teacher.last_name}`) === normalize(fullName));
  return match?.id ?? teachers[0]?.id ?? "";
}

function createInitialState(
  result: Result | null | undefined,
  students: Student[],
  classes: SchoolClass[],
  subjects: Subject[],
  preferredTeacherId: string,
  defaultAcademicYear: string
): ResultFormState {
  return {
    student_id: result?.student_id ?? students[0]?.id ?? "",
    class_id: result?.class_id ?? classes[0]?.id ?? "",
    subject_id: result?.subject_id ?? subjects[0]?.id ?? "",
    teacher_id: result?.teacher_id ?? preferredTeacherId,
    academic_year: result?.academic_year ?? defaultAcademicYear,
    term: result?.term ?? "First",
    continuous_assessment: result?.continuous_assessment ?? 0,
    examination: result?.examination ?? 0,
  };
}

function validateForm(form: ResultFormState): string[] {
  const messages: string[] = [];

  if (!form.student_id) messages.push("Student is required.");
  if (!form.class_id) messages.push("Class is required.");
  if (!form.subject_id) messages.push("Subject is required.");
  if (!form.teacher_id) messages.push("Teacher is required.");

  if (!form.academic_year.trim()) {
    messages.push("Session is required.");
  }

  if (form.continuous_assessment < 0 || form.continuous_assessment > 40) {
    messages.push("Continuous assessment must be between 0 and 40.");
  }

  if (form.examination < 0 || form.examination > 60) {
    messages.push("Examination score must be between 0 and 60.");
  }

  const total = computeTotal(form.continuous_assessment, form.examination);

  if (total < 0 || total > 100) {
    messages.push("Total score must be between 0 and 100.");
  }

  return messages;
}

export default function ResultForm({
  mode,
  result,
  students,
  classes,
  subjects,
  teachers,
  onClose,
  onSaved,
}: ResultFormProps) {
  const { fullName } = useAuth();
  const preferredTeacherId = resolvePreferredTeacherId(teachers, fullName);
  const [form, setForm] = useState<ResultFormState>(() =>
    createInitialState(result, students, classes, subjects, preferredTeacherId, defaultAcademicCalendar.academicYear)
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  const selectedClass = classes.find((schoolClass) => schoolClass.id === form.class_id) ?? null;
  const filteredStudents = useMemo(() => {
    if (!selectedClass) {
      return students;
    }

    return students.filter((student) => normalize(student.class_name ?? "") === normalize(selectedClass.class_name));
  }, [selectedClass, students]);

  const totalScore = useMemo(
    () => computeTotal(form.continuous_assessment, form.examination),
    [form.continuous_assessment, form.examination]
  );

  const grade = useMemo(() => gradeFromTotal(totalScore), [totalScore]);
  const remark = useMemo(() => remarkFromGrade(grade), [grade]);

  function update<K extends keyof ResultFormState>(key: K, value: ResultFormState[K]): void {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const messages = validateForm(form);
    setValidationMessages(messages);

    if (messages.length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        student_id: form.student_id,
        class_id: form.class_id,
        subject_id: form.subject_id,
        academic_year: form.academic_year.trim(),
        term: form.term,
        continuous_assessment: form.continuous_assessment,
        examination: form.examination,
        total_score: totalScore,
        grade,
        remark,
        teacher_id: form.teacher_id,
        status: mode === "edit" ? result?.status ?? "Draft" : "Draft",
      };

      if (mode === "edit" && result?.id) {
        await updateResult(result.id, payload);
      } else {
        await createResult(payload);
      }

      await onSaved?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save result.";
      setValidationMessages([message]);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = students.length > 0 && classes.length > 0 && subjects.length > 0 && teachers.length > 0;

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <FormField label="Class">
          <select
            style={inputStyle}
            value={form.class_id}
            onChange={(event) => {
              const nextClassId = event.target.value;
              const nextClass = classes.find((schoolClass) => schoolClass.id === nextClassId) ?? null;
              const nextStudent = students.find((student) => normalize(student.class_name ?? "") === normalize(nextClass?.class_name ?? ""));

              setForm((previous) => ({
                ...previous,
                class_id: nextClassId,
                student_id: nextStudent?.id ?? previous.student_id,
              }));
            }}
            aria-label="Select class"
          >
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.class_name}
                {schoolClass.section ? ` - ${schoolClass.section}` : ""}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Student">
          <select
            style={inputStyle}
            value={form.student_id}
            onChange={(event) => update("student_id", event.target.value)}
            aria-label="Select student"
          >
            {filteredStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name} ({student.admission_number})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Subject">
          <select
            style={inputStyle}
            value={form.subject_id}
            onChange={(event) => update("subject_id", event.target.value)}
            aria-label="Select subject"
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.subject_name} ({subject.subject_code})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Session" hint="Academic year">
          <input
            style={inputStyle}
            value={form.academic_year}
            onChange={(event) => update("academic_year", event.target.value)}
            placeholder="e.g. 2026/2027"
            aria-label="Session"
          />
        </FormField>

        <FormField label="Term">
          <select
            style={inputStyle}
            value={form.term}
            onChange={(event) => update("term", event.target.value as "First" | "Second" | "Third")}
            aria-label="Term"
          >
            <option value="First">First</option>
            <option value="Second">Second</option>
            <option value="Third">Third</option>
          </select>
        </FormField>

        <FormField label="Continuous Assessment" hint="0 - 40">
          <input
            style={inputStyle}
            type="number"
            min={0}
            max={40}
            step="0.01"
            value={form.continuous_assessment}
            onChange={(event) => update("continuous_assessment", Number(event.target.value))}
            aria-label="Continuous assessment score"
          />
        </FormField>

        <FormField label="Examination" hint="0 - 60">
          <input
            style={inputStyle}
            type="number"
            min={0}
            max={60}
            step="0.01"
            value={form.examination}
            onChange={(event) => update("examination", Number(event.target.value))}
            aria-label="Examination score"
          />
        </FormField>

        <FormField label="Total Score">
          <input style={{ ...inputStyle, background: "#f8fafc" }} value={totalScore} readOnly aria-label="Total score" />
        </FormField>

        <FormField label="Grade">
          <input style={{ ...inputStyle, background: "#f8fafc" }} value={grade} readOnly aria-label="Grade" />
        </FormField>

        <FormField label="Remark" fullWidth>
          <input style={{ ...inputStyle, background: "#f8fafc" }} value={remark} readOnly aria-label="Remark" />
        </FormField>
      </div>

      {validationMessages.length > 0 ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 14,
          }}
        >
          {validationMessages.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      ) : null}

      {!canSubmit ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 14,
          }}
        >
          Results entry needs students, classes, subjects, and teachers records to exist.
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setValidationMessages(validateForm(form))}
          disabled={submitting}
        >
          Validate
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Result"}
        </Button>
      </div>
    </form>
  );
}
