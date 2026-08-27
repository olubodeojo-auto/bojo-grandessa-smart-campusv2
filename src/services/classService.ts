import { supabase } from "../lib/supabase";
import type {
  CreateClassData,
  SchoolClass,
  UpdateClassData,
} from "../types/class";

const TABLE = "classes";

export function normalizeClassName(className: string): string {
  const normalized = className.trim().toLowerCase();
  const legacyLabels: Record<string, string> = {
    "playgroup": "Pre-Nursery",
    "pre nursery": "Pre-Nursery",
    "nursery 1": "Kindergarten 1",
    "nursery 2": "Kindergarten 2",
    "primary 1": "Basic 1",
    "primary 2": "Basic 2",
    "primary 3": "Basic 3",
    "primary 4": "Basic 4",
    "primary 5": "Basic 5",
    "primary 6": "Basic 6",
  };

  return legacyLabels[normalized] ?? className.trim();
}

/**
 * Get all classes.
 */
export async function getClasses(): Promise<SchoolClass[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, class_name, status, created_at, updated_at")
    .order("class_name", { ascending: true });

  if (error) throw error;

  const normalizedClasses = (data ?? []).map((item) => ({
    ...(item as SchoolClass),
    class_name: normalizeClassName((item as SchoolClass).class_name),
  }));

  return Array.from(new Map(normalizedClasses.map((item) => [item.class_name.toLowerCase(), item])).values());
}

/**
 * Add a new class.
 */
export async function createClass(payload: CreateClassData): Promise<SchoolClass> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      class_name: payload.class_name.trim(),
      class_teacher_id: payload.class_teacher_id ?? null,
      status: payload.status,
    })
    .select("id, class_name, class_teacher_id, status, created_at, updated_at")
    .single();

  if (error) throw error;

  return data as SchoolClass;
}

/**
 * Update an existing class.
 */
export async function updateClass(payload: UpdateClassData): Promise<SchoolClass> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      class_name: payload.class_name.trim(),
      class_teacher_id: payload.class_teacher_id ?? null,
      status: payload.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .select("id, class_name, class_teacher_id, status, created_at, updated_at")
    .single();

  if (error) throw error;

  return data as SchoolClass;
}

/**
 * Archive a class by switching it to an inactive status.
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