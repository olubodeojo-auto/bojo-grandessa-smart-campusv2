/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, type FormEvent } from "react";
import { createSubject, updateSubject } from "../../../services/subjectService";
import type { Subject, SubjectAcademicLevel, SubjectDepartment, SubjectStatus } from "../../../types/subject";
import FormField, { inputStyle } from "../../../components/forms/FormField";
import Button from "../../../components/ui/Button";

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

  return (
    <form onSubmit={save}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        <FormField label="Subject Name">
          <input style={inputStyle} placeholder="Subject Name" value={form.subject_name} onChange={(event) => update("subject_name", event.target.value)} aria-label="Subject name" />
        </FormField>

        <FormField label="Subject Code">
          <input style={inputStyle} placeholder="Subject Code" value={form.subject_code} onChange={(event) => update("subject_code", event.target.value)} aria-label="Subject code" />
        </FormField>

        <FormField label="Department">
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
        </FormField>

        <FormField label="Academic Level">
          <select style={inputStyle} value={form.academic_level} onChange={(event) => update("academic_level", event.target.value as SubjectAcademicLevel)} aria-label="Academic level">
            <option value="Creche">Creche</option>
            <option value="Nursery">Nursery</option>
            <option value="Primary">Primary</option>
            <option value="Junior Secondary">Junior Secondary</option>
            <option value="Senior Secondary">Senior Secondary</option>
          </select>
        </FormField>

        <FormField label="Status">
          <select style={inputStyle} value={form.status} onChange={(event) => update("status", event.target.value as SubjectStatus)} aria-label="Subject status">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </FormField>

        <FormField label="Description" fullWidth>
          <textarea style={{ ...inputStyle, minHeight: 96, resize: "vertical" }} placeholder="Description" value={form.description} onChange={(event) => update("description", event.target.value)} aria-label="Subject description" />
        </FormField>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Subject"}
        </Button>
      </div>
    </form>
  );
}
