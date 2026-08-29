import { supabase } from "../lib/supabase";
import type {
  CreateClassData,
  SchoolClass,
  UpdateClassData,
} from "../types/class";

const TABLE = "classes";
const CLASS_SELECT = "id, class_name, class_teacher_id, status, created_at, updated_at";

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
    .select(CLASS_SELECT)
    .order("class_name", { ascending: true });

  if (error) throw error;

  const classRows = (data ?? []) as SchoolClass[];
  const teacherIds = classRows.map((item) => item.class_teacher_id).filter((id): id is string => Boolean(id));
  const teacherMap = new Map<string, SchoolClass["class_teacher"]>();

  if (teacherIds.length > 0) {
    const { data: assignments, error: assignmentError } = await supabase
      .from("user_roles")
      .select("user_id, role_id")
      .in("user_id", teacherIds)
      .eq("is_active", true);

    if (assignmentError) throw assignmentError;

    const roleIds = (assignments ?? []).map((assignment) => assignment.role_id);
    const { data: roles, error: roleError } = await supabase.from("roles").select("id, name").in("id", roleIds);
    if (roleError) throw roleError;

    const teacherRoleIds = new Set((roles ?? []).filter((role) => role.name === "Teacher").map((role) => role.id));
    const activeTeacherIds = (assignments ?? [])
      .filter((assignment) => teacherRoleIds.has(assignment.role_id))
      .map((assignment) => assignment.user_id);

    if (activeTeacherIds.length > 0) {
      const { data: teachers, error: teacherError } = await supabase
        .from("users")
        .select("id, first_name, last_name, status")
        .in("id", activeTeacherIds)
        .eq("status", "Active");

      if (teacherError) throw teacherError;
      (teachers ?? []).forEach((teacher) => teacherMap.set(teacher.id, teacher));
    }
  }

  const normalizedClasses = classRows.map((item) => ({
    ...item,
    class_name: normalizeClassName(item.class_name),
    class_teacher: teacherMap.get(item.class_teacher_id ?? "") ?? null,
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
    .select(CLASS_SELECT)
    .single();

  if (error) throw error;

  return data as SchoolClass;
}

/**
 * Update an existing class.
 */
export async function updateClass(payload: UpdateClassData): Promise<SchoolClass> {
  const { data: currentClass, error: currentClassError } = await supabase
    .from(TABLE)
    .select("class_name, class_teacher_id, status")
    .eq("id", payload.id)
    .single();

  if (currentClassError) throw currentClassError;

  const updateData: Record<string, unknown> = {};
  const normalizedPayloadName = payload.class_name.trim();

  if (currentClass.class_name !== normalizedPayloadName) {
    updateData.class_name = normalizedPayloadName;
  }

  if ((currentClass.class_teacher_id ?? null) !== (payload.class_teacher_id ?? null)) {
    updateData.class_teacher_id = payload.class_teacher_id ?? null;
  }

  if (currentClass.status !== payload.status) {
    updateData.status = payload.status;
  }

  if (Object.keys(updateData).length === 0) {
    return currentClass as SchoolClass;
  }

  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from(TABLE)
    .update(updateData)
    .eq("id", payload.id)
    .select(CLASS_SELECT)
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