import { Eye, Pencil, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { Teacher } from "../../../types/teacher";

interface TeacherTableProps {
  teachers: Teacher[];
  loading: boolean;
  onView: (teacher: Teacher) => void;
  onEdit: (teacher: Teacher) => void;
  onDelete: (teacher: Teacher) => void | Promise<void>;
}

export default function TeacherTable({
  teachers,
  loading,
  onView,
  onEdit,
  onDelete,
}: TeacherTableProps) {
  if (loading) {
    return (
      <div className="card" style={{ padding: 30 }}>
        Loading teachers...
      </div>
    );
  }

  if (teachers.length === 0) {
    return (
      <div className="card" style={{ padding: 30 }}>
        <h3>No teachers found</h3>
        <p>
          Click <b>Add Teacher</b> to create your first teacher profile.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Employee No.</th>
            <th style={th}>Teacher</th>
            <th style={th}>Specialization</th>
            <th style={th}>Status</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {teachers.map((teacher) => (
            <tr key={teacher.id}>
              <td style={td}>{teacher.employee_number}</td>
              <td style={td}>
                {teacher.first_name} {teacher.last_name}
              </td>
              <td style={td}>{teacher.specialization ?? "—"}</td>
              <td style={td}>{teacher.status}</td>
              <td style={td}>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    aria-label={`View ${teacher.first_name} ${teacher.last_name}`}
                    onClick={() => onView(teacher)}
                    style={actionButtonStyle}
                  >
                    <Eye size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label={`Edit ${teacher.first_name} ${teacher.last_name}`}
                    onClick={() => onEdit(teacher)}
                    style={actionButtonStyle}
                  >
                    <Pencil size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label={`Delete ${teacher.first_name} ${teacher.last_name}`}
                    onClick={() => {
                      void onDelete(teacher);
                    }}
                    style={{ ...actionButtonStyle, color: "#dc2626" }}
                  >
                    <Trash2 size={18} />
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
  textAlign: "left",
  padding: 14,
  borderBottom: "2px solid #E5E7EB",
};

const td: CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #F3F4F6",
};

const actionButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  color: "#2E7D32",
};
