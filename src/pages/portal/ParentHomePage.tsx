import { ArrowRight, BookOpen, ClipboardList, Megaphone, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getParentStudents } from "../../services/studentService";
import { getAssignmentsForParent } from "../../services/assignmentService";
import { getReportHistoriesByStudents } from "../../services/reportCardService";
import type { Student } from "../../types/student";
import type { Assignment } from "../../types/assignment";
import type { ReportHistoryBySession } from "../../types/reportCard";
import { getPublishedAnnouncements } from "../../services/announcementService";
import type { Announcement } from "../../types/announcement";
import { formatStudentName } from "../../utils/reportCardPresentation";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function studentName(student: Student): string {
  return formatStudentName(student);
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
  const [reportErrors, setReportErrors] = useState<Record<string, string>>({});
  const [assignmentsUnavailable, setAssignmentsUnavailable] = useState(false);
  const [announcementsUnavailable, setAnnouncementsUnavailable] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDashboard(): Promise<void> {
      const [studentsResult, assignmentsResult, announcementsResult] = await Promise.allSettled([
        getParentStudents(),
        getAssignmentsForParent(),
        getPublishedAnnouncements(3),
      ]);
      if (!active) return;

      if (studentsResult.status === "rejected") {
        setError(studentsResult.reason instanceof Error
          ? studentsResult.reason.message
          : "Unable to load your linked students.");
        return;
      }

      const studentRows = studentsResult.value;
      setStudents(studentRows);
      if (assignmentsResult.status === "fulfilled") {
        setAssignments(assignmentsResult.value);
      } else {
        setAssignmentsUnavailable(true);
      }
      if (announcementsResult.status === "fulfilled") {
        setAnnouncements(announcementsResult.value);
      } else {
        setAnnouncementsUnavailable(true);
      }

      if (studentRows.length === 0) return;
      try {
        const histories = await getReportHistoriesByStudents(
          studentRows.map((student) => student.id),
          { parentScoped: true },
        );
        if (active) setReportHistories(histories);
      } catch {
        if (active) {
          setReportErrors(Object.fromEntries(studentRows.map((student) => [
            student.id,
            "Published results could not be loaded right now. Refresh this page and try again.",
          ])));
        }
      }
    }

    void loadDashboard().finally(() => {
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
                const reportError = reportErrors[student.id];
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
                      {reportError ? <p className="parent-dashboard-no-results" role="alert">{reportError}</p> : history.length > 0 ? history.map((session) => (
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
                                        <span>{type === "Midterm" ? `Midterm (CA) · ${entry.resultCount} subjects` : `End-of-Term · ${entry.resultCount} published rows`}</span>
                                        <ArrowRight size={14} />
                                      </Link>
                                    ));
                                  })}
                                </div>
                                {entries.some((entry) => entry.reportType === "Midterm")
                                  && !entries.some((entry) => entry.reportType === "End-of-Term") ? (
                                    <p className="parent-dashboard-no-results">End-of-Term results will appear here when the school publishes them.</p>
                                  ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )) : <p className="parent-dashboard-no-results">No published results are available yet. End-of-Term results will appear here when the school publishes them.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="parent-portal-stat-grid">
            <Link to="/portal/assignments" className="parent-portal-stat-card"><ClipboardList size={22} /><strong>{assignments.length}</strong><span>{assignmentsUnavailable ? "Assignments temporarily unavailable" : "Published assignments"}</span></Link>
            <Link to="/announcements" className="parent-portal-stat-card"><Megaphone size={22} /><strong>School</strong><span>Latest updates</span></Link>
            <Link to="/portal/students" className="parent-portal-stat-card"><UsersRound size={22} /><strong>{students.length}</strong><span>Linked {students.length === 1 ? "student" : "students"}</span></Link>
          </section>
          <section>
            <div className="parent-section-heading"><h2>School Updates</h2><Link to="/announcements">View all</Link></div>
            {announcementsUnavailable ? <div className="parent-portal-state">School updates are temporarily unavailable. Your student results remain available above.</div> : announcements.length > 0 ? <div className="parent-update-list">{announcements.map((announcement) => <Link className="parent-update" to="/announcements" key={announcement.id}><strong>{announcement.title}</strong><span>{new Date(announcement.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><p>{announcement.message.slice(0, 120)}{announcement.message.length > 120 ? "..." : ""}</p></Link>)}</div> : <div className="parent-portal-state">No published school updates at the moment.</div>}
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
