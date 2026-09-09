import { supabase } from "../lib/supabase";

const PARENT_ACCOUNT_REDIRECT_URL = "https://grandessaschool.com.ng/complete-account";

type ParentAccountResponse = {
  contact: { id: string; auth_user_id: string };
  invited: boolean;
  status: "not_created" | "invited" | "active";
};

type ParentPortalAccount = {
  auth_user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type ParentPortalLink = {
  student_id: string;
  auth_user_id: string;
  relationship: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
};

async function invokeParentAccount<T = ParentAccountResponse>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("manage-parent", { body });
  if (error) throw error;
  return data as T;
}

export function createParentPortalAccount(contactId: string): Promise<ParentAccountResponse> {
  return invokeParentAccount({ action: "create", contact_id: contactId, redirect_to: PARENT_ACCOUNT_REDIRECT_URL });
}

export function resendParentPortalInvite(contactId: string): Promise<ParentAccountResponse> {
  return invokeParentAccount({ action: "resend_invitation", contact_id: contactId, redirect_to: PARENT_ACCOUNT_REDIRECT_URL });
}

export function getParentPortalAccountStatus(contactId: string): Promise<ParentAccountResponse> {
  return invokeParentAccount({ action: "status", contact_id: contactId });
}

export function listParentPortalAccounts(): Promise<ParentPortalAccount[]> {
  return invokeParentAccount<{ accounts: ParentPortalAccount[] }>({ action: "accounts" }).then((payload) => payload.accounts ?? []);
}

export function listParentPortalLinks(studentId: string): Promise<ParentPortalLink[]> {
  return invokeParentAccount<{ links: ParentPortalLink[] }>({ action: "links", student_id: studentId }).then((payload) => payload.links ?? []);
}

export function linkParentAccountToStudent(studentId: string, authUserId: string, relationship?: string | null): Promise<{ ok: boolean }> {
  return invokeParentAccount<{ ok: boolean }>({ action: "link", student_id: studentId, auth_user_id: authUserId, relationship: relationship ?? null });
}

export function unlinkParentAccountFromStudent(studentId: string, authUserId: string): Promise<{ ok: boolean }> {
  return invokeParentAccount<{ ok: boolean }>({ action: "unlink", student_id: studentId, auth_user_id: authUserId });
}