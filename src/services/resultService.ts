import supabase from "../lib/supabase";
import type { Result } from "../types/result";

const TABLE = "results";

export async function getResults(): Promise<Result[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data as Result[]) ?? [];
  } catch (error) {
    console.error("Failed to fetch results:", error);
    throw new Error("Unable to load results.");
  }
}

export async function getStudentResults(
  studentId: string
): Promise<Result[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data as Result[]) ?? [];
  } catch (error) {
    console.error(error);
    throw new Error("Unable to load student results.");
  }
}

export async function createResult(
  result: Omit<Result, "id" | "created_at" | "updated_at">
): Promise<Result> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(result)
      .select()
      .single();

    if (error) throw error;

    return data as Result;
  } catch (error) {
    console.error(error);
    throw new Error("Unable to create result.");
  }
}

export async function updateResult(
  id: string,
  result: Partial<Result>
): Promise<Result> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(result)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data as Result;
  } catch (error) {
    console.error(error);
    throw new Error("Unable to update result.");
  }
}

export async function deleteResult(
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
    throw new Error("Unable to delete result.");
  }
}