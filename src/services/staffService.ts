import { supabase } from "../lib/supabase";

export type StaffRole = "Administrator" | "Proprietress" | "Super Admin" | "Accountant" | "Teacher";

export interface StaffUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  role_id: string;
  role_name: StaffRole;
}

export type CreateStaffInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role_name: StaffRole;
};

type StaffFunctionResponse = { staff?: StaffUser[]; user?: StaffUser };

async function invokeStaffFunction<T extends StaffFunctionResponse>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("manage-staff", { body });
  if (error) throw error;
  return data as T;
}

export async function getStaffUsers(): Promise<StaffUser[]> {
  const response = await invokeStaffFunction<{ staff: StaffUser[] }>({ action: "list" });
  return response.staff ?? [];
}

export async function createStaffUser(input: CreateStaffInput): Promise<StaffUser> {
  const response = await invokeStaffFunction<{ user: StaffUser }>({ action: "create", ...input });
  if (!response.user) throw new Error("Staff user was not returned by the server.");
  return response.user;
}

export async function toggleStaffStatus(id: string, status: "Active" | "Inactive"): Promise<void> {
  await invokeStaffFunction({ action: "set_status", id, status });
}

export async function getActiveTeacherUsers(): Promise<StaffUser[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role_id, is_active")
    .eq("is_active", true);

  if (error) throw error;

  const roleIds = (data ?? []).map((row) => row.role_id);
  const userIds = (data ?? []).map((row) => row.user_id);
  if (roleIds.length === 0 || userIds.length === 0) return [];
  const [{ data: roles, error: rolesError }, { data: users, error: usersError }] = await Promise.all([
    supabase.from("roles").select("id, name").in("id", roleIds),
    supabase.from("users").select("id, first_name, last_name, status").in("id", userIds),
  ]);

  if (rolesError) throw rolesError;
  if (usersError) throw usersError;

  const roleById = new Map((roles ?? []).map((role) => [role.id, role.name as StaffRole]));
  const userById = new Map((users ?? []).map((user) => [user.id, user]));

  return (data ?? []).flatMap((row) => {
    const roleName = roleById.get(row.role_id);
    const user = userById.get(row.user_id);

    if (roleName !== "Teacher" || !user || user.status !== "Active") return [];

    return [{
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: null,
      phone: null,
      status: user.status,
      role_id: row.role_id,
      role_name: roleName,
    }];
  });
}