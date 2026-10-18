import { useMemo, useState, type FormEvent } from "react";
import Button from "../../../components/ui/Button";
import FormField, { inputStyle } from "../../../components/forms/FormField";
import { defaultAcademicCalendar } from "../../../config/grandessaCalendar";
import { grandessaGradingScale } from "../../../config/grandessaGrading";
import { useAuth } from "../../../hooks/useAuth";
import { createResult, updateResult } from "../../../services/resultService";
import type { SchoolClass } from "../../../types/class";
import type { Result, ResultAssessmentType } from "../../../types/result";
import type { Student } from "../../../types/student";
import type { Subject } from "../../../types/subject";
import { calculateResult, transitionAssessmentType, validateAssessmentMarks } from "../../../utils/resultCalculations";
import type { ResultAssignment } from "../../../utils/resultPermissions";
import { formatScoreInput, parseScoreInput } from "../../../utils/scoreInput";

type ResultFormProps = {
  mode: "add" | "edit";
  result?: Result | null;
  students: Student[];
  classes?: SchoolClass[];
  subjects?: Subject[];
  allowedAssignments?: ResultAssignment[];
  academicYears?: string[];
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

type ResultFormState = {
  calculationMode: "Manual" | "Automatic";
  student_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  class_name: string;
  subject_name: string;
  teacher_name: string;
  academic_year: string;
  term: "First" | "Second" | "Third";
  assessment_type: ResultAssessmentType;
  continuous_assessment: number | null;
  maximum_score: number | null;
  examination: number | null;
  total_score: number | null;
  grade: string;
  remark: string;
};

type ResultScoreField = "continuous_assessment" | "maximum_score" | "examination" | "total_score";
type ResultScoreInputs = Record<ResultScoreField, string>;

function scoreInputsFromForm(form: ResultFormState): ResultScoreInputs {
  return {
    continuous_assessment: formatScoreInput(form.continuous_assessment),
    maximum_score: formatScoreInput(form.maximum_score),
    examination: formatScoreInput(form.examination),
    total_score: formatScoreInput(form.total_score),
  };
}

function createInitialState(
  result: Result | null | undefined,
  students: Student[],
  classes: SchoolClass[] | undefined,
  defaultAcademicYear: string,
): ResultFormState {
  const student = students.find((candidate) => candidate.id === result?.student_id)
    ?? students[0];
  const classId = result?.class_id ?? student?.class_id ?? "";
  const schoolClass = classes?.find((candidate) => candidate.id === classId);
  const assignedTeacherName = schoolClass?.class_teacher
    ? [schoolClass.class_teacher.first_name, schoolClass.class_teacher.last_name].filter(Boolean).join(" ")
    : student?.class_teacher_name
      || [student?.class_teacher?.first_name, student?.class_teacher?.last_name].filter(Boolean).join(" ");
  return {
    calculationMode: result?.calculation_mode ?? "Manual",
    student_id: result?.student_id ?? student?.id ?? "",
    class_id: classId,
    subject_id: result?.subject_id ?? "",
    teacher_id: result?.teacher_id ?? "",
    class_name: result?.class_name ?? schoolClass?.class_name ?? student?.class_name ?? "",
    subject_name: result?.subject_name ?? "",
    teacher_name: result?.teacher_name ?? assignedTeacherName ?? "",
    academic_year: result?.academic_year ?? defaultAcademicYear,
    term: result?.term ?? "First",
    assessment_type: result?.assessment_type ?? "CA",
    continuous_assessment: result?.continuous_assessment ?? null,
    maximum_score: result?.maximum_score ?? null,
    examination: result?.examination ?? null,
    total_score: result?.total_score ?? null,
    grade: result?.grade ?? "",
    remark: result?.remark ?? "",
  };
}

function validateForm(form: ResultFormState): string[] {
  const messages: string[] = [];

  if (!form.student_id) messages.push("Student is required.");
  if (!form.class_id) messages.push("Class is required.");
  if (!form.subject_id) messages.push("Subject is required.");

  if (!form.academic_year.trim()) {
    messages.push("Session is required.");
  }

  messages.push(...validateAssessmentMarks(form));
  return [...new Set(messages)];
}

export default function ResultForm({
  mode,
  result,
  students,
  classes,
  subjects,
  allowedAssignments,
  academicYears = [],
  onClose,
  onSaved,
}: ResultFormProps) {
  const { user, roles } = useAuth();
  const [form, setForm] = useState<ResultFormState>(() =>
    createInitialState(result, students, classes, defaultAcademicCalendar.academicYear)
  );
  const [scoreInputs, setScoreInputs] = useState<ResultScoreInputs>(() =>
    scoreInputsFromForm(createInitialState(result, students, classes, defaultAcademicCalendar.academicYear))
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const isTeacher = roles.some((role) => role.name.trim().toLowerCase() === "teacher");

  const selectedStudentOptions = useMemo(() => students, [students]);
  const selectedStudent = selectedStudentOptions.find((student) => student.id === form.student_id);
  const selectedClass = classes?.find((schoolClass) => schoolClass.id === form.class_id);
  const assignedTeacherName = selectedClass?.class_teacher
    ? [selectedClass.class_teacher.first_name, selectedClass.class_teacher.last_name].filter(Boolean).join(" ")
    : selectedStudent?.class_teacher_name
      || [selectedStudent?.class_teacher?.first_name, selectedStudent?.class_teacher?.last_name].filter(Boolean).join(" ");
  const availableClasses = useMemo(() => {
    if (!allowedAssignments) return classes ?? [];
    const permittedClassIds = new Set(allowedAssignments.map((assignment) => assignment.class_id));
    return (classes ?? []).filter((schoolClass) => permittedClassIds.has(schoolClass.id));
  }, [allowedAssignments, classes]);
  const availableSubjects = useMemo(() => {
    return subjects ?? [];
  }, [subjects]);

  const calculated = useMemo(
    () => calculateResult(form.assessment_type, form.continuous_assessment, form.examination),
    [form.assessment_type, form.continuous_assessment, form.examination]
  );
  function update<K extends keyof ResultFormState>(key: K, value: ResultFormState[K]): void {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function updateScoreInput(key: ResultScoreField, text: string): void {
    const parsed = parseScoreInput(text);
    setScoreInputs((previous) => ({ ...previous, [key]: text }));
    update(key, parsed.value);
  }

  function getScoreInputErrors(): string[] {
    const labels: Record<ResultScoreField, string> = {
      continuous_assessment: "Continuous assessment score",
      maximum_score: "Maximum score",
      examination: "Examination score",
      total_score: "Entered total",
    };
    return (Object.entries(scoreInputs) as Array<[ResultScoreField, string]>)
      .filter(([, text]) => !parseScoreInput(text).valid)
      .map(([field]) => `${labels[field]} must be a valid number.`);
  }

  const academicYearOptions = useMemo(
    () => [...new Set([defaultAcademicCalendar.academicYear, ...academicYears, form.academic_year].filter(Boolean))]
      .sort((left, right) => right.localeCompare(left)),
    [academicYears, form.academic_year],
  );

  function updateAssessmentType(assessmentType: ResultAssessmentType): void {
    const next = { ...form, ...transitionAssessmentType(form, assessmentType) };
    setForm(next);
    setScoreInputs(scoreInputsFromForm(next));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const messages = [...getScoreInputErrors(), ...validateForm(form)];
    setValidationMessages(messages);

    if (messages.length > 0) {
      return;
    }
    if (allowedAssignments && !allowedAssignments.some(
      (assignment) => assignment.class_id === form.class_id,
    )) {
      setValidationMessages(["You are not assigned to this class and subject."]);
      return;
    }
    const selectedStudent = students.find((student) => student.id === form.student_id);
    if (selectedStudent?.class_id && selectedStudent.class_id !== form.class_id) {
      setValidationMessages(["Selected student does not belong to the selected class."]);
      return;
    }

    setSubmitting(true);

    try {
      const calculatedValues = form.calculationMode === "Automatic"
        ? calculateResult(form.assessment_type, form.continuous_assessment, form.examination)
        : null;
      const payload = {
        student_id: form.student_id,
        class_id: form.class_id,
        subject_id: form.subject_id,
        teacher_id: form.teacher_id || selectedClass?.class_teacher_id || (isTeacher ? user?.id : undefined),
        class_name: form.class_name.trim() || selectedClass?.class_name || undefined,
        subject_name: form.subject_name.trim() || undefined,
        teacher_name: form.teacher_name.trim() || assignedTeacherName || undefined,
        academic_year: form.academic_year.trim(),
        term: form.term,
        assessment_type: form.assessment_type,
        calculation_mode: form.calculationMode,
        continuous_assessment: form.assessment_type === "Examination" ? null : form.continuous_assessment,
        maximum_score: form.assessment_type === "CA" ? form.maximum_score : null,
        examination: form.assessment_type === "CA" ? null : form.examination,
        total_score: form.assessment_type === "CA"
          ? null
          : calculatedValues ? calculatedValues.total : form.total_score,
        grade: form.assessment_type === "CA"
          ? null
          : calculatedValues ? calculatedValues.grade : form.grade.trim() || null,
        remark: form.assessment_type === "CA"
          ? null
          : calculatedValues ? calculatedValues.remark : form.remark.trim() || null,
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

  const canSubmit = students.length > 0 && Boolean(classes?.length) && Boolean(subjects?.length);
  const teacherEditingExisting = mode === "edit" && Boolean(allowedAssignments);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <FormField label="Student">
          <select
            style={inputStyle}
            value={form.student_id}
            onChange={(event) => {
              const studentId = event.target.value;
              const selected = students.find((student) => student.id === studentId);
              update("student_id", studentId);
              update("class_id", selected?.class_id ?? "");
              const studentClass = classes?.find((schoolClass) => schoolClass.id === selected?.class_id);
              update("class_name", studentClass?.class_name ?? selected?.class_name ?? "");
              update("teacher_id", studentClass?.class_teacher_id ?? "");
              const assignedName = studentClass?.class_teacher
                ? [studentClass.class_teacher.first_name, studentClass.class_teacher.last_name].filter(Boolean).join(" ")
                : selected?.class_teacher_name
                  || [selected?.class_teacher?.first_name, selected?.class_teacher?.last_name].filter(Boolean).join(" ");
              update("teacher_name", assignedName ?? "");
              if (allowedAssignments && selected?.class_id && !allowedAssignments.some(
                (assignment) => assignment.class_id === selected.class_id,
              )) update("subject_id", "");
            }}
            aria-label="Select student"
            disabled={teacherEditingExisting}
          >
            {selectedStudentOptions.map((student) => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name} ({student.admission_number})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Class">
          {Array.isArray(classes) && classes.length > 0 ? (
            <select
              style={inputStyle}
              value={form.class_id}
              onChange={(event) => {
                const classId = event.target.value;
                const selected = classes.find((schoolClass) => schoolClass.id === classId);
                update("class_id", classId);
                update("class_name", selected?.class_name ?? "");
                update("teacher_id", selected?.class_teacher_id ?? "");
                const assignedName = selected?.class_teacher
                  ? [selected.class_teacher.first_name, selected.class_teacher.last_name].filter(Boolean).join(" ")
                  : "";
                update("teacher_name", assignedName);
                if (allowedAssignments && !allowedAssignments.some(
                  (assignment) => assignment.class_id === classId,
                )) update("subject_id", "");
              }}
              aria-label="Select class"
              disabled={teacherEditingExisting}
            >
              <option value="">Select class</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
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
              disabled={teacherEditingExisting}
            />
          )}
        </FormField>

        <FormField label="Subject">
          <select
            style={inputStyle}
            value={form.subject_id}
            onChange={(event) => {
              const subjectId = event.target.value;
              const selected = subjects?.find((subject) => subject.id === subjectId);
              update("subject_id", subjectId);
              update("subject_name", selected?.subject_name ?? "");
            }}
            aria-label="Select subject"
            disabled={teacherEditingExisting}
          >
            <option value="">Select subject</option>
            {availableSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.subject_name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Teacher display name" hint="Optional">
          <input
            style={inputStyle}
            value={form.teacher_name}
            onChange={(event) => update("teacher_name", event.target.value)}
            aria-label="Teacher display name"
            disabled={teacherEditingExisting}
          />
          {assignedTeacherName ? <small style={{ color: "#475569" }}>Assigned teacher: {assignedTeacherName}</small> : null}
        </FormField>

        <FormField label="Academic session">
          <select
            style={inputStyle}
            value={form.academic_year}
            onChange={(event) => update("academic_year", event.target.value)}
            aria-label="Academic session"
            disabled={teacherEditingExisting}
          >
            {academicYearOptions.map((academicYear) => (
              <option key={academicYear} value={academicYear}>{academicYear}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Term">
          <select
            style={inputStyle}
            value={form.term}
            onChange={(event) => update("term", event.target.value as "First" | "Second" | "Third")}
            aria-label="Term"
            disabled={teacherEditingExisting}
          >
            <option value="First">First</option>
            <option value="Second">Second</option>
            <option value="Third">Third</option>
          </select>
        </FormField>

        <FormField label="Assessment Type">
          <select
            style={inputStyle}
            value={form.assessment_type === "CA" ? "CA" : "Combined"}
            onChange={(event) => updateAssessmentType(event.target.value as "CA" | "Combined")}
            aria-label="Assessment type"
          >
            <option value="CA">Midterm</option>
            <option value="Combined">End-of-Term</option>
          </select>
        </FormField>

        <FormField label="Calculation mode">
          <select
            style={inputStyle}
            value={form.calculationMode}
            onChange={(event) => {
              const nextMode = event.target.value as "Manual" | "Automatic";
              if (nextMode === "Automatic"
                && (form.total_score !== null || form.grade || form.remark)
                && !window.confirm("Automatic calculation will replace the entered total, grade and remark where marks allow. Continue?")) return;
              setForm((previous) => ({ ...previous, calculationMode: nextMode }));
            }}
            aria-label="Calculation mode"
          >
            <option value="Manual">Manual entry (recommended)</option>
            <option value="Automatic">Automatic calculation</option>
          </select>
        </FormField>

        {form.assessment_type !== "Examination" ? <FormField label="Continuous Assessment (CA)" hint="Partial marks are allowed; leave blank if not recorded">
          <input
            style={inputStyle}
            type="text"
            inputMode="decimal"
            value={scoreInputs.continuous_assessment}
            onChange={(event) => updateScoreInput("continuous_assessment", event.target.value)}
            aria-label="Continuous assessment score"
          />
        </FormField> : null}

        {form.assessment_type === "CA" ? (
          <FormField label="Maximum score" hint="Optional; leave blank when the midterm maximum is not set">
            <input
              style={inputStyle}
              type="text"
              inputMode="decimal"
              value={scoreInputs.maximum_score}
              onChange={(event) => updateScoreInput("maximum_score", event.target.value)}
              aria-label="Midterm maximum score"
            />
          </FormField>
        ) : null}

        {form.assessment_type !== "CA" ? <FormField label="Examination" hint="Leave blank if not recorded">
          <input
            style={inputStyle}
            type="text"
            inputMode="decimal"
            value={scoreInputs.examination}
            onChange={(event) => updateScoreInput("examination", event.target.value)}
            aria-label="Examination score"
          />
        </FormField> : null}

        {form.assessment_type === "CA" ? (
          <p style={{ margin: 0, color: "#475569", fontSize: 13, gridColumn: "1 / -1" }}>
            CA entries are saved separately as drafts. Final totals, grades, and report-card remarks are not produced from CA marks.
          </p>
        ) : form.calculationMode === "Automatic" && form.assessment_type === "Combined" ? (
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <div><strong>Final total:</strong> {calculated.total ?? ""}</div>
            <div><strong>Final grade:</strong> {calculated.grade ?? ""}</div>
            <div><strong>Final remark:</strong> {calculated.remark ?? ""}</div>
          </div>
        ) : (
          <>
            {form.assessment_type === "Combined" ? (
              <FormField label="Entered Total">
                <input
                  style={inputStyle}
                  type="text"
                  inputMode="decimal"
                  value={scoreInputs.total_score}
                  readOnly={form.calculationMode === "Automatic"}
                  onChange={(event) => updateScoreInput("total_score", event.target.value)}
                  aria-label="Entered total score"
                />
              </FormField>
            ) : (
            <FormField label="Entered Total" hint="Standalone examination entries are not used for final report-card calculations">
              <input
                style={inputStyle}
                type="text"
                inputMode="decimal"
                value={scoreInputs.total_score}
                onChange={(event) => updateScoreInput("total_score", event.target.value)}
                aria-label="Entered total score"
              />
            </FormField>
            )}
                <FormField label="Entered Grade" hint="Choose from the configured grading scale">
                  <select style={inputStyle} value={form.grade} disabled={form.calculationMode === "Automatic"} onChange={(event) => update("grade", event.target.value)} aria-label="Entered grade">
                    <option value="">Select grade</option>
                    {grandessaGradingScale.map((band) => <option key={band.grade} value={band.grade}>{band.grade}</option>)}
                    {form.grade && !grandessaGradingScale.some((band) => band.grade === form.grade) ? <option value={form.grade}>{form.grade} (saved)</option> : null}
                  </select>
                </FormField>
                <FormField label="Entered Remark" hint="Choose from the configured remarks" fullWidth>
                  <select style={inputStyle} value={form.remark} disabled={form.calculationMode === "Automatic"} onChange={(event) => update("remark", event.target.value)} aria-label="Entered remark">
                    <option value="">Select remark</option>
                    {grandessaGradingScale.map((band) => <option key={band.remark} value={band.remark}>{band.remark}</option>)}
                    {form.remark && !grandessaGradingScale.some((band) => band.remark === form.remark) ? <option value={form.remark}>{form.remark} (saved)</option> : null}
                  </select>
                </FormField>
          </>
        )}
      </div>

      <p style={{ margin: "14px 0 0", color: "#475569", fontSize: 13 }}>
        Results save as drafts. Missing assessment components may remain blank.
      </p>
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
          Results entry needs students, classes, and subjects records to exist.
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setValidationMessages([...getScoreInputErrors(), ...validateForm(form)])}
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
