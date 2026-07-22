import type { ReportCardData } from "../../types/reportCard";

export default function ReportCardDocument({ report }: { report: ReportCardData }) {
  const schoolName = report.schoolSettings.school_name || "";
  const schoolLevel = report.template.level === "Kindergarten" ? "KINDERGARTEN" : "ELEMENTARY";
  const pupilName = `${report.student.first_name} ${report.student.last_name}`.trim();
  const ageText = report.student.date_of_birth
    ? Math.max(0, new Date().getFullYear() - new Date(report.student.date_of_birth).getFullYear()).toString()
    : "";

  const gradingText = report.gradingScale
    .map((item) => {
      const range = item.min === 0 ? "Below 40" : `${item.min} - ${Math.floor(item.max)}`;
      return `${range}  ${item.grade}  ${item.remark}`;
    })
    .join(" | ");

  return (
    <article className="report-card" id="report-card-preview">
      <header className="report-card-header official-header">
        {report.schoolSettings.logo_url ? (
          <img className="school-logo" src={report.schoolSettings.logo_url} alt="School Logo" />
        ) : null}
        <h1>{schoolName}</h1>
        <h2>{schoolLevel} SCHOOL</h2>
        <h3>STATEMENT OF RESULT</h3>
        {report.schoolSettings.motto ? <p className="school-motto">{report.schoolSettings.motto}</p> : null}
      </header>

      <section className="report-card-meta official-meta">
        <div className="meta-row">
          <p>FOR: {report.term.toUpperCase()} TERM EXAMINATION ({report.academicYear})</p>
          <p>TERM ENDING ON: {report.termEnding}</p>
        </div>
        <div className="meta-row">
          <p>NAME OF PUPIL: {pupilName}</p>
          <p>CLASS: {report.className}</p>
        </div>
        <div className="meta-row">
          <p>AGE: {ageText ? `${ageText}+` : ""}</p>
          <p>NEXT TERM BEGINS: {report.nextTermBegins}</p>
        </div>
        <div className="meta-row attendance-inline">
          <p>MAXIMUM ATTENDANCE: {report.attendance.maximumAttendance}</p>
          <p>TIME PRESENT: {report.attendance.timesPresent}</p>
          <p>TIME ABSENT: {report.attendance.timesAbsent}</p>
        </div>
      </section>

      <section className="report-card-results official-results">
        <table>
          <thead>
            <tr>
              <th>SUBJECTS</th>
              <th>CA(40) SCORE</th>
              <th>EXAM SCORE</th>
              <th>TOTAL SCORE</th>
              <th>GRADE POINT</th>
              <th>TEACHER'S REMARK</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((line) => (
              <tr key={line.resultId}>
                <td>{line.subjectName}</td>
                <td>{line.continuousAssessment}</td>
                <td>{line.examination}</td>
                <td>{line.totalScore}</td>
                <td>{line.grade}</td>
                <td>{line.teacherRemark}</td>
              </tr>
            ))}
            <tr className="summary-row">
              <td>TOTAL MARK OBTAINED</td>
              <td colSpan={2}></td>
              <td>{report.totalMarksObtained}</td>
              <td colSpan={2}></td>
            </tr>
            <tr className="summary-row">
              <td>TOTAL MARKS OBTAINABLE</td>
              <td colSpan={2}></td>
              <td>{report.totalMarksObtainable}</td>
              <td colSpan={2}></td>
            </tr>
            <tr className="summary-row">
              <td>STUDENT PERCENTAGE</td>
              <td colSpan={2}></td>
              <td>{report.studentPercentage}%</td>
              <td>{report.gradingScale.find((item) => report.studentPercentage >= item.min && report.studentPercentage <= item.max)?.grade ?? ""}</td>
              <td>{report.gradingScale.find((item) => report.studentPercentage >= item.min && report.studentPercentage <= item.max)?.remark ?? ""}</td>
            </tr>
            <tr className="summary-row">
              <td>CLASS AVERAGE</td>
              <td colSpan={5}>{report.classAverage}%</td>
            </tr>
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
        </div>
      </section>

      <section className="official-grading-block">
        <h4>GRADING</h4>
        <p>{gradingText}</p>
      </section>

      <footer className="report-card-footer official-footer">
        {report.schoolSettings.address ? <p>{report.schoolSettings.address}</p> : null}
        <p>
          {[report.schoolSettings.phone, report.schoolSettings.email, report.schoolSettings.website]
            .filter(Boolean)
            .join(" | ")}
        </p>
        {report.schoolSettings.report_footer ? <p>{report.schoolSettings.report_footer}</p> : null}
      </footer>
    </article>
  );
}
