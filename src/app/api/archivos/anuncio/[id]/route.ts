import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/security/supabase-admin";
import { MATERIALS_BUCKET } from "@/lib/storage-constants";

export const dynamic = "force-dynamic";

/** Flyer de anuncio: solo usuarios del mismo colegio. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const a = await prisma.announcement.findUnique({ where: { id: params.id } });
  if (!a || a.schoolId !== user.schoolId || !a.filePath) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!a.published && user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { data, error } = await createAdminClient()
    .storage.from(MATERIALS_BUCKET)
    .createSignedUrl(a.filePath, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
  }
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
