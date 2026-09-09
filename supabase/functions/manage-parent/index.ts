import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

type ParentRequest = {
  action?: "create" | "resend_invitation" | "status" | "directory" | "link" | "unlink" | "accounts" | "links";
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
  if (redirect.pathname !== "/complete-account" || !["http:", "https:"].includes(redirect.protocol)) throw new Error("Invalid invitation redirect URL.");
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

async function handleCreate(adminClient: ReturnType<typeof createClient>, request: ParentRequest): Promise<Response> {
  if (!request.contact_id) return errorResponse("A contact id is required.", 400);
  const { data: contact, error: contactError } = await adminClient.from("contacts").select("id, first_name, last_name, email, auth_user_id").eq("id", request.contact_id).maybeSingle();
  if (contactError) throw contactError;
  if (!contact) return errorResponse("Contact not found.", 404);
  const email = contact.email?.trim().toLowerCase();
  if (!email) return errorResponse("Add an email address to this contact before creating a portal account.", 400);
  if (contact.auth_user_id) {
    const { data: authUserResult, error: authError } = await adminClient.auth.admin.getUserById(contact.auth_user_id);
    if (authError) throw authError;
    const completed = Boolean(authUserResult.user?.email_confirmed_at || authUserResult.user?.last_sign_in_at);
    return response({ contact: { id: contact.id, auth_user_id: contact.auth_user_id }, invited: false, status: completed ? "active" : "invited" });
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
  
  const { error: deactivateError } = await adminClient
    .from("user_roles")
    .update({ is_active: false })
    .eq("user_id", authUserId)
    .neq("role_id", role.id);
  if (deactivateError) throw deactivateError;
  
  const { data: existingRole, error: roleCheckError } = await adminClient.from("user_roles").select("id").eq("user_id", authUserId).eq("role_id", role.id).maybeSingle();
  if (roleCheckError) throw roleCheckError;
  if (existingRole?.id) {
    const { error } = await adminClient.from("user_roles").update({ is_active: true }).eq("id", existingRole.id);
    if (error) throw error;
  } else {
    const { error } = await adminClient.from("user_roles").insert({ user_id: authUserId, role_id: role.id, start_date: new Date().toISOString().slice(0, 10), end_date: null, is_active: true });
    if (error) throw error;
  }
  const { error: linkError } = await adminClient.from("contacts").update({ auth_user_id: authUserId }).eq("id", contact.id);
  if (linkError) throw linkError;
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

async function handleDirectory(adminClient: ReturnType<typeof createClient>): Promise<Response> {
  const [{ data: contacts, error: contactsError }, { data: students, error: studentsError }] = await Promise.all([
    adminClient.from("contacts").select("id, first_name, last_name, relationship, email, phone, auth_user_id"),
    adminClient.from("students").select("id, first_name, last_name, admission_number, class_id, primary_contact_id, secondary_contact_id"),
  ]);
  if (contactsError) throw contactsError;
  if (studentsError) throw studentsError;

  const authUsers = new Map<string, { emailConfirmed: boolean; signedIn: boolean }>();
  let page = 1;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      authUsers.set(user.id, {
        emailConfirmed: Boolean(user.email_confirmed_at),
        signedIn: Boolean(user.last_sign_in_at),
      });
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  const classes = new Map<string, string>();
  const { data: classRows, error: classesError } = await adminClient.from("classes").select("id, class_name");
  if (classesError) throw classesError;
  for (const row of classRows ?? []) classes.set(row.id, row.class_name);

  const linkedStudents = new Map<string, Array<Record<string, unknown>>>();
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
      const current = linkedStudents.get(contactId) ?? [];
      if (!current.some((linkedStudent) => linkedStudent.id === student.id)) current.push(studentData);
      linkedStudents.set(contactId, current);
    }
  }

  const entries = (contacts ?? [])
    .filter((contact) => linkedStudents.has(contact.id))
    .map((contact) => {
      const authUser = contact.auth_user_id ? authUsers.get(contact.auth_user_id) : undefined;
      const completed = Boolean(authUser?.emailConfirmed || authUser?.signedIn);
      return {
        contact: {
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          relationship: contact.relationship,
          email: contact.email,
          phone: contact.phone,
        },
        students: linkedStudents.get(contact.id) ?? [],
        account_status: contact.auth_user_id ? (completed ? "active" : "invited") : "not_created",
      };
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