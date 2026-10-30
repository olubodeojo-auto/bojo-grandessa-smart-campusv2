import { describe, expect, it } from "vitest";

import type { ReportHistoryBySession } from "../types/reportCard";
import { findLatestAvailableReportPeriod } from "./resultPresentation";

const midtermOnlyHistory: ReportHistoryBySession[] = [{
  academicYear: "2026/2027",
  entries: [{
    academicYear: "2026/2027",
    term: "First",
    classId: "basic-3",
    className: "Basic 3",
    reportType: "Midterm",
    resultCount: 17,
    publishedCount: 17,
    latestUpdatedAt: "2026-10-29T14:40:41.197Z",
  }],
}];

describe("findLatestAvailableReportPeriod", () => {
  it("falls back to a published Midterm when End-of-Term is not available", () => {
    const selected = findLatestAvailableReportPeriod(midtermOnlyHistory, "End-of-Term");

    expect(selected?.academicYear).toBe("2026/2027");
    expect(selected?.period.reportType).toBe("Midterm");
    expect(selected?.period.term).toBe("First");
  });

  it("keeps the preferred report type when it is available", () => {
    const history: ReportHistoryBySession[] = [{
      ...midtermOnlyHistory[0],
      entries: [
        ...midtermOnlyHistory[0].entries,
        {
          ...midtermOnlyHistory[0].entries[0],
          reportType: "End-of-Term",
          resultCount: 15,
          publishedCount: 15,
        },
      ],
    }];

    expect(findLatestAvailableReportPeriod(history, "End-of-Term")?.period.reportType).toBe("End-of-Term");
  });

  it("returns null when no published report periods exist", () => {
    expect(findLatestAvailableReportPeriod([], "End-of-Term")).toBeNull();
  });
});
