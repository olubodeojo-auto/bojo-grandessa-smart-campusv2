import { supabase } from "../lib/supabase";
import type { StaffDirectoryEntry, StaffDirectoryInput } from "../types/staffDirectory";

export const MAX_STAFF_DIRECTORY_PROFILES = 15;
const STAFF_DIRECTORY_BUCKET = "staff_directory_photos";
const STAFF_DIRECTORY_TABLE = "staff_directory";

function mapDbRow(row: {
  id: string;
  full_name: string;
  position: string;
  bio: string | null;
  photo_url: string | null;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
}): StaffDirectoryEntry {
  return {
    id: row.id,
    fullName: row.full_name,
    position: row.position,
    bio: row.bio ?? undefined,
    imageUrl: row.photo_url ?? undefined,
    displayOrder: row.display_order,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function getBucketPathFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const prefix = `/storage/v1/object/public/${STAFF_DIRECTORY_BUCKET}/`;
    const index = url.pathname.indexOf(prefix);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(index + prefix.length));
  } catch {
    return null;
  }
}

async function removePhotoFromBucketIfOwned(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) {
    return;
  }

  const bucketPath = getBucketPathFromPublicUrl(publicUrl);

  if (!bucketPath) {
    return;
  }

  const { error } = await supabase.storage.from(STAFF_DIRECTORY_BUCKET).remove([bucketPath]);

  if (error) {
    throw error;
  }
}

export async function listStaffDirectoryEntries(): Promise<StaffDirectoryEntry[]> {
  const { data, error } = await supabase
    .from(STAFF_DIRECTORY_TABLE)
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapDbRow);
}

export async function uploadStaffDirectoryPhoto(file: File): Promise<string> {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSizeBytes = 5 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only JPG, PNG, and WebP images are supported.");
  }

  if (file.size > maxSizeBytes) {
    throw new Error("Please upload an image smaller than 5 MB.");
  }

  const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `staff-directory/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const { error } = await supabase.storage.from(STAFF_DIRECTORY_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(STAFF_DIRECTORY_BUCKET).getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("The staff directory photo could not be generated.");
  }

  return data.publicUrl;
}

export async function createStaffDirectoryEntry(input: StaffDirectoryInput): Promise<StaffDirectoryEntry> {
  const fullName = input.fullName.trim();
  const position = input.position.trim();

  if (!fullName || !position) {
    throw new Error("Full name and position are required.");
  }

  const { data: existing, error: countError } = await supabase
    .from(STAFF_DIRECTORY_TABLE)
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (countError) {
    throw countError;
  }

  const nextDisplayOrder = (existing?.display_order ?? 0) + 1;

  if (nextDisplayOrder > MAX_STAFF_DIRECTORY_PROFILES) {
    throw new Error(`Only ${MAX_STAFF_DIRECTORY_PROFILES} team profiles can be displayed at once.`);
  }

  const { data, error } = await supabase
    .from(STAFF_DIRECTORY_TABLE)
    .insert([
      {
        full_name: fullName,
        position,
        bio: input.bio?.trim() || null,
        photo_url: input.imageUrl?.trim() || null,
        display_order: nextDisplayOrder,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapDbRow(data);
}

export async function updateStaffDirectoryEntry(id: string, input: StaffDirectoryInput & { imageUrl?: string | null }): Promise<StaffDirectoryEntry> {
  const existingRow = await supabase
    .from(STAFF_DIRECTORY_TABLE)
    .select("photo_url")
    .eq("id", id)
    .maybeSingle();

  if (existingRow.error) {
    throw existingRow.error;
  }

  const nextImageUrl = input.imageUrl?.trim() || null;
  const oldPhotoUrl = existingRow.data?.photo_url ?? null;

  const { data, error } = await supabase
    .from(STAFF_DIRECTORY_TABLE)
    .update({
      full_name: input.fullName.trim(),
      position: input.position.trim(),
      bio: input.bio?.trim() || null,
      photo_url: nextImageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (oldPhotoUrl && oldPhotoUrl !== nextImageUrl) {
    await removePhotoFromBucketIfOwned(oldPhotoUrl);
  }

  return mapDbRow(data);
}

export async function deleteStaffDirectoryEntry(id: string): Promise<StaffDirectoryEntry[]> {
  const { data: existing, error: findError } = await supabase
    .from(STAFF_DIRECTORY_TABLE)
    .select("photo_url")
    .eq("id", id)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing?.photo_url) {
    await removePhotoFromBucketIfOwned(existing.photo_url);
  }

  const { error } = await supabase.from(STAFF_DIRECTORY_TABLE).delete().eq("id", id);

  if (error) {
    throw error;
  }

  return listStaffDirectoryEntries();
}

export async function persistStaffDirectoryOrder(entries: StaffDirectoryEntry[]): Promise<StaffDirectoryEntry[]> {
  const uniqueEntries = entries.map((entry, index) => ({ ...entry, displayOrder: index + 1 }));

  for (const entry of uniqueEntries) {
    const { error } = await supabase
      .from(STAFF_DIRECTORY_TABLE)
      .update({
        display_order: entry.displayOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);

    if (error) {
      throw error;
    }
  }

  return listStaffDirectoryEntries();
}

export async function reorderStaffDirectoryEntries(id: string, direction: "up" | "down"): Promise<StaffDirectoryEntry[]> {
  const entries = await listStaffDirectoryEntries();
  const index = entries.findIndex((entry) => entry.id === id);

  if (index === -1) {
    return entries;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= entries.length) {
    return entries;
  }

  const reordered = [...entries];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

  return persistStaffDirectoryOrder(reordered);
}
