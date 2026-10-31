import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

type ParentRequest = {
  action?: "create" | "resend_invitation" | "status" | "directory" | "link" | "link_existing" | "unlink" | "accounts" | "links" | "reuse_existing";
  contact_id?: string;
  student_id?: string;
  auth_user_id?: string;
  relationship?: string | null;
  redirect_to?: string;
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function errorResponse(message: string, status: number): Response {
  return response({ error: message }, status);
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get("Authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() || null : null;
}

function validateRedirect(value: string | undefined): string {
  if (!value) throw new Error("A valid /complete-account redirect URL is required.");
  const redirect = new URL(value);
  if (redirect.origin !== "https://grandessaschool.com.ng" || redirect.pathname !== "/complete-account" || redirect.search || redirect.hash) {
    throw new Error("Invitations must use the school’s official account-completion page.");
  }
  return redirect.toString();
}

async function assertManager(adminClient: ReturnType<typeof createClient>, userId: string): Promise<void> {
  const [{ data: user, error: userError }, { data: assignments, error: assignmentError }] = await Promise.all([
    adminClient.from("users").select("status").eq("id", userId).maybeSingle(),
    adminClient.from("user_roles").select("role_id").eq("user_id", userId).eq("is_active", true),
  ]);
  if (userError) throw userError;
  if (assignmentError) throw assignmentError;
  if (!user || user.status !== "Active") throw new Error("You are not authorized to manage parent accounts.");
  const roleIds = (assignments ?? []).map((assignment) => assignment.role_id);
  const { data: roles, error: roleError } = await adminClient.from("roles").select("name").in("id", roleIds);
  if (roleError) throw roleError;
  if (!(roles ?? []).some((role) => ["Proprietress", "Super Admin", "Administrator", "School Admin", "admin", "Admin", "school_admin", "super_admin"].includes(role.name))) {
    throw new Error("You are not authorized to manage parent accounts.");
  }
}

async function getParentRole(adminClient: ReturnType<typeof createClient>): Promise<{ id: string; name: string }> {
  const { data, error } = await adminClient.from("roles").select("id, name").in("name", ["Parent", "parent"]).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The Parent role is not configured.");
  return data;
}

async function ensureContactStudentLinks(
  adminClient: ReturnType<typeof createClient>,
  contact: { id: string; relationship?: string | null },
  authUserId: string,
): Promise<void> {
  const parentRole = await getParentRole(adminClient);
  const [{ data: user, error: userError }, { data: assignments, error: assignmentError }] = await Promise.all([
    adminClient.from("users").select("status").eq("id", authUserId).maybeSingle(),
    adminClient.from("user_roles").select("id").eq("user_id", authUserId).eq("role_id", parentRole.id).eq("is_active", true).limit(1),
  ]);
  if (userError) throw userError;
  if (assignmentError) throw assignmentError;
  if (!user || user.status !== "Active" || !assignments?.length) return;

  const { data: students, error: studentsError } = await adminClient
    .from("students")
    .select("id")
    .or(`primary_contact_id.eq.${contact.id},secondary_contact_id.eq.${contact.id}`);
  if (studentsError) throw studentsError;
  if (!students?.length) return;

  const { error: linkError } = await adminClient
    .from("parent_student_links")
    .upsert(
      students.map((student) => ({
        student_id: student.id,
        auth_user_id: authUserId,
        relationship: contact.relationship ?? null,
      })),
      { onConflict: "student_id,auth_user_id", ignoreDuplicates: true },
    );
  if (linkError) throw linkError;
}

async function ensureParentRole(
  adminClient: ReturnType<typeof createClient>,
  authUserId: string,
  roleId: string,
): Promise<void> {
  const { data: assignments, error: assignmentsError } = await adminClient
    .from("user_roles")
    .select("id, is_active")
    .eq("user_id", authUserId)
    .eq("role_id", roleId);
  if (assignmentsError) throw assignmentsError;

  if ((assignments ?? []).some((assignment) => assignment.is_active === true)) return;

  const existingAssignment = assignments?.[0];
  if (existingAssignment?.id) {
    const { error } = await adminClient
      .from("user_roles")
      .update({ is_active: true })
      .eq("id", existingAssignment.id);
    if (error) throw error;
    return;
  }

  const { error } = await adminClient.from("user_roles").insert({
    user_id: authUserId,
    role_id: roleId,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    is_active: true,
  });
  if (error) throw error;
}

async function handleCreate(adminClient: ReturnType<typeof createClient>, request: ParentRequest): Promise<Response> {
  if (!request.contact_id) return errorResponse("A contact id is required.", 400);
  const { data: contact, error: contactError } = await adminClient.from("contacts").select("id, first_name, last_name, email, relationship, auth_user_id").eq("id", request.contact_id).maybeSingle();
  if (contactError) throw contactError;
  if (!contact) return errorResponse("Contact not found.", 404);
  const email = contact.email?.trim().toLowerCase();
  if (!email) return errorResponse("Add an email address to this contact before creating a portal account.", 400);
  if (contact.auth_user_id) {
    const { data: authUserResult, error: authError } = await adminClient.auth.admin.getUserById(contact.auth_user_id);
    if (authError) throw authError;
    const existingUser = authUserResult.user;
    if (!existingUser) return errorResponse("The contact points to a missing login account. Review this contact before changing it.", 409);
    if (existingUser.email?.trim().toLowerCase() !== email) {
      return errorResponse("The contact email does not match its linked login account. Review the contact before restoring access; no account was changed.", 409);
    }

    // Restore the disabled profile as well as the Parent role.
    const { error: userError } = await adminClient.from("users").upsert({
      id: contact.auth_user_id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      status: "Active",
    }, { onConflict: "id" });
    if (userError) throw userError;

    const parentRole = await getParentRole(adminClient);
    await ensureParentRole(adminClient, contact.auth_user_id, parentRole.id);
    await ensureContactStudentLinks(adminClient, contact, contact.auth_user_id);
    const completed = Boolean(existingUser.email_confirmed_at || existingUser.last_sign_in_at);
    return response({
      contact: { id: contact.id, auth_user_id: contact.auth_user_id },
      invited: false,
      status: completed ? "active" : "invited",
      restored: true,
    });
  }

  const { data: authUsers, error: authListError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authListError) throw authListError;
  const existingAuthUser = authUsers.users.find((user) => user.email?.toLowerCase() === email);
  if (existingAuthUser) {
    return errorResponse("This email already belongs to an Auth account. Link that account explicitly before creating a parent portal account.", 409);
  }

  let authUserId: string | undefined;
  let invited = false;
  if (!authUserId) {
    const redirectTo = validateRedirect(request.redirect_to);
    const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteError) throw inviteError;
    if (!invitedUser.user) throw new Error("Supabase Auth did not return the invited user.");
    authUserId = invitedUser.user.id;
    invited = true;
  }

  const role = await getParentRole(adminClient);
  const { error: userError } = await adminClient.from("users").upsert({ id: authUserId, first_name: contact.first_name, last_name: contact.last_name, status: "Active" }, { onConflict: "id" });
  if (userError) throw userError;
  await ensureParentRole(adminClient, authUserId, role.id);
  const { error: linkError } = await adminClient.from("contacts").update({ auth_user_id: authUserId }).eq("id", contact.id);
  if (linkError) throw linkError;
  await ensureContactStudentLinks(adminClient, contact, authUserId);
  return response({ contact: { id: contact.id, auth_user_id: authUserId }, invited, status: "invited" });
}

async function handleResend(authClient: ReturnType<typeof createClient>, adminClient: ReturnType<typeof createClient>, request: ParentRequest): Promise<Response> {
  if (!request.contact_id) return errorResponse("A contact id is required.", 400);
  const { data: contact, error } = await adminClient.from("contacts").select("id, auth_user_id").eq("id", request.contact_id).maybeSingle();
  if (error) throw error;
  if (!contact?.auth_user_id) return errorResponse("Create the parent portal account before resending an invite.", 400);
  const { data: authUserResult, error: authError } = await adminClient.auth.admin.getUserById(contact.auth_user_id);
  if (authError) throw authError;
  const email = authUserResult.user?.email;
  if (!email) return errorResponse("This contact has no email available for an invitation.", 400);
  if (authUserResult.user.email_confirmed_at || authUserResult.user.last_sign_in_at) return errorResponse("This account has already been completed. Use Forgot Password if needed.", 400);
  const redirectTo = validateRedirect(request.redirect_to);
  const { error: resetError } = await authClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetError) throw resetError;
  return response({ contact: { id: contact.id, auth_user_id: contact.auth_user_id }, invited: true, status: "invited" });
}

async function handleStatus(adminClient: ReturnType<typeof createClient>, request: ParentRequest): Promise<Response> {
  if (!request.contact_id) return errorResponse("A contact id is required.", 400);
  const { data: contact, error } = await adminClient.from("contacts").select("id, auth_user_id").eq("id", request.contact_id).maybeSingle();
  if (error) throw error;
  if (!contact) return errorResponse("Contact not found.", 404);
  if (!contact.auth_user_id) return response({ contact: { id: contact.id, auth_user_id: "" }, invited: false, status: "not_created" });

  const { data: authUserResult, error: authError } = await adminClient.auth.admin.getUserById(contact.auth_user_id);
  if (authError) throw authError;
  const completed = Boolean(authUserResult.user?.email_confirmed_at || authUserResult.user?.last_sign_in_at);
  return response({ contact: { id: contact.id, auth_user_id: contact.auth_user_id }, invited: !completed, status: completed ? "active" : "invited" });
}

async function handleLink(adminClient: ReturnType<typeof createClient>, request: ParentRequest, callerId: string): Promise<Response> {
  if (!request.student_id) return errorResponse("A student id is required.", 400);
  if (!request.auth_user_id) return errorResponse("An auth user id is required.", 400);

  const { data: student, error: studentError } = await adminClient.from("students").select("id").eq("id", request.student_id).maybeSingle();
  if (studentError) throw studentError;
  if (!student) return errorResponse("Student not found.", 404);

  const { data: authUser, error: authLookupError } = await adminClient.auth.admin.getUserById(request.auth_user_id);
  if (authLookupError) throw authLookupError;
  if (!authUser.user) return errorResponse("Authenticated parent account not found.", 404);

  const parentRole = await getParentRole(adminClient);
  const { data: parentRoleRows, error: roleRowsError } = await adminClient
    .from("user_roles")
    .select("id")
    .eq("user_id", request.auth_user_id)
    .eq("role_id", parentRole.id)
    .eq("is_active", true)
    .limit(1);
  if (roleRowsError) throw roleRowsError;
  if (!parentRoleRows || parentRoleRows.length === 0) {
    return errorResponse("The selected user does not currently hold an active Parent role.", 409);
  }

  const { data: parentUser, error: parentUserError } = await adminClient.from("users").select("id, status").eq("id", request.auth_user_id).maybeSingle();
  if (parentUserError) throw parentUserError;
  if (!parentUser || parentUser.status !== "Active") return errorResponse("The selected parent account is not active.", 409);

  const { data: existing, error: listError } = await adminClient
    .from("parent_student_links")
    .select("id")
    .eq("student_id", request.student_id)
    .eq("auth_user_id", request.auth_user_id)
    .limit(1)
    .maybeSingle();
  if (listError) throw listError;
  if (existing?.id) {
    return response({ ok: true, already_linked: true, message: "This parent account is already linked to this student." });
  }

  const { error: linkError } = await adminClient
    .from("parent_student_links")
    .insert({
      student_id: request.student_id,
      auth_user_id: request.auth_user_id,
      relationship: request.relationship ?? null,
      created_by: callerId,
    });

  if (linkError) {
    if (String(linkError.message).toLowerCase().includes("duplicate")) {
      return response({ ok: true, already_linked: true, message: "This parent account is already linked to this student." });
    }
    throw linkError;
  }

  return response({ ok: true, already_linked: false, auth_user_id: request.auth_user_id, student_id: request.student_id, relationship: request.relationship ?? null });
}

async function handleUnlink(adminClient: ReturnType<typeof createClient>, request: ParentRequest): Promise<Response> {
  if (!request.student_id) return errorResponse("A student id is required.", 400);
  if (!request.auth_user_id) return errorResponse("An auth user id is required.", 400);

  const { error } = await adminClient
    .from("parent_student_links")
    .delete()
    .eq("student_id", request.student_id)
    .eq("auth_user_id", request.auth_user_id);

  if (error) throw error;
  return response({ ok: true });
}

async function handleAccounts(adminClient: ReturnType<typeof createClient>): Promise<Response> {
  const parentRole = await getParentRole(adminClient);
  const { data: roleRows, error: roleRowsError } = await adminClient
    .from("user_roles")
    .select("user_id")
    .eq("role_id", parentRole.id)
    .eq("is_active", true);
  if (roleRowsError) throw roleRowsError;

  const userIds = [...new Set((roleRows ?? []).map((row) => row.user_id).filter(Boolean))];
  if (userIds.length === 0) return response({ accounts: [] });

  const { data: profileRows, error: profilesError } = await adminClient
    .from("users")
    .select("id, first_name, last_name, status")
    .in("id", userIds)
    .eq("status", "Active");
  if (profilesError) throw profilesError;

  const profileById = new Map((profileRows ?? []).map((row) => [row.id, row]));
  const accounts = [] as Array<{ auth_user_id: string; first_name: string | null; last_name: string | null; email: string | null }>;

  let page = 1;
  while (true) {
    const { data: authPage, error: authPageError } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (authPageError) throw authPageError;
    for (const authUser of authPage.users) {
      if (!userIds.includes(authUser.id)) continue;
      const profile = profileById.get(authUser.id);
      if (!profile) continue;
      accounts.push({
        auth_user_id: authUser.id,
        email: authUser.email ?? null,
        first_name: profile.first_name ?? authUser.user_metadata?.first_name ?? null,
        last_name: profile.last_name ?? authUser.user_metadata?.last_name ?? null,
      });
    }
    if (authPage.users.length < 1000) break;
    page += 1;
  }

  return response({ accounts });
}

async function handleLinks(adminClient: ReturnType<typeof createClient>, request: ParentRequest): Promise<Response> {
  if (!request.student_id) return errorResponse("A student id is required.", 400);

  const { data: rows, error } = await adminClient
    .from("parent_student_links")
    .select("student_id, auth_user_id, relationship, created_at")
    .eq("student_id", request.student_id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const links = [] as Array<Record<string, unknown>>;
  for (const row of rows ?? []) {
    const { data: userRecord, error: userRecordError } = await adminClient
      .from("users")
      .select("id, first_name, last_name, status")
      .eq("id", row.auth_user_id)
      .maybeSingle();
    if (userRecordError) throw userRecordError;

    const { data: authUser, error: authLookupError } = await adminClient.auth.admin.getUserById(row.auth_user_id);
    if (authLookupError) throw authLookupError;

    links.push({
      student_id: row.student_id,
      auth_user_id: row.auth_user_id,
      relationship: row.relationship,
      email: authUser.user?.email ?? null,
      created_at: row.created_at,
      first_name: userRecord?.first_name ?? null,
      last_name: userRecord?.last_name ?? null,
    });
  }

  return response({ links });
}


async function handleReuseExistingParentAccount(
  adminClient: ReturnType<typeof createClient>,
  request: ParentRequest,
): Promise<Response> {
  if (!request.contact_id) return errorResponse("A contact id is required.", 400);
  const { data: contact, error: contactError } = await adminClient
    .from("contacts")
    .select("id, email, relationship")
    .eq("id", request.contact_id)
    .maybeSingle();
  if (contactError) throw contactError;
  if (!contact) return errorResponse("Contact not found.", 404);

  const email = contact.email?.trim().toLowerCase();
  if (!email) return errorResponse("This contact needs an email address before an existing account can be matched.", 400);

  let matchingUserId: string | null = null;
  let page = 1;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const matches = data.users.filter((user) => user.email?.trim().toLowerCase() === email);
    if (matches.length > 1) return errorResponse("More than one login uses this email. Review the accounts before linking.", 409);
    if (matches.length === 1) {
      matchingUserId = matches[0].id;
      break;
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
  if (!matchingUserId) return errorResponse("No existing login uses this contact email. Create an invitation only if the school confirms no account exists.", 404);

  const { data: canonicalContacts, error: canonicalError } = await adminClient
    .from("contacts")
    .select("id, relationship")
    .eq("auth_user_id", matchingUserId);
  if (canonicalError) throw canonicalError;
  const canonical = (canonicalContacts ?? []).find((row) => row.id !== contact.id);
  if (!canonical) return errorResponse("The matching login is not yet attached to a verified school contact. Review the account before reusing it.", 409);

  const parentRole = await getParentRole(adminClient);
  const [{ data: parentUser, error: parentUserError }, { data: roleRows, error: roleRowsError }] = await Promise.all([
    adminClient.from("users").select("id, status").eq("id", matchingUserId).maybeSingle(),
    adminClient.from("user_roles").select("id").eq("user_id", matchingUserId).eq("role_id", parentRole.id).eq("is_active", true).limit(1),
  ]);
  if (parentUserError) throw parentUserError;
  if (roleRowsError) throw roleRowsError;
  if (!parentUser || parentUser.status !== "Active" || !roleRows?.length) {
    return errorResponse("The matching login is not an active Parent portal account. Review its access before reusing it.", 409);
  }

  const { data: students, error: studentsError } = await adminClient
    .from("students")
    .select("id, primary_contact_id, secondary_contact_id")
    .or(`primary_contact_id.eq.${contact.id},secondary_contact_id.eq.${contact.id}`);
  if (studentsError) throw studentsError;
  if (!students?.length) return response({ ok: true, linked_students: 0, message: "No students currently use this contact record." });

  for (const student of students) {
    const updates: Record<string, string> = {};
    if (student.primary_contact_id === contact.id) updates.primary_contact_id = canonical.id;
    if (student.secondary_contact_id === contact.id) updates.secondary_contact_id = canonical.id;
    if (Object.keys(updates).length > 0) {
      const { error } = await adminClient.from("students").update(updates).eq("id", student.id);
      if (error) throw error;
    }
  }

  const { error: linksError } = await adminClient
    .from("parent_student_links")
    .upsert(
      students.map((student) => ({
        student_id: student.id,
        auth_user_id: matchingUserId,
        relationship: contact.relationship ?? canonical.relationship ?? null,
      })),
      { onConflict: "student_id,auth_user_id", ignoreDuplicates: true },
    );
  if (linksError) throw linksError;

  return response({
    ok: true,
    linked_students: students.length,
    auth_user_id: matchingUserId,
    canonical_contact_id: canonical.id,
    message: "Existing parent account reused. Student contact records and portal links have been aligned.",
  });
}

async function handleLinkExisting(
  adminClient: ReturnType<typeof createClient>,
  request: ParentRequest,
): Promise<Response> {
  if (!request.contact_id) return errorResponse("A contact id is required.", 400);
  const { data: contact, error: contactError } = await adminClient
    .from("contacts")
    .select("id, first_name, last_name, relationship, email, auth_user_id")
    .eq("id", request.contact_id)
    .maybeSingle();
  if (contactError) throw contactError;
  if (!contact) return errorResponse("Contact not found.", 404);
  if (contact.auth_user_id) {
    const { data: existingAuthResult, error: existingAuthError } = await adminClient.auth.admin.getUserById(contact.auth_user_id);
    if (existingAuthError) throw existingAuthError;
    const existingUser = existingAuthResult.user;
    if (!existingUser || existingUser.email?.trim().toLowerCase() !== contact.email?.trim().toLowerCase()) {
      return errorResponse("The existing contact-to-login link does not match the contact email. Review it before linking; no change was made.", 409);
    }
    const { error: userError } = await adminClient.from("users").upsert({
      id: contact.auth_user_id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      status: "Active",
    }, { onConflict: "id" });
    if (userError) throw userError;
    await ensureParentRole(adminClient, contact.auth_user_id, (await getParentRole(adminClient)).id);
    await ensureContactStudentLinks(adminClient, contact, contact.auth_user_id);
    const completed = Boolean(existingUser.email_confirmed_at || existingUser.last_sign_in_at);
    return response({
      contact: { id: contact.id, auth_user_id: contact.auth_user_id },
      invited: false,
      status: completed ? "active" : "invited",
      linked_existing: true,
    });
  }

  const email = contact.email?.trim().toLowerCase();
  if (!email) return errorResponse("Add a valid email address before linking an existing parent account.", 400);

  let matchingUserId: string | null = null;
  let page = 1;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) {
      matchingUserId = match.id;
      break;
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
  if (!matchingUserId) return errorResponse("No existing account uses this contact’s email address. Create an account invitation instead.", 404);

  const { data: existingContact, error: existingContactError } = await adminClient
    .from("contacts")
    .select("id")
    .eq("auth_user_id", matchingUserId)
    .neq("id", contact.id)
    .limit(1)
    .maybeSingle();
  if (existingContactError) throw existingContactError;
  if (existingContact) {
    return errorResponse("This account is already attached to a different contact record. Review the duplicate contact before linking it; no link was changed.", 409);
  }

  const { data: authUserResult, error: authError } = await adminClient.auth.admin.getUserById(matchingUserId);
  if (authError) throw authError;
  const authUser = authUserResult.user;
  if (!authUser) return errorResponse("The matching account could not be loaded.", 404);

  const parentRole = await getParentRole(adminClient);
  const { error: userError } = await adminClient.from("users").upsert({
    id: matchingUserId,
    first_name: contact.first_name,
    last_name: contact.last_name,
    status: "Active",
  }, { onConflict: "id" });
  if (userError) throw userError;
  await ensureParentRole(adminClient, matchingUserId, parentRole.id);

  const { data: linkedContact, error: linkError } = await adminClient
    .from("contacts")
    .update({ auth_user_id: matchingUserId })
    .eq("id", contact.id)
    .is("auth_user_id", null)
    .select("id")
    .maybeSingle();
  if (linkError) throw linkError;
  if (!linkedContact) {
    return errorResponse("The contact changed while this account was being linked. Refresh the directory and try again.", 409);
  }
  await ensureContactStudentLinks(adminClient, contact, matchingUserId);
  const completed = Boolean(authUser.email_confirmed_at || authUser.last_sign_in_at);
  return response({
    contact: { id: contact.id, auth_user_id: matchingUserId },
    invited: false,
    status: completed ? "active" : "invited",
    linked_existing: true,
  });
}

async function handleDirectory(adminClient: ReturnType<typeof createClient>): Promise<Response> {
  type DirectoryContact = {
    id: string;
    first_name: string;
    last_name: string;
    relationship: string | null;
    email: string | null;
    phone: string | null;
    auth_user_id: string | null;
  };

  const [{ data: contacts, error: contactsError }, { data: students, error: studentsError }, parentRole] = await Promise.all([
    adminClient.from("contacts").select("id, first_name, last_name, relationship, email, phone, auth_user_id"),
    adminClient.from("students").select("id, first_name, last_name, admission_number, class_id, primary_contact_id, secondary_contact_id"),
    getParentRole(adminClient),
  ]);
  if (contactsError) throw contactsError;
  if (studentsError) throw studentsError;

  const { data: activeParentAssignments, error: activeParentAssignmentsError } = await adminClient
    .from("user_roles")
    .select("user_id")
    .eq("role_id", parentRole.id)
    .eq("is_active", true);
  if (activeParentAssignmentsError) throw activeParentAssignmentsError;
  const activeParentUserIds = new Set((activeParentAssignments ?? []).map((assignment) => assignment.user_id));

  const linkedAuthUserIds = [...new Set((contacts ?? [])
    .map((contact) => contact.auth_user_id)
    .filter((value): value is string => Boolean(value)))];
  const { data: userProfiles, error: userProfilesError } = linkedAuthUserIds.length > 0
    ? await adminClient.from("users").select("id, status").in("id", linkedAuthUserIds)
    : { data: [], error: null };
  if (userProfilesError) throw userProfilesError;
  const activeProfileUserIds = new Set((userProfiles ?? [])
    .filter((user) => user.status === "Active")
    .map((user) => user.id));

  const { data: parentLinkRows, error: parentLinkError } = await adminClient
    .from("parent_student_links")
    .select("student_id, auth_user_id");
  if (parentLinkError) throw parentLinkError;
  const linkedStudentIdsByAuthUser = new Map<string, Set<string>>();
  for (const link of parentLinkRows ?? []) {
    const studentIds = linkedStudentIdsByAuthUser.get(link.auth_user_id) ?? new Set<string>();
    studentIds.add(link.student_id);
    linkedStudentIdsByAuthUser.set(link.auth_user_id, studentIds);
  }

  const authUsers = new Map<string, { email: string | null; emailConfirmed: boolean; signedIn: boolean }>();
  const authUsersByEmail = new Map<string, { id: string; emailConfirmed: boolean; signedIn: boolean }>();
  let page = 1;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
      authUsers.set(user.id, {
        email: normalizedEmail,
        emailConfirmed: Boolean(user.email_confirmed_at),
        signedIn: Boolean(user.last_sign_in_at),
      });
      if (normalizedEmail && !authUsersByEmail.has(normalizedEmail)) {
        authUsersByEmail.set(normalizedEmail, {
          id: user.id,
          emailConfirmed: Boolean(user.email_confirmed_at),
          signedIn: Boolean(user.last_sign_in_at),
        });
      }
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  const { data: classRows, error: classesError } = await adminClient.from("classes").select("id, class_name");
  if (classesError) throw classesError;
  const classes = new Map<string, string>();
  for (const row of classRows ?? []) classes.set(row.id, row.class_name);

  const studentIdsByContact = new Map<string, Map<string, Record<string, unknown>>>();
  for (const student of students ?? []) {
    const studentData = {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      admission_number: student.admission_number,
      class_name: classes.get(student.class_id) ?? null,
    };
    for (const contactId of [student.primary_contact_id, student.secondary_contact_id]) {
      if (!contactId) continue;
      const current = studentIdsByContact.get(contactId) ?? new Map<string, Record<string, unknown>>();
      current.set(student.id, studentData);
      studentIdsByContact.set(contactId, current);
    }
  }

  const contactData = (contact: DirectoryContact) => ({
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    relationship: contact.relationship,
    email: contact.email,
    phone: contact.phone,
  });

  const entries = (contacts ?? []).flatMap((contact) => {
    const linkedStudents = [...(studentIdsByContact.get(contact.id)?.values() ?? [])];
    if (linkedStudents.length === 0) return [];

    let status: "not_created" | "inactive" | "invited" | "active" | "link_missing" | "account_exists_unlinked" | "account_conflict";
    if (contact.auth_user_id) {
      const authUser = authUsers.get(contact.auth_user_id);
      if (!activeParentUserIds.has(contact.auth_user_id)
        || !activeProfileUserIds.has(contact.auth_user_id)
        || !authUsers.has(contact.auth_user_id)) {
        status = "inactive";
      } else {
        const linkedStudentIds = linkedStudentIdsByAuthUser.get(contact.auth_user_id) ?? new Set<string>();
        const hasMissingStudentLink = linkedStudents.some((student) => !linkedStudentIds.has(String(student.id)));
        if (hasMissingStudentLink) {
          status = "link_missing";
        } else if (authUser?.emailConfirmed || authUser?.signedIn) {
          status = "active";
        } else {
          status = "invited";
        }
      }
    } else {
      const normalizedEmail = contact.email?.trim().toLowerCase() ?? "";
      const matchingAuthUser = normalizedEmail ? authUsersByEmail.get(normalizedEmail) : undefined;
      if (!normalizedEmail || !matchingAuthUser) {
        status = "not_created";
      } else {
        const usedByAnotherContact = (contacts ?? []).some((candidate) =>
          candidate.id !== contact.id && candidate.auth_user_id === matchingAuthUser.id
        );
        status = usedByAnotherContact ? "account_conflict" : "account_exists_unlinked";
      }
    }

    return [{
      contact: contactData(contact),
      students: linkedStudents,
      account_status: status,
    }];
  });

  return response({ entries });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("Method not allowed.", 405);
  try {
    const token = bearerToken(request);
    if (!token) return errorResponse("Authentication is required.", 401);
    const url = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return errorResponse("Invalid authentication token.", 401);
    const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await assertManager(adminClient, authData.user.id);
    const payload = (await request.json()) as ParentRequest;
    if (payload.action === "create") return await handleCreate(adminClient, payload);
    if (payload.action === "link_existing") return await handleLinkExisting(adminClient, payload);
    if (payload.action === "reuse_existing") return await handleReuseExistingParentAccount(adminClient, payload);
    if (payload.action === "resend_invitation") return await handleResend(authClient, adminClient, payload);
    if (payload.action === "status") return await handleStatus(adminClient, payload);
    if (payload.action === "directory") return await handleDirectory(adminClient);
    if (payload.action === "link") return await handleLink(adminClient, payload, authData.user.id);
    if (payload.action === "unlink") return await handleUnlink(adminClient, payload);
    if (payload.action === "accounts") return await handleAccounts(adminClient);
    if (payload.action === "links") return await handleLinks(adminClient, payload);
    return errorResponse("Unsupported parent account action.", 400);
  } catch (error) {
    console.error(error);
    return errorResponse(error instanceof Error ? error.message : "Unable to manage parent account.", 500);
  }
});
