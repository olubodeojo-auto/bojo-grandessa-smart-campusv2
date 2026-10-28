import ReportCardsPage from "./ReportCardsPage";
import ResultsPage from "./ResultsPage";

export default function ResultsWorkspacePage() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card" style={{ padding: "18px 20px" }}>
        <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 30 }}>Publish Arena</h1>
        <p style={{ margin: "6px 0 0", color: "#475569" }}>
          Import or enter marks, review each pupil, and publish reports from this one workspace.
        </p>
      </div>
      <ReportCardsPage embedded />
      <ResultsPage embedded />
    </div>
  );
}
