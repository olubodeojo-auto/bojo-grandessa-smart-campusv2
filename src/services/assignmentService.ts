import { supabase } from "../lib/supabase";
import { getAssignmentNotificationStatuses as fetchAssignmentNotificationStatuses, previewCommunication, sendCommunication } from "./communicationService";
import type { Assignment, AssignmentFile, AssignmentNotificationStatus, CreateAssignmentInput, UpdateAssignmentInput } from "../types/assignment";

const BUCKET = "assignment_files";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

const ASSIGNMENT_SELECT = "*, classes(class_name), subjects(subject_name), assignment_files(*)";

function validateFile(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error(`${file.name} is not a supported attachment type.`);
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error(`${file.name} must be smaller than 10 MB.`);
}

async function uploadAssignmentFiles(files: File[], assignmentId: string, storageSchoolId: string): Promise<void> {
  const uploadedPaths: string[] = [];

  try {
    for (const file of files) {
      validateFile(file);
      const path = `${storageSchoolId}/${assignmentId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);

      const { error: fileError } = await supabase.from("assignment_files").insert({
        assignment_id: assignmentId,
        storage_path: path,
        file_name: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
      });
      if (fileError) throw fileError;
    }
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths);
      await supabase.from("assignment_files").delete().in("storage_path", uploadedPaths);
    }
    throw error;
  }
}

function mapAssignment(row: Record<string, unknown>): Assignment {
  const schoolClass = row.classes as { class_name?: string } | null;
  const subject = row.subjects as { subject_name?: string } | null;
  return {
    ...(row as unknown as Assignment),
    class_name: schoolClass?.class_name,
    subject_name: subject?.subject_name,
    files: (row.assignment_files ?? []) as AssignmentFile[],
  };
}

export async function getAssignmentsForStaff(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapAssignment(row as Record<string, unknown>));
}

export async function getAssignmentsForParent(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapAssignment(row as Record<string, unknown>));
}

export async function createAssignment(input: CreateAssignmentInput, userId: string, storageSchoolId: string): Promise<Assignment> {
  if (!input.title.trim() || !input.due_date || !input.class_id || !input.subject_id) {
    throw new Error("Class, subject, title, and due date are required.");
  }

  const { data: created, error: createError } = await supabase
    .from("assignments")
    .insert({
      class_id: input.class_id,
      subject_id: input.subject_id,
      title: input.title.trim(),
      instructions: input.instructions.trim(),
      due_date: input.due_date,
      frequency: input.frequency,
      published: true,
      published_at: new Date().toISOString(),
      created_by: userId,
    })
    .select(ASSIGNMENT_SELECT)
    .single();

  if (createError) throw createError;
  const assignmentId = (created as { id: string }).id;

  try {
    await uploadAssignmentFiles(input.files, assignmentId, storageSchoolId);
  } catch (error) {
    await supabase.from("assignments").delete().eq("id", assignmentId);
    throw error;
  }

  const assignment = mapAssignment(created as Record<string, unknown>);
  if (input.notify_parents) {
    await notifyAssignmentParents(assignment);
  }

  return assignment;
}

export async function updateAssignment(id: string, input: UpdateAssignmentInput, storageSchoolId: string): Promise<Assignment> {
  if (!input.title.trim() || !input.due_date || !input.class_id || !input.subject_id) {
    throw new Error("Class, subject, title, and due date are required.");
  }

  const { error } = await supabase
    .from("assignments")
    .update({
      class_id: input.class_id,
      subject_id: input.subject_id,
      title: input.title.trim(),
      instructions: input.instructions.trim(),
      due_date: input.due_date,
      frequency: input.frequency,
    })
    .eq("id", id)
    .select(ASSIGNMENT_SELECT)
    .single();

  if (error) throw error;
  await uploadAssignmentFiles(input.files, id, storageSchoolId);

  const refreshed = await supabase.from("assignments").select(ASSIGNMENT_SELECT).eq("id", id).single();
  if (refreshed.error) throw refreshed.error;
  return mapAssignment(refreshed.data as Record<string, unknown>);
}

export async function deleteAssignmentFile(file: AssignmentFile): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([file.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("assignment_files").delete().eq("id", file.id);
  if (error) throw error;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { data: files, error: filesError } = await supabase.from("assignment_files").select("storage_path").eq("assignment_id", id);
  if (filesError) throw filesError;

  const paths = (files ?? []).map((file) => file.storage_path as string);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) throw storageError;
  }

  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) throw error;
}

export async function getAssignmentNotificationStatuses(assignmentIds: string[]): Promise<Record<string, AssignmentNotificationStatus>> {
  const statuses = await fetchAssignmentNotificationStatuses(assignmentIds);
  return Object.fromEntries(statuses.map((status) => [status.assignment_id, status]));
}

export async function notifyAssignmentParents(assignment: Assignment, recipientCount?: number): Promise<{ accepted: number; recipientCount: number; duplicate?: boolean }> {
  const preview = recipientCount === undefined ? await previewCommunication({ audience: "class", class_id: assignment.class_id }) : null;
  const totalRecipients = recipientCount ?? preview?.recipient_count ?? 0;
  if (totalRecipients === 0) {
    throw new Error("No parent recipients were found for this class.");
  }

  const result = await sendCommunication({
    audience: "class",
    class_id: assignment.class_id,
    assignment_id: assignment.id,
    subject: `New assignment: ${assignment.title.trim()}`,
    body: `A new ${assignment.frequency.toLowerCase()} assignment is available in the Grandessa Parent Portal. Please sign in to view the instructions and any attachments.\n\nDue date: ${assignment.due_date}`,
  });

  return { accepted: result.accepted, recipientCount: totalRecipients, duplicate: result.duplicate };
}

export async function createAssignmentFileUrl(file: AssignmentFile): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 300);
  if (error || !data?.signedUrl) throw error ?? new Error("The attachment could not be opened.");
  return data.signedUrl;
}
