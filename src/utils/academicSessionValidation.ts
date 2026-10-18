import type { AcademicSessionSetup } from "../types/academicSession";

function parseDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}

export function validateAcademicSessionSetup(setup: AcademicSessionSetup): string | null {
  const sessionName = setup.sessionName.trim();
  const sessionStart = parseDate(setup.startDate);
  const sessionEnd = parseDate(setup.endDate);
  if (!sessionName) return "Enter an academic session name.";
  if (sessionStart === null || sessionEnd === null || sessionEnd < sessionStart) {
    return "Enter valid session start and end dates.";
  }
  if (setup.terms.length !== 3) return "Enter dates for all three academic terms.";
  if (setup.currentTerm && !setup.isCurrent) {
    return "A current term can only be selected for the current academic session.";
  }

  let previousTermEnd = sessionStart - 1;
  for (const term of setup.terms) {
    const start = parseDate(term.startDate);
    const end = parseDate(term.endDate);
    if (start === null || end === null || end < start) {
      return `Enter valid start and end dates for the ${term.termName} Term.`;
    }
    if (start < sessionStart || end > sessionEnd || start <= previousTermEnd) {
      return "Term dates must be non-overlapping, in First/Second/Third order, and within the session dates.";
    }
    previousTermEnd = end;
  }
  return null;
}
