import { supabase } from "../lib/supabase";

export type CommunicationAudience = "parents" | "staff" | "students" | "community" | "class" | "people" | "custom";
export type CommunicationPersonSource = "contact" | "staff" | "student";

export interface CommunicationPerson {
  source: CommunicationPersonSource;
  id: string;
  name: string;
  email: string | null;
  email_available: boolean;
}

export interface CommunicationDirectory {
  classes: Array<{ id: string; class_name: string }>;
  people: CommunicationPerson[];
  usage: CommunicationUsage;
}

export interface CommunicationUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface CommunicationTarget {
  audience: CommunicationAudience;
  class_id?: string;
  people?: Array<{ source: CommunicationPersonSource; id: string }>;
  custom_emails?: string[];
}

export interface CommunicationPreview {
  recipient_count: number;
  missing_email_count: number;
  usage: CommunicationUsage;
  recipients: CommunicationRecipient[];
}

export interface CommunicationRecipient {
  name: string;
  email: string | null;
  source: CommunicationPersonSource;
}

export interface CommunicationAttachment {
  filename: string;
  content: string;
  content_type: string;
  size: number;
  content_id?: string;
}

async function invokeCommunication<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("send-communication", { body });
  if (error) {
    const context = "context" in error ? error.context : null;
    if (context instanceof Response) {
      try {
        const payload = (await context.clone().json()) as { error?: unknown };
        if (typeof payload.error === "string" && payload.error.trim()) {
          throw new Error(payload.error);
        }
      } catch (responseError) {
        if (responseError instanceof Error && responseError.message !== "Unexpected end of JSON input") {
          throw responseError;
        }
      }
    }
    throw new Error("Unable to process this communication request.");
  }
  return data as T;
}

export async function getCommunicationDirectory(): Promise<CommunicationDirectory> {
  return invokeCommunication<CommunicationDirectory>({ action: "directory" });
}

export async function previewCommunication(target: CommunicationTarget): Promise<CommunicationPreview> {
  return invokeCommunication<CommunicationPreview>({ action: "preview", ...target });
}

export async function sendCommunication(input: CommunicationTarget & { subject: string; body: string; body_html?: string; attachments?: CommunicationAttachment[] }): Promise<{ accepted: number; duplicate?: boolean; usage: CommunicationUsage }> {
  return invokeCommunication({
    action: "send",
    ...input,
    idempotency_key: crypto.randomUUID(),
  });
}

export async function sendCommunicationTest(input: {
  test_email: string;
  subject: string;
  body: string;
  body_html?: string;
  attachments?: CommunicationAttachment[];
}): Promise<{ accepted: number; duplicate?: boolean; usage: CommunicationUsage }> {
  return invokeCommunication({
    action: "test",
    ...input,
    idempotency_key: crypto.randomUUID(),
  });
}
