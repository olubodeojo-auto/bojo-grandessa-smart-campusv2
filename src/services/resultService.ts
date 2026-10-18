/* eslint-disable preserve-caught-error */

import supabase from "../lib/supabase";
import type { Result } from "../types/result";

const TABLE = "results";

function describeResultError(error: unknown, action: string): Error {
  const detail = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "Unknown database error.";
  return new Error(`${action}: ${detail}`);
}

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

export type TeacherResultAssignment = { class_id: string };

export async function getMyResultAssignments(): Promise<TeacherResultAssignment[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in is required to load teaching assignments.");

  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("class_teacher_id", authData.user.id);

  if (error) {
    throw new Error(`Unable to load teaching assignments: ${error.message}`);
  }

  return (data ?? []).map((schoolClass) => ({ class_id: schoolClass.id }));
}

export async function reviewResult(
  id: string,
  decision: "publish" | "return" | "unpublish",
  reason?: string,
): Promise<void> {
  if (decision === "publish") {
    return publishResult(id);
  }

  const { error } = await supabase.rpc("review_result", {
    target_result_id: id,
    decision,
    reason: reason ?? null,
  });
  if (error) throw new Error(`Unable to ${decision} result: ${error.message}`);
}

export async function publishResult(id: string): Promise<void> {
  const { error } = await supabase.rpc("publish_result", {
    target_result_id: id,
  });
  if (error) throw new Error(`Unable to publish result: ${error.message}`);
}

export async function submitResult(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_result", { target_result_id: id });
  if (error) throw new Error(`Unable to submit result: ${error.message}`);
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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error("Sign in is required to create results.");

    const { data, error } = await supabase
      .from(TABLE)
      .insert({ ...result, created_by: result.created_by ?? authData.user.id })
      .select()
      .single();

    if (error) throw error;

    return data as Result;
  } catch (error) {
    console.error(error);
    throw describeResultError(error, "Unable to create result");
  }
}

export async function createResults(
  results: Array<Omit<Result, "id" | "created_at" | "updated_at">>
): Promise<void> {
  if (results.length === 0) return;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in is required to import results.");

  const { error } = await supabase
    .from(TABLE)
    .insert(results.map((result) => ({ ...result, created_by: result.created_by ?? authData.user.id })));
  if (error) throw new Error(`Unable to import results: ${error.message}`);
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
    throw describeResultError(error, "Unable to update result");
  }
}

export async function deleteResult(
  id: string
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("The result does not exist or deletion was blocked by a database policy.");
  } catch (error) {
    console.error(error);
    throw describeResultError(error, "Unable to delete result");
  }
}