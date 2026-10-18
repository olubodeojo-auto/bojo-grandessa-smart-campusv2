import { CornerUpLeft, Eye, Pencil, Trash2, Upload } from "lucide-react";
import type { CSSProperties } from "react";
import DataTable from "../../../components/tables/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import StatusBadge from "../../../components/ui/StatusBadge";
import type { ResultStatus } from "../../../types/result";
import type { ResultAssessmentType } from "../../../types/result";

export interface ResultRow {
  id: string;
  studentId: string;
  classId?: string;
  studentName: string;
  className: string;
  subjectName: string;
  teacherName: string;
  academicYear: string;
  term: "First" | "Second" | "Third";
  assessmentType: ResultAssessmentType;
  continuousAssessment: number | null;
  maximumScore: number | null;
  examination: number | null;
  totalScore: number | null;
  grade: string | null;
  remark: string | null;
  status: ResultStatus;
  createdBy?: string | null;
  submittedBy?: string | null;
  submittedByName?: string | null;
  submittedAt?: string | null;
  reviewReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  publishedBy?: string | null;
  publishedAt?: string | null;
}

type ResultTableProps = {
  rows: ResultRow[];
  loading: boolean;
  canEdit: (row: ResultRow) => boolean;
  canDelete: (row: ResultRow) => boolean;
  canPublish: (row: ResultRow) => boolean;
  canUnpublish: (row: ResultRow) => boolean;
  onView: (row: ResultRow) => void;
  onEdit: (row: ResultRow) => void;
  onDelete: (row: ResultRow) => void | Promise<void>;
  onReview: (row: ResultRow, decision: "publish" | "unpublish") => void | Promise<void>;
};

function getStatusTone(status: ResultStatus): "success" | "warning" | "neutral" {
  if (status === "Published") return "success";
  return "warning";
}

export default function ResultTable({
  rows,
  loading,
  canEdit,
  canDelete,
  canPublish,
  canUnpublish,
  onView,
  onEdit,
  onDelete,
  onReview,
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
        {
          key: "totalScore",
          header: "Total",
          render: (row: ResultRow) => row.assessmentType === "CA" ? "—" : row.totalScore ?? "—",
        },
        {
          key: "grade",
          header: "Grade",
          render: (row: ResultRow) => row.assessmentType === "CA" ? "—" : row.grade ?? "—",
        },
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
                disabled={!canEdit(row)}
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
                disabled={!canDelete(row)}
              >
                <Trash2 size={18} />
              </button>

              {canPublish(row) ? (
                <button type="button" aria-label={`Publish result for ${row.studentName}`} onClick={() => void onReview(row, "publish")} style={{ ...actionButtonStyle, color: "#1d4ed8" }}>
                  <Upload size={18} />
                </button>
              ) : null}
              {canUnpublish(row) ? (
                <button type="button" aria-label={`Unpublish result for ${row.studentName}`} onClick={() => void onReview(row, "unpublish")} style={{ ...actionButtonStyle, color: "#b45309" }}>
                  <CornerUpLeft size={18} />
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
