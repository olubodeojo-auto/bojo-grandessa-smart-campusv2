import { Download, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/ui/EmptyState";
import SectionCard from "../../components/ui/SectionCard";
import { useAuth } from "../../hooks/useAuth";
import { createAssignmentFileUrl, getAssignmentsForParent } from "../../services/assignmentService";
import type { Assignment, AssignmentFile } from "../../types/assignment";

export default function ParentAssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingFile, setOpeningFile] = useState("");

  useEffect(() => {
    let active = true;
    void getAssignmentsForParent()
      .then((rows) => { if (active) setAssignments(rows); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load assignments."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  async function download(file: AssignmentFile): Promise<void> {
    setOpeningFile(file.id);
    try {
      const url = await createAssignmentFileUrl(file);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "The attachment could not be opened.");
    } finally {
      setOpeningFile("");
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <div className="card" style={{ marginBottom: 16 }}><h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 30 }}>Assignments</h1><p style={{ marginTop: 8, color: "#666" }}>Published work for your children is collected here.</p></div>
      {error ? <p role="alert" style={{ color: "#991b1b" }}>{error}</p> : null}
      {loading ? <SectionCard><p>Loading assignments...</p></SectionCard> : assignments.length === 0 ? <EmptyState title="No assignments available" description="Published assignments for your children will appear here." /> : (
        <div style={{ display: "grid", gap: 16 }}>
          {assignments.map((assignment) => <SectionCard key={assignment.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><p style={{ margin: 0, color: "#0f6b35", fontWeight: 700 }}>{assignment.subject_name} · {assignment.class_name}</p><h2 style={{ margin: "6px 0" }}>{assignment.title}</h2></div><span style={{ color: "#64748b" }}>{assignment.frequency}</span></div>
            <p style={{ margin: "8px 0" }}><strong>Posted:</strong> {assignment.published_at?.slice(0, 10) ?? assignment.created_at.slice(0, 10)} · <strong>Due:</strong> {assignment.due_date}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{assignment.instructions || "No instructions added."}</p>
            {assignment.files.length ? <div style={{ display: "grid", gap: 8, marginTop: 14 }}>{assignment.files.map((file) => <button key={file.id} type="button" onClick={() => void download(file)} disabled={openingFile === file.id} style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content" }}><Paperclip size={16} />{file.file_name}<Download size={16} />{openingFile === file.id ? "Opening..." : "Download"}</button>)}</div> : null}
          </SectionCard>)}
        </div>
      )}
    </div>
  );
}
