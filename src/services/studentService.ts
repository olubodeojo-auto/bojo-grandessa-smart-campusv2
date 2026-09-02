import { supabase } from "../lib/supabase";
import { getClasses } from "./classService";
import type { Student } from "../types/student";

export type StudentDatabaseWrite = {
  id?: string;
  school_id?: string | null;
  admission_number?: string | null;
  class_id?: string | null;
  primary_contact_id?: string | null;
  secondary_contact_id?: string | null;
  result_access_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  photo_url?: string | null;
  blood_group?: string | null;
  genotype?: string | null;
  allergies?: string | null;
  medical_notes?: string | null;
  admission_date?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StudentWriteInput = StudentDatabaseWrite;

interface StudentListFilters {
  search?: string;
  className?: string;
}

function normalizeFilterValue(value?: string): string {
  return value?.trim() ?? "";
}

async function ensureStudentProvisioning(student: Student): Promise<void> {
  await Promise.allSettled([
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

let resultAccessCodeColumnSupport: boolean | null = null;

async function isResultAccessCodeColumnSupported(): Promise<boolean> {
  if (resultAccessCodeColumnSupport !== null) {
    return resultAccessCodeColumnSupport;
  }

  try {
    const { error } = await supabase
      .from("students")
      .select("result_access_code")
      .limit(1);

    const supported = !(error && (error.code === "42703" || error.message.toLowerCase().includes("result_access_code")));
    resultAccessCodeColumnSupport = supported;
    return supported;
  } catch {
    resultAccessCodeColumnSupport = false;
    return false;
  }
}

async function generateUniqueResultAccessCode(excludeStudentId?: string): Promise<string> {
  if (!(await isResultAccessCodeColumnSupported())) {
    return generateResultAccessCode();
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = generateResultAccessCode();
    const query = supabase
      .from("students")
      .select("id")
      .eq("result_access_code", candidate);

    const safeExcludeStudentId = excludeStudentId?.trim();
    const studentQuery = safeExcludeStudentId ? query.neq("id", safeExcludeStudentId) : query;
    const { data, error } = await studentQuery.maybeSingle();

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

function mapStudentDatabaseWrite(input: StudentWriteInput): StudentDatabaseWrite {
  const payload: StudentDatabaseWrite = {};

  if (input.school_id !== undefined) payload.school_id = input.school_id ?? null;
  if (input.admission_number !== undefined) payload.admission_number = input.admission_number?.trim() || null;
  if (input.class_id !== undefined) payload.class_id = input.class_id ?? null;
  if (input.primary_contact_id !== undefined) payload.primary_contact_id = input.primary_contact_id ?? null;
  if (input.secondary_contact_id !== undefined) payload.secondary_contact_id = input.secondary_contact_id ?? null;
  if (input.first_name !== undefined) payload.first_name = input.first_name?.trim() || null;
  if (input.last_name !== undefined) payload.last_name = input.last_name?.trim() || null;
  if (input.middle_name !== undefined) payload.middle_name = input.middle_name?.trim() || null;
  if (input.gender !== undefined) payload.gender = input.gender ?? null;
  if (input.date_of_birth !== undefined) payload.date_of_birth = input.date_of_birth ?? null;
  if (input.result_access_code !== undefined) payload.result_access_code = input.result_access_code?.trim() || null;
  if (input.photo_url !== undefined) {
    payload.photo_url = typeof input.photo_url === "string" ? input.photo_url.trim() || null : null;
  }
  if (input.blood_group !== undefined) payload.blood_group = input.blood_group?.trim() || null;
  if (input.genotype !== undefined) payload.genotype = input.genotype?.trim() || null;
  if (input.allergies !== undefined) payload.allergies = input.allergies?.trim() || null;
  if (input.medical_notes !== undefined) payload.medical_notes = input.medical_notes?.trim() || null;
  if (input.admission_date !== undefined) payload.admission_date = input.admission_date ?? null;
  if (input.status !== undefined) payload.status = input.status ?? null;

  return payload;
}

export async function createStudent(
  student: StudentWriteInput
): Promise<Student> {
  const suppliedCode = normalizeResultAccessCode(student.result_access_code);
  const accessCode: string = suppliedCode ?? (await generateUniqueResultAccessCode());
  const supportsResultAccessCode = await isResultAccessCodeColumnSupported();

  const uniqueCode = await (async () => {
    if (!supportsResultAccessCode) {
      return null;
    }

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

  const dbWrite = mapStudentDatabaseWrite(student);
  const insertPayload: Record<string, unknown> = { ...dbWrite };

  if (supportsResultAccessCode && uniqueCode) {
    insertPayload.result_access_code = uniqueCode;
  }

  const { data, error } = await supabase
    .from("students")
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;

  const created = data as Student;
  await ensureStudentProvisioning(created);

  return created;
}

export async function updateStudent(
  id: string,
  updates: StudentWriteInput
): Promise<Student> {
  const payload = mapStudentDatabaseWrite(updates);
  const updatePayload: Record<string, unknown> = { ...payload };

  if (await isResultAccessCodeColumnSupported()) {
    const existingCode = normalizeResultAccessCode(updates.result_access_code);
    if (existingCode) {
      updatePayload.result_access_code = existingCode;
    }
  }

  const { data, error } = await supabase
    .from("students")
    .update(updatePayload)
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