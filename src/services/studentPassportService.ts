import { supabase } from "../lib/supabase";

const PASSPORT_BUCKET = "school_branding";
const MAX_PASSPORT_FILE_SIZE = 5 * 1024 * 1024;
const PASSPORT_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getBucketPathFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const prefix = `/storage/v1/object/public/${PASSPORT_BUCKET}/`;
    const index = url.pathname.indexOf(prefix);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(index + prefix.length));
  } catch {
    return null;
  }
}

export async function removeStudentPassportPhoto(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) {
    return;
  }

  const bucketPath = getBucketPathFromPublicUrl(publicUrl);
  if (!bucketPath) {
    return;
  }

  const { error } = await supabase.storage.from(PASSPORT_BUCKET).remove([bucketPath]);
  if (error) {
    throw error;
  }
}

export async function uploadStudentPassportPhoto(file: File): Promise<string> {
  if (!PASSPORT_ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only JPG, JPEG, PNG, and WebP images are supported.");
  }

  if (file.size > MAX_PASSPORT_FILE_SIZE) {
    throw new Error("Please upload a student passport photo smaller than 5 MB.");
  }

  const fileToUpload = await resizePassportImage(file);
  const extension = fileToUpload.type === "image/png" ? "png" : fileToUpload.type === "image/webp" ? "webp" : "jpg";
  const path = `student-passports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage.from(PASSPORT_BUCKET).upload(path, fileToUpload, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(PASSPORT_BUCKET).getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("The student photo could not be generated.");
  }

  return data.publicUrl;
}

async function resizePassportImage(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    const targetWidth = 400;
    const targetHeight = 500;
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);

    const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const offsetX = (targetWidth - width) / 2;
    const offsetY = (targetHeight - height) / 2;

    context.drawImage(image, offsetX, offsetY, width, height);

    let quality = 0.82;
    let mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/webp";

    while (quality >= 0.45) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mimeType, quality);
      });

      if (!blob) {
        break;
      }

      if (blob.size <= 500 * 1024) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
          type: "image/webp",
        });
      }

      quality -= 0.1;
      if (quality <= 0.45) {
        mimeType = "image/jpeg";
      }
    }

    const fallbackBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.75);
    });

    if (!fallbackBlob) {
      return file;
    }

    return new File([fallbackBlob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image could not be processed."));
    image.src = url;
  });
}
