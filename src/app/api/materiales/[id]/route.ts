import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const material = await prisma.material.findUnique({ where: { id: params.id } });
  if (!material) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (user.role !== "ADMINISTRADOR" && material.uploadedById !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await prisma.material.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true, filePath: material.filePath });
}
