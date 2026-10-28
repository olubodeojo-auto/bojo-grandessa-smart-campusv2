import ReportCardsPage from "./ReportCardsPage";
import ResultsPage from "./ResultsPage";

export default function ResultsWorkspacePage() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <ReportCardsPage embedded />
      <ResultsPage embedded />
    </div>
  );
}
