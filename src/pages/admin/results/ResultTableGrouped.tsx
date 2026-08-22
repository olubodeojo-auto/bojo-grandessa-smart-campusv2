import { ChevronDown, ChevronUp, Eye, Pencil, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import EmptyState from "../../../components/ui/EmptyState";
import StatusBadge from "../../../components/ui/StatusBadge";
import type { ResultStatus } from "../../../types/result";
import type { ResultRow } from "./ResultTable";

interface ResultGroup {
  studentName: string;
  className: string;
  academicYear: string;
  term: string;
  admissionNumber: string;
  subjectCount: number;
  status: ResultStatus;
  rows: ResultRow[];
}

type ResultTableGroupedProps = {
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

function extractAdmissionNumber(studentName: string): string {
  const match = studentName.match(/\(([^)]+)\)$/);
  return match ? match[1] : "";
}

export default function ResultTableGrouped({
  rows,
  loading,
  canManage,
  canPublish,
  onView,
  onEdit,
  onDelete,
  onPublish,
}: ResultTableGroupedProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (loading) {
    return <EmptyState title="Loading results" description="Please wait while results are loaded." />;
  }

  if (rows.length === 0) {
    return <EmptyState title="No results found" description="Create a result record to get started." />;
  }

  // Group rows by student_id + academic_year + term
  const groupMap = new Map<string, ResultGroup>();

  rows.forEach((row) => {
    const groupKey = `${row.studentName}|${row.academicYear}|${row.term}`;
    
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        studentName: row.studentName,
        className: row.className,
        academicYear: row.academicYear,
        term: row.term,
        admissionNumber: extractAdmissionNumber(row.studentName),
        subjectCount: 0,
        status: row.status,
        rows: [],
      });
    }

    const group = groupMap.get(groupKey)!;
    group.subjectCount += 1;
    group.rows.push(row);
  });

  const groups = Array.from(groupMap.values());

  function toggleGroup(groupKey: string): void {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gap: 0 }}>
        {groups.map((group) => {
          const groupKey = `${group.studentName}|${group.academicYear}|${group.term}`;
          const isExpanded = expandedGroups.has(groupKey);

          return (
            <div key={groupKey} style={{ borderBottom: "1px solid #e5e7eb" }}>
              {/* Group Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 120px 120px 100px 100px 80px",
                  gap: 12,
                  padding: 14,
                  alignItems: "center",
                  background: isExpanded ? "#f9fafb" : "transparent",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => toggleGroup(groupKey)}
              >
                {/* Expand Toggle */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {/* Student & Class */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1f2937" }}>{group.studentName}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{group.className}</div>
                </div>

                {/* Session */}
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Session</div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: "#374151" }}>{group.academicYear}</div>
                </div>

                {/* Term */}
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Term</div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: "#374151" }}>{group.term}</div>
                </div>

                {/* Subject Count */}
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Subjects</div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: "#374151" }}>{group.subjectCount}</div>
                </div>

                {/* Status */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <StatusBadge tone={getStatusTone(group.status)}>{group.status}</StatusBadge>
                </div>

                {/* Spacer */}
                <div />
              </div>

              {/* Expanded Subject Results */}
              {isExpanded && (
                <div style={{ background: "#fafafa", borderTop: "1px solid #e5e7eb" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, paddingLeft: 52 }}>Subject</th>
                        <th style={thStyle}>Teacher</th>
                        <th style={thStyle}>CA</th>
                        <th style={thStyle}>Exam</th>
                        <th style={thStyle}>Total</th>
                        <th style={thStyle}>Grade</th>
                        <th style={thStyle}>Remark</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id} style={{ background: "white" }}>
                          <td style={tdStyle}>{row.subjectName}</td>
                          <td style={tdStyle}>{row.teacherName}</td>
                          <td style={tdStyle}>{row.continuousAssessment}</td>
                          <td style={tdStyle}>{row.examination}</td>
                          <td style={tdStyle}>{row.totalScore}</td>
                          <td style={tdStyle}>{row.grade}</td>
                          <td style={tdStyle}>{row.remark}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                aria-label={`View result for ${row.studentName} - ${row.subjectName}`}
                                onClick={() => onView(row)}
                                style={actionButtonStyle}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                aria-label={`Edit result for ${row.studentName} - ${row.subjectName}`}
                                onClick={() => onEdit(row)}
                                style={actionButtonStyle}
                                disabled={!canManage}
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                type="button"
                                aria-label={`Delete result for ${row.studentName} - ${row.subjectName}`}
                                onClick={() => {
                                  void onDelete(row);
                                }}
                                style={{ ...actionButtonStyle, color: "#dc2626" }}
                                disabled={!canManage}
                              >
                                <Trash2 size={16} />
                              </button>

                              {row.status !== "Published" && canPublish ? (
                                <button
                                  type="button"
                                  aria-label={`Publish result for ${row.studentName} - ${row.subjectName}`}
                                  onClick={() => {
                                    void onPublish(row);
                                  }}
                                  style={{ ...actionButtonStyle, color: "#1d4ed8" }}
                                >
                                  <Upload size={16} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  fontWeight: 600,
  fontSize: 12,
  background: "#f3f4f6",
};

const tdStyle: CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 13,
};

const actionButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  color: "#2E7D32",
};
