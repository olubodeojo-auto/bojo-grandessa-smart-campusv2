import { ArrowRight, BookOpen, ClipboardList, Megaphone, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getParentStudents } from "../../services/studentService";
import { getAssignmentsForParent } from "../../services/assignmentService";
import { getReportHistoryByStudent } from "../../services/reportCardService";
import type { Student } from "../../types/student";
import type { Assignment } from "../../types/assignment";
import type { ReportHistoryBySession } from "../../types/reportCard";
import { getPublishedAnnouncements } from "../../services/announcementService";
import type { Announcement } from "../../types/announcement";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function studentName(student: Student): string {
  return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");
}

function reportLink(studentId: string, academicYear: string, term: string, reportType: string, classId: string): string {
  const params = new URLSearchParams({ studentId, academicYear, term, reportType, classId });
  return `/portal/reports?${params.toString()}`;
}

export default function ParentHomePage() {
  const { fullName } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [reportHistories, setReportHistories] = useState<Record<string, ReportHistoryBySession[]>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([getParentStudents(), getAssignmentsForParent(), getPublishedAnnouncements(3)])
      .then(async ([studentRows, assignmentRows, announcementRows]) => {
        if (!active) return;
        setStudents(studentRows);
        setAssignments(assignmentRows);
        setAnnouncements(announcementRows);
        const historyRows = await Promise.all(studentRows.map(async (student) => {
          const history = await getReportHistoryByStudent(student.id, { parentScoped: true });
          return [student.id, history] as const;
        }));
        if (active) setReportHistories(Object.fromEntries(historyRows));
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load your portal summary.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="parent-portal-page">
      <section className="parent-portal-hero">
        <p className="parent-portal-eyebrow">Grandessa Smart Campus</p>
        <h1>{greeting()}, {fullName || "there"}</h1>
        <p>Here are your linked students and their published school results.</p>
      </section>

      {error ? <div className="parent-portal-alert" role="alert">{error}</div> : null}
      {loading ? <div className="parent-portal-state">Loading your family dashboard...</div> : students.length > 0 ? (
        <>
          <section aria-labelledby="parent-children-heading">
            <div className="parent-section-heading"><h2 id="parent-children-heading">Your Students</h2><Link to="/portal/students">View student details</Link></div>
            <div className="parent-dashboard-children">
              {students.map((student) => {
                const history = reportHistories[student.id] ?? [];
                const reportCount = history.reduce((total, session) => total + session.entries.length, 0);
                return (
                  <article className="parent-dashboard-child" key={student.id}>
                    <div className="parent-dashboard-child__identity">
                      <div className="parent-child-card__mark"><UsersRound size={22} /></div>
                      <div>
                        <p className="parent-portal-eyebrow">Linked Student</p>
                        <h3>{studentName(student)}</h3>
                        <p>{student.class_name || "Class not assigned"} · {student.admission_number || "Admission number unavailable"}</p>
                      </div>
                    </div>
                    <div className="parent-dashboard-child__reports">
                      <div className="parent-dashboard-child__reports-heading">
                        <strong>Published Results</strong>
                        <span>{reportCount} {reportCount === 1 ? "report" : "reports"}</span>
                      </div>
                      {history.length > 0 ? history.map((session) => (
                        <div className="parent-dashboard-session" key={session.academicYear}>
                          <h4>{session.academicYear}</h4>
                          {(["First", "Second", "Third"] as const).map((term) => {
                            const entries = session.entries.filter((entry) => entry.term === term);
                            if (entries.length === 0) return null;
                            return (
                              <div className="parent-dashboard-term" key={term}>
                                <span className="parent-dashboard-term__name">{term} Term</span>
                                <div className="parent-dashboard-result-links">
                                  {(["Midterm", "End-of-Term"] as const).map((type) => {
                                    const matching = entries.filter((entry) => entry.reportType === type);
                                    return matching.map((entry) => (
                                      <Link
                                        className="parent-dashboard-result-link"
                                        key={`${entry.classId}-${type}`}
                                        to={reportLink(student.id, session.academicYear, term, type, entry.classId)}
                                      >
                                        <BookOpen size={15} />
                                        <span>{type === "Midterm" ? "Midterm (CA)" : "End-of-Term"}</span>
                                        <ArrowRight size={14} />
                                      </Link>
                                    ));
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )) : <p className="parent-dashboard-no-results">No published results are available yet.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="parent-portal-stat-grid">
            <Link to="/portal/assignments" className="parent-portal-stat-card"><ClipboardList size={22} /><strong>{assignments.length}</strong><span>Published assignments</span></Link>
            <Link to="/announcements" className="parent-portal-stat-card"><Megaphone size={22} /><strong>School</strong><span>Latest updates</span></Link>
            <Link to="/portal/students" className="parent-portal-stat-card"><UsersRound size={22} /><strong>{students.length}</strong><span>Linked {students.length === 1 ? "student" : "students"}</span></Link>
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
        <div className="parent-portal-state">No linked students are available for this account yet. Please contact the school to confirm your parent account is linked.</div>
      )}
    </main>
  );
}
