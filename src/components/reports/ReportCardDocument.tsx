import type { ReportCardData } from "../../types/reportCard";
import { calculateAgeFromDateOfBirth, getReportSummaryValues } from "../../utils/reportCardPresentation";

export default function ReportCardDocument({ report }: { report: ReportCardData }) {
  const schoolName = report.schoolSettings.school_name || "";
  const schoolLevel = "KINDERGARTEN AND ELEMENTARY SCHOOL";
  const pupilName = `${report.student.first_name} ${report.student.last_name}`.trim();
  const age = calculateAgeFromDateOfBirth(report.student.date_of_birth);
  const summary = getReportSummaryValues(report);
  const classDisplay = report.className?.trim() || "";

  return (
    <article className="report-card" id="report-card-preview">
      <header className="report-card-header official-header">
        {report.schoolSettings.logo_url ? (
          <img className="school-logo" src={report.schoolSettings.logo_url} alt="School Logo" />
        ) : null}
        <h1>{schoolName}</h1>
        <h2>{schoolLevel}</h2>
        <h3>{report.reportType === "Midterm" ? "MIDTERM PROGRESS REPORT" : "STATEMENT OF RESULT"}</h3>
        {report.schoolSettings.motto ? <p className="school-motto">{report.schoolSettings.motto}</p> : null}
      </header>

      <section className="report-card-meta official-meta">
        <div className="meta-row">
          <p>FOR: {report.term.toUpperCase()} TERM {report.reportType === "Midterm" ? "MIDTERM ASSESSMENT" : "EXAMINATION"} ({report.academicYear})</p>
          <p>TERM ENDING ON: {report.termEnding || ""}</p>
        </div>
        <div className="meta-row">
          <p className="pupil-name">NAME OF PUPIL: {pupilName}</p>
          <p>CLASS: {classDisplay}</p>
        </div>
        <div className="meta-row">
          <p>CLASS TEACHER: {report.classTeacherName || ""}</p>
        </div>
        <div className="meta-row">
          <p>AGE: {age ?? ""}</p>
          <p>NEXT TERM BEGINS: {report.nextTermBegins || ""}</p>
        </div>
        <div className="meta-row attendance-inline">
          <p>MAXIMUM ATTENDANCE: {report.attendance.maximumAttendance ?? ""}</p>
          <p>TIME PRESENT: {report.attendance.timesPresent ?? ""}</p>
          <p>TIME ABSENT: {report.attendance.timesAbsent ?? ""}</p>
        </div>
      </section>

      <section className="report-card-results official-results">
        <table>
          <thead>
            {report.reportType === "Midterm" ? (
              <tr>
                <th>SUBJECTS</th>
                <th>MIDTERM SCORE</th>
                <th>MAXIMUM SCORE</th>
                <th>SUBJECT TEACHER</th>
              </tr>
            ) : (
              <tr>
                <th>SUBJECTS</th>
                <th>CA(40) SCORE</th>
                <th>EXAM SCORE</th>
                <th>TOTAL SCORE</th>
                <th>GRADE POINT</th>
                <th>TEACHER'S REMARK</th>
              </tr>
            )}
          </thead>
          <tbody>
            {report.lines.map((line) => (
              <tr key={line.resultId}>
                {report.reportType === "Midterm" ? (
                  <>
                    <td>{line.subjectName}</td>
                    <td>{line.continuousAssessment ?? ""}</td>
                    <td>{line.maximumScore ?? ""}</td>
                    <td>{line.teacherName || ""}</td>
                  </>
                ) : (
                  <>
                    <td>{line.subjectName}</td>
                    <td>{line.continuousAssessment ?? ""}</td>
                    <td>{line.examination ?? ""}</td>
                    <td>{line.totalScore ?? ""}</td>
                    <td>{line.grade ?? ""}</td>
                    <td>{line.teacherRemark || ""}</td>
                  </>
                )}
              </tr>
            ))}
            {report.reportType === "Midterm" ? (
              <>
                <tr className="summary-row"><td>TOTAL MARK OBTAINED</td><td>{summary.totalMarksObtained ?? ""}</td><td colSpan={2}></td></tr>
                <tr className="summary-row"><td>TOTAL MARKS OBTAINABLE</td><td colSpan={3}>{summary.totalMarksObtainable ?? ""}</td></tr>
                <tr className="summary-row"><td>STUDENT PERCENTAGE</td><td colSpan={3}>{summary.studentPercentage === null ? "" : `${summary.studentPercentage.toFixed(2)}%`}</td></tr>
                <tr className="summary-row"><td>CLASS AVERAGE</td><td colSpan={3}>{report.classAverage === null ? "" : `${report.classAverage.toFixed(2)}%`}</td></tr>
              </>
            ) : (
              <>
                <tr className="summary-row">
                  <td>TOTAL MARK OBTAINED</td>
                  <td colSpan={2}></td>
                  <td>{summary.totalMarksObtained ?? ""}</td>
                  <td colSpan={2}></td>
                </tr>
                <tr className="summary-row">
                  <td>TOTAL MARKS OBTAINABLE</td>
                  <td colSpan={2}></td>
                  <td>{summary.totalMarksObtainable ?? ""}</td>
                  <td colSpan={2}></td>
                </tr>
                <tr className="summary-row">
                  <td>STUDENT PERCENTAGE</td>
                  <td colSpan={2}></td>
                  <td>{summary.studentPercentage === null ? "" : `${summary.studentPercentage.toFixed(2)}%`}</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr className="summary-row">
                  <td>CLASS AVERAGE</td>
                  <td colSpan={5}>{report.classAverage === null ? "" : `${report.classAverage.toFixed(2)}%`}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </section>

      <section className="official-comments">
        <div>
          <span>Class Teacher's Comment:</span>
          <p>{report.classTeacherComment || " "}</p>
        </div>
        <div>
          <span>Head Teacher's Comment:</span>
          <p>{report.headTeacherComment || " "}</p>
          <div className="official-signoff-assets">
            {report.schoolSettings.principal_signature_url ? (
              <img
                className="principal-signature"
                src={report.schoolSettings.principal_signature_url}
                alt="Head Teacher / Principal signature"
                onError={(event) => { event.currentTarget.style.display = "none"; }}
              />
            ) : null}
            {report.schoolSettings.school_stamp_url ? (
              <img
                className="school-stamp"
                src={report.schoolSettings.school_stamp_url}
                alt="School stamp"
                onError={(event) => { event.currentTarget.style.display = "none"; }}
              />
            ) : null}
          </div>
        </div>
      </section>

      {report.reportType === "End-of-Term" ? <section className="official-grading-block">
        <h4>GRADING</h4>
        <div className="grading-strip">
          {report.gradingScale.map((item) => (
            <span key={item.grade}>
              <strong>{item.min === 0 ? "Below 40" : `${item.min} - ${Math.floor(item.max)}`}</strong> {item.grade} {item.remark}
            </span>
          ))}
        </div>
      </section> : null}

      <footer className="report-card-footer official-footer">
        {report.schoolSettings.address ? <p><strong>Address:</strong> {report.schoolSettings.address}</p> : null}
        <p>
          {report.schoolSettings.phone ? <span><strong>Phone:</strong> {report.schoolSettings.phone}</span> : null}
          {report.schoolSettings.email ? <span><strong>Email:</strong> {report.schoolSettings.email}</span> : null}
          {report.schoolSettings.website ? <span><strong>Web:</strong> {report.schoolSettings.website}</span> : null}
        </p>
        {report.schoolSettings.report_footer ? <p>{report.schoolSettings.report_footer}</p> : null}
      </footer>
    </article>
  );
}
