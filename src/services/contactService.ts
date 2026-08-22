import { supabase } from "../lib/supabase";

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  relationship: string | null;
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  address: string | null;
  created_at?: string;
  updated_at?: string;
}

const ALLOWED_RELATIONSHIPS = [
  "Father",
  "Mother",
  "Guardian",
  "Uncle",
  "Aunt",
  "Sponsor",
  "Other",
];

export async function createContact(payload: {
  first_name: string;
  last_name: string;
  relationship?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  address?: string | null;
}): Promise<Contact> {
  const relationship = payload.relationship && ALLOWED_RELATIONSHIPS.includes(payload.relationship) ? payload.relationship : null;

  const insertPayload = {
    first_name: payload.first_name.trim(),
    last_name: payload.last_name.trim(),
    relationship,
    phone: payload.phone?.trim() || null,
    alternate_phone: payload.alternate_phone?.trim() || null,
    email: payload.email?.trim() || null,
    address: payload.address?.trim() || null,
  };

  const { data, error } = await supabase
    .from("contacts")
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;

  return data as Contact;
}

export async function updateContact(id: string, payload: Partial<Contact>): Promise<Contact> {
  const updatePayload: any = {};

  if (payload.first_name !== undefined) updatePayload.first_name = (payload.first_name ?? "").trim() || null;
  if (payload.last_name !== undefined) updatePayload.last_name = (payload.last_name ?? "").trim() || null;
  if (payload.relationship !== undefined) updatePayload.relationship = ALLOWED_RELATIONSHIPS.includes(payload.relationship as string) ? payload.relationship : null;
  if (payload.phone !== undefined) updatePayload.phone = (payload.phone ?? "").trim() || null;
  if (payload.alternate_phone !== undefined) updatePayload.alternate_phone = (payload.alternate_phone ?? "").trim() || null;
  if (payload.email !== undefined) updatePayload.email = (payload.email ?? "").trim() || null;
  if (payload.address !== undefined) updatePayload.address = (payload.address ?? "").trim() || null;

  const { data, error } = await supabase
    .from("contacts")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data as Contact;
}

export async function getContact(id: string): Promise<Contact | null> {
  const { data, error } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();

  if (error) throw error;

  return (data ?? null) as Contact | null;
}
