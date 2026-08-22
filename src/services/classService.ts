import { supabase } from "../lib/supabase";
import type {
  CreateClassData,
  SchoolClass,
  UpdateClassData,
} from "../types/class";

const TABLE = "classes";

/**
 * Get all classes.
 */
export async function getClasses(): Promise<SchoolClass[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, class_name, status, created_at, updated_at")
    .order("class_name", { ascending: true });

  if (error) throw error;

  return (data ?? []) as SchoolClass[];
}

/**
 * Add a new class.
 */
export async function createClass(payload: CreateClassData): Promise<SchoolClass> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      class_name: payload.class_name.trim(),
      status: payload.status,
    })
    .select("id, class_name, status, created_at, updated_at")
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
      status: payload.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .select("id, class_name, status, created_at, updated_at")
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