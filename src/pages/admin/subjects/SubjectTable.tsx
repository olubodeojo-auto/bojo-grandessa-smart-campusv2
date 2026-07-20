import { Archive, Eye, Pencil } from "lucide-react";
import type { CSSProperties } from "react";
import type { Subject } from "../../../types/subject";
import DataTable from "../../../components/tables/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import StatusBadge from "../../../components/ui/StatusBadge";

interface SubjectTableProps {
  subjects: Subject[];
  loading: boolean;
  onView: (subject: Subject) => void;
  onEdit: (subject: Subject) => void;
  onArchive: (subject: Subject) => void | Promise<void>;
}

export default function SubjectTable({ subjects, loading, onView, onEdit, onArchive }: SubjectTableProps) {
  if (loading) {
    return <EmptyState title="Loading subjects" description="Please wait while your subject list loads." />;
  }

  if (subjects.length === 0) {
    return <EmptyState title="No subjects found" description="Create a subject to get started." />;
  }

  return (
    <DataTable
      columns={[
        { key: "subject_code", header: "Subject Code" },
        { key: "subject_name", header: "Subject Name" },
        { key: "department", header: "Department" },
        { key: "academic_level", header: "Academic Level" },
        {
          key: "status",
          header: "Status",
          render: (subject: Subject) => <StatusBadge tone={subject.status === "Active" ? "success" : "warning"}>{subject.status}</StatusBadge>,
        },
        {
          key: "id",
          header: "Actions",
          render: (subject: Subject) => (
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
          ),
        },
      ]}
      rows={subjects}
      emptyMessage="No subjects found."
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
