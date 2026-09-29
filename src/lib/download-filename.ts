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
