/* eslint-disable preserve-caught-error */

import supabase from "../lib/supabase";
import type { Attendance } from "../types/attendance";

const TABLE = "attendance";

export async function getAttendance(): Promise<Attendance[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("attendance_date", { ascending: false });

    if (error) throw error;

    return (data as Attendance[]) ?? [];
  } catch (error) {
    console.error("Failed to fetch attendance:", error);
    throw new Error("Unable to load attendance.");
  }
}

export async function getAttendanceByStudent(
  studentId: string
): Promise<Attendance[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("student_id", studentId)
      .order("attendance_date", { ascending: false });

    if (error) throw error;

    return (data as Attendance[]) ?? [];
  } catch (error) {
    console.error(error);
    throw new Error("Unable to load attendance.");
  }
}

export async function markAttendance(
  attendance: Omit<Attendance, "id" | "created_at" | "updated_at">
): Promise<Attendance> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(attendance)
      .select()
      .single();

    if (error) throw error;

    return data as Attendance;
  } catch (error) {
    console.error(error);
    throw new Error("Unable to mark attendance.");
  }
}

export async function updateAttendance(
  id: string,
  attendance: Partial<Attendance>
): Promise<Attendance> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(attendance)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data as Attendance;
  } catch (error) {
    console.error(error);
    throw new Error("Unable to update attendance.");
  }
}

export async function deleteAttendance(
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
    throw new Error("Unable to delete attendance.");
  }
}