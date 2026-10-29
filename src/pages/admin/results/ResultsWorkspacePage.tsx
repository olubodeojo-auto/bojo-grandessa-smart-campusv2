import { ArrowDown, ArrowRight, CheckCircle2, ClipboardCheck, FileSpreadsheet, PencilLine } from "lucide-react";
import ReportCardsPage from "./ReportCardsPage";
import ResultsPage from "./ResultsPage";

const scrollButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  minHeight: 44,
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid #d6dee8",
  background: "#ffffff",
  color: "#24364b",
  fontWeight: 750,
  cursor: "pointer",
  textDecoration: "none",
};

function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function ResultsWorkspacePage() {
  return (
    <main style={{ display: "grid", gap: 28, width: "100%", maxWidth: 1480, margin: "0 auto", paddingBottom: 28 }}>
      <header
        className="card"
        style={{
          border: "1px solid #dce5ee",
          borderRadius: 22,
          padding: "clamp(20px, 3vw, 32px)",
          background: "linear-gradient(135deg, #f7fafc 0%, #ffffff 68%, #f1f8f6 100%)",
          boxShadow: "0 6px 24px rgba(23, 43, 77, 0.05)",
          display: "grid",
          gap: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 20, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 480px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#0f766e", fontSize: 12, fontWeight: 850, letterSpacing: "0.08em" }}>
              <CheckCircle2 size={16} />
              GRANDESSA · SCHOOL RESULTS
            </div>
            <h1 style={{ margin: 0, color: "#172b4d", fontFamily: "Fredoka", fontSize: "clamp(28px, 3vw, 38px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              Results &amp; reports
            </h1>
            <p style={{ margin: "11px 0 0", maxWidth: 740, color: "#526277", fontSize: 15, lineHeight: 1.7 }}>
              One workspace from marks to published reports. Enter marks manually or import a spreadsheet, resolve only the issues that need attention, then publish when the pupil’s results are ready.
            </p>
          </div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <button type="button" onClick={() => scrollToSection("results-entry-workspace")} style={scrollButtonStyle}>
              <PencilLine size={17} />
              Enter or import marks
              <ArrowDown size={15} />
            </button>
            <button type="button" onClick={() => scrollToSection("review-publish-section")} style={{ ...scrollButtonStyle, background: "#0f766e", borderColor: "#0f766e", color: "#ffffff" }}>
              <ClipboardCheck size={17} />
              Review and publish
              <ArrowDown size={15} />
            </button>
          </div>
        </div>

        <div aria-label="Results workflow" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {[
            {
              number: "01",
              title: "Enter marks",
              note: "Import a spreadsheet or enter a pupil’s marks.",
              icon: <FileSpreadsheet size={18} />,
              target: "results-entry-workspace",
            },
            {
              number: "02",
              title: "Resolve issues",
              note: "Confirm pupil, class, subject and mark details where needed.",
              icon: <PencilLine size={18} />,
              target: "imports-awaiting-reconciliation-results",
            },
            {
              number: "03",
              title: "Publish reports",
              note: "Check readiness and release reports without sending emails.",
              icon: <ClipboardCheck size={18} />,
              target: "review-publish-section",
            },
          ].map((step) => (
            <button
              key={step.number}
              type="button"
              onClick={() => scrollToSection(step.target)}
              style={{
                display: "grid",
                gridTemplateColumns: "36px minmax(0, 1fr) 16px",
                gap: 10,
                alignItems: "start",
                padding: 14,
                border: "1px solid #e1e8ef",
                borderRadius: 15,
                background: "#ffffff",
                color: "#24364b",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 11, background: "#edf7f5", color: "#0f766e" }}>
                {step.icon}
              </span>
              <span style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 850 }}>{step.number} · {step.title}</span>
                <span style={{ fontSize: 12, lineHeight: 1.5, color: "#64748b", fontWeight: 450 }}>{step.note}</span>
              </span>
              <ArrowRight size={15} style={{ marginTop: 10, color: "#94a3b8" }} />
            </button>
          ))}
        </div>
        <p style={{ margin: 0, color: "#637286", fontSize: 12, lineHeight: 1.5 }}>
          Imported and manually entered marks follow the same review and publishing rules. The pupil report shows whether the source was imported, manual or mixed.
        </p>
      </header>

      <section id="results-entry-section" style={{ display: "grid", gap: 12, scrollMarginTop: 18 }}>
        <div style={{ display: "grid", gap: 5, padding: "0 4px" }}>
          <div style={{ color: "#0f766e", fontSize: 12, fontWeight: 850, letterSpacing: "0.07em" }}>STEP 1 · ENTER MARKS</div>
          <h2 style={{ margin: 0, color: "#172b4d", fontSize: 24 }}>Enter or import pupil results</h2>
          <p style={{ margin: 0, maxWidth: 800, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
            Start here. Spreadsheet imports and manual entry feed the same report list below—there is no separate publishing workspace to open.
          </p>
        </div>
        <ResultsPage embedded />
      </section>

      <section id="review-publish-section" style={{ display: "grid", gap: 12, scrollMarginTop: 18 }}>
        <div style={{ display: "grid", gap: 5, padding: "0 4px" }}>
          <div style={{ color: "#0f766e", fontSize: 12, fontWeight: 850, letterSpacing: "0.07em" }}>STEPS 2–3 · CHECK AND RELEASE</div>
          <h2 style={{ margin: 0, color: "#172b4d", fontSize: 24 }}>Review and publish reports</h2>
          <p style={{ margin: 0, maxWidth: 800, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
            Work from one pupil list. Reports that need attention explain why; ready reports can be published here. Publishing does not send parent emails.
          </p>
        </div>
        <ReportCardsPage embedded />
      </section>
    </main>
  );
}
