import { supabase } from "../lib/supabase";
import { getClasses } from "./classService";
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

  const [{ data, error }, classes] = await Promise.all([query, getClasses()]);

  if (error) throw error;

  const classesById = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass]));
  return (data ?? []).map((row) => mapStudentRow(row, classesById.get((row as { class_id?: string }).class_id ?? "")));
}

export async function getStudent(id: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  if (!data) return null;
  const classes = await getClasses();
  return mapStudentRow(data, classes.find((schoolClass) => schoolClass.id === (data as { class_id?: string }).class_id));
}

function mapStudentRow(row: Record<string, unknown>, schoolClass?: Awaited<ReturnType<typeof getClasses>>[number]): Student {
  return {
    ...(row as unknown as Student),
    class_name: schoolClass?.class_name || (row.class_name as string | undefined) || "",
    class_teacher: schoolClass?.class_teacher ?? null,
  };
}

export function generateResultAccessCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function normalizeResultAccessCode(value?: string | null): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

async function generateUniqueResultAccessCode(excludeStudentId?: string): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = generateResultAccessCode();

    const { data, error } = await supabase
      .from("students")
      .select("id")
      .eq("result_access_code", candidate)
      .neq("id", excludeStudentId ?? "")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique Result Access Code.");
}

export async function getStudentByAccessCode(code: string): Promise<Student | null> {
  const normalized = code.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("result_access_code", normalized)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return null;
  }

  return (data ?? null) as Student | null;
}

export async function createStudent(
  student: Omit<Student, "id" | "created_at" | "updated_at">
): Promise<Student> {
  const suppliedCode = normalizeResultAccessCode(student.result_access_code);
  const accessCode = suppliedCode ?? (await generateUniqueResultAccessCode());

  const uniqueCode = await (async () => {
    if (suppliedCode) {
      const { data, error } = await supabase
        .from("students")
        .select("id")
        .eq("result_access_code", suppliedCode)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        return await generateUniqueResultAccessCode();
      }
    }

    return accessCode;
  })();

  const { data, error } = await supabase
    .from("students")
    .insert({ ...student, result_access_code: uniqueCode })
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
  const payload = { ...updates };

  if (Object.prototype.hasOwnProperty.call(payload, "result_access_code")) {
    const existingCode = normalizeResultAccessCode(payload.result_access_code);
    if (!existingCode) {
      delete payload.result_access_code;
    } else {
      payload.result_access_code = existingCode;
    }
  }

  const { data, error } = await supabase
    .from("students")
    .update(payload)
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