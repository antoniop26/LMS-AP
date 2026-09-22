import { createClient as createBrowserClient } from "@/lib/supabase/client";

export const MATERIALS_BUCKET = "materiales";

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

export function isAllowedFile(file: File) {
  return ALLOWED_MIME.includes(file.type) || file.name.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|png|jpe?g|gif|webp|txt)$/i);
}

export function buildMaterialPath(
  schoolId: string,
  subjectId: string,
  fileName: string,
  folderId?: string | null
) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stamp = Date.now();
  const folderPart = folderId ? `${folderId}/` : "";
  return `${schoolId}/${subjectId}/${folderPart}${stamp}-${safe}`;
}

/** Upload from the browser using the anon client (requires Storage policies). */
export async function uploadMaterial(
  file: File,
  schoolId: string,
  subjectId: string,
  folderId?: string | null
): Promise<{ path: string; publicUrl: string }> {
  if (!isAllowedFile(file)) {
    throw new Error("Tipo de archivo no permitido. Use PDF, imágenes o documentos Office.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("El archivo no puede superar 20 MB.");
  }

  const supabase = createBrowserClient();
  const path = buildMaterialPath(schoolId, subjectId, file.name, folderId);

  const { error } = await supabase.storage.from(MATERIALS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(MATERIALS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function getSignedMaterialUrl(path: string, expiresIn = 3600) {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteMaterialFile(path: string) {
  const supabase = createBrowserClient();
  const { error } = await supabase.storage.from(MATERIALS_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

const ANNOUNCEMENT_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export function isAllowedAnnouncementFile(file: File) {
  return (
    ANNOUNCEMENT_MIME.includes(file.type) ||
    !!file.name.match(/\.(pdf|png|jpe?g|gif|webp)$/i)
  );
}

export function buildAnnouncementPath(schoolId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stamp = Date.now();
  return `announcements/${schoolId}/${stamp}-${safe}`;
}

/** Upload flyer for school announcements into the materiales bucket. */
export async function uploadAnnouncement(
  file: File,
  schoolId: string
): Promise<{ path: string; publicUrl: string }> {
  if (!isAllowedAnnouncementFile(file)) {
    throw new Error("Tipo de archivo no permitido. Use PDF o imágenes.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("El archivo no puede superar 20 MB.");
  }

  const supabase = createBrowserClient();
  const path = buildAnnouncementPath(schoolId, file.name);

  const { error } = await supabase.storage.from(MATERIALS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(MATERIALS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
