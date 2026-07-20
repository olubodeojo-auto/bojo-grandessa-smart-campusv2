import { supabase } from "../lib/supabase";
import type {
  CreateClassData,
  SchoolClass,
  UpdateClassData,
} from "../types/class";

const FALLBACK_SCHOOL_ID = "1829b784-8e94-4713-bbaf-2518b5e374be";
const TABLE = "classes";

type ClassQueryOptions = {
  schoolId?: string | null;
};

function getActiveSchoolId(schoolId?: string | null): string {
  const candidate = schoolId?.trim() || (typeof window !== "undefined" ? window.localStorage.getItem("activeSchoolId")?.trim() : "") || import.meta.env.VITE_SCHOOL_ID?.toString().trim();

  return candidate || FALLBACK_SCHOOL_ID;
}

function normalizeClassRecord(record: SchoolClass): SchoolClass {
  return {
    ...record,
    section: record.section ?? null,
    class_teacher: record.class_teacher ?? null,
    teacher_id: record.teacher_id ?? null,
    academic_level: record.academic_level ?? null,
    current_students: record.current_students ?? null,
    available_seats: record.available_seats ?? null,
    subjects_assigned: record.subjects_assigned ?? null,
    homeroom_teacher: record.homeroom_teacher ?? null,
  };
}

/**
 * Get all classes for the active school.
 */
export async function getClasses(options: ClassQueryOptions = {}): Promise<SchoolClass[]> {
  const schoolId = getActiveSchoolId(options.schoolId);

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("school_id", schoolId)
    .order("class_name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(normalizeClassRecord);
}

/**
 * Add a new class.
 * TODO: replace class_teacher with teacher_id once the classes table includes a UUID teacher_id column.
 */
export async function createClass(payload: CreateClassData): Promise<SchoolClass> {
  const normalizedSection = payload.section.trim() || null;
  const normalizedTeacherName = payload.class_teacher.trim() || null;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      school_id: getActiveSchoolId(),
      class_name: payload.class_name.trim(),
      section: normalizedSection,
      capacity: payload.capacity,
      class_teacher: normalizedTeacherName,
      status: payload.status,
    })
    .select()
    .single();

  if (error) throw error;

  return normalizeClassRecord(data as SchoolClass);
}

/**
 * Update an existing class.
 * TODO: replace class_teacher with teacher_id once the classes table includes a UUID teacher_id column.
 */
export async function updateClass(payload: UpdateClassData): Promise<SchoolClass> {
  const normalizedSection = payload.section.trim() || null;
  const normalizedTeacherName = payload.class_teacher.trim() || null;

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      class_name: payload.class_name.trim(),
      section: normalizedSection,
      capacity: payload.capacity,
      class_teacher: normalizedTeacherName,
      status: payload.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .select()
    .single();

  if (error) throw error;

  return normalizeClassRecord(data as SchoolClass);
}

/**
 * Archive a class by switching it to an inactive status.
 * TODO: add archived_at or an is_archived flag if the database needs a dedicated archive workflow.
 */
export async function archiveClass(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: "Inactive",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}