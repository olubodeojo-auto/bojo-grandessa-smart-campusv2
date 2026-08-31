/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { createClass, updateClass } from "../../../services/classService";
import { getActiveTeacherUsers, type StaffUser } from "../../../services/staffService";
import type { ClassStatus, SchoolClass } from "../../../types/class";

type Props = {
  mode: "add" | "edit";
  schoolClass?: SchoolClass | null;
  onClose: () => void;
  onSaved?: () => void;
};

type ClassFormState = {
  id: string | null;
  class_name: string;
  class_teacher_id: string | null;
  status: ClassStatus;
};

function createInitialState(schoolClass?: SchoolClass | null): ClassFormState {
  return {
    id: schoolClass?.id ?? null,
    class_name: schoolClass?.class_name ?? "",
    class_teacher_id: schoolClass?.class_teacher_id ?? null,
    status: schoolClass?.status ?? "Active",
  };
}

export default function ClassForm({ mode, schoolClass, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ClassFormState>(() => createInitialState(schoolClass));
  const [teachers, setTeachers] = useState<StaffUser[]>([]);

  useEffect(() => {
    setForm(createInitialState(schoolClass));
  }, [schoolClass]);

  useEffect(() => {
    void getActiveTeacherUsers().then(setTeachers).catch(() => setTeachers([]));
  }, []);

  function update<K extends keyof ClassFormState>(field: K, value: ClassFormState[K]): void {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedClassName = form.class_name.trim();
    if (!trimmedClassName) {
      alert("Class name is required.");
      return;
    }

    const classId = (schoolClass?.id ?? form.id ?? null);
    const normalizedTeacherId = form.class_teacher_id && form.class_teacher_id.trim().length > 0
      ? form.class_teacher_id.trim()
      : null;

    setLoading(true);

    try {
      if (mode === "edit") {
        if (!classId) {
          throw new Error("The selected class id was not found. Please reopen the record and try again.");
        }

        await updateClass({
          id: classId,
          class_name: trimmedClassName,
          class_teacher_id: normalizedTeacherId,
          status: form.status,
        });
      } else {
        await createClass({
          class_name: trimmedClassName,
          class_teacher_id: normalizedTeacherId,
          status: form.status,
        });
      }

      onSaved?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save class.";
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
      <h2 id="class-form-title" style={{ marginBottom: 20 }}>{mode === "edit" ? "Edit Class" : "Create Class"}</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Class Name</span>
          <input
            style={inputStyle}
            placeholder="Class Name (e.g. Kindergarten 2)"
            value={form.class_name}
            onChange={(event) => update("class_name", event.target.value)}
            aria-label="Class name"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Class Teacher</span>
          <select
            style={inputStyle}
            value={form.class_teacher_id ?? ""}
            onChange={(event) => update("class_teacher_id", event.target.value === "" ? null : event.target.value)}
            aria-label="Class teacher"
          >
            <option value="">Not Assigned / No teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {[teacher.first_name, teacher.last_name].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Status</span>
          <select
            style={inputStyle}
            value={form.status}
            onChange={(event) => update("status", event.target.value as ClassStatus)}
            aria-label="Class status"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
        <button type="button" onClick={onClose}>
          Cancel
        </button>

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Class"}
        </button>
      </div>
    </form>
  );
}