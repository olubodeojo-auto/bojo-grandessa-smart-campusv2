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
    <main className="parent-portal-page">
      <section className="parent-portal-page-heading"><p className="parent-portal-eyebrow">Schoolwork</p><h1>Assignments</h1><p>Keep track of your child&apos;s current published school work.</p></section>
      {error ? <p role="alert" style={{ color: "#991b1b" }}>{error}</p> : null}
      {loading ? <SectionCard><p>Loading assignments...</p></SectionCard> : assignments.length === 0 ? <EmptyState title="No assignments available" description="Published assignments for your children will appear here." /> : (
        <div style={{ display: "grid", gap: 14 }}>
          {assignments.map((assignment) => <article className="parent-assignment-card" key={assignment.id}>
            <span className="parent-status-pill">Published assignment</span>
            <h2>{assignment.title}</h2>
            <div className="parent-assignment-card__meta">{assignment.subject_name || "Schoolwork"} {assignment.class_name ? `· ${assignment.class_name}` : ""} · Due {assignment.due_date}</div>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#52675b" }}>{assignment.instructions || "No instructions added."}</p>
            {assignment.files.length ? <div style={{ display: "grid", gap: 8 }}>{assignment.files.map((file) => <button key={file.id} type="button" onClick={() => void download(file)} disabled={openingFile === file.id} style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content" }}><Paperclip size={16} />{file.file_name}<Download size={16} />{openingFile === file.id ? "Opening..." : "Open attachment"}</button>)}</div> : null}
          </article>)}
        </div>
      )}
    </main>
  );
}
