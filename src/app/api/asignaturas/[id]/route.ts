import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const subject = await prisma.subject.findFirst({ where: { id: params.id, schoolId: user.schoolId } });
  if (!subject) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await prisma.subject.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
