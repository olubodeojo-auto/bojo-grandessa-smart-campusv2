import type { AcademicTermName } from "../types/academicSession";

export interface AcademicTermMatch {
  id: string;
  term_name: string;
  academic_sessions: { session_name: string } | { session_name: string }[] | null;
}

export function toStoredTermName(termName: string): string {
  return `${fromStoredTermName(termName)} Term`;
}

export function fromStoredTermName(termName: string): AcademicTermName {
  const shortName = termName.replace(/\s+term$/i, "");
  if (shortName === "First" || shortName === "Second" || shortName === "Third") return shortName;
  throw new Error(`Unsupported academic term "${termName}".`);
}

function normalizeTermName(termName: string): string {
  return termName.replace(/\s+term$/i, "");
}

export function resolveReportTermId(
  matches: AcademicTermMatch[],
  academicYear: string,
  termName: string,
): string {
  const normalizedTermName = normalizeTermName(termName);
  const matching = matches.filter((term) =>
    normalizeTermName(term.term_name) === normalizedTermName
    && (Array.isArray(term.academic_sessions)
      ? term.academic_sessions.some((session) => session.session_name === academicYear)
      : term.academic_sessions?.session_name === academicYear));
  if (matching.length === 0) {
    throw new Error(
      `No ${normalizedTermName} term exists for academic session ${academicYear}. An administrator must create the session and term dates before saving report details.`,
    );
  }
  if (matching.length > 1) {
    throw new Error(`More than one ${normalizedTermName} term resolves to academic session ${academicYear}. Resolve the duplicate term records before saving.`);
  }
  return matching[0].id;
}
