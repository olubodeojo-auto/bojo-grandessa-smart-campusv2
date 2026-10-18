import { ChevronDown, ChevronUp, CornerUpLeft, Eye, Pencil, Send, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import EmptyState from "../../../components/ui/EmptyState";
import type { ResultStatus } from "../../../types/result";
import type { ResultRow } from "./ResultTable";

interface ResultGroup {
  studentId: string;
  studentName: string;
  className: string;
  admissionNumber: string;
  subjectCount: number;
  statuses: ResultStatus[];
  rows: ResultRow[];
}

type ResultTableGroupedProps = {
  rows: ResultRow[];
  loading: boolean;
  canEdit: (row: ResultRow) => boolean;
  canDelete: (row: ResultRow) => boolean;
  canSubmit: (row: ResultRow) => boolean;
  canReturn: (row: ResultRow) => boolean;
  canPublish: (row: ResultRow) => boolean;
  canUnpublish: (row: ResultRow) => boolean;
  onView: (row: ResultRow) => void;
  onEdit: (row: ResultRow) => void;
  onDelete: (row: ResultRow) => void | Promise<void>;
  onSubmit: (row: ResultRow) => void | Promise<void>;
  onReview: (row: ResultRow, decision: "publish" | "return" | "unpublish") => void | Promise<void>;
};

function extractAdmissionNumber(studentName: string): string {
  const match = studentName.match(/\(([^)]+)\)$/);
  return match ? match[1] : "";
}

export default function ResultTableGrouped({
  rows,
  loading,
  canEdit,
  canDelete,
  canSubmit,
  canReturn,
  canPublish,
  canUnpublish,
  onView,
  onEdit,
  onDelete,
  onSubmit,
  onReview,
}: ResultTableGroupedProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (loading) {
    return <EmptyState title="Loading results" description="Please wait while results are loaded." />;
  }

  if (rows.length === 0) {
    return <EmptyState title="No results found" description="Create a result record to get started." />;
  }

  const groupMap = new Map<string, ResultGroup>();

  rows.forEach((row) => {
    const groupKey = row.studentId;
    
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        studentId: row.studentId,
        studentName: row.studentName,
        className: row.className,
        admissionNumber: extractAdmissionNumber(row.studentName),
        subjectCount: 0,
        statuses: [],
        rows: [],
      });
    }

    const group = groupMap.get(groupKey)!;
    if (!group.className.split(" · ").includes(row.className)) {
      group.className = group.className ? `${group.className} · ${row.className}` : row.className;
    }
    group.subjectCount += 1;
    if (!group.statuses.includes(row.status)) group.statuses.push(row.status);
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
    <div
      className="card"
      role="region"
      aria-label="Pupil results; scroll horizontally to view all subject columns"
      tabIndex={0}
      style={{ minWidth: 0, overflowX: "auto" }}
    >
      <div style={{ display: "grid", gap: 0 }}>
        {groups.map((group) => {
          const groupKey = group.studentId;
          const isExpanded = expandedGroups.has(groupKey);

          return (
            <div key={groupKey} style={{ borderBottom: "1px solid #e5e7eb" }}>
              {/* Group Header */}
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? `result-subjects-${groupKey}` : undefined}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} results for ${group.studentName}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px minmax(180px,1fr) minmax(140px,1fr) 100px 120px 40px",
                  gap: 12,
                  padding: 14,
                  alignItems: "center",
                  background: isExpanded ? "#f9fafb" : "transparent",
                  cursor: "pointer",
                  userSelect: "none",
                  width: "100%",
                  border: 0,
                  color: "inherit",
                  font: "inherit",
                  textAlign: "left",
                }}
                onClick={() => toggleGroup(groupKey)}
              >
                {/* Expand Toggle */}
                <span style={{ display: "flex", justifyContent: "center" }}>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </span>

                {/* Student & Class */}
                <span style={{ display: "block" }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#1f2937" }}>{group.studentName}</span>
                  <span style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 2 }}>{group.className}</span>
                </span>

                <span style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: 12, color: "#6b7280" }}>Reports</span>
                  <span style={{ display: "block", fontWeight: 500, fontSize: 14, color: "#374151" }}>{group.rows.length} subject entries</span>
                </span>

                <span style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: 12, color: "#6b7280" }}>Subjects</span>
                  <span style={{ display: "block", fontWeight: 500, fontSize: 14, color: "#374151" }}>{group.subjectCount}</span>
                </span>

                <span style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: 12, color: "#6b7280" }}>Workflow</span>
                  <span style={{ display: "block", fontWeight: 500, fontSize: 13, color: "#374151" }}>{group.statuses.join(" · ")}</span>
                </span>

                <span />
              </button>

              {/* Expanded Subject Results */}
              {isExpanded && (
                <div id={`result-subjects-${groupKey}`} style={{ background: "#fafafa", borderTop: "1px solid #e5e7eb" }}>
                  <table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Class</th>
                        <th style={thStyle}>Session / Term</th>
                        <th style={thStyle}>Report</th>
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
                          <td style={tdStyle}>{row.className}</td>
                          <td style={tdStyle}>{row.academicYear} · {row.term}</td>
                          <td style={tdStyle}>{row.assessmentType === "CA" ? "Midterm" : "End-of-Term"}</td>
                          <td style={tdStyle}>{row.subjectName}</td>
                          <td style={tdStyle}>{row.teacherName}</td>
                          <td style={tdStyle}>{row.assessmentType === "CA" && row.maximumScore !== null ? `${row.continuousAssessment ?? "—"} / ${row.maximumScore}` : row.continuousAssessment ?? "—"}</td>
                          <td style={tdStyle}>{row.examination ?? "—"}</td>
                          <td style={tdStyle}>{row.assessmentType === "CA" ? "—" : row.totalScore ?? "—"}</td>
                          <td style={tdStyle}>{row.assessmentType === "CA" ? "—" : row.grade ?? "—"}</td>
                          <td style={tdStyle}>{row.assessmentType === "CA" ? "—" : row.remark ?? "—"}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                aria-label={`View Details for ${row.studentName} - ${row.subjectName}`}
                                onClick={() => onView(row)}
                                style={actionButtonStyle}
                              >
                                <Eye size={16} /> View Details
                              </button>

                              <button
                                type="button"
                                aria-label={`Edit Result for ${row.studentName} - ${row.subjectName}`}
                                onClick={() => onEdit(row)}
                                style={{ ...actionButtonStyle, opacity: canEdit(row) ? 1 : 0.55 }}
                                disabled={!canEdit(row)}
                                title={!canEdit(row)
                                  ? row.status === "Published"
                                    ? "Unpublish this result before editing it."
                                    : "You do not have permission to edit this result."
                                  : undefined}
                              >
                                <Pencil size={16} /> Edit Result
                              </button>

                              {canDelete(row) ? (
                                <button
                                  type="button"
                                  aria-label={`Delete result for ${row.studentName} - ${row.subjectName}`}
                                  onClick={() => void onDelete(row)}
                                  style={{ ...actionButtonStyle, color: "#dc2626" }}
                                >
                                  <Trash2 size={16} /> Delete
                                </button>
                              ) : null}

                              {canPublish(row) ? (
                                <button type="button" aria-label={`Publish Result for ${row.studentName} - ${row.subjectName}`} onClick={() => void onReview(row, "publish")} style={{ ...actionButtonStyle, color: "#1d4ed8" }}>
                                  <Upload size={16} /> Publish Result
                                </button>
                              ) : null}

                              {canSubmit(row) ? (
                                <button type="button" aria-label={`Submit for Review for ${row.studentName} - ${row.subjectName}`} onClick={() => void onSubmit(row)} style={{ ...actionButtonStyle, color: "#1d4ed8" }}>
                                  <Send size={16} /> Submit for Review
                                </button>
                              ) : null}

                              {canReturn(row) ? (
                                <button type="button" aria-label={`Return for Correction for ${row.studentName} - ${row.subjectName}`} onClick={() => void onReview(row, "return")} style={{ ...actionButtonStyle, color: "#b45309" }}>
                                  <CornerUpLeft size={16} /> Return for Correction
                                </button>
                              ) : null}

                              {canUnpublish(row) ? (
                                <button type="button" aria-label={`Unpublish for ${row.studentName} - ${row.subjectName}`} onClick={() => void onReview(row, "unpublish")} style={{ ...actionButtonStyle, color: "#b45309" }}>
                                  <CornerUpLeft size={16} /> Unpublish
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
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  padding: "5px 7px",
  color: "#2E7D32",
  fontSize: 12,
  whiteSpace: "nowrap",
};
