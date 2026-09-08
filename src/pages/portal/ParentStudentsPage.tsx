import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getParentStudents } from "../../services/studentService";
import type { Student } from "../../types/student";

function studentName(student: Student): string {
  return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");
}

export default function ParentStudentsPage() {
  const { fullName } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getParentStudents()
      .then((rows) => {
        if (!active) return;
        setStudents(rows);
        setSelectedId(rows[0]?.id ?? "");
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load your students.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const student = students.find((item) => item.id === selectedId) ?? students[0];
  const teacherName = student?.class_teacher ? [student.class_teacher.first_name, student.class_teacher.last_name].filter(Boolean).join(" ") || "Not assigned" : "Not assigned";

  return (
    <main className="parent-portal-page">
      <section className="parent-portal-page-heading">
        <p className="parent-portal-eyebrow">For {fullName || "your family"}</p>
        <h1>My Child{students.length > 1 ? "ren" : ""}</h1>
        <p>Simple, read-only information about the children linked to your account.</p>
      </section>
      {error ? <div className="parent-portal-alert" role="alert">{error}</div> : null}
      {loading ? <div className="parent-portal-state">Loading student information...</div> : students.length === 0 ? <div className="parent-portal-state">No linked student is available for this account.</div> : (
        <>
          {students.length > 1 ? (
            <label className="parent-portal-select-label">Choose a student
              <select value={student?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
                {students.map((item) => <option key={item.id} value={item.id}>{studentName(item)}</option>)}
              </select>
            </label>
          ) : null}
          {student ? (
            <section className="parent-student-detail">
              <div className="parent-student-detail__identity">
                <div className="parent-child-avatar">{student.first_name.charAt(0)}{student.last_name.charAt(0)}</div>
                <div><p className="parent-portal-eyebrow">Student profile</p><h2>{studentName(student)}</h2><p>{student.class_name || "Class not assigned"}</p></div>
              </div>
              <div className="parent-student-detail__grid">
                <div><span>Class Teacher</span><strong>{teacherName}</strong></div>
                <div><span>Admission Number</span><strong>{student.admission_number}</strong></div>
                <div><span>Status</span><strong>{student.status}</strong></div>
                <div><span>Admission Date</span><strong>{student.admission_date || "Not available"}</strong></div>
              </div>
              <div className="parent-student-contact-note">Need to update your child&apos;s information? Please contact the school office and we&apos;ll be happy to help.</div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
