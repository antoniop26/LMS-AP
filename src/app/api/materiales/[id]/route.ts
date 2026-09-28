import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/security/supabase-admin";
import { MATERIALS_BUCKET } from "@/lib/storage-constants";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const material = await prisma.material.findUnique({
    where: { id: params.id },
    include: { subject: { select: { schoolId: true } } },
  });
  if (!material || material.subject.schoolId !== user.schoolId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (user.role !== "ADMINISTRADOR" && material.uploadedById !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await prisma.material.delete({ where: { id: params.id } });
  // Borrar también el archivo del bucket privado (best effort).
  await createAdminClient().storage.from(MATERIALS_BUCKET).remove([material.filePath]).catch(() => undefined);
  return NextResponse.json({ ok: true, filePath: material.filePath });
}
