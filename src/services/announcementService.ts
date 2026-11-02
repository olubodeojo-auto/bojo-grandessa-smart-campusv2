import { supabase } from "../lib/supabase";
import type { Announcement, AnnouncementCreatePayload, AnnouncementUpdatePayload } from "../types/announcement";

type AnnouncementRow = Pick<Announcement, "id" | "title" | "message" | "created_at" | "updated_at"> & {
  is_active: boolean | null;
};

type AnnouncementDatabaseUpdate = {
  title?: string;
  message?: string;
  audience?: NonNullable<AnnouncementCreatePayload["audience"]>;
  is_active?: boolean;
};

// Helper to map DB rows (which use is_active) to frontend Announcement shape (which expects `published`).
function mapRowToAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    // normalize DB is_active -> published boolean
    published: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createAnnouncement(
  payload: AnnouncementCreatePayload
): Promise<Announcement> {
  // use a valid production audience default; keep any supplied valid audience unchanged
  const providedAudience = payload.audience;
  const audience = providedAudience && ["All", "Teachers", "Students", "Contacts"].includes(providedAudience)
    ? providedAudience
    : "All";

  const dbPayload: AnnouncementDatabaseUpdate = {
    title: payload.title,
    message: payload.message,
    audience,
    // map the frontend 'Publish announcement immediately' checkbox to the DB column is_active
    is_active: payload.published ?? false,
  };

  const { data, error } = await supabase
    .from("announcements")
    .insert([dbPayload])
    .select()
    .single();

  if (error) throw error;
  return mapRowToAnnouncement(data);
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRowToAnnouncement);
}

export async function getPublishedAnnouncements(limit: number = 5): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapRowToAnnouncement);
}

export async function updateAnnouncement(
  id: string,
  payload: AnnouncementUpdatePayload
): Promise<Announcement> {
  // Map any published flag in payload to the database's is_active.
  const dbPayload: AnnouncementDatabaseUpdate = {
    ...(payload.title === undefined ? {} : { title: payload.title }),
    ...(payload.message === undefined ? {} : { message: payload.message }),
    ...(payload.audience === undefined ? {} : { audience: payload.audience }),
    ...(payload.published === undefined ? {} : { is_active: payload.published }),
  };

  // Ensure we don't accidentally send unsupported fields like `published`.
  const { data, error } = await supabase
    .from("announcements")
    .update(dbPayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapRowToAnnouncement(data);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
