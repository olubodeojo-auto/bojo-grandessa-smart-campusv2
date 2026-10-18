export type AcademicTermName = "First" | "Second" | "Third";

export interface AcademicTerm {
  id: string;
  academic_session_id: string;
  term_name: AcademicTermName;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface AcademicSession {
  id: string;
  session_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_locked: boolean;
  terms: AcademicTerm[];
}

export interface AcademicSessionSetup {
  sessionId: string | null;
  sessionName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  currentTerm: AcademicTermName | "";
  terms: Array<{
    termName: AcademicTermName;
    startDate: string;
    endDate: string;
  }>;
}
