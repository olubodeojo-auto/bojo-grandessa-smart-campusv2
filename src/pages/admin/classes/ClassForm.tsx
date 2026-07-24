/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { createClass, updateClass } from "../../../services/classService";
import type { ClassStatus, SchoolClass } from "../../../types/class";

const MAX_CAPACITY = 100;

type Props = {
  mode: "add" | "edit";
  schoolClass?: SchoolClass | null;
  onClose: () => void;
  onSaved?: () => void;
};

type ClassFormState = {
  class_name: string;
  section: string;
  capacity: number;
  class_teacher: string;
  status: ClassStatus;
};

function createInitialState(schoolClass?: SchoolClass | null): ClassFormState {
  return {
    class_name: schoolClass?.class_name ?? "",
    section: schoolClass?.section ?? "",
    capacity: schoolClass?.capacity ?? 30,
    class_teacher: schoolClass?.class_teacher ?? "",
    status: schoolClass?.status ?? "Active",
  };
}

export default function ClassForm({ mode, schoolClass, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ClassFormState>(() => createInitialState(schoolClass));

  useEffect(() => {
    setForm(createInitialState(schoolClass));
  }, [schoolClass]);

  function update<K extends keyof ClassFormState>(field: K, value: ClassFormState[K]): void {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!form.class_name.trim()) {
      alert("Class name is required.");
      return;
    }

    if (form.capacity <= 0) {
      alert("Capacity must be greater than zero.");
      return;
    }

    if (form.capacity > MAX_CAPACITY) {
      alert(`Capacity cannot exceed ${MAX_CAPACITY}.`);
      return;
    }

    setLoading(true);

    try {
      if (mode === "edit" && schoolClass?.id) {
        await updateClass({
          id: schoolClass.id,
          class_name: form.class_name,
          section: form.section,
          capacity: form.capacity,
          class_teacher: form.class_teacher,
          status: form.status,
        });
      } else {
        await createClass({
          class_name: form.class_name,
          section: form.section,
          capacity: form.capacity,
          class_teacher: form.class_teacher,
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
            placeholder="Class Name (e.g. JSS1)"
            value={form.class_name}
            onChange={(event) => update("class_name", event.target.value)}
            aria-label="Class name"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Section</span>
          <input
            style={inputStyle}
            placeholder="Section (A, B, Science...)"
            value={form.section}
            onChange={(event) => update("section", event.target.value)}
            aria-label="Class section"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Capacity</span>
          <input
            style={inputStyle}
            type="number"
            min="1"
            max={MAX_CAPACITY}
            placeholder="Capacity"
            value={form.capacity}
            onChange={(event) => update("capacity", Number(event.target.value))}
            aria-label="Class capacity"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Class Teacher</span>
          <input
            style={inputStyle}
            placeholder="Class Teacher"
            value={form.class_teacher}
            onChange={(event) => update("class_teacher", event.target.value)}
            aria-label="Class teacher"
          />
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