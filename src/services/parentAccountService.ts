import { supabase } from "../lib/supabase";

const PARENT_ACCOUNT_REDIRECT_URL = "https://grandessaschool.com.ng/complete-account";

type ParentAccountResponse = {
  contact: { id: string; auth_user_id: string };
  invited: boolean;
  status: "not_created" | "invited" | "active";
};

async function invokeParentAccount(body: Record<string, unknown>): Promise<ParentAccountResponse> {
  const { data, error } = await supabase.functions.invoke("manage-parent", { body });
  if (error) throw error;
  return data as ParentAccountResponse;
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