import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const group = await prisma.group.findFirst({
    where: { id: params.id, grade: { schoolId: user.schoolId } },
  });
  if (!group) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await prisma.group.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
