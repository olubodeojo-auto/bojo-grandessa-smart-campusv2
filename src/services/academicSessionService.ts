import { supabase } from "../lib/supabase";
import type { AcademicSession, AcademicSessionSetup, AcademicTerm } from "../types/academicSession";
import { validateAcademicSessionSetup } from "../utils/academicSessionValidation";
import { fromStoredTermName } from "../utils/reportTermResolution";

type AcademicSessionRow = Omit<AcademicSession, "terms">;

export async function getAcademicSessionSetups(): Promise<AcademicSession[]> {
  const [{ data: sessionRows, error: sessionError }, { data: termRows, error: termError }] = await Promise.all([
    supabase
      .from("academic_sessions")
      .select("id, session_name, start_date, end_date, is_current, is_locked")
      .order("start_date", { ascending: false }),
    supabase
      .from("terms")
      .select("id, academic_session_id, term_name, start_date, end_date, is_current")
      .order("start_date", { ascending: true }),
  ]);
  if (sessionError) throw new Error(`Unable to load academic sessions: ${sessionError.message}`);
  if (termError) throw new Error(`Unable to load academic terms: ${termError.message}`);

  const terms = ((termRows ?? []) as Array<AcademicTerm & { term_name: string }>).map((term) => ({
    ...term,
    term_name: fromStoredTermName(term.term_name),
  }));
  return ((sessionRows ?? []) as AcademicSessionRow[]).map((session) => ({
    ...session,
    terms: terms.filter((term) => term.academic_session_id === session.id),
  }));
}

export async function saveAcademicSessionSetup(setup: AcademicSessionSetup): Promise<string> {
  const validationError = validateAcademicSessionSetup(setup);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase.rpc("save_academic_session_setup", {
    target_session_id: setup.sessionId,
    target_session_name: setup.sessionName.trim(),
    target_session_start_date: setup.startDate,
    target_session_end_date: setup.endDate,
    target_is_current: setup.isCurrent,
    target_current_term: setup.currentTerm || null,
    target_terms: setup.terms.map((term) => ({
      term_name: term.termName,
      start_date: term.startDate,
      end_date: term.endDate,
    })),
  });
  if (error) throw new Error(`Unable to save academic session and terms: ${error.message}`);
  if (typeof data !== "string" || !data) {
    throw new Error("Academic session setup was saved without returning its session ID.");
  }
  return data;
}
