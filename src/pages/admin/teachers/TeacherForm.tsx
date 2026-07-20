import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  createTeacher,
  updateTeacher,
} from "../../../services/teacherService";
import type {
  EmploymentType,
  Teacher,
  TeacherStatus,
} from "../../../types/teacher";

type Props = {
  mode: "add" | "edit";
  teacher?: Teacher | null;
  onClose: () => void;
  onSaved?: () => void;
};

type TeacherFormState = {
  employee_number: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  gender: "Male" | "Female";
  date_of_birth: string;
  email: string;
  phone: string;
  address: string;
  qualification: string;
  specialization: string;
  employment_type: EmploymentType;
  date_employed: string;
  status: TeacherStatus;
  passport_url: string;
};

function createInitialState(teacher?: Teacher | null): TeacherFormState {
  return {
    employee_number: teacher?.employee_number ?? "",
    first_name: teacher?.first_name ?? "",
    last_name: teacher?.last_name ?? "",
    middle_name: teacher?.middle_name ?? "",
    gender: teacher?.gender ?? "Male",
    date_of_birth: teacher?.date_of_birth ?? "",
    email: teacher?.email ?? "",
    phone: teacher?.phone ?? "",
    address: teacher?.address ?? "",
    qualification: teacher?.qualification ?? "",
    specialization: teacher?.specialization ?? "",
    employment_type: teacher?.employment_type ?? "Full Time",
    date_employed: teacher?.date_employed ?? new Date().toISOString().slice(0, 10),
    status: teacher?.status ?? "Active",
    passport_url: teacher?.passport_url ?? "",
  };
}

export default function TeacherForm({ mode, teacher, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<TeacherFormState>(() => createInitialState(teacher));

  useEffect(() => {
    setForm(createInitialState(teacher));
  }, [teacher]);

  function update<K extends keyof TeacherFormState>(field: K, value: TeacherFormState[K]): void {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);

    try {
      const payload: Omit<Teacher, "id" | "created_at" | "updated_at"> = {
        employee_number: form.employee_number,
        first_name: form.first_name,
        last_name: form.last_name,
        middle_name: form.middle_name,
        gender: form.gender,
        date_of_birth: form.date_of_birth,
        email: form.email,
        phone: form.phone,
        address: form.address,
        qualification: form.qualification,
        specialization: form.specialization,
        employment_type: form.employment_type,
        date_employed: form.date_employed,
        passport_url: form.passport_url,
        status: form.status,
      };

      if (mode === "edit" && teacher?.id) {
        await updateTeacher(teacher.id, payload);
      } else {
        await createTeacher(payload);
      }

      onSaved?.();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save teacher. Please try again.";

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
        {mode === "edit" ? "Edit Teacher" : "Teacher Profile"}
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
          placeholder="Employee Number"
          value={form.employee_number}
          onChange={(event) => update("employee_number", event.target.value)}
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
          placeholder="Middle Name"
          value={form.middle_name}
          onChange={(event) => update("middle_name", event.target.value)}
        />

        <select
          style={inputStyle}
          value={form.gender}
          onChange={(event) => update("gender", event.target.value as "Male" | "Female")}
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
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Phone"
          value={form.phone}
          onChange={(event) => update("phone", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Qualification"
          value={form.qualification}
          onChange={(event) => update("qualification", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Specialization"
          value={form.specialization}
          onChange={(event) => update("specialization", event.target.value)}
        />

        <select
          style={inputStyle}
          value={form.employment_type}
          onChange={(event) => update("employment_type", event.target.value as EmploymentType)}
        >
          <option value="Full Time">Full Time</option>
          <option value="Part Time">Part Time</option>
          <option value="Contract">Contract</option>
        </select>

        <input
          style={inputStyle}
          type="date"
          value={form.date_employed}
          onChange={(event) => update("date_employed", event.target.value)}
        />

        <select
          style={inputStyle}
          value={form.status}
          onChange={(event) => update("status", event.target.value as TeacherStatus)}
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="On Leave">On Leave</option>
          <option value="Retired">Retired</option>
        </select>

        <input
          style={inputStyle}
          placeholder="Passport URL"
          value={form.passport_url}
          onChange={(event) => update("passport_url", event.target.value)}
        />

        <textarea
          style={{ ...inputStyle, minHeight: 96, resize: "vertical" }}
          placeholder="Address"
          value={form.address}
          onChange={(event) => update("address", event.target.value)}
        />
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
          {loading ? "Saving..." : mode === "edit" ? "Update Teacher" : "Save Teacher"}
        </button>
      </div>
    </form>
  );
}
