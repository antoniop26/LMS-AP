import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const grades = await prisma.grade.findMany({
    where: { schoolId: user.schoolId },
    include: { _count: { select: { groups: true, subjects: true } } },
    orderBy: { level: "asc" },
  });
  return NextResponse.json(grades);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const name = String(body.name || "").trim();
  const level = Number(body.level) || 1;
  if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  const grade = await prisma.grade.create({
    data: { name, level, schoolId: user.schoolId },
  });
  return NextResponse.json(grade, { status: 201 });
}
