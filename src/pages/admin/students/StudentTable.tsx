import { Eye, Pencil, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { Student } from "../../../types/student";

interface StudentTableProps {
  students: Student[];
  loading: boolean;
  onView: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}

export default function StudentTable({
  students,
  loading,
  onView,
  onEdit,
  onDelete,
}: StudentTableProps) {
  if (loading) {
    return (
      <div className="card" style={{ padding: 30 }}>
        Loading students...
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="card" style={{ padding: 30 }}>
        <h3>No students found</h3>
        <p>
          Click <b>Add Student</b> to admit your first student.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th style={th}>Admission No.</th>
            <th style={th}>Student</th>
            <th style={th}>Gender</th>
            <th style={th}>Status</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {students.map((student) => (
            <tr key={student.id}>
              <td style={td}>{student.admission_number}</td>

              <td style={td}>
                {student.first_name} {student.last_name}
              </td>

              <td style={td}>{student.gender}</td>

              <td style={td}>{student.status}</td>

              <td style={td}>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    aria-label={`View ${student.first_name} ${student.last_name}`}
                    onClick={() => onView(student)}
                    style={actionButtonStyle}
                  >
                    <Eye size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label={`Edit ${student.first_name} ${student.last_name}`}
                    onClick={() => onEdit(student)}
                    style={actionButtonStyle}
                  >
                    <Pencil size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label={`Delete ${student.first_name} ${student.last_name}`}
                    onClick={() => onDelete(student)}
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