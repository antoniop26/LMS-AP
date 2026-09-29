/**
 * Nombre de archivo seguro para Content-Disposition (se conservan acentos y espacios).
 * Quita caracteres de control y separadores de ruta; si falta, usa el nombre del
 * objeto en Storage sin el prefijo de marca de tiempo ("1790000000000-").
 */
export function downloadFileName(fileName: string | null | undefined, filePath: string): string {
  const fromPath = (filePath.split("/").pop() || "archivo").replace(/^\d{10,}-/, "");
  const cleaned = String(fileName ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "_")
    .trim()
    .slice(0, 200);
  if (!cleaned) return fromPath;
  // Si el nombre original perdió la extensión, tomar la del objeto almacenado.
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(fromPath)?.[0];
  if (ext && !/\.[A-Za-z0-9]{1,8}$/.test(cleaned)) return cleaned + ext;
  return cleaned;
}

/**
 * Agrega `download=<nombre>` a una URL firmada de Supabase Storage para que responda con
 * `Content-Disposition: attachment; filename*=UTF-8''…`.
 * Nota: no usamos la opción `{ download: nombre }` de supabase-js porque codifica el nombre
 * dos veces y los acentos llegan como "%C3%AD" literal en el nombre descargado.
 */
export function withDownloadParam(signedUrl: string, fileName: string): string {
  const url = new URL(signedUrl);
  url.searchParams.set("download", fileName);
  return url.toString();
}

const INLINE_MIME = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"];
const INLINE_EXT = /\.(pdf|png|jpe?g|gif|webp)$/i;

/**
 * ¿Se puede abrir en el navegador ("Ver")? Solo PDF e imágenes raster comunes
 * (sin SVG). Se acepta por MIME o por extensión del nombre original/ruta.
 */
export function isInlineViewable(
  mimeType: string | null | undefined,
  ...names: (string | null | undefined)[]
): boolean {
  const mime = String(mimeType || "").toLowerCase().split(";")[0].trim();
  if (INLINE_MIME.includes(mime)) return true;
  return names.some((n) => !!n && INLINE_EXT.test(n));
}

/** URL interna para ver en línea (el servidor igual fuerza descarga si no es PDF/imagen). */
export function viewUrl(fileUrl: string): string {
  return `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}view=1`;
}
