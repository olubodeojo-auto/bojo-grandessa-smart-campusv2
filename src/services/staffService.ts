import { supabase } from "../lib/supabase";

export type StaffRole = "Administrator" | "Teacher" | "Back Office";

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

export async function getActiveTeacherUsers(): Promise<StaffUser[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role_id, is_active")
    .eq("is_active", true);

  if (error) throw error;

  const roleIds = (data ?? []).map((row) => row.role_id);
  const userIds = (data ?? []).map((row) => row.user_id);
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