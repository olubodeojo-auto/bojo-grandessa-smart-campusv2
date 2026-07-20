import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { createStudent, updateStudent } from "../../../services/studentService";
import type { Gender, Student, StudentStatus } from "../../../types/student";

type Props = {
  mode: "add" | "edit";
  student?: Student | null;
  onClose: () => void;
  onSaved?: () => void;
};

type StudentFormState = {
  admission_number: string;
  first_name: string;
  last_name: string;
  gender: Gender;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  date_of_birth: string;
  admission_date: string;
  status: StudentStatus;
};

function createInitialState(student?: Student | null): StudentFormState {
  return {
    admission_number: student?.admission_number ?? "",
    first_name: student?.first_name ?? "",
    last_name: student?.last_name ?? "",
    gender: student?.gender ?? "Male",
    class_name: student?.class_name ?? "",
    parent_name: student?.parent_name ?? "",
    parent_phone: student?.parent_phone ?? "",
    date_of_birth: student?.date_of_birth ?? "",
    admission_date: student?.admission_date ?? new Date().toISOString().slice(0, 10),
    status: student?.status ?? "Active",
  };
}

export default function StudentForm({ mode, student, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<StudentFormState>(() => createInitialState(student));

  useEffect(() => {
    setForm(createInitialState(student));
  }, [student]);

  function update<K extends keyof StudentFormState>(
    field: K,
    value: StudentFormState[K]
  ): void {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);

    try {
      const payload: Omit<Student, "id" | "created_at" | "updated_at"> = {
        school_id: "1829b784-8e94-4713-bbaf-2518b5e374be",
        admission_number: form.admission_number,
        first_name: form.first_name,
        last_name: form.last_name,
        middle_name: "",
        gender: form.gender,
        date_of_birth: form.date_of_birth,
        class_name: form.class_name,
        parent_name: form.parent_name,
        parent_phone: form.parent_phone,
        email: "",
        phone: "",
        address: "",
        passport_url: "",
        blood_group: "",
        genotype: "",
        allergies: "",
        medical_notes: "",
        admission_date: form.admission_date,
        status: form.status,
      };

      if (mode === "edit" && student?.id) {
        await updateStudent(student.id, payload);
      } else {
        await createStudent(payload);
      }

      onSaved?.();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save student. Please try again.";

      alert(message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  return (
    <form onSubmit={save}>
      <h2 style={{ marginBottom: 20 }}>
        {mode === "edit" ? "Edit Student" : "Student Admission"}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 16,
        }}
      >
        <input
          style={inputStyle}
          placeholder="Admission Number"
          value={form.admission_number}
          onChange={(event) => update("admission_number", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="First Name"
          value={form.first_name}
          onChange={(event) => update("first_name", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Last Name"
          value={form.last_name}
          onChange={(event) => update("last_name", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Class"
          value={form.class_name}
          onChange={(event) => update("class_name", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Parent Name"
          value={form.parent_name}
          onChange={(event) => update("parent_name", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Parent Phone"
          value={form.parent_phone}
          onChange={(event) => update("parent_phone", event.target.value)}
        />

        <select
          style={inputStyle}
          value={form.gender}
          onChange={(event) => update("gender", event.target.value as Gender)}
        >
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>

        <input
          style={inputStyle}
          type="date"
          value={form.date_of_birth}
          onChange={(event) => update("date_of_birth", event.target.value)}
        />

        <input
          style={inputStyle}
          type="date"
          value={form.admission_date}
          onChange={(event) => update("admission_date", event.target.value)}
        />

        <select
          style={inputStyle}
          value={form.status}
          onChange={(event) => update("status", event.target.value as StudentStatus)}
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Graduated">Graduated</option>
          <option value="Transferred">Transferred</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          marginTop: 24,
        }}
      >
        <button type="button" onClick={onClose}>
          Cancel
        </button>

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : mode === "edit" ? "Update Student" : "Save Student"}
        </button>
      </div>
    </form>
  );
}