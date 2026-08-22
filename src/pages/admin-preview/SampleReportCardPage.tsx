import { ArrowLeft, ArrowRight, Printer } from "lucide-react";
import { Link } from "react-router-dom";

type SubjectResult = {
  subject: string;
  ca: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
};

type BehaviorRating = {
  trait: string;
  score: number;
};

const studentInfo = [
  { label: "Student Name", value: "ADEBAYO DAVID OJO" },
  { label: "Admission Number", value: "GSC-2025-018" },
  { label: "Class", value: "Primary 5 Gold" },
  { label: "Gender", value: "Male" },
  { label: "Age", value: "10 Years" },
  { label: "Attendance", value: "96%" },
  { label: "House", value: "Blue House" },
  { label: "Class Teacher", value: "Mrs Esther Johnson" },
] as const;

const subjectResults: SubjectResult[] = [
  { subject: "English", ca: 36, exam: 54, total: 90, grade: "A", remark: "Excellent" },
  { subject: "Mathematics", ca: 34, exam: 56, total: 90, grade: "A", remark: "Excellent" },
  { subject: "Basic Science", ca: 35, exam: 52, total: 87, grade: "A", remark: "Very Good" },
  { subject: "Basic Technology", ca: 33, exam: 50, total: 83, grade: "A", remark: "Very Good" },
  { subject: "ICT", ca: 37, exam: 55, total: 92, grade: "A", remark: "Outstanding" },
  { subject: "Social Studies", ca: 33, exam: 51, total: 84, grade: "A", remark: "Very Good" },
  { subject: "Civic Education", ca: 32, exam: 50, total: 82, grade: "A", remark: "Very Good" },
  { subject: "CRS", ca: 34, exam: 53, total: 87, grade: "A", remark: "Very Good" },
  { subject: "Yoruba", ca: 31, exam: 49, total: 80, grade: "A", remark: "Very Good" },
  { subject: "Creative Arts", ca: 36, exam: 52, total: 88, grade: "A", remark: "Excellent" },
  { subject: "Physical & Health Education", ca: 35, exam: 51, total: 86, grade: "A", remark: "Excellent" },
];

const summaryStats = [
  { label: "Average", value: "88%" },
  { label: "Overall Grade", value: "A" },
  { label: "Class Position", value: "3rd of 28" },
  { label: "Promotion Status", value: "PROMOTED" },
] as const;

const behavioralRatings: BehaviorRating[] = [
  { trait: "Punctuality", score: 5 },
  { trait: "Leadership", score: 5 },
  { trait: "Neatness", score: 4 },
  { trait: "Communication", score: 5 },
  { trait: "Teamwork", score: 4 },
  { trait: "Creativity", score: 5 },
];

function gradeBadgeClass(grade: string): string {
  if (grade === "A") {
    return "sample-report-card-grade sample-report-card-grade--a";
  }

  if (grade === "B") {
    return "sample-report-card-grade sample-report-card-grade--b";
  }

  if (grade === "C") {
    return "sample-report-card-grade sample-report-card-grade--c";
  }

  return "sample-report-card-grade sample-report-card-grade--d";
}

function starRating(score: number): string {
  return `${"★".repeat(score)}${"☆".repeat(5 - score)}`;
}

export default function SampleReportCardPage() {
  return (
    <section className="admin-preview-page sample-report-card-page">
      <header className="admin-preview-page-header">
        <div>
          <p className="admin-preview-kicker">Administrator Preview</p>
          <h1>Sample Report Card</h1>
          <p>
            This page demonstrates the appearance of the final academic report card. No live student
            data is displayed.
          </p>
        </div>

        <div className="admin-preview-header-actions sample-report-card-actions" aria-label="Top Actions">
          <button type="button" className="admin-preview-secondary-action">
            <Printer size={16} />
            Print Preview
          </button>

          <Link to="/administrator-preview" className="admin-preview-secondary-action sample-report-card-link-action">
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>

          <Link to="/administrator-preview#preview-modules" className="admin-preview-primary-action sample-report-card-link-action">
            <ArrowRight size={16} />
            Back to Modules
          </Link>
        </div>
      </header>

      <article className="sample-report-card-sheet" aria-label="Academic report card preview">
        <header className="sample-report-card-sheet__header">
          <div>
            <p className="sample-report-card-eyebrow">Grandessa Smart Campus</p>
            <p className="sample-report-card-location">Ikorodu, Lagos</p>
            <h2>ACADEMIC REPORT CARD</h2>
            <p className="sample-report-card-motto">Learn To Be Great</p>

            <div className="sample-report-card-meta-row">
              <span>Academic Session: 2025/2026</span>
              <span>Term: Third Term</span>
            </div>
          </div>

          <div className="sample-report-card-media-grid" aria-label="School branding and student identity preview">
            <figure className="sample-report-card-logo-wrap">
              <img
                src="/client-resources/branding/grandessa-logo-primary.png"
                alt="Grandessa School logo"
                className="sample-report-card-logo"
              />
            </figure>
            <div className="sample-report-card-passport" role="img" aria-label="Sample student passport avatar">
              <span className="sample-report-card-passport__ring" />
              <span className="sample-report-card-passport__head" />
              <span className="sample-report-card-passport__body" />
              <small>Sample Avatar</small>
            </div>
          </div>
        </header>

        <section className="admin-preview-panel sample-report-card-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Student Information</h3>
              <p>Comprehensive learner profile for the current term.</p>
            </div>
          </div>

          <dl className="sample-report-card-student-grid">
            {studentInfo.map((item) => (
              <div key={item.label} className="sample-report-card-student-item">
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="admin-preview-panel sample-report-card-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Academic Results</h3>
              <p>Performance breakdown by subject using static demonstration data.</p>
            </div>
          </div>

          <div className="admin-preview-table-wrap">
            <table className="admin-preview-table">
              <caption className="sample-report-card-table-caption">Term performance by subject</caption>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>CA</th>
                  <th>Exam</th>
                  <th>Total</th>
                  <th>Grade</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {subjectResults.map((result) => (
                  <tr key={result.subject}>
                    <td>{result.subject}</td>
                    <td>{result.ca}</td>
                    <td>{result.exam}</td>
                    <td>{result.total}</td>
                    <td>
                      <span className={gradeBadgeClass(result.grade)}>{result.grade}</span>
                    </td>
                    <td>{result.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sample-report-card-summary-grid" aria-label="Academic summary">
          {summaryStats.map((item) => (
            <article key={item.label} className="admin-preview-stat-card sample-report-card-summary-card">
              <p>{item.label}</p>
              <h3>{item.value}</h3>
            </article>
          ))}
        </section>

        <section className="admin-preview-panel sample-report-card-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Behavioural Assessment</h3>
              <p>Character and social development indicators for the term.</p>
            </div>
          </div>

          <div className="sample-report-card-behaviour-grid">
            {behavioralRatings.map((rating) => (
              <article key={rating.trait} className="sample-report-card-behaviour-item">
                <div className="sample-report-card-behaviour-item__meta">
                  <h4>{rating.trait}</h4>
                  <span>{starRating(rating.score)}</span>
                </div>
                <div className="admin-preview-chart__track">
                  <div className="admin-preview-chart__bar" style={{ width: `${(rating.score / 5) * 100}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="sample-report-card-comment-grid">
          <article className="admin-preview-panel sample-report-card-panel">
            <div className="admin-preview-section-head">
              <div>
                <h3>Class Teacher Comment</h3>
              </div>
            </div>
            <p className="admin-preview-muted-copy">
              David has demonstrated excellent academic performance throughout the term. He is hardworking,
              respectful and participates actively in class activities. Keep up the excellent work.
            </p>
          </article>

          <article className="admin-preview-panel sample-report-card-panel">
            <div className="admin-preview-section-head">
              <div>
                <h3>Head Teacher Comment</h3>
              </div>
            </div>
            <p className="admin-preview-muted-copy">
              Congratulations on another outstanding academic performance. Continue striving for excellence and
              maintain your discipline.
            </p>
          </article>
        </section>

        <footer className="sample-report-card-footer">
          <div className="sample-report-card-signatures">
            <div className="sample-report-card-signature-item">
              <small>Prepared By</small>
              <span className="sample-report-card-sign-line" aria-hidden="true" />
              <strong>Class Teacher</strong>
            </div>
            <div className="sample-report-card-signature-item">
              <small>Approved By</small>
              <span className="sample-report-card-sign-line" aria-hidden="true" />
              <strong>Head Teacher</strong>
            </div>
          </div>

          <div className="sample-report-card-footer-artifacts">
            <div className="sample-report-card-watermark" aria-label="Grandessa official sample watermark">
              GRANDESSA OFFICIAL SAMPLE
            </div>
            <div className="sample-report-card-qr" role="img" aria-label="Decorative sample QR code block">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <p className="sample-report-card-sample-note">Administrator Preview | Sample Only</p>
        </footer>
      </article>
    </section>
  );
}
