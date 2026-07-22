import { supabase } from "../lib/supabase";
import type { Student } from "../types/student";

interface StudentListFilters {
  search?: string;
  className?: string;
}

function normalizeFilterValue(value?: string): string {
  return value?.trim() ?? "";
}

async function ensureParentLinkage(student: Student): Promise<void> {
  const parentName = normalizeFilterValue(student.parent_name);
  const parentPhone = normalizeFilterValue(student.parent_phone);

  if (!parentName && !parentPhone) {
    return;
  }

  const [firstName, ...rest] = parentName.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ") || firstName || "Unknown";

  const parentPayload = {
    first_name: firstName || "Unknown",
    last_name: lastName,
    phone: parentPhone || null,
  };

  try {
    await supabase
      .from("parents")
      .upsert(parentPayload, {
        onConflict: "phone",
        ignoreDuplicates: false,
      })
      .throwOnError();
  } catch {
    // Parent linkage should not block student creation when parent schema differs.
  }
}

async function ensureStudentProvisioning(student: Student): Promise<void> {
  await Promise.allSettled([
    ensureParentLinkage(student),
    (async () => {
      try {
        await supabase
          .from("report_cards")
          .select("id")
          .eq("student_id", student.id)
          .limit(1)
          .maybeSingle();
      } catch {
        // Optional bootstrap check only.
      }
    })(),
  ]);
}

export async function getStudents(
  filters: StudentListFilters = {}
): Promise<Student[]> {
  const search = normalizeFilterValue(filters.search);
  const className = normalizeFilterValue(filters.className);

  let query = supabase.from("students").select("*").order("created_at", {
    ascending: false,
  });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,admission_number.ilike.%${search}%`
    );
  }

  if (className && className.toLowerCase() !== "all classes") {
    query = query.ilike("class_name", `%${className}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as Student[];
}

export async function getStudent(id: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  return (data ?? null) as Student | null;
}

export async function createStudent(
  student: Omit<Student, "id" | "created_at" | "updated_at">
): Promise<Student> {
  const { data, error } = await supabase
    .from("students")
    .insert(student)
    .select()
    .single();

  if (error) throw error;

  const created = data as Student;
  await ensureStudentProvisioning(created);

  return created;
}

export async function updateStudent(
  id: string,
  updates: Partial<Student>
): Promise<Student> {
  const { data, error } = await supabase
    .from("students")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data as Student;
}

export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) throw error;
}

export async function searchStudents(search: string): Promise<Student[]> {
  return getStudents({ search });
}