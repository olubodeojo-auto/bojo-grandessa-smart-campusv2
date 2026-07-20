import type { Subject } from "../../../types/subject";
import SectionCard from "../../../components/ui/SectionCard";
import StatusBadge from "../../../components/ui/StatusBadge";

type Props = {
  subject?: Subject | null;
};

export default function SubjectProfile({ subject }: Props) {
  if (!subject) {
    return (
      <div className="card">
        <h2>No subject selected.</h2>
      </div>
    );
  }

  return (
    <SectionCard style={{ padding: 0, border: "none", boxShadow: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h2 id="subject-profile-title" style={{ margin: 0 }}>{subject.subject_name}</h2>
        <StatusBadge tone={subject.status === "Active" ? "success" : "warning"}>{subject.status}</StatusBadge>
      </div>
      <p>
        <strong>Subject Code:</strong> {subject.subject_code}
      </p>
      <p>
        <strong>Department:</strong> {subject.department ?? "—"}
      </p>
      <p>
        <strong>Academic Level:</strong> {subject.academic_level ?? "—"}
      </p>
      <p>
        <strong>Description:</strong> {subject.description ?? "—"}
      </p>
      <p>
        <strong>Created:</strong> {subject.created_at}
      </p>
      <p>
        <strong>Updated:</strong> {subject.updated_at}
      </p>
    </SectionCard>
  );
}
