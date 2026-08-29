import { Archive, Eye, Pencil } from "lucide-react";
import type { CSSProperties } from "react";
import type { SchoolClass } from "../../../types/class";

type Props = {
  classes: SchoolClass[];
  loading: boolean;
  onView: (schoolClass: SchoolClass) => void;
  onEdit: (schoolClass: SchoolClass) => void;
  onArchive: (schoolClass: SchoolClass) => void | Promise<void>;
};

function teacherDisplayName(schoolClass: SchoolClass): string {
  if (!schoolClass.class_teacher) {
    return "Unassigned";
  }
  return [schoolClass.class_teacher.first_name, schoolClass.class_teacher.last_name]
    .filter(Boolean)
    .join(" ") || "Unassigned";
}

export default function ClassTable({ classes, loading, onView, onEdit, onArchive }: Props) {
  if (loading) {
    return (
      <div className="card" style={{ padding: 30 }}>
        Loading classes...
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="card" style={{ padding: 30, textAlign: "center" }}>
        <h3>No classes found</h3>
        <p>Create a class to get started.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Class</th>
            <th style={th}>Class Teacher</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {classes.map((schoolClass) => (
            <tr key={schoolClass.id}>
              <td style={td}>{schoolClass.class_name}</td>
              <td style={td}>{teacherDisplayName(schoolClass)}</td>
              <td style={td}>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" aria-label={`View ${schoolClass.class_name}`} onClick={() => onView(schoolClass)} style={actionButtonStyle}>
                    <Eye size={18} />
                  </button>
                  <button type="button" aria-label={`Edit ${schoolClass.class_name}`} onClick={() => onEdit(schoolClass)} style={actionButtonStyle}>
                    <Pencil size={18} />
                  </button>
                  <button type="button" aria-label={`Archive ${schoolClass.class_name}`} onClick={() => { void onArchive(schoolClass); }} style={{ ...actionButtonStyle, color: "#dc2626" }}>
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