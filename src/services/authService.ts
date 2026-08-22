import supabase from "../lib/supabase";

export type UserRole =
  | "super_admin"
  | "school_admin"
  | "teacher"
  | "parent";

export async function signIn(
  email: string,
  password: string
) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) throw error;

  return data;
}

export async function signOut() {
  const { error } =
    await supabase.auth.signOut();

  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } =
    await supabase.auth.getUser();

  if (error) throw error;

  return data.user;
}

export async function getCurrentSession() {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) throw error;

  return data.session;
}

export async function resetPassword(
  email: string
) {
  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/reset-password`
    : undefined;

  const { error } =
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) throw error;
}

export async function updatePassword(
  password: string
) {
  const { error } =
    await supabase.auth.updateUser({
      password,
    });

  if (error) throw error;
}