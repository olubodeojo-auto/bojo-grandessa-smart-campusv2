import type { Subject } from "../../../types/subject";

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
    <div className="card">
      <h2 id="subject-profile-title">{subject.subject_name}</h2>
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
        <strong>Status:</strong> {subject.status}
      </p>
      <p>
        <strong>Created:</strong> {subject.created_at}
      </p>
      <p>
        <strong>Updated:</strong> {subject.updated_at}
      </p>
    </div>
  );
}
