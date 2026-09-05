import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const DAILY_LIMIT = 100;
const SENDER = "Grandessa Smart Campus <no-reply@grandessaschool.com.ng>";
const staffRoles = new Set(["Administrator", "Proprietress", "Super Admin", "Accountant", "Teacher"]);
const managerRoles = new Set(["Administrator", "Proprietress", "Super Admin"]);

type Audience = "parents" | "staff" | "students" | "community" | "class" | "people" | "custom";
type PersonSource = "contact" | "staff" | "student";

type PersonRef = { source: PersonSource; id: string };
type RequestPayload = {
  action?: "directory" | "preview" | "send" | "test";
  audience?: Audience;
  class_id?: string;
  people?: PersonRef[];
  custom_emails?: string[];
  subject?: string;
  body?: string;
  body_html?: string;
  attachments?: CommunicationAttachment[];
  test_email?: string;
  idempotency_key?: string;
};

type CommunicationAttachment = {
  filename: string;
  content: string;
  content_type: string;
  size: number;
  content_id?: string;
};

type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null };
type StudentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  class_id: string | null;
  primary_contact_id: string | null;
  secondary_contact_id: string | null;
  status: string | null;
};
type UserRow = { id: string; first_name: string | null; last_name: string | null; status: string | null };
type AssignmentRow = { user_id: string; role_id: string; is_active: boolean | null };
type RoleRow = { id: string; name: string };
type ClassRow = { id: string; class_name: string; class_teacher_id: string | null; status: string | null };
type Directory = {
  contacts: ContactRow[];
  students: StudentRow[];
  users: UserRow[];
  assignments: AssignmentRow[];
  roles: RoleRow[];
  classes: ClassRow[];
  authEmails: Map<string, string>;
};

type Candidate = { email: string | null; name?: string; source?: PersonSource };

class CommunicationRequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

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

function getBearerToken(request: Request): string | null {
  const value = request.headers.get("Authorization");
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() || null : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function validateAttachments(attachments: CommunicationAttachment[]): boolean {
  return attachments.length <= 10 && attachments.every((attachment) =>
    Boolean(attachment.filename && attachment.content && attachment.content_type) &&
    Number.isFinite(attachment.size) && attachment.size > 0
  );
}

function displayName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "Unnamed recipient";
}

async function listAuthEmails(adminClient: ReturnType<typeof createClient>): Promise<Map<string, string>> {
  const authEmails = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      const email = normalizeEmail(user.email);
      if (email) authEmails.set(user.id, email);
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
  return authEmails;
}

async function loadDirectory(adminClient: ReturnType<typeof createClient>): Promise<Directory> {
  const [contactsResult, studentsResult, usersResult, assignmentsResult, rolesResult, classesResult, authEmails] = await Promise.all([
    adminClient.from("contacts").select("id, first_name, last_name, email"),
    adminClient.from("students").select("id, first_name, last_name, class_id, primary_contact_id, secondary_contact_id, status"),
    adminClient.from("users").select("id, first_name, last_name, status"),
    adminClient.from("user_roles").select("user_id, role_id, is_active").eq("is_active", true),
    adminClient.from("roles").select("id, name"),
    adminClient.from("classes").select("id, class_name, class_teacher_id, status"),
    listAuthEmails(adminClient),
  ]);

  for (const result of [contactsResult, studentsResult, usersResult, assignmentsResult, rolesResult, classesResult]) {
    if (result.error) throw result.error;
  }

  return {
    contacts: (contactsResult.data ?? []) as ContactRow[],
    students: (studentsResult.data ?? []) as StudentRow[],
    users: (usersResult.data ?? []) as UserRow[],
    assignments: (assignmentsResult.data ?? []) as AssignmentRow[],
    roles: (rolesResult.data ?? []) as RoleRow[],
    classes: (classesResult.data ?? []) as ClassRow[],
    authEmails,
  };
}

function staffIds(directory: Directory): Set<string> {
  const roleById = new Map(directory.roles.map((role) => [role.id, role.name]));
  return new Set(directory.assignments
    .filter((assignment) => staffRoles.has(roleById.get(assignment.role_id) ?? ""))
    .map((assignment) => assignment.user_id));
}

function contactCandidates(directory: Directory, students = directory.students): Candidate[] {
  const contactIds = new Set<string>();
  for (const student of students) {
    if (student.primary_contact_id) contactIds.add(student.primary_contact_id);
    if (student.secondary_contact_id) contactIds.add(student.secondary_contact_id);
  }
  return directory.contacts
    .filter((contact) => contactIds.has(contact.id))
    .map((contact) => ({ email: contact.email, name: displayName(contact.first_name, contact.last_name), source: "contact" as const }));
}

function resolveCandidates(directory: Directory, payload: RequestPayload): Candidate[] {
  const audience = payload.audience;
  if (!audience) throw new Error("Choose an audience.");

  const staffUserIds = staffIds(directory);
  const staffCandidates = directory.users
    .filter((user) => staffUserIds.has(user.id))
    .map((user) => ({ email: directory.authEmails.get(user.id) ?? null, name: displayName(user.first_name, user.last_name), source: "staff" as const }));
  const studentCandidates = contactCandidates(directory);
  const parentCandidates = contactCandidates(directory);

  if (audience === "parents") return parentCandidates;
  if (audience === "staff") return staffCandidates;
  if (audience === "students") return studentCandidates;
  if (audience === "community") return [...parentCandidates, ...staffCandidates, ...studentCandidates];
  if (audience === "custom") return (payload.custom_emails ?? []).map((email) => ({ email, name: email, source: "contact" as const }));

  if (audience === "class") {
    if (!payload.class_id) throw new Error("Choose a class.");
    const classStudents = directory.students.filter((student) => student.class_id === payload.class_id);
    const classRow = directory.classes.find((schoolClass) => schoolClass.id === payload.class_id);
    const teacherCandidate = classRow?.class_teacher_id
      ? [{ email: directory.authEmails.get(classRow.class_teacher_id) ?? null, name: "Class teacher", source: "staff" as const }]
      : [];
    return [...contactCandidates(directory, classStudents), ...teacherCandidate];
  }

  return (payload.people ?? []).flatMap((person) => {
    if (!person?.id) return [];
    if (person.source === "contact") {
      const contact = directory.contacts.find((candidate) => candidate.id === person.id);
      return contact ? [{ email: contact.email, name: displayName(contact.first_name, contact.last_name), source: "contact" as const }] : [];
    }
    if (person.source === "student") {
      const student = directory.students.find((candidate) => candidate.id === person.id);
      return student ? contactCandidates(directory, [student]) : [];
    }
    const user = directory.users.find((candidate) => candidate.id === person.id);
    return user && staffUserIds.has(user.id)
      ? [{ email: directory.authEmails.get(user.id) ?? null, name: displayName(user.first_name, user.last_name), source: "staff" as const }]
      : [];
  });
}

function summarize(candidates: Candidate[]): { recipient_count: number; missing_email_count: number; emails: string[]; recipients: Array<{ name: string; email: string | null; source: PersonSource }> } {
  const emails = new Set<string>();
  const recipients: Array<{ name: string; email: string | null; source: PersonSource }> = [];
  let missingEmailCount = 0;
  for (const candidate of candidates) {
    const email = normalizeEmail(candidate.email);
    const source = candidate.source ?? "contact";
    if (email) {
      if (!emails.has(email)) recipients.push({ name: candidate.name ?? email, email, source });
      emails.add(email);
    } else {
      missingEmailCount += 1;
      recipients.push({ name: candidate.name ?? "Unnamed recipient", email: null, source });
    }
  }
  return { recipient_count: emails.size, missing_email_count: missingEmailCount, emails: [...emails], recipients };
}

function directoryResponse(directory: Directory): Response {
  const staffUserIds = staffIds(directory);
  const roleById = new Map(directory.roles.map((role) => [role.id, role.name]));
  const people = [
    ...directory.contacts.map((contact) => ({ source: "contact", id: contact.id, name: displayName(contact.first_name, contact.last_name), email: normalizeEmail(contact.email), email_available: Boolean(normalizeEmail(contact.email)) })),
    ...directory.users
      .filter((user) => staffUserIds.has(user.id) && roleById.has(directory.assignments.find((assignment) => assignment.user_id === user.id)?.role_id ?? ""))
      .map((user) => ({ source: "staff", id: user.id, name: displayName(user.first_name, user.last_name), email: directory.authEmails.get(user.id) ?? null, email_available: Boolean(directory.authEmails.get(user.id)) })),
    ...directory.students.map((student) => { const email = contactCandidates(directory, [student]).find((candidate) => normalizeEmail(candidate.email))?.email ?? null; return { source: "student", id: student.id, name: displayName(student.first_name, student.last_name), email: normalizeEmail(email), email_available: Boolean(normalizeEmail(email)) }; }),
  ];
  return response({
    classes: directory.classes.filter((schoolClass) => schoolClass.status !== "Inactive").map(({ id, class_name }) => ({ id, class_name })),
    people,
    usage: { used: 0, limit: DAILY_LIMIT, remaining: DAILY_LIMIT },
  });
}

async function getUsage(adminClient: ReturnType<typeof createClient>): Promise<{ used: number; limit: number; remaining: number }> {
  const { data, error } = await adminClient
    .from("communication_sends")
    .select("recipient_count")
    .in("status", ["reserved", "accepted"])
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  if (error) {
    throw new Error(error.message);
  }
  const used = (data ?? []).reduce((total, row) => total + Number(row.recipient_count ?? 0), 0);
  return { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) };
}

function renderHtml(body: string, bodyHtml?: string): string {
  if (bodyHtml?.trim()) {
    const sanitizedHtml = bodyHtml
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
      .replace(/href\s*=\s*(["'])\s*javascript:[^"']*\1/gi, "href=$1#$1");
    return `<div dir="ltr" style="direction:ltr;text-align:left;unicode-bidi:normal">${sanitizedHtml}</div>`;
  }
  const escaped = body.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
  return `<div dir="ltr" style="font-family:Arial,sans-serif;line-height:1.6;color:#243424;white-space:pre-wrap;direction:ltr;text-align:left;unicode-bidi:normal">${escaped}</div>`;
}

async function sendBatch(apiKey: string, subject: string, body: string, bodyHtml: string | undefined, emails: string[], attachments: CommunicationAttachment[]): Promise<number> {
  for (let index = 0; index < emails.length; index += 100) {
    const batch = emails.slice(index, index + 100).map((email) => ({
      from: SENDER,
      to: [email],
      subject,
      html: renderHtml(body, bodyHtml),
      text: body,
      attachments: attachments.length ? attachments.map(({ filename, content, content_id }) => ({ filename, content, ...(content_id ? { content_id } : {}) })) : undefined,
    }));
    const result = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (!result.ok) throw new Error("The email provider could not accept this message.");
  }
  return emails.length;
}

async function assertManager(adminClient: ReturnType<typeof createClient>, userId: string): Promise<void> {
  const [{ data: user, error: userError }, { data: assignments, error: assignmentError }] = await Promise.all([
    adminClient.from("users").select("status").eq("id", userId).maybeSingle(),
    adminClient.from("user_roles").select("role_id, is_active").eq("user_id", userId).eq("is_active", true),
  ]);
  if (userError) throw userError;
  if (assignmentError) throw assignmentError;
  if (!user || user.status !== "Active") throw new CommunicationRequestError("You are not authorized to send communications.", 403);
  const roleIds = (assignments ?? []).map((assignment) => assignment.role_id);
  const { data: roles, error: roleError } = await adminClient.from("roles").select("name").in("id", roleIds);
  if (roleError) throw roleError;
  if (!(roles ?? []).some((role) => managerRoles.has(role.name))) {
    throw new CommunicationRequestError("You are not authorized to send communications.", 403);
  }
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
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return errorResponse("Invalid authentication token.", 401);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await assertManager(adminClient, authData.user.id);
    const payload = (await request.json()) as RequestPayload;
    const directory = await loadDirectory(adminClient);

    if (payload.action === "directory") {
      const result = await directoryResponse(directory);
      const body = await result.json();
      body.usage = await getUsage(adminClient);
      return response(body);
    }

    if (payload.action === "test") {
      const testEmail = normalizeEmail(payload.test_email);
      const subject = payload.subject?.trim() ?? "";
      const body = payload.body?.trim() ?? "";
      const bodyHtml = typeof payload.body_html === "string" ? payload.body_html : undefined;
      const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
      const idempotencyKey = payload.idempotency_key?.trim() ?? "";
      if (!testEmail || !subject || subject.length > 200 || !body || body.length > 10000 || !idempotencyKey) {
        return errorResponse("A valid test email, subject, message, and send details are required.", 400);
      }
      if (!validateAttachments(attachments)) return errorResponse("One or more attachments are invalid.", 400);

      const { data: reservation, error: reservationError } = await adminClient.rpc("reserve_communication_send", {
        p_created_by: authData.user.id,
        p_idempotency_key: idempotencyKey,
        p_audience: "test",
        p_subject: subject,
        p_recipient_count: 1,
      });
      if (reservationError) {
        if (reservationError.message.includes("Daily communication email limit")) return errorResponse("Today’s 100-email limit has been reached.", 429);
        throw reservationError;
      }
      const reservationRow = Array.isArray(reservation) ? reservation[0] : reservation;
      if (reservationRow?.is_duplicate) return response({ accepted: 0, duplicate: true, usage: await getUsage(adminClient) });

      try {
        const accepted = await sendBatch(requiredEnv("RESEND_API_KEY"), subject, body, bodyHtml, [testEmail], attachments);
        const { error: updateError } = await adminClient.from("communication_sends").update({ accepted_count: accepted, status: "accepted" }).eq("id", reservationRow.send_id);
        if (updateError) throw updateError;
        return response({ accepted, duplicate: false, usage: await getUsage(adminClient) });
      } catch (sendError) {
        await adminClient.from("communication_sends").update({ status: "failed" }).eq("id", reservationRow.send_id);
        console.error("Communication test send failed", sendError instanceof Error ? sendError.message : "Unknown provider error");
        return errorResponse("The test message could not be sent. Please try again later.", 502);
      }
    }

    const summary = summarize(resolveCandidates(directory, payload));
    if (payload.action === "preview") {
      return response({ recipient_count: summary.recipient_count, missing_email_count: summary.missing_email_count, recipients: summary.recipients, usage: await getUsage(adminClient) });
    }

    if (payload.action !== "send") return errorResponse("Unsupported communication action.", 400);
    const subject = payload.subject?.trim() ?? "";
    const body = payload.body?.trim() ?? "";
    const bodyHtml = typeof payload.body_html === "string" ? payload.body_html : undefined;
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    const idempotencyKey = payload.idempotency_key?.trim() ?? "";
    if (!subject || subject.length > 200 || !body || body.length > 10000 || !idempotencyKey) return errorResponse("Subject, message, and send details are required.", 400);
    if (!validateAttachments(attachments)) return errorResponse("One or more attachments are invalid.", 400);
    if (!summary.recipient_count) return errorResponse("No valid email recipients were found.", 400);
    if (summary.recipient_count > DAILY_LIMIT) return errorResponse("This message exceeds today’s 100-email limit.", 400);

    const { data: reservation, error: reservationError } = await adminClient.rpc("reserve_communication_send", {
      p_created_by: authData.user.id,
      p_idempotency_key: idempotencyKey,
      p_audience: payload.audience ?? "",
      p_subject: subject,
      p_recipient_count: summary.recipient_count,
    });
    if (reservationError) {
      if (reservationError.message.includes("Daily communication email limit")) return errorResponse("Today’s 100-email limit has been reached.", 429);
      throw reservationError;
    }
    const reservationRow = Array.isArray(reservation) ? reservation[0] : reservation;
    if (reservationRow?.is_duplicate) return response({ ok: true, duplicate: true, accepted: 0, usage: await getUsage(adminClient) });

    try {
      const accepted = await sendBatch(requiredEnv("RESEND_API_KEY"), subject, body, bodyHtml, summary.emails, attachments);
      const { error: updateError } = await adminClient.from("communication_sends").update({ accepted_count: accepted, status: "accepted" }).eq("id", reservationRow.send_id);
      if (updateError) throw updateError;
      return response({ ok: true, accepted, usage: await getUsage(adminClient) });
    } catch (sendError) {
      await adminClient.from("communication_sends").update({ status: "failed" }).eq("id", reservationRow.send_id);
      console.error("Communication send failed", sendError instanceof Error ? sendError.message : "Unknown provider error");
      return errorResponse("The message could not be sent. Please try again later.", 502);
    }
  } catch (error) {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : (() => {
        try {
          return { type: typeof error, value: JSON.stringify(error) };
        } catch {
          return { type: typeof error, value: "[unserializable error]" };
        }
      })();
    console.error("Communication request failed", errorDetails);
    if (error instanceof CommunicationRequestError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("Unable to process communication.", 500);
  }
});
