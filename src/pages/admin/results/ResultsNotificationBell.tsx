import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import type { Result } from "../../../types/result";

export type ResultNotice = {
  id: string;
  classId: string;
  className: string;
  academicYear: string;
  term: Result["term"];
  assessmentType: Result["assessment_type"];
  status: "Submitted" | "Returned" | "Published";
  count: number;
  latestUpdatedAt: string;
  label: string;
  actors: string[];
};

type ResultsNotificationBellProps = {
  results: Result[];
  isAdministrator: boolean;
  isTeacher: boolean;
  onOpen: (notice: ResultNotice) => void;
};

const READ_KEY = "grandessa.results.notifications.read";

function readNoticeIds(): Set<string> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(READ_KEY) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : []);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.error("Unable to read saved results notification state.", error);
    return new Set();
  }
}

export default function ResultsNotificationBell({
  results,
  isAdministrator,
  isTeacher,
  onOpen,
}: ResultsNotificationBellProps) {
  const [readIds, setReadIds] = useState<Set<string>>(readNoticeIds);
  const [open, setOpen] = useState(false);
  const notices = useMemo(() => {
    const groups = new Map<string, ResultNotice>();
    results.forEach((result) => {
      const status = isAdministrator && result.status === "Submitted"
        ? "Submitted"
        : isTeacher && result.status === "Returned" && !result.published_at
          ? "Returned"
          : (isAdministrator || isTeacher) && result.status === "Published"
            ? "Published"
            : null;
      if (!status || !result.class_id) return;
      const key = [status, result.class_id, result.academic_year, result.term, result.assessment_type].join("|");
      const actor = status === "Submitted"
        ? result.submitted_by_name?.trim() || (result.submitted_by ? `Staff account ${result.submitted_by}` : "Teacher")
        : status === "Returned"
          ? result.reviewed_by ? `Administrator account ${result.reviewed_by}` : "Administrator"
          : result.published_by ? `Administrator account ${result.published_by}` : "Administrator";
      const current = groups.get(key);
      if (current) {
        current.count += 1;
        if (result.updated_at > current.latestUpdatedAt) current.latestUpdatedAt = result.updated_at;
        if (!current.actors.includes(actor)) current.actors.push(actor);
        return;
      }
      groups.set(key, {
        id: key,
        classId: result.class_id,
        className: result.class_name || "Class",
        academicYear: result.academic_year,
        term: result.term,
        assessmentType: result.assessment_type,
        status,
        count: 1,
        latestUpdatedAt: result.updated_at,
        label: status === "Submitted"
          ? "Results submitted for review"
          : status === "Returned"
            ? "Results returned for correction"
            : "Results published",
        actors: [actor],
      });
    });
    return [...groups.values()]
      .map((notice) => ({ ...notice, id: `${notice.id}|${notice.latestUpdatedAt}|${notice.count}` }))
      .sort((left, right) => right.latestUpdatedAt.localeCompare(left.latestUpdatedAt));
  }, [isAdministrator, isTeacher, results]);
  const unreadCount = notices.filter((notice) => !readIds.has(notice.id)).length;

  function openNotice(notice: ResultNotice): void {
    const next = new Set(readIds);
    next.add(notice.id);
    setReadIds(next);
    window.localStorage.setItem(READ_KEY, JSON.stringify([...next]));
    setOpen(false);
    onOpen(notice);
  }

  function markAllRead(): void {
    const next = new Set([...readIds, ...notices.map((notice) => notice.id)]);
    setReadIds(next);
    window.localStorage.setItem(READ_KEY, JSON.stringify([...next]));
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`Results notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#fff", cursor: "pointer" }}
      >
        <Bell size={16} />
        Results inbox
        {unreadCount > 0 ? <span style={{ borderRadius: 999, padding: "1px 7px", background: "#dc2626", color: "white", fontSize: 12 }}>{unreadCount}</span> : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Results notifications" style={{ position: "absolute", zIndex: 30, right: 0, top: "calc(100% + 8px)", width: "min(380px, 90vw)", maxHeight: 420, overflow: "auto", padding: 12, border: "1px solid #cbd5e1", borderRadius: 12, background: "white", boxShadow: "0 12px 30px rgba(15,23,42,.16)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <strong>Results inbox</strong>
            <button type="button" onClick={markAllRead} disabled={unreadCount === 0} style={{ border: 0, background: "none", color: "#166534", cursor: "pointer" }}>Mark all read</button>
          </div>
          {notices.length === 0 ? <p style={{ margin: 0, color: "#64748b" }}>No results updates need your attention.</p> : (
            <div style={{ display: "grid", gap: 8 }}>
              {notices.map((notice) => (
                <button key={notice.id} type="button" onClick={() => openNotice(notice)} style={{ display: "grid", gap: 3, textAlign: "left", padding: 10, border: "1px solid #e2e8f0", borderRadius: 9, background: readIds.has(notice.id) ? "#fff" : "#f0fdf4", cursor: "pointer" }}>
                  <strong>{notice.label}{readIds.has(notice.id) ? "" : " · New"}</strong>
                  <span>{notice.className} · {notice.assessmentType === "CA" ? "Midterm Report" : "End-of-Term Report"}</span>
                  <span>{notice.term} Term {notice.academicYear} · {notice.count} subject result(s)</span>
                  <span>
                    {notice.status === "Submitted" ? "Submitted by" : notice.status === "Returned" ? "Returned by" : "Published by"}: {notice.actors.join(", ")}
                  </span>
                  <time dateTime={notice.latestUpdatedAt}>{new Date(notice.latestUpdatedAt).toLocaleString()}</time>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
