import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const subjects = await prisma.subject.findMany({
    where: { schoolId: user.schoolId },
    include: { grade: true, _count: { select: { teacherSubjects: true, materials: true, tests: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(subjects);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const name = String(body.name || "").trim();
  const code = body.code ? String(body.code).trim() : null;
  const gradeId = body.gradeId || null;
  if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  const subject = await prisma.subject.create({
    data: { name, code, gradeId, schoolId: user.schoolId },
  });
  return NextResponse.json(subject, { status: 201 });
}
