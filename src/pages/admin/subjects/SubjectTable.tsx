import { Archive, Eye, Pencil } from "lucide-react";
import type { CSSProperties } from "react";
import type { Subject } from "../../../types/subject";

interface SubjectTableProps {
  subjects: Subject[];
  loading: boolean;
  onView: (subject: Subject) => void;
  onEdit: (subject: Subject) => void;
  onArchive: (subject: Subject) => void | Promise<void>;
}

export default function SubjectTable({ subjects, loading, onView, onEdit, onArchive }: SubjectTableProps) {
  if (loading) {
    return <div className="card" style={{ padding: 30 }}>Loading subjects...</div>;
  }

  if (subjects.length === 0) {
    return (
      <div className="card" style={{ padding: 30, textAlign: "center" }}>
        <h3>No subjects found</h3>
        <p>Create a subject to get started.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Subject Code</th>
            <th style={th}>Subject Name</th>
            <th style={th}>Department</th>
            <th style={th}>Academic Level</th>
            <th style={th}>Status</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.id}>
              <td style={td}>{subject.subject_code}</td>
              <td style={td}>{subject.subject_name}</td>
              <td style={td}>{subject.department ?? "—"}</td>
              <td style={td}>{subject.academic_level ?? "—"}</td>
              <td style={td}>{subject.status}</td>
              <td style={td}>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" aria-label={`View ${subject.subject_name}`} onClick={() => onView(subject)} style={actionButtonStyle}>
                    <Eye size={18} />
                  </button>
                  <button type="button" aria-label={`Edit ${subject.subject_name}`} onClick={() => onEdit(subject)} style={actionButtonStyle}>
                    <Pencil size={18} />
                  </button>
                  <button type="button" aria-label={`Archive ${subject.subject_name}`} onClick={() => { void onArchive(subject); }} style={{ ...actionButtonStyle, color: "#dc2626" }}>
                    <Archive size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: CSSProperties = {
  padding: "14px",
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  fontWeight: 600,
};

const td: CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #eee",
};

const actionButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  color: "#2E7D32",
};
