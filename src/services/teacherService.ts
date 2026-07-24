/* eslint-disable preserve-caught-error */

import supabase from "../lib/supabase";
import type { Teacher } from "../types/teacher";

const TABLE = "teachers";

export async function getTeachers(): Promise<Teacher[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data as Teacher[]) ?? [];
  } catch (error) {
    console.error("Failed to fetch teachers:", error);
    throw new Error("Unable to load teachers.");
  }
}

export async function getTeacher(
  id: string
): Promise<Teacher | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return data as Teacher;
  } catch (error) {
    console.error(error);
    throw new Error("Unable to load teacher.");
  }
}

export async function createTeacher(
  teacher: Omit<Teacher, "id" | "created_at" | "updated_at">
): Promise<Teacher> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(teacher)
      .select()
      .single();

    if (error) throw error;

    return data as Teacher;
  } catch (error) {
    console.error(error);
    throw new Error("Unable to create teacher.");
  }
}

export async function updateTeacher(
  id: string,
  teacher: Partial<Teacher>
): Promise<Teacher> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(teacher)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data as Teacher;
  } catch (error) {
    console.error(error);
    throw new Error("Unable to update teacher.");
  }
}

export async function deleteTeacher(
  id: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id);

    if (error) throw error;
  } catch (error) {
    console.error(error);
    throw new Error("Unable to delete teacher.");
  }
}

export async function searchTeachers(
  keyword: string
): Promise<Teacher[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .or(
        `first_name.ilike.%${keyword}%,last_name.ilike.%${keyword}%,employee_number.ilike.%${keyword}%`
      );

    if (error) throw error;

    return (data as Teacher[]) ?? [];
  } catch (error) {
    console.error(error);
    throw new Error("Unable to search teachers.");
  }
}