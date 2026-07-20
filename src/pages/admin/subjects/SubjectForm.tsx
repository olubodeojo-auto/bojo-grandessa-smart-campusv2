import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { createSubject, updateSubject } from "../../../services/subjectService";
import type { Subject, SubjectAcademicLevel, SubjectDepartment, SubjectStatus } from "../../../types/subject";

type Props = {
  mode: "add" | "edit";
  subject?: Subject | null;
  onClose: () => void;
  onSaved?: () => void;
};

type SubjectFormState = {
  subject_code: string;
  subject_name: string;
  department: SubjectDepartment;
  academic_level: SubjectAcademicLevel;
  description: string;
  status: SubjectStatus;
};

function createInitialState(subject?: Subject | null): SubjectFormState {
  return {
    subject_code: subject?.subject_code ?? "",
    subject_name: subject?.subject_name ?? "",
    department: subject?.department ?? "General",
    academic_level: subject?.academic_level ?? "Primary",
    description: subject?.description ?? "",
    status: subject?.status ?? "Active",
  };
}

export default function SubjectForm({ mode, subject, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<SubjectFormState>(() => createInitialState(subject));

  useEffect(() => {
    setForm(createInitialState(subject));
  }, [subject]);

  function update<K extends keyof SubjectFormState>(field: K, value: SubjectFormState[K]): void {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!form.subject_name.trim()) {
      alert("Subject name is required.");
      return;
    }

    if (!form.subject_code.trim()) {
      alert("Subject code is required.");
      return;
    }

    if (!form.academic_level) {
      alert("Academic level is required.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "edit" && subject?.id) {
        await updateSubject({
          id: subject.id,
          subject_code: form.subject_code,
          subject_name: form.subject_name,
          department: form.department,
          academic_level: form.academic_level,
          description: form.description,
          status: form.status,
        });
      } else {
        await createSubject({
          subject_code: form.subject_code,
          subject_name: form.subject_name,
          department: form.department,
          academic_level: form.academic_level,
          description: form.description,
          status: form.status,
        });
      }

      onSaved?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save subject.";
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
      <h2 id="subject-form-title" style={{ marginBottom: 20 }}>{mode === "edit" ? "Edit Subject" : "Create Subject"}</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Subject Name</span>
          <input style={inputStyle} placeholder="Subject Name" value={form.subject_name} onChange={(event) => update("subject_name", event.target.value)} aria-label="Subject name" />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Subject Code</span>
          <input style={inputStyle} placeholder="Subject Code" value={form.subject_code} onChange={(event) => update("subject_code", event.target.value)} aria-label="Subject code" />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Department</span>
          <select style={inputStyle} value={form.department} onChange={(event) => update("department", event.target.value as SubjectDepartment)} aria-label="Subject department">
            <option value="General">General</option>
            <option value="Science">Science</option>
            <option value="Commercial">Commercial</option>
            <option value="Arts">Arts</option>
            <option value="Vocational">Vocational</option>
            <option value="Languages">Languages</option>
            <option value="ICT">ICT</option>
            <option value="Creative Arts">Creative Arts</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Academic Level</span>
          <select style={inputStyle} value={form.academic_level} onChange={(event) => update("academic_level", event.target.value as SubjectAcademicLevel)} aria-label="Academic level">
            <option value="Creche">Creche</option>
            <option value="Nursery">Nursery</option>
            <option value="Primary">Primary</option>
            <option value="Junior Secondary">Junior Secondary</option>
            <option value="Senior Secondary">Senior Secondary</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Status</span>
          <select style={inputStyle} value={form.status} onChange={(event) => update("status", event.target.value as SubjectStatus)} aria-label="Subject status">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: "1 / -1" }}>
          <span>Description</span>
          <textarea style={{ ...inputStyle, minHeight: 96, resize: "vertical" }} placeholder="Description" value={form.description} onChange={(event) => update("description", event.target.value)} aria-label="Subject description" />
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Subject"}
        </button>
      </div>
    </form>
  );
}
