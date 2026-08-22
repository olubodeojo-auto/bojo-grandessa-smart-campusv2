import { useMemo, useState, type FormEvent } from "react";
import Button from "../../../components/ui/Button";
import FormField, { inputStyle } from "../../../components/forms/FormField";
import { defaultAcademicCalendar } from "../../../config/grandessaCalendar";
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
  classes?: SchoolClass[];
  subjects?: Subject[];
  teachers?: Teacher[];
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

type ResultFormState = {
  student_id: string;
  class_name: string;
  subject_name: string;
  teacher_name: string;
  academic_year: string;
  term: "First" | "Second" | "Third";
  continuous_assessment: number;
  examination: number;
};

function createInitialState(
  result: Result | null | undefined,
  students: Student[],
  defaultAcademicYear: string
): ResultFormState {
  return {
    student_id: result?.student_id ?? students[0]?.id ?? "",
    class_name: result?.class_name ?? "",
    subject_name: result?.subject_name ?? "",
    teacher_name: result?.teacher_name ?? "",
    academic_year: result?.academic_year ?? defaultAcademicYear,
    term: result?.term ?? "First",
    continuous_assessment: result?.continuous_assessment ?? 0,
    examination: result?.examination ?? 0,
  };
}

function validateForm(form: ResultFormState): string[] {
  const messages: string[] = [];

  if (!form.student_id) messages.push("Student is required.");

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
  classes: _classes,
  subjects,
  teachers: _teachers,
  onClose,
  onSaved,
}: ResultFormProps) {
  const [form, setForm] = useState<ResultFormState>(() =>
    createInitialState(result, students, defaultAcademicCalendar.academicYear)
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  const selectedStudentOptions = useMemo(() => students, [students]);

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
        class_name: form.class_name.trim() || undefined,
        subject_name: form.subject_name.trim() || undefined,
        teacher_name: form.teacher_name.trim() || undefined,
        academic_year: form.academic_year.trim(),
        term: form.term,
        continuous_assessment: form.continuous_assessment,
        examination: form.examination,
        total_score: totalScore,
        grade,
        remark,
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

  const canSubmit = students.length > 0;

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <FormField label="Student">
          <select
            style={inputStyle}
            value={form.student_id}
            onChange={(event) => update("student_id", event.target.value)}
            aria-label="Select student"
          >
            {selectedStudentOptions.map((student) => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name} ({student.admission_number})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Class (optional)">
          {Array.isArray(_classes) && _classes.length > 0 ? (
            <select
              style={inputStyle}
              value={form.class_name}
              onChange={(event) => update("class_name", event.target.value)}
              aria-label="Select class"
            >
              <option value="">Select class</option>
              {_classes.map((c: any) => (
                <option key={c.id} value={c.class_name}>
                  {c.class_name}
                </option>
              ))}
            </select>
          ) : (
            <input
              style={inputStyle}
              value={form.class_name}
              onChange={(event) => update("class_name", event.target.value)}
              placeholder="e.g. Primary 5"
              aria-label="Class name"
            />
          )}
        </FormField>

        <FormField label="Subject (optional)">
          <select
            style={inputStyle}
            value={form.subject_name}
            onChange={(event) => update("subject_name", event.target.value)}
            aria-label="Select subject"
          >
            <option value="">Select subject</option>
            {Array.isArray(subjects) && subjects.map((subject) => (
              <option key={subject.id} value={subject.subject_name}>
                {subject.subject_name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Teacher (optional)">
          <input
            style={inputStyle}
            value={form.teacher_name}
            onChange={(event) => update("teacher_name", event.target.value)}
            placeholder="e.g. Mrs. Adebayo"
            aria-label="Teacher name"
          />
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
