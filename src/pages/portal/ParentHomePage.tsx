import { ArrowRight, BookOpen, ClipboardList, Megaphone, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getParentStudents } from "../../services/studentService";
import { getAssignmentsForParent } from "../../services/assignmentService";
import { getReportHistoryByStudent } from "../../services/reportCardService";
import type { Student } from "../../types/student";
import type { Assignment } from "../../types/assignment";
import { getPublishedAnnouncements } from "../../services/announcementService";
import type { Announcement } from "../../types/announcement";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function studentName(student: Student): string {
  return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");
}

export default function ParentHomePage() {
  const { fullName } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [latestPublishedReport, setLatestPublishedReport] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([getParentStudents(), getAssignmentsForParent(), getPublishedAnnouncements(3)])
      .then(([studentRows, assignmentRows, announcementRows]) => {
        if (!active) return;
        setStudents(studentRows);
        setAssignments(assignmentRows);
        setAnnouncements(announcementRows);
        setSelectedId(studentRows[0]?.id ?? "");
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load your portal summary.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const child = students.find((student) => student.id === selectedId) ?? students[0];
  const pendingAssignments = assignments.length;

  useEffect(() => {
    if (!child) {
      setLatestPublishedReport("");
      return;
    }

    let active = true;
    void getReportHistoryByStudent(child.id, { parentScoped: true }).then((history) => {
      if (!active) return;
      const latest = history
        .flatMap((session) => session.entries.filter((entry) => entry.publishedCount > 0).map((entry) => `${session.academicYear} · ${entry.term}`))
        .at(0) ?? "";
      setLatestPublishedReport(latest);
    }).catch(() => {
      if (active) setLatestPublishedReport("");
    });

    return () => { active = false; };
  }, [child]);

  return (
    <main className="parent-portal-page">
      <section className="parent-portal-hero">
        <p className="parent-portal-eyebrow">Grandessa Smart Campus</p>
        <h1>{greeting()}, {fullName || "there"}</h1>
        <p>Here&apos;s what&apos;s happening with {child ? studentName(child) : "your child"}.</p>
      </section>

      {error ? <div className="parent-portal-alert" role="alert">{error}</div> : null}
      {loading ? <div className="parent-portal-state">Loading your portal...</div> : child ? (
        <>
          {students.length > 1 ? <label className="parent-portal-select-label">Viewing
            <select value={child.id} onChange={(event) => setSelectedId(event.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{studentName(student)}</option>)}</select>
          </label> : null}
          <section className="parent-child-card">
            <div className="parent-child-card__mark"><UsersRound size={24} /></div>
            <div>
              <p className="parent-portal-eyebrow">My Student</p>
              <h2>{studentName(child)}</h2>
              <p>{child.class_name || "Class not assigned"}</p>
              <span>Class Teacher: {child.class_teacher ? [child.class_teacher.first_name, child.class_teacher.last_name].filter(Boolean).join(" ") || "Not assigned" : "Not assigned"}</span>
            </div>
            <Link className="parent-portal-arrow-link" to="/portal/students" aria-label="View my student"><ArrowRight size={20} /></Link>
          </section>

          <section className="parent-portal-stat-grid">
            <Link to="/portal/assignments" className="parent-portal-stat-card"><ClipboardList size={22} /><strong>{pendingAssignments}</strong><span>Published assignments</span></Link>
            <Link to="/portal/reports" className="parent-portal-stat-card"><BookOpen size={22} /><strong>{latestPublishedReport || "View"}</strong><span>{latestPublishedReport ? "Latest published report" : "Reports and progress"}</span></Link>
            <Link to="/announcements" className="parent-portal-stat-card"><Megaphone size={22} /><strong>School</strong><span>Latest updates</span></Link>
          </section>
          <section>
            <div className="parent-section-heading"><h2>School Updates</h2><Link to="/announcements">View all</Link></div>
            {announcements.length > 0 ? <div className="parent-update-list">{announcements.map((announcement) => <Link className="parent-update" to="/announcements" key={announcement.id}><strong>{announcement.title}</strong><span>{new Date(announcement.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><p>{announcement.message.slice(0, 120)}{announcement.message.length > 120 ? "..." : ""}</p></Link>)}</div> : <div className="parent-portal-state">No published school updates at the moment.</div>}
          </section>
          <section>
            <div className="parent-section-heading"><h2>School Life</h2></div>
            <div className="parent-portal-stat-grid"><Link to="/gallery" className="parent-portal-stat-card"><UsersRound size={22} /><strong>Gallery</strong><span>See life at Grandessa</span></Link><Link to="/our-team" className="parent-portal-stat-card"><UsersRound size={22} /><strong>Our Team</strong><span>Meet the school team</span></Link></div>
          </section>
        </>
      ) : (
        <div className="parent-portal-state">No linked student is available for this account yet.</div>
      )}
    </main>
  );
}
