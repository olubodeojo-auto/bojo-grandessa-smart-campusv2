import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ImagePlus, PencilLine, Trash2, Users } from "lucide-react";

import {
  createStaffDirectoryEntry,
  deleteStaffDirectoryEntry,
  listStaffDirectoryEntries,
  MAX_STAFF_DIRECTORY_PROFILES,
  persistStaffDirectoryOrder,
  reorderStaffDirectoryEntries,
  updateStaffDirectoryEntry,
  uploadStaffDirectoryPhoto,
} from "../../../services/staffDirectoryService";
import type { StaffDirectoryEntry } from "../../../types/staffDirectory";
import AppHeader from "../../../components/layout/AppHeader";

const initialForm = {
  fullName: "",
  position: "",
  bio: "",
  imageUrl: "",
};

function getInitials(fullName: string): string {
  const names = fullName.trim().split(/\s+/).filter(Boolean);

  if (names.length === 0) {
    return "GS";
  }

  if (names.length === 1) {
    return names[0].slice(0, 2).toUpperCase();
  }

  return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
}

export default function StaffDirectoryPage() {
  const [entries, setEntries] = useState<StaffDirectoryEntry[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const totalCount = useMemo(() => entries.length, [entries]);

  const loadEntries = async () => {
    setLoading(true);
    setError("");

    try {
      setEntries(await listStaffDirectoryEntries());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load team profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const uploaded = await uploadStaffDirectoryPhoto(file);
      setForm((current) => ({ ...current, imageUrl: uploaded }));
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    }
  };

  const clearForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const trimmedName = form.fullName.trim();
      const trimmedRole = form.position.trim();

      if (!trimmedName || !trimmedRole) {
        setError("Full name and position are required.");
        return;
      }

      if (editingId) {
        await updateStaffDirectoryEntry(editingId, {
          fullName: trimmedName,
          position: trimmedRole,
          bio: form.bio.trim(),
          imageUrl: form.imageUrl.trim() || undefined,
        });
      } else {
        if (entries.length >= MAX_STAFF_DIRECTORY_PROFILES) {
          throw new Error(`Only ${MAX_STAFF_DIRECTORY_PROFILES} team profiles can be displayed at once.`);
        }

        await createStaffDirectoryEntry({
          fullName: trimmedName,
          position: trimmedRole,
          bio: form.bio.trim(),
          imageUrl: form.imageUrl.trim() || undefined,
        });
      }

      clearForm();
      await loadEntries();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Remove this team profile from the public directory?");

    if (!confirmed) {
      return;
    }

    try {
      setEntries(await deleteStaffDirectoryEntry(id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete profile.");
    }
  };

  const handleReorder = async (id: string, direction: "up" | "down") => {
    try {
      setEntries(await reorderStaffDirectoryEntries(id, direction));
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "Unable to reorder profiles.");
    }
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDropOn = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const draggedIndex = entries.findIndex((entry) => entry.id === draggedId);
    const targetIndex = entries.findIndex((entry) => entry.id === targetId);

    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedId(null);
      return;
    }

    const reordered = [...entries];
    const [movedEntry] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, movedEntry);

    try {
      setEntries(reordered);
      setEntries(await persistStaffDirectoryOrder(reordered));
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "Unable to reorder profiles.");
    } finally {
      setDraggedId(null);
    }
  };

  const beginEdit = (entry: StaffDirectoryEntry) => {
    setEditingId(entry.id);
    setForm({
      fullName: entry.fullName,
      position: entry.position,
      bio: entry.bio ?? "",
      imageUrl: entry.imageUrl ?? "",
    });
    setError("");
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <AppHeader />

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 32 }}>Staff Directory</h1>
          <p style={{ margin: "8px 0 0", color: "#666", fontFamily: "Poppins" }}>
            Independent team profiles for the public Our Team section.
          </p>
        </div>

        <div style={{ background: "#edf6ee", color: "#1f5f34", borderRadius: 999, padding: "8px 14px", fontWeight: 700, fontFamily: "Poppins" }}>
          {totalCount}/{MAX_STAFF_DIRECTORY_PROFILES} profiles
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={18} color="#2E7D32" />
            <h2 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 22 }}>{editingId ? "Edit team member" : "Add a team member"}</h2>
          </div>

          {editingId ? (
            <button type="button" onClick={clearForm} style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 999, padding: "8px 12px", cursor: "pointer" }}>
              Cancel edit
            </button>
          ) : null}
        </div>

        {error ? (
          <div style={{ marginBottom: 16, background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 10, padding: "10px 12px" }}>
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600, fontFamily: "Poppins" }}>Full name</span>
              <input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="e.g., Mrs. Grace Adebayo"
                style={{ width: "100%", boxSizing: "border-box", padding: "12px", border: "1px solid #d1d5db", borderRadius: 8 }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600, fontFamily: "Poppins" }}>Position</span>
              <input
                value={form.position}
                onChange={(event) => setForm((current) => ({ ...current, position: event.target.value }))}
                placeholder="e.g., Proprietress"
                style={{ width: "100%", boxSizing: "border-box", padding: "12px", border: "1px solid #d1d5db", borderRadius: 8 }}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontFamily: "Poppins" }}>Short bio (optional)</span>
            <textarea
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              rows={4}
              placeholder="Add a short introduction for the public profile."
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "#f3f4f6",
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
                border: "1px solid #d1d5db",
              }}
            >
              <ImagePlus size={18} color="#2E7D32" />
              {editingId ? "Replace photo" : "Upload photo"}
              <input type="file" accept="image/*" onChange={handleFileChange} hidden />
            </label>

            {form.imageUrl ? (
              <img
                src={form.imageUrl}
                alt="Profile preview"
                style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 12, border: "1px solid #d1d5db" }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "#edf6ee",
                  color: "#1f5f34",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                {getInitials(form.fullName || "Grandessa Team")}
              </div>
            )}

            {form.imageUrl ? (
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, imageUrl: "" }))}
                style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
              >
                Remove photo
              </button>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={saving} style={{ background: "#2E7D32", color: "#fff", border: "none", borderRadius: 12, padding: "12px 20px", cursor: "pointer", fontWeight: 700 }}>
              {saving ? "Saving..." : editingId ? "Update profile" : "Save profile"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 18px", fontFamily: "Fredoka", fontSize: 22 }}>Directory preview</h2>

        {loading ? (
          <p style={{ margin: 0, color: "#666" }}>Loading profiles...</p>
        ) : entries.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>No profiles yet. Add your first team member above.</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                draggable
                onDragStart={() => handleDragStart(entry.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleDropOn(entry.id)}
                style={{ display: "grid", gridTemplateColumns: "80px 1fr auto", gap: 16, alignItems: "center", padding: 12, border: "1px solid #e5e7eb", borderRadius: 14, cursor: "grab", background: draggedId === entry.id ? "#f3f4f6" : "#fff" }}
              >
                {entry.imageUrl ? (
                  <img
                    src={entry.imageUrl}
                    alt={entry.fullName}
                    style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 12 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                      background: "#edf6ee",
                      color: "#1f5f34",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 20,
                    }}
                  >
                    {getInitials(entry.fullName)}
                  </div>
                )}

                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{entry.fullName}</div>
                  <div style={{ color: "#2E7D32", fontWeight: 600 }}>{entry.position}</div>
                  {entry.bio ? <p style={{ margin: "8px 0 0", color: "#4b5563" }}>{entry.bio}</p> : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => handleReorder(entry.id, "up")} disabled={entry.displayOrder === 1} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", cursor: entry.displayOrder === 1 ? "not-allowed" : "pointer" }} aria-label={`Move ${entry.fullName} upward`}>
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" onClick={() => handleReorder(entry.id, "down")} disabled={entry.displayOrder === entries.length} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", cursor: entry.displayOrder === entries.length ? "not-allowed" : "pointer" }} aria-label={`Move ${entry.fullName} downward`}>
                    <ArrowDown size={16} />
                  </button>
                  <button type="button" onClick={() => beginEdit(entry)} style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "8px 10px", cursor: "pointer" }} aria-label={`Edit ${entry.fullName}`}>
                    <PencilLine size={16} />
                  </button>
                  <button type="button" onClick={() => void handleDelete(entry.id)} style={{ border: "1px solid #fca5a5", borderRadius: 8, background: "#fff", color: "#b91c1c", padding: "8px 10px", cursor: "pointer" }} aria-label={`Delete ${entry.fullName}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
