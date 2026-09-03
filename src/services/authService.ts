import supabase from "../lib/supabase";

export const PASSWORD_RESET_REDIRECT_URL = "https://grandessaschool.com.ng/reset-password";

export type UserRole =
  | "super_admin"
  | "school_admin"
  | "teacher"
  | "parent";

export function getFriendlyAuthError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }
  if (message.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  if (message.includes("expired") || message.includes("invalid token") || message.includes("otp")) {
    return "This link is invalid or has expired. Please request a new one.";
  }
  if (message.includes("password") && (message.includes("weak") || message.includes("short") || message.includes("characters"))) {
    return "Choose a stronger password with at least 8 characters.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "We could not connect to Grandessa. Check your connection and try again.";
  }

  return fallback;
}

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
  const { error } =
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: PASSWORD_RESET_REDIRECT_URL });

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