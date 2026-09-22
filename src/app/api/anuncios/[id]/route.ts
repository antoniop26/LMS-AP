import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "Solo el administrador puede eliminar comunicados" }, { status: 403 });
  }

  const announcement = await prisma.announcement.findUnique({ where: { id: params.id } });
  if (!announcement) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (announcement.schoolId !== user.schoolId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await prisma.announcement.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true, filePath: announcement.filePath });
}
