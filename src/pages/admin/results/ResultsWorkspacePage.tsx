import { ArrowDown, FileSpreadsheet, PencilLine } from "lucide-react";
import type { CSSProperties } from "react";
import ReportCardsPage from "./ReportCardsPage";
import ResultsPage from "./ResultsPage";

const actionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 42,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #d6dee8",
  background: "#ffffff",
  color: "#24364b",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function ResultsWorkspacePage() {
  return (
    <main style={{ display: "grid", gap: 24, width: "100%", maxWidth: 1600, margin: "0 auto", paddingBottom: 24 }}>
      <header
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          padding: "18px clamp(16px, 2vw, 26px)",
          border: "1px solid #dce5ee",
          borderRadius: 14,
          background: "#ffffff",
          boxShadow: "0 2px 10px rgba(23, 43, 77, 0.04)",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 420px" }}>
          <h1 style={{ margin: 0, color: "#172b4d", fontFamily: "Fredoka", fontSize: "clamp(25px, 2.6vw, 32px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Results &amp; reports
          </h1>
          <p style={{ margin: "6px 0 0", color: "#526277", fontSize: 14, lineHeight: 1.45 }}>
            Enter marks, fix pupil or subject mismatches, then publish reports.
          </p>
        </div>
        <nav aria-label="Results actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => scrollToSection("results-entry-workspace")} style={actionStyle}>
            <FileSpreadsheet size={17} />
            Enter or import marks
            <ArrowDown size={14} />
          </button>
          <button type="button" onClick={() => scrollToSection("review-publish-section")} style={{ ...actionStyle, background: "#0f766e", borderColor: "#0f766e", color: "#ffffff" }}>
            <PencilLine size={17} />
            Review and publish
            <ArrowDown size={14} />
          </button>
        </nav>
      </header>

      <section id="results-entry-section" style={{ display: "grid", gap: 10, scrollMarginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, padding: "0 2px" }}>
          <h2 style={{ margin: 0, color: "#172b4d", fontSize: 22 }}>Enter or import pupil results</h2>
          <span style={{ color: "#64748b", fontSize: 13 }}>Manual and imported marks use the same review process.</span>
        </div>
        <ResultsPage embedded />
      </section>

      <section id="review-publish-section" style={{ display: "grid", gap: 10, scrollMarginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, padding: "0 2px" }}>
          <h2 style={{ margin: 0, color: "#172b4d", fontSize: 22 }}>Pupil reports</h2>
          <span style={{ color: "#64748b", fontSize: 13 }}>Publish here when the reports are ready. No parent emails are sent.</span>
        </div>
        <ReportCardsPage embedded />
      </section>
    </main>
  );
}
