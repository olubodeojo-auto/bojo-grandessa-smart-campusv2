import { supabase } from "../lib/supabase";
import type {
  CreateSubjectData,
  Subject,
  UpdateSubjectData,
} from "../types/subject";

const FALLBACK_SCHOOL_ID = "1829b784-8e94-4713-bbaf-2518b5e374be";
const TABLE = "subjects";

type SubjectQueryOptions = {
  schoolId?: string | null;
};

function getActiveSchoolId(schoolId?: string | null): string {
  const candidate =
    schoolId?.trim() ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("activeSchoolId")?.trim()
      : "") ||
    import.meta.env.VITE_SCHOOL_ID?.toString().trim();

  return candidate || FALLBACK_SCHOOL_ID;
}

function normalizeSubject(record: Subject): Subject {
  return {
    ...record,
    department: record.department ?? null,
    academic_level: record.academic_level ?? null,
    description: record.description ?? null,
  };
}

export async function getSubjects(
  _options: SubjectQueryOptions = {}
): Promise<Subject[]> {
  // Load subjects without assuming a school_id column exists. Return only active subjects ordered by name.
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("status", "Active")
    .order("subject_name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(normalizeSubject);
}

export async function getSubject(id: string): Promise<Subject | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  return data ? normalizeSubject(data as Subject) : null;
}

export async function createSubject(
  payload: CreateSubjectData
): Promise<Subject> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      school_id: getActiveSchoolId(),
      subject_code: payload.subject_code.trim(),
      subject_name: payload.subject_name.trim(),
      department: payload.department,
      academic_level: payload.academic_level,
      description: payload.description.trim() || null,
      status: payload.status,
    })
    .select()
    .single();

  if (error) throw error;

  return normalizeSubject(data as Subject);
}

export async function updateSubject(
  payload: UpdateSubjectData
): Promise<Subject> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      subject_code: payload.subject_code.trim(),
      subject_name: payload.subject_name.trim(),
      department: payload.department,
      academic_level: payload.academic_level,
      description: payload.description.trim() || null,
      status: payload.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .select()
    .single();

  if (error) throw error;

  return normalizeSubject(data as Subject);
}

export async function archiveSubject(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: "Inactive",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}
