import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewMaterial } from "@/lib/security/authz";
import { createAdminClient } from "@/lib/security/supabase-admin";
import { MATERIALS_BUCKET } from "@/lib/storage-constants";
import { downloadFileName, withDownloadParam } from "@/lib/download-filename";

export const dynamic = "force-dynamic";

/**
 * Descarga autorizada: verifica permisos y redirige a una URL firmada de 60 s que
 * fuerza la descarga (Content-Disposition: attachment) con el nombre original del
 * archivo. Aplica igual a carpetas de recursos y de entregas.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const m = await prisma.material.findUnique({
    where: { id: params.id },
    include: {
      subject: { select: { schoolId: true } },
      folder: { select: { kind: true, groupId: true, createdById: true } },
    },
  });
  if (!m || !(await canViewMaterial(user, m))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { data, error } = await createAdminClient()
    .storage.from(MATERIALS_BUCKET)
    .createSignedUrl(m.filePath, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
  }
  const res = NextResponse.redirect(
    withDownloadParam(data.signedUrl, downloadFileName(m.fileName, m.filePath)),
    302
  );
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
