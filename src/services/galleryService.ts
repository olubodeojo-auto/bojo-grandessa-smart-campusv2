import { supabase } from "../lib/supabase";
import type { GalleryImage, GalleryCreatePayload } from "../types/gallery";

const GALLERY_BUCKET = "gallery_images";
const MAX_IMAGES = 30;
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadGalleryImage(
  file: File,
  title?: string,
  caption?: string
): Promise<GalleryImage> {
  // Validation
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only JPG, PNG, and WebP images are supported.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image must be smaller than 3 MB.");
  }

  // Check current count
  const { data: existing, error: countError } = await supabase
    .from("gallery_images")
    .select("id", { count: "exact" });

  if (countError) throw countError;

  if ((existing?.length ?? 0) >= MAX_IMAGES) {
    throw new Error(`Maximum ${MAX_IMAGES} gallery images reached. Delete an image first.`);
  }

  // Upload to storage
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(GALLERY_BUCKET)
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(GALLERY_BUCKET)
    .getPublicUrl(fileName);

  // Create database record
  const payload: GalleryCreatePayload = {
    title: title?.trim() || undefined,
    caption: caption?.trim() || undefined,
    storage_path: uploadData.path,
    url: publicUrlData.publicUrl,
    file_size_bytes: file.size,
    file_type: file.type,
  };

  const { data: imageRecord, error: dbError } = await supabase
    .from("gallery_images")
    .insert([payload])
    .select()
    .single();

  if (dbError) {
    // Clean up storage if DB insert fails
    await supabase.storage.from(GALLERY_BUCKET).remove([fileName]);
    throw dbError;
  }

  return imageRecord;
}

export async function getGalleryImages(): Promise<GalleryImage[]> {
  const { data, error } = await supabase
    .from("gallery_images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteGalleryImage(id: string): Promise<void> {
  // Get the image record first
  const { data: image, error: fetchError } = await supabase
    .from("gallery_images")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  if (!image) {
    throw new Error("Image not found.");
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(GALLERY_BUCKET)
    .remove([image.storage_path]);

  if (storageError) {
    console.error("Failed to delete from storage:", storageError);
  }

  // Delete database record
  const { error: dbError } = await supabase
    .from("gallery_images")
    .delete()
    .eq("id", id);

  if (dbError) throw dbError;
}
