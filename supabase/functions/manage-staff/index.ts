import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const managedRoles = ["Administrator", "Proprietress", "Super Admin", "Accountant", "Teacher"] as const;
const managerRoles = new Set(["Administrator", "Proprietress", "Super Admin"]);
type ManagedRole = (typeof managedRoles)[number];
type StaffAction = "list" | "create" | "update" | "resend_invitation" | "set_status" | "delete";

type StaffRequest = {
  action?: StaffAction;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role_name?: ManagedRole;
  id?: string;
  status?: "Active" | "Inactive";
  redirect_to?: string;
};

interface CallerInfo {
  userId: string;
  roles: Set<string>;
  isSuperAdmin: boolean;
}

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string | null;
};

type RoleRow = { id: string; name: string };
type UserRoleRow = { id?: string; user_id: string; role_id: string; is_active: boolean | null };

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function getRoleName(adminClient: ReturnType<typeof createClient>, roleId: string): Promise<ManagedRole | null> {
  const { data, error } = await adminClient.from("roles").select("name").eq("id", roleId).maybeSingle();
  if (error) throw error;
  return isManagedRole(data?.name) ? data.name : null;
}

function errorResponse(message: string, status: number): Response {
  return response({ error: message }, status);
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function getBearerToken(request: Request): string | null {
  const value = request.headers.get("Authorization");
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim() || null;
}

function isManagedRole(value: unknown): value is ManagedRole {
  return typeof value === "string" && (managedRoles as readonly string[]).includes(value);
}

async function getRoleMap(
  adminClient: ReturnType<typeof createClient>,
  roleIds: string[],
): Promise<Map<string, string>> {
  if (roleIds.length === 0) return new Map();

  const { data, error } = await adminClient.from("roles").select("id, name").in("id", roleIds);
  if (error) throw error;
  return new Map(((data ?? []) as RoleRow[]).map((role) => [role.id, role.name]));
}

async function assertAuthorizedCaller(
  adminClient: ReturnType<typeof createClient>,
  callerId: string,
): Promise<CallerInfo> {
  const [{ data: caller, error: callerError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    adminClient.from("users").select("status").eq("id", callerId).maybeSingle(),
    adminClient.from("user_roles").select("role_id, is_active").eq("user_id", callerId).eq("is_active", true),
  ]);

  if (callerError) throw callerError;
  if (assignmentsError) throw assignmentsError;
  if (!caller || caller.status !== "Active") throw new Error("Caller is not an active staff user.");

  const roleMap = await getRoleMap(
    adminClient,
    ((assignments ?? []) as Pick<UserRoleRow, "role_id">[]).map((assignment: Pick<UserRoleRow, "role_id">) => assignment.role_id),
  );

  const callerRoles = new Set<string>();
  let isSuperAdmin = false;

  (assignments ?? []).forEach((assignment: UserRoleRow) => {
    const roleName = roleMap.get(assignment.role_id) ?? "";
    if (roleName) {
      callerRoles.add(roleName);
      if (roleName === "Super Admin") {
        isSuperAdmin = true;
      }
    }
  });

  if (!callerRoles.size || (!isSuperAdmin && !Array.from(callerRoles).some((roleName) => managerRoles.has(roleName)))) {
    throw new Error("You are not authorized to manage staff users.");
  }

  return { userId: callerId, roles: callerRoles, isSuperAdmin };
}

async function listStaff(adminClient: ReturnType<typeof createClient>, caller: CallerInfo): Promise<Response> {
  const [{ data: users, error: usersError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    adminClient.from("users").select("id, first_name, last_name, phone, status").order("last_name"),
    adminClient.from("user_roles").select("user_id, role_id, is_active"),
  ]);

  if (usersError) throw usersError;
  if (assignmentsError) throw assignmentsError;

  const userRows = (users ?? []) as UserRow[];
  const userRoleRows = (assignments ?? []) as UserRoleRow[];
  const roleMap = await getRoleMap(adminClient, userRoleRows.map((assignment) => assignment.role_id));
  const authUsers = new Map<string, string>();
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const authUser of data.users) {
      if (authUser.email) authUsers.set(authUser.id, authUser.email);
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  const staff = userRoleRows.flatMap((assignment: UserRoleRow) => {
    const user = userRows.find((candidate: UserRow) => candidate.id === assignment.user_id);
    const roleName = roleMap.get(assignment.role_id);
    if (!user || !isManagedRole(roleName)) return [];

    // Filter out Super Admin if caller is not Super Admin
    if (roleName === "Super Admin" && !caller.isSuperAdmin) {
      return [];
    }

    return [{
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: authUsers.get(user.id) ?? null,
      phone: user.phone,
      status: user.status,
      role_id: assignment.role_id,
      role_name: roleName,
    }];
  });

  return response({ staff });
}

async function createStaff(
  adminClient: ReturnType<typeof createClient>,
  caller: CallerInfo,
  request: StaffRequest,
): Promise<Response> {
  const firstName = request.first_name?.trim();
  const lastName = request.last_name?.trim();
  const email = request.email?.trim().toLowerCase();
  const phone = request.phone?.trim() || null;

  if (!firstName || !lastName || !email || !isManagedRole(request.role_name)) {
    return errorResponse("First name, last name, email, and a valid role are required.", 400);
  }

  // Prevent non-Super Admin from creating Super Admin accounts
  if (request.role_name === "Super Admin" && !caller.isSuperAdmin) {
    return errorResponse("You are not authorized to create Super Admin accounts.", 403);
  }

  const { data: role, error: roleError } = await adminClient
    .from("roles")
    .select("id, name")
    .eq("name", request.role_name)
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role) return errorResponse("Selected role does not exist.", 400);

  // Check if email already exists in Auth
  const { data: existingAuthUsers, error: checkError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (checkError) throw checkError;

  const emailExists = (existingAuthUsers.users ?? []).some(
    (user: { email?: string | null }) => user.email?.toLowerCase() === email
  );
  if (emailExists) {
    return errorResponse("This email is already registered.", 400);
  }

  let redirectTo: string | undefined;
  if (request.redirect_to) {
    try {
      const redirectUrl = new URL(request.redirect_to);
      if (redirectUrl.pathname !== "/complete-account" || !["http:", "https:"].includes(redirectUrl.protocol)) {
        return errorResponse("Invalid invitation redirect URL.", 400);
      }
      redirectTo = redirectUrl.toString();
    } catch {
      return errorResponse("Invalid invitation redirect URL.", 400);
    }
  }

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (inviteError) {
    if (inviteError.message?.includes("already registered")) {
      return errorResponse("This email is already registered.", 400);
    }
    throw inviteError;
  }
  if (!invited.user) throw new Error("Supabase Auth did not return the invited user.");

  const authUserId = invited.user.id;
  const { error: userError } = await adminClient.from("users").insert({
    id: authUserId,
    first_name: firstName,
    last_name: lastName,
    phone,
    status: "Active",
  });

  if (userError) {
    await adminClient.auth.admin.deleteUser(authUserId);
    throw userError;
  }

  const { error: assignmentError } = await adminClient.from("user_roles").insert({
    user_id: authUserId,
    role_id: role.id,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    is_active: true,
  });

  if (assignmentError) {
    await adminClient.from("users").delete().eq("id", authUserId);
    await adminClient.auth.admin.deleteUser(authUserId);
    throw assignmentError;
  }

  return response({
    user: {
      id: authUserId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      status: "Active",
      role_id: role.id,
      role_name: role.name as ManagedRole,
    },
  }, 201);
}

async function updateStaff(
  adminClient: ReturnType<typeof createClient>,
  caller: CallerInfo,
  request: StaffRequest,
): Promise<Response> {
  if (!request.id) return errorResponse("User id is required.", 400);

  const targetAssignmentsQuery = await adminClient
    .from("user_roles")
    .select("id, user_id, role_id, is_active")
    .eq("user_id", request.id);

  if (targetAssignmentsQuery.error) throw targetAssignmentsQuery.error;

  const targetAssignments = (targetAssignmentsQuery.data ?? []) as UserRoleRow[];
  const roleMap = await getRoleMap(
    adminClient,
    targetAssignments.map((assignment: UserRoleRow) => assignment.role_id),
  );
  const currentRoleName = targetAssignments
    .filter((assignment: UserRoleRow) => assignment.is_active !== false)
    .map((assignment: UserRoleRow) => roleMap.get(assignment.role_id))
    .find((roleName): roleName is ManagedRole => isManagedRole(roleName)) ?? null;

  const targetUpdates: Record<string, string | null> = {};
  if (request.first_name !== undefined) targetUpdates.first_name = request.first_name.trim() || null;
  if (request.last_name !== undefined) targetUpdates.last_name = request.last_name.trim() || null;
  if (request.phone !== undefined) targetUpdates.phone = request.phone.trim() || null;

  if (Object.keys(targetUpdates).length > 0) {
    const { error: userError } = await adminClient.from("users").update(targetUpdates).eq("id", request.id);
    if (userError) throw userError;
  }

  if (request.role_name) {
    const targetRoles = targetAssignments.map((assignment: UserRoleRow) => roleMap.get(assignment.role_id) ?? "");
    const isTargetSuperAdmin = targetRoles.includes("Super Admin");

    if (isTargetSuperAdmin && !caller.isSuperAdmin) {
      return errorResponse("You are not authorized to manage Super Admin accounts.", 403);
    }

    const { data: role, error: roleError } = await adminClient
      .from("roles")
      .select("id, name")
      .eq("name", request.role_name)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!role) return errorResponse("Selected role does not exist.", 400);

    const selectedRoleExists = targetAssignments.some((assignment: UserRoleRow) => assignment.role_id === role.id);
    const roleIsUnchanged = currentRoleName === request.role_name;

    if (roleIsUnchanged) {
      const existingRoleAssignment = targetAssignments.find((assignment: UserRoleRow) => assignment.role_id === role.id);
      if (existingRoleAssignment?.id) {
        const { error: reactivateError } = await adminClient
          .from("user_roles")
          .update({ is_active: true })
          .eq("id", existingRoleAssignment.id);
        if (reactivateError) throw reactivateError;
      } else {
        const { error: insertError } = await adminClient.from("user_roles").insert({
          user_id: request.id,
          role_id: role.id,
          start_date: new Date().toISOString().slice(0, 10),
          end_date: null,
          is_active: true,
        });
        if (insertError) throw insertError;
      }
    } else {
      const { error: deactivateError } = await adminClient
        .from("user_roles")
        .update({ is_active: false })
        .eq("user_id", request.id);
      if (deactivateError) throw deactivateError;

      if (selectedRoleExists) {
        const existingRoleAssignment = targetAssignments.find((assignment: UserRoleRow) => assignment.role_id === role.id);
        if (existingRoleAssignment?.id) {
          const { error: activateError } = await adminClient
            .from("user_roles")
            .update({ is_active: true })
            .eq("id", existingRoleAssignment.id);
          if (activateError) throw activateError;
        }
      } else {
        const { error: assignError } = await adminClient.from("user_roles").insert({
          user_id: request.id,
          role_id: role.id,
          start_date: new Date().toISOString().slice(0, 10),
          end_date: null,
          is_active: true,
        });
        if (assignError) throw assignError;
      }
    }
  }

  const { data: user, error: fetchError } = await adminClient
    .from("users")
    .select("id, first_name, last_name, phone, status")
    .eq("id", request.id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!user) return errorResponse("User not found.", 404);

  const authListResult = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authListResult.error) throw authListResult.error;

  const { data: activeAssignments, error: activeAssignmentsError } = await adminClient
    .from("user_roles")
    .select("role_id, is_active")
    .eq("user_id", request.id)
    .eq("is_active", true);

  if (activeAssignmentsError) throw activeAssignmentsError;

  const authEmail = authListResult.data.users.find((candidate: { id: string }) => candidate.id === request.id)?.email ?? null;
  const activeRoleId = (activeAssignments ?? [])[0]?.role_id ?? null;
  const activeRoleName = activeRoleId ? await getRoleName(adminClient, activeRoleId) : null;

  return response({
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: authEmail,
      phone: user.phone,
      status: user.status,
      role_id: activeRoleId ?? "",
      role_name: activeRoleName ?? "Teacher",
    },
  });
}

async function resendInvitation(
  authClient: ReturnType<typeof createClient>,
  adminClient: ReturnType<typeof createClient>,
  caller: CallerInfo,
  request: StaffRequest,
): Promise<Response> {
  if (!request.id) return errorResponse("User id is required.", 400);

  const { data: targetAssignments, error: assignmentError } = await adminClient
    .from("user_roles")
    .select("role_id, is_active")
    .eq("user_id", request.id);

  if (assignmentError) throw assignmentError;

  const roleMap = await getRoleMap(
    adminClient,
    ((targetAssignments ?? []) as Pick<UserRoleRow, "role_id">[]).map((assignment: Pick<UserRoleRow, "role_id">) => assignment.role_id),
  );

  const targetRoles = (targetAssignments ?? []).map((assignment: UserRoleRow) => roleMap.get(assignment.role_id) ?? "");
  const isTargetSuperAdmin = targetRoles.includes("Super Admin");

  if (isTargetSuperAdmin && !caller.isSuperAdmin) {
    return errorResponse("You are not authorized to manage Super Admin accounts.", 403);
  }

  const { data: authUserResult, error: authUserError } = await adminClient.auth.admin.getUserById(request.id);
  if (authUserError) throw authUserError;

  const authUser = authUserResult?.user;
  if (!authUser) return errorResponse("User not found.", 404);
  if (!authUser.email) return errorResponse("This user has no email available for an invitation.", 400);

  if (authUser.email_confirmed_at || authUser.last_sign_in_at) {
    return errorResponse("This account has already been completed and cannot be re-invited.", 400);
  }

  if (!request.redirect_to) {
    return errorResponse("A valid /complete-account redirect URL is required.", 400);
  }

  let redirectTo: string;
  try {
    const redirectUrl = new URL(request.redirect_to);
    if (redirectUrl.pathname !== "/complete-account" || !["http:", "https:"].includes(redirectUrl.protocol)) {
      return errorResponse("Invalid invitation redirect URL.", 400);
    }
    redirectTo = redirectUrl.toString();
  } catch {
    return errorResponse("Invalid invitation redirect URL.", 400);
  }

  const { error: resetError } = await authClient.auth.resetPasswordForEmail(authUser.email, { redirectTo });
  if (resetError) throw resetError;

  const { data: existingUser, error: userError } = await adminClient
    .from("users")
    .select("id, first_name, last_name, status")
    .eq("id", request.id)
    .maybeSingle();

  if (userError) throw userError;
  if (!existingUser) return errorResponse("User not found.", 404);

  return response({
    ok: true,
    user: {
      id: existingUser.id,
      first_name: existingUser.first_name,
      last_name: existingUser.last_name,
      email: authUser.email,
      phone: null,
      status: existingUser.status,
      role_id: targetAssignments?.[0]?.role_id ?? "",
      role_name: targetAssignments && targetAssignments[0]?.role_id ? await getRoleName(adminClient, targetAssignments[0].role_id) ?? "Teacher" : "Teacher",
    },
  });
}

async function setStaffStatus(
  adminClient: ReturnType<typeof createClient>,
  caller: CallerInfo,
  request: StaffRequest,
): Promise<Response> {
  if (!request.id || !request.status) return errorResponse("User id and status are required.", 400);

  // Get the target user's role to check if it's Super Admin
  const { data: targetAssignments, error: assignmentError } = await adminClient
    .from("user_roles")
    .select("role_id, is_active")
    .eq("user_id", request.id)
    .eq("is_active", true);

  if (assignmentError) throw assignmentError;

  const roleMap = await getRoleMap(
    adminClient,
    ((targetAssignments ?? []) as Pick<UserRoleRow, "role_id">[]).map((assignment: Pick<UserRoleRow, "role_id">) => assignment.role_id),
  );

  const targetRoles = (targetAssignments ?? []).map((assignment: UserRoleRow) => roleMap.get(assignment.role_id) ?? "");
  const isTargetSuperAdmin = targetRoles.includes("Super Admin");

  // Prevent non-Super Admin from modifying Super Admin
  if (isTargetSuperAdmin && !caller.isSuperAdmin) {
    return errorResponse("You are not authorized to manage Super Admin accounts.", 403);
  }

  const { error: userError } = await adminClient
    .from("users")
    .update({ status: request.status })
    .eq("id", request.id);
  if (userError) throw userError;

  const { error: roleError } = await adminClient
    .from("user_roles")
    .update({ is_active: request.status === "Active" })
    .eq("user_id", request.id);
  if (roleError) throw roleError;

  return response({ ok: true });
}

async function deleteStaff(
  adminClient: ReturnType<typeof createClient>,
  caller: CallerInfo,
  request: StaffRequest,
): Promise<Response> {
  if (!request.id) return errorResponse("User id is required.", 400);

  // Get the target user's role to check if it's Super Admin
  const { data: targetAssignments, error: assignmentError } = await adminClient
    .from("user_roles")
    .select("role_id, is_active")
    .eq("user_id", request.id);

  if (assignmentError) throw assignmentError;

  const roleMap = await getRoleMap(
    adminClient,
    ((targetAssignments ?? []) as Pick<UserRoleRow, "role_id">[]).map((assignment: Pick<UserRoleRow, "role_id">) => assignment.role_id),
  );

  const targetRoles = (targetAssignments ?? []).map((assignment: UserRoleRow) => roleMap.get(assignment.role_id) ?? "");
  const isTargetSuperAdmin = targetRoles.includes("Super Admin");

  // Prevent non-Super Admin from deleting Super Admin
  if (isTargetSuperAdmin && !caller.isSuperAdmin) {
    return errorResponse("You are not authorized to manage Super Admin accounts.", 403);
  }

  // Delete from user_roles
  const { error: roleError } = await adminClient
    .from("user_roles")
    .delete()
    .eq("user_id", request.id);
  if (roleError) throw roleError;

  // Delete from users
  const { error: userError } = await adminClient
    .from("users")
    .delete()
    .eq("id", request.id);
  if (userError) throw userError;

  // Delete from auth
  const { error: authError } = await adminClient.auth.admin.deleteUser(request.id);
  if (authError) throw authError;

  return response({ ok: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("Method not allowed.", 405);

  try {
    const token = getBearerToken(request);
    if (!token) return errorResponse("Authentication is required.", 401);

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return errorResponse("Invalid authentication token.", 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const caller = await assertAuthorizedCaller(adminClient, authData.user.id);

    const payload = (await request.json()) as StaffRequest;
    if (payload.action === "list") return await listStaff(adminClient, caller);
    if (payload.action === "create") return await createStaff(adminClient, caller, payload);
    if (payload.action === "update") return await updateStaff(adminClient, caller, payload);
    if (payload.action === "resend_invitation") return await resendInvitation(authClient, adminClient, caller, payload);
    if (payload.action === "set_status") return await setStaffStatus(adminClient, caller, payload);
    if (payload.action === "delete") return await deleteStaff(adminClient, caller, payload);
    return errorResponse("Unsupported staff action.", 400);
  } catch (error) {
    console.error(error);
    return errorResponse(error instanceof Error ? error.message : "Unable to manage staff.", 500);
  }
});
