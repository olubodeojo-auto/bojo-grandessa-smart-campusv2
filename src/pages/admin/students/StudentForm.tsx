/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { createStudent, updateStudent } from "../../../services/studentService";
import { getClasses } from "../../../services/classService";
import { createContact, updateContact, getContact } from "../../../services/contactService";
import type { Gender, Student, StudentStatus } from "../../../types/student";
import type { SchoolClass } from "../../../types/class";

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
  middle_name: string;
  gender: Gender;
  class_id: string | null;
  class_name: string;
  blood_group: string;
  genotype: string;
  medical_notes: string;
  photo_url: string;
  primary_contact_id: string | null;
  secondary_contact_id: string | null;
  primary_first_name: string;
  primary_last_name: string;
  primary_relationship: string;
  primary_phone: string;
  primary_alternate_phone: string;
  primary_email: string;
  primary_address: string;
  secondary_first_name: string;
  secondary_last_name: string;
  secondary_relationship: string;
  secondary_phone: string;
  secondary_alternate_phone: string;
  secondary_email: string;
  secondary_address: string;
  date_of_birth: string;
  admission_date: string;
  status: StudentStatus;
};

function createInitialState(student?: Student | null): StudentFormState {
  return {
    admission_number: student?.admission_number ?? "",
    first_name: student?.first_name ?? "",
    last_name: student?.last_name ?? "",
    middle_name: (student as any)?.middle_name ?? "",
    gender: student?.gender ?? "Male",
    class_id: student?.class_id ?? null,
    class_name: (student as any)?.class_name ?? "",
    blood_group: (student as any)?.blood_group ?? "",
    genotype: (student as any)?.genotype ?? "",
    medical_notes: (student as any)?.medical_notes ?? "",
    photo_url: (student as any)?.photo_url ?? "",
    primary_contact_id: student?.primary_contact_id ?? null,
    secondary_contact_id: student?.secondary_contact_id ?? null,
    primary_first_name: "",
    primary_last_name: "",
    primary_relationship: "",
    primary_phone: "",
    primary_alternate_phone: "",
    primary_email: "",
    primary_address: "",
    secondary_first_name: "",
    secondary_last_name: "",
    secondary_relationship: "",
    secondary_phone: "",
    secondary_alternate_phone: "",
    secondary_email: "",
    secondary_address: "",
    date_of_birth: student?.date_of_birth ?? "",
    admission_date: student?.admission_date ?? new Date().toISOString().slice(0, 10),
    status: student?.status ?? "Active",
  };
}

export default function StudentForm({ mode, student, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<StudentFormState>(() => createInitialState(student));
  const hasUserEditedRef = useRef(false);
  const [classesList, setClassesList] = useState<SchoolClass[]>([]);

  useEffect(() => {
    hasUserEditedRef.current = false;
    const nextState = createInitialState(student);
    setForm(nextState);

    let cancelled = false;

    (async () => {
      try {
        const classes = await getClasses();
        if (cancelled) {
          return;
        }

        setClassesList(classes);

        if (!student?.id || hasUserEditedRef.current) {
          return;
        }

        if (student.class_id) {
          const foundClass = classes.find((item) => item.id === student.class_id);
          if (foundClass && !cancelled && !hasUserEditedRef.current) {
            setForm((prev) => ({
              ...prev,
              class_id: foundClass.id,
              class_name: foundClass.class_name,
            }));
          }
        }

        const primaryId = student.primary_contact_id ?? null;
        if (primaryId && !cancelled && !hasUserEditedRef.current) {
          const primary = await getContact(primaryId);
          if (primary && !cancelled && !hasUserEditedRef.current) {
            setForm((prev) => ({
              ...prev,
              primary_contact_id: primary.id,
              primary_first_name: primary.first_name || "",
              primary_last_name: primary.last_name || "",
              primary_relationship: primary.relationship || "",
              primary_phone: primary.phone || "",
              primary_alternate_phone: primary.alternate_phone || "",
              primary_email: primary.email || "",
              primary_address: primary.address || "",
            }));
          }
        }

        const secondaryId = student.secondary_contact_id ?? null;
        if (secondaryId && !cancelled && !hasUserEditedRef.current) {
          const secondary = await getContact(secondaryId);
          if (secondary && !cancelled && !hasUserEditedRef.current) {
            setForm((prev) => ({
              ...prev,
              secondary_contact_id: secondary.id,
              secondary_first_name: secondary.first_name || "",
              secondary_last_name: secondary.last_name || "",
              secondary_relationship: secondary.relationship || "",
              secondary_phone: secondary.phone || "",
              secondary_alternate_phone: secondary.alternate_phone || "",
              secondary_email: secondary.email || "",
              secondary_address: secondary.address || "",
            }));
          }
        }
      } catch {
        // fail silently only for fetch population; actual save paths must surface errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [student]);

  function update<K extends keyof StudentFormState>(
    field: K,
    value: StudentFormState[K]
  ): void {
    hasUserEditedRef.current = true;

    if (field === "class_id") {
      const selected = (value as string | null) ? classesList.find((c) => c.id === value) : undefined;
      setForm((prev) => ({
        ...prev,
        class_id: (value as string | null) ?? null,
        class_name: selected ? selected.class_name : "",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);

    try {
      const classId = form.class_id ?? null;

      let primaryContactId = form.primary_contact_id ?? null;
      if (form.primary_first_name.trim() || form.primary_phone.trim() || form.primary_last_name.trim()) {
        if (primaryContactId) {
          const updated = await updateContact(primaryContactId, {
            first_name: form.primary_first_name,
            last_name: form.primary_last_name,
            relationship: form.primary_relationship || null,
            phone: form.primary_phone || null,
            alternate_phone: form.primary_alternate_phone || null,
            email: form.primary_email || null,
            address: form.primary_address || null,
          });
          primaryContactId = updated.id;
        } else {
          const created = await createContact({
            first_name: form.primary_first_name,
            last_name: form.primary_last_name || "",
            relationship: form.primary_relationship || null,
            phone: form.primary_phone || null,
            alternate_phone: form.primary_alternate_phone || null,
            email: form.primary_email || null,
            address: form.primary_address || null,
          });
          primaryContactId = created.id;
        }
      }

      let secondaryContactId = form.secondary_contact_id ?? null;
      if (form.secondary_first_name.trim() || form.secondary_phone.trim() || form.secondary_last_name.trim()) {
        if (secondaryContactId) {
          const updated = await updateContact(secondaryContactId, {
            first_name: form.secondary_first_name,
            last_name: form.secondary_last_name,
            relationship: form.secondary_relationship || null,
            phone: form.secondary_phone || null,
            alternate_phone: form.secondary_alternate_phone || null,
            email: form.secondary_email || null,
            address: form.secondary_address || null,
          });
          secondaryContactId = updated.id;
        } else {
          const created = await createContact({
            first_name: form.secondary_first_name,
            last_name: form.secondary_last_name || "",
            relationship: form.secondary_relationship || null,
            phone: form.secondary_phone || null,
            alternate_phone: form.secondary_alternate_phone || null,
            email: form.secondary_email || null,
            address: form.secondary_address || null,
          });
          secondaryContactId = created.id;
        }
      }

      const payload: Omit<Student, "id" | "created_at" | "updated_at"> = {
        admission_number: form.admission_number.trim(),
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name: form.last_name.trim(),
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        admission_date: form.admission_date || new Date().toISOString().slice(0, 10),
        class_id: classId,
        primary_contact_id: primaryContactId,
        secondary_contact_id: secondaryContactId,
        blood_group: form.blood_group.trim() || null,
        genotype: form.genotype.trim() || null,
        medical_notes: form.medical_notes.trim() || null,
        photo_url: form.photo_url.trim() || null,
        status: form.status,
      } as unknown as Omit<Student, "id" | "created_at" | "updated_at">;

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
    <form
      onSubmit={save}
      style={{
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ marginBottom: 20, flexShrink: 0 }}>
        {mode === "edit" ? "Edit Student" : "Student Admission"}
      </h2>

      <div
        style={{
          overflowY: "auto",
          overflowX: "hidden",
          paddingRight: 8,
          flex: "1 1 auto",
          minHeight: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: 16,
            width: "100%",
            boxSizing: "border-box",
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
          placeholder="Middle Name"
          value={form.middle_name}
          onChange={(event) => update("middle_name", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Last Name"
          value={form.last_name}
          onChange={(event) => update("last_name", event.target.value)}
        />

        <select
          style={inputStyle}
          value={form.class_id ?? ""}
          onChange={(event) => update("class_id", event.target.value || null)}
          aria-label="Class"
        >
          <option value="">Select Class</option>
          {classesList.map((item) => (
            <option key={item.id} value={item.id}>
              {item.class_name}
            </option>
          ))}
        </select>

        <input
          style={inputStyle}
          placeholder="Blood Group"
          value={form.blood_group}
          onChange={(event) => update("blood_group", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Genotype"
          value={form.genotype}
          onChange={(event) => update("genotype", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Photo URL"
          value={form.photo_url}
          onChange={(event) => update("photo_url", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Medical Notes"
          value={form.medical_notes}
          onChange={(event) => update("medical_notes", event.target.value)}
        />

        {/* Primary contact */}
        <input
          style={inputStyle}
          placeholder="Primary Contact First Name"
          value={form.primary_first_name}
          onChange={(event) => update("primary_first_name", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Primary Contact Last Name"
          value={form.primary_last_name}
          onChange={(event) => update("primary_last_name", event.target.value)}
        />

        <select
          style={inputStyle}
          value={form.primary_relationship}
          onChange={(event) => update("primary_relationship", event.target.value)}
        >
          <option value="">Relationship (optional)</option>
          <option value="Father">Father</option>
          <option value="Mother">Mother</option>
          <option value="Guardian">Guardian</option>
          <option value="Uncle">Uncle</option>
          <option value="Aunt">Aunt</option>
          <option value="Sponsor">Sponsor</option>
          <option value="Other">Other</option>
        </select>

        <input
          style={inputStyle}
          placeholder="Primary Contact Phone"
          value={form.primary_phone}
          onChange={(event) => update("primary_phone", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Primary Alternate Phone"
          value={form.primary_alternate_phone}
          onChange={(event) => update("primary_alternate_phone", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Primary Email"
          type="email"
          value={form.primary_email}
          onChange={(event) => update("primary_email", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Primary Address"
          value={form.primary_address}
          onChange={(event) => update("primary_address", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Secondary Contact First Name (optional)"
          value={form.secondary_first_name}
          onChange={(event) => update("secondary_first_name", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Secondary Contact Last Name (optional)"
          value={form.secondary_last_name}
          onChange={(event) => update("secondary_last_name", event.target.value)}
        />

        <select
          style={inputStyle}
          value={form.secondary_relationship}
          onChange={(event) => update("secondary_relationship", event.target.value)}
        >
          <option value="">Relationship (optional)</option>
          <option value="Father">Father</option>
          <option value="Mother">Mother</option>
          <option value="Guardian">Guardian</option>
          <option value="Uncle">Uncle</option>
          <option value="Aunt">Aunt</option>
          <option value="Sponsor">Sponsor</option>
          <option value="Other">Other</option>
        </select>

        <input
          style={inputStyle}
          placeholder="Secondary Contact Phone (optional)"
          value={form.secondary_phone}
          onChange={(event) => update("secondary_phone", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Secondary Alternate Phone (optional)"
          value={form.secondary_alternate_phone}
          onChange={(event) => update("secondary_alternate_phone", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Secondary Email (optional)"
          type="email"
          value={form.secondary_email}
          onChange={(event) => update("secondary_email", event.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Secondary Address (optional)"
          value={form.secondary_address}
          onChange={(event) => update("secondary_address", event.target.value)}
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
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          marginTop: 24,
          flexShrink: 0,
          paddingTop: 8,
          borderTop: "1px solid #e5e7eb",
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