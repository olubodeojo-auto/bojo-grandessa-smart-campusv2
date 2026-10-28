import { useState } from "react";
import ReportCardsPage from "./ReportCardsPage";
import ResultsPage from "./ResultsPage";

type WorkspaceView = "marks" | "publish";

const tabStyle = (active: boolean): React.CSSProperties => ({
  border: active ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
  background: active ? "#eff6ff" : "#fff",
  color: active ? "#1d4ed8" : "#334155",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "left",
});

export default function ResultsWorkspacePage() {
  const [view, setView] = useState<WorkspaceView>("marks");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ padding: "18px 20px" }}>
        <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 30 }}>Publish Assistant</h1>
        <p style={{ margin: "6px 0 0", color: "#475569" }}>
          One place to prepare pupils’ marks, check results and publish reports.
        </p>
        <div role="group" aria-label="Results workspace" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8, marginTop: 16 }}>
          <button type="button" aria-pressed={view === "marks"} onClick={() => setView("marks")} style={tabStyle(view === "marks")}>
            <span style={{ display: "block" }}>1. Enter or import marks</span>
            <span style={{ display: "block", fontSize: 12, fontWeight: 400, marginTop: 3 }}>Manual entry and workbook imports</span>
          </button>
          <button type="button" aria-pressed={view === "publish"} onClick={() => setView("publish")} style={tabStyle(view === "publish")}>
            <span style={{ display: "block" }}>2. Review and publish</span>
            <span style={{ display: "block", fontSize: 12, fontWeight: 400, marginTop: 3 }}>Check pupil reports and publication status</span>
          </button>
        </div>
      </div>
      {view === "marks" ? <ResultsPage embedded /> : <ReportCardsPage embedded />}
    </div>
  );
}
