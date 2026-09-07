import { Bell, Check, ClipboardPlus, ExternalLink, Paperclip, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Button from "../../../components/ui/Button";
import PageHeader from "../../../components/layout/PageHeader";
import AppModal from "../../../components/modals/AppModal";
import EmptyState from "../../../components/ui/EmptyState";
import FormField, { inputStyle } from "../../../components/forms/FormField";
import { useAuth } from "../../../hooks/useAuth";
import {
  createAssignment,
  createAssignmentFileUrl,
  deleteAssignment,
  deleteAssignmentFile,
  getAssignmentNotificationStatuses,
  getAssignmentsForStaff,
  notifyAssignmentParents,
  updateAssignment,
} from "../../../services/assignmentService";
import { getClasses } from "../../../services/classService";
import { getSubjects } from "../../../services/subjectService";
import { previewCommunication } from "../../../services/communicationService";
import type { Assignment, AssignmentFrequency, AssignmentNotificationStatus } from "../../../types/assignment";
import type { SchoolClass } from "../../../types/class";
import type { Subject } from "../../../types/subject";

const FALLBACK_SCHOOL_ID = "1829b784-8e94-4713-bbaf-2518b5e374be";
const EMPTY_FORM = { classId: "", subjectId: "", title: "", instructions: "", dueDate: "", frequency: "One-time" as AssignmentFrequency, notifyParents: false };
type FormMode = "create" | "edit";
type DueState = "Upcoming" | "Due today" | "Overdue";

function todayKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function dueState(dueDate: string): DueState {
  const today = todayKey();
  if (dueDate === today) return "Due today";
  return dueDate < today ? "Overdue" : "Upcoming";
}

function formatDueDate(dueDate: string): string {
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [open, setOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [removingFileId, setRemovingFileId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [notificationStatuses, setNotificationStatuses] = useState<Record<string, AssignmentNotificationStatus>>({});
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState<DueState | "all">("all");
  const [sort, setSort] = useState<"newest" | "due">("newest");

  const schoolId = useMemo(() => window.localStorage.getItem("activeSchoolId")?.trim() || import.meta.env.VITE_SCHOOL_ID?.toString().trim() || FALLBACK_SCHOOL_ID, []);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [assignmentRows, classRows, subjectRows] = await Promise.all([getAssignmentsForStaff(), getClasses(), getSubjects()]);
      setAssignments(assignmentRows);
      setClasses(classRows.filter((item) => item.status !== "Inactive"));
      setSubjects(subjectRows);
      setNotificationStatuses(await getAssignmentNotificationStatuses(assignmentRows.map((assignment) => assignment.id)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function resetForm(): void {
    setForm(EMPTY_FORM);
    setFiles([]);
    setEditingAssignment(null);
    setError("");
  }

  const handleModalClose = useCallback(() => {
    if (!saving) setOpen(false);
  }, [saving]);

  function openCreate(): void {
    resetForm();
    setFormMode("create");
    setSuccess("");
    setOpen(true);
  }

  function openEdit(assignment: Assignment): void {
    setFormMode("edit");
    setEditingAssignment(assignment);
    setForm({ classId: assignment.class_id, subjectId: assignment.subject_id, title: assignment.title, instructions: assignment.instructions, dueDate: assignment.due_date, frequency: assignment.frequency, notifyParents: false });
    setFiles([]);
    setError("");
    setSuccess("");
    setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (formMode === "edit" && editingAssignment) {
        await updateAssignment(editingAssignment.id, { class_id: form.classId, subject_id: form.subjectId, title: form.title, instructions: form.instructions, due_date: form.dueDate, frequency: form.frequency, files }, schoolId);
        setSuccess("Assignment updated.");
      } else {
        await createAssignment({ class_id: form.classId, subject_id: form.subjectId, title: form.title, instructions: form.instructions, due_date: form.dueDate, frequency: form.frequency, notify_parents: form.notifyParents, files }, user.id, schoolId);
        setSuccess("Assignment published.");
      }
      setOpen(false);
      resetForm();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function removeExistingFile(file: Assignment["files"][number]): Promise<void> {
    if (!window.confirm(`Remove attachment "${file.file_name}"?`)) return;
    setRemovingFileId(file.id);
    setError("");
    try {
      await deleteAssignmentFile(file);
      setEditingAssignment((current) => current ? { ...current, files: current.files.filter((item) => item.id !== file.id) } : current);
      setAssignments((current) => current.map((item) => item.id === file.assignment_id ? { ...item, files: item.files.filter((existing) => existing.id !== file.id) } : item));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove attachment.");
    } finally {
      setRemovingFileId(null);
    }
  }

  async function handleDelete(assignment: Assignment): Promise<void> {
    if (!window.confirm(`Delete "${assignment.title}"?\n\nThis will remove the assignment and its attachments. This action cannot be undone.`)) return;
    setDeletingId(assignment.id);
    setError("");
    try {
      await deleteAssignment(assignment.id);
      setAssignments((current) => current.filter((item) => item.id !== assignment.id));
      setSuccess("Assignment deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete assignment.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleNotify(assignment: Assignment): Promise<void> {
    setNotifyingId(assignment.id);
    setError("");
    setSuccess("");
    try {
      const preview = await previewCommunication({ audience: "class", class_id: assignment.class_id });
      if (preview.recipient_count === 0) throw new Error("No parent recipients were found for this class.");
      const action = notificationStatuses[assignment.id]?.notified ? " again" : "";
      if (!window.confirm(`Send assignment notification${action} to ${preview.recipient_count} parents?`)) return;
      const result = await notifyAssignmentParents(assignment, preview.recipient_count);
      setSuccess(result.duplicate ? "This notification was already submitted." : `${result.accepted} parent notification${result.accepted === 1 ? "" : "s"} accepted.`);
      setNotificationStatuses(await getAssignmentNotificationStatuses([assignment.id]));
    } catch (notifyError) {
      setError(notifyError instanceof Error ? notifyError.message : "Unable to notify parents.");
    } finally {
      setNotifyingId(null);
    }
  }

  async function openAttachment(file: Assignment["files"][number]): Promise<void> {
    try {
      const url = await createAssignmentFileUrl(file);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Unable to open attachment.");
    }
  }

  const filteredAssignments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assignments
      .filter((assignment) => {
        const matchesSearch = !term || [assignment.title, assignment.instructions, assignment.class_name, assignment.subject_name].some((value) => value?.toLowerCase().includes(term));
        const matchesClass = classFilter === "all" || assignment.class_id === classFilter;
        const matchesSubject = subjectFilter === "all" || assignment.subject_id === subjectFilter;
        const matchesDue = dueFilter === "all" || dueState(assignment.due_date) === dueFilter;
        return matchesSearch && matchesClass && matchesSubject && matchesDue;
      })
      .sort((left, right) => sort === "due" ? left.due_date.localeCompare(right.due_date) : right.created_at.localeCompare(left.created_at));
  }, [assignments, classFilter, dueFilter, search, sort, subjectFilter]);

  return (
    <>
      <PageHeader title="Assignments" description="Publish, update and manage class work for the right families." actions={<Button type="button" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 8 }}><ClipboardPlus size={18} /> Create Assignment</Button>} />
      {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}
      {success ? <p role="status" style={{ color: "#2e7d32" }}>{success}</p> : null}
      <div className="card" style={{ display: "grid", gridTemplateColumns: "minmax(220px, 2fr) repeat(4, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
        <input style={inputStyle} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assignments" aria-label="Search assignments" />
        <select style={inputStyle} value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Filter by class"><option value="all">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}</select>
        <select style={inputStyle} value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} aria-label="Filter by subject"><option value="all">All subjects</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.subject_name}</option>)}</select>
        <select style={inputStyle} value={dueFilter} onChange={(event) => setDueFilter(event.target.value as DueState | "all")} aria-label="Filter by due status"><option value="all">All due dates</option><option>Upcoming</option><option>Due today</option><option>Overdue</option></select>
        <select style={inputStyle} value={sort} onChange={(event) => setSort(event.target.value as "newest" | "due")} aria-label="Sort assignments"><option value="newest">Newest</option><option value="due">Due soonest</option></select>
      </div>
      {loading ? <p>Loading assignments...</p> : filteredAssignments.length === 0 ? <EmptyState title={assignments.length ? "No matching assignments" : "No assignments yet"} description={assignments.length ? "Try changing your search or filters." : "Create an assignment to publish work for a class."} /> : (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredAssignments.map((assignment) => {
            const state = dueState(assignment.due_date);
            const status = notificationStatuses[assignment.id];
            return <article key={assignment.id} className="card" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><p style={{ margin: 0, color: "#64748b", fontWeight: 600 }}>{assignment.subject_name} · {assignment.class_name}</p><h3 style={{ margin: "4px 0 0" }}>{assignment.title}</h3></div><span style={{ color: state === "Overdue" ? "#b91c1c" : state === "Due today" ? "#b45309" : "#2e7d32", fontWeight: 700 }}>{state}</span></div>
              <p style={{ margin: 0 }}>{assignment.instructions || "No instructions added."}</p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "#64748b", fontSize: 13 }}><span>Due {formatDueDate(assignment.due_date)}</span><span>Published {assignment.published_at?.slice(0, 10) ?? assignment.created_at.slice(0, 10)}</span><span>{assignment.files.length} attachment{assignment.files.length === 1 ? "" : "s"}</span><span>{status?.notified ? "Parents notified" : "Parents not notified"}</span></div>
              {assignment.files.length ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{assignment.files.map((file) => <button type="button" key={file.id} onClick={() => void openAttachment(file)} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "6px 8px", cursor: "pointer" }} title={`Open ${file.file_name}`}><Paperclip size={14} /> {file.file_name} <ExternalLink size={13} /></button>)}</div> : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button type="button" size="sm" variant="secondary" onClick={() => openEdit(assignment)} disabled={Boolean(deletingId) || Boolean(notifyingId)}><Pencil size={15} /> Edit</Button><Button type="button" size="sm" onClick={() => void handleNotify(assignment)} disabled={Boolean(deletingId) || Boolean(notifyingId) || status?.status === "reserved"}><Bell size={15} /> {notifyingId === assignment.id ? "Sending..." : status?.notified ? "Notify Again" : "Notify Parents"}</Button><Button type="button" size="sm" variant="secondary" onClick={() => void handleDelete(assignment)} disabled={Boolean(deletingId) || Boolean(notifyingId)} style={{ color: "#b91c1c", borderColor: "#fecaca" }}><Trash2 size={15} /> {deletingId === assignment.id ? "Deleting..." : "Delete"}</Button>{status?.notified ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#2e7d32", fontSize: 13, fontWeight: 600 }}><Check size={15} /> Parents notified</span> : null}</div>
            </article>;
          })}
        </div>
      )}

      <AppModal open={open} title={formMode === "edit" ? "Edit Assignment" : "Create Assignment"} size="lg" onClose={handleModalClose}>
        <form onSubmit={(event) => void save(event)} style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
            <FormField label="Class"><select style={inputStyle} value={form.classId} onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))} required><option value="">Choose a class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}</select></FormField>
            <FormField label="Course / Subject"><select style={inputStyle} value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))} required><option value="">Choose a subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.subject_name}</option>)}</select></FormField>
            <FormField label="Assignment title"><input style={inputStyle} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required /></FormField>
            <FormField label="Due date"><input style={inputStyle} type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} required /></FormField>
            <FormField label="Frequency"><select style={inputStyle} value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as AssignmentFrequency }))}><option>One-time</option><option>Daily</option><option>Weekly</option></select></FormField>
          </div>
          <FormField label="Instructions / description"><textarea style={{ ...inputStyle, minHeight: 120, resize: "vertical" }} value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} /></FormField>
          {editingAssignment?.files.length ? <div style={{ display: "grid", gap: 8 }}><strong>Existing attachments</strong>{editingAssignment.files.map((file) => <div key={file.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><button type="button" onClick={() => void openAttachment(file)} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "transparent", padding: 0, cursor: "pointer", color: "#2e7d32" }}><Paperclip size={14} /> {file.file_name}</button><Button type="button" size="sm" variant="secondary" onClick={() => void removeExistingFile(file)} disabled={removingFileId === file.id}>{removingFileId === file.id ? "Removing..." : "Remove"}</Button></div>)}</div> : null}
          <label style={{ display: "grid", gap: 6 }}>{formMode === "edit" ? "Add new attachments" : "Optional attachments"}<input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>
          {files.length ? <div style={{ display: "grid", gap: 4 }}>{files.map((file) => <span key={`${file.name}-${file.size}`}><Paperclip size={14} /> {file.name}</span>)}</div> : null}
          {formMode === "create" ? <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={form.notifyParents} onChange={(event) => setForm((current) => ({ ...current, notifyParents: event.target.checked }))} /> Notify parents by email</label> : null}
          {error ? <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{error}</p> : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : formMode === "edit" ? "Save Changes" : "Publish Assignment"}</Button></div>
        </form>
      </AppModal>
    </>
  );
}
