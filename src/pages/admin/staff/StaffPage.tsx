import { UserPlus, UserRound, UserRoundCheck, UserRoundX, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

import {
  createStaffUser,
  deleteStaffUser,
  getStaffUsers,
  toggleStaffStatus,
  type CreateStaffInput,
  type StaffRole,
  type StaffUser,
} from "../../../services/staffService";

const roles: StaffRole[] = [
  "Administrator",
  "Proprietress",
  "Super Admin",
  "Accountant",
  "Teacher",
];

const modalOverlayStyle = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 999,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  padding: 20,
  background: "rgba(0, 0, 0, 0.45)",
};

const modalPanelStyle = {
  width: 620,
  maxWidth: "100%",
  maxHeight: "90vh",
  overflowY: "auto" as const,
  padding: 24,
  borderRadius: 16,
  background: "#fff",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
};

type FormState = Omit<CreateStaffInput, "phone"> & { phone: string };

const initialForm: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role_name: "Teacher",
};

function displayName(staff: StaffUser): string {
  return [staff.first_name, staff.last_name].filter(Boolean).join(" ") || "Unnamed user";
}

function statusLabel(status: string | null): string {
  return status || "Inactive";
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);

  const loadStaff = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      setStaff(await getStaffUsers());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load staff users.";
      console.error(message);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return staff;

    return staff.filter((member) =>
      [displayName(member), member.email, member.phone, member.role_name, statusLabel(member.status)]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [search, staff]);

  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openForm(): void {
    setForm(initialForm);
    setIsFormOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);

    try {
      await createStaffUser({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role_name: form.role_name,
      });
      setIsFormOpen(false);
      await loadStaff();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create staff user.";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(member: StaffUser): Promise<void> {
    const nextStatus = statusLabel(member.status) === "Active" ? "Inactive" : "Active";
    const confirmed = window.confirm(`${nextStatus === "Active" ? "Activate" : "Deactivate"} ${displayName(member)}?`);

    if (!confirmed) return;

    try {
      await toggleStaffStatus(member.id, nextStatus);
      await loadStaff();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update staff status.";
      alert(message);
    }
  }

  async function deleteStaff(member: StaffUser): Promise<void> {
    const confirmed = window.confirm(`Delete ${displayName(member)} and their account? This action cannot be undone.`);

    if (!confirmed) return;

    try {
      await deleteStaffUser(member.id);
      await loadStaff();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete staff member.";
      alert(message);
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 32 }}>Staff &amp; Users</h1>
            <p style={{ marginTop: 8, color: "#666", fontFamily: "Poppins" }}>
              Manage authorized staff access for Grandessa School.
            </p>
          </div>
          <button type="button" onClick={openForm} style={{ display: "flex", alignItems: "center", gap: 10, background: "#2E7D32", color: "#fff", border: "none", borderRadius: 12, padding: "12px 20px", cursor: "pointer", fontFamily: "Poppins", fontWeight: 600 }}>
            <UserPlus size={18} />
            Add Staff Member
          </button>
        </div>

        <section className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <UserRound size={20} color="#2E7D32" />
            <input
              style={{ ...inputStyle, maxWidth: 420 }}
              type="search"
              placeholder="Search staff"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search staff"
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 8px" }}>Name</th>
                  <th style={{ padding: "12px 8px" }}>Email</th>
                  <th style={{ padding: "12px 8px" }}>Phone</th>
                  <th style={{ padding: "12px 8px" }}>Role</th>
                  <th style={{ padding: "12px 8px" }}>Status</th>
                  <th style={{ padding: "12px 8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading staff...</td></tr>
                ) : filteredStaff.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#666" }}>No staff users found.</td></tr>
                ) : filteredStaff.map((member) => {
                  const active = statusLabel(member.status) === "Active";

                  return (
                    <tr key={member.id} style={{ borderBottom: "1px solid #f0f1f2" }}>
                      <td style={{ padding: "14px 8px", fontWeight: 600 }}>{displayName(member)}</td>
                      <td style={{ padding: "14px 8px" }}>{member.email || "Not available"}</td>
                      <td style={{ padding: "14px 8px" }}>{member.phone || "Not provided"}</td>
                      <td style={{ padding: "14px 8px" }}>{member.role_name}</td>
                      <td style={{ padding: "14px 8px" }}>{statusLabel(member.status)}</td>
                      <td style={{ padding: "14px 8px", display: "flex", gap: 12 }}>
                        <button type="button" onClick={() => void changeStatus(member)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {active ? <UserRoundX size={16} /> : <UserRoundCheck size={16} />}
                          {active ? "Deactivate" : "Activate"}
                        </button>
                        <button type="button" onClick={() => void deleteStaff(member)} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#dc2626" }} title="Delete staff member">
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </motion.div>

      {isFormOpen ? (
        <div role="dialog" aria-modal="true" aria-labelledby="staff-form-title" style={modalOverlayStyle}>
          <form onSubmit={submitForm} style={modalPanelStyle}>
            <h2 id="staff-form-title" style={{ marginTop: 0 }}>Add Staff Member</h2>
            <p style={{ color: "#666" }}>The staff member will receive the normal Supabase invitation flow.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>First Name</span>
                <input required style={inputStyle} value={form.first_name} onChange={(event) => updateForm("first_name", event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Last Name</span>
                <input required style={inputStyle} value={form.last_name} onChange={(event) => updateForm("last_name", event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Email</span>
                <input required type="email" style={inputStyle} value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Phone (optional)</span>
                <input style={inputStyle} value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Role</span>
                <select style={inputStyle} value={form.role_name} onChange={(event) => updateForm("role_name", event.target.value as StaffRole)}>
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button type="button" onClick={() => setIsFormOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? "Creating..." : "Create / Invite"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
