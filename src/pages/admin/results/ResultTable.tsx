import { Eye, Pencil, Trash2, Upload } from "lucide-react";
import type { CSSProperties } from "react";
import DataTable from "../../../components/tables/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import StatusBadge from "../../../components/ui/StatusBadge";
import type { ResultStatus } from "../../../types/result";

export interface ResultRow {
  id: string;
  studentName: string;
  className: string;
  subjectName: string;
  teacherName: string;
  academicYear: string;
  term: "First" | "Second" | "Third";
  continuousAssessment: number;
  examination: number;
  totalScore: number;
  grade: string;
  remark: string;
  status: ResultStatus;
}

type ResultTableProps = {
  rows: ResultRow[];
  loading: boolean;
  canManage: boolean;
  canPublish: boolean;
  onView: (row: ResultRow) => void;
  onEdit: (row: ResultRow) => void;
  onDelete: (row: ResultRow) => void | Promise<void>;
  onPublish: (row: ResultRow) => void | Promise<void>;
};

function getStatusTone(status: ResultStatus): "success" | "warning" | "neutral" {
  if (status === "Published") return "success";
  if (status === "Approved") return "neutral";
  return "warning";
}

export default function ResultTable({
  rows,
  loading,
  canManage,
  canPublish,
  onView,
  onEdit,
  onDelete,
  onPublish,
}: ResultTableProps) {
  if (loading) {
    return <EmptyState title="Loading results" description="Please wait while results are loaded." />;
  }

  if (rows.length === 0) {
    return <EmptyState title="No results found" description="Create a result record to get started." />;
  }

  return (
    <DataTable
      columns={[
        { key: "studentName", header: "Student" },
        { key: "className", header: "Class" },
        { key: "subjectName", header: "Subject" },
        { key: "teacherName", header: "Teacher" },
        { key: "academicYear", header: "Session" },
        { key: "term", header: "Term" },
        { key: "continuousAssessment", header: "CA" },
        { key: "examination", header: "Exam" },
        { key: "totalScore", header: "Total" },
        { key: "grade", header: "Grade" },
        {
          key: "status",
          header: "Status",
          render: (row: ResultRow) => <StatusBadge tone={getStatusTone(row.status)}>{row.status}</StatusBadge>,
        },
        {
          key: "id",
          header: "Actions",
          render: (row: ResultRow) => (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" aria-label={`View result for ${row.studentName}`} onClick={() => onView(row)} style={actionButtonStyle}>
                <Eye size={18} />
              </button>

              <button
                type="button"
                aria-label={`Edit result for ${row.studentName}`}
                onClick={() => onEdit(row)}
                style={actionButtonStyle}
                disabled={!canManage}
              >
                <Pencil size={18} />
              </button>

              <button
                type="button"
                aria-label={`Delete result for ${row.studentName}`}
                onClick={() => {
                  void onDelete(row);
                }}
                style={{ ...actionButtonStyle, color: "#dc2626" }}
                disabled={!canManage}
              >
                <Trash2 size={18} />
              </button>

              {row.status !== "Published" && canPublish ? (
                <button
                  type="button"
                  aria-label={`Publish result for ${row.studentName}`}
                  onClick={() => {
                    void onPublish(row);
                  }}
                  style={{ ...actionButtonStyle, color: "#1d4ed8" }}
                >
                  <Upload size={18} />
                </button>
              ) : null}
            </div>
          ),
        },
      ]}
      rows={rows}
      emptyMessage="No results found."
    />
  );
}

const actionButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  color: "#2E7D32",
};
