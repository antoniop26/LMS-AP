import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const gradeId = req.nextUrl.searchParams.get("gradeId");
  const groups = await prisma.group.findMany({
    where: {
      grade: { schoolId: user.schoolId },
      ...(gradeId ? { gradeId } : {}),
    },
    include: {
      grade: true,
      _count: { select: { students: true } },
    },
    orderBy: [{ grade: { level: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const name = String(body.name || "").trim();
  const gradeId = String(body.gradeId || "");
  if (!name || !gradeId) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  const grade = await prisma.grade.findFirst({ where: { id: gradeId, schoolId: user.schoolId } });
  if (!grade) return NextResponse.json({ error: "Grado inválido" }, { status: 400 });
  const group = await prisma.group.create({ data: { name, gradeId } });
  return NextResponse.json(group, { status: 201 });
}
