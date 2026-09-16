import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const [teacherSubjects, studentGroups] = await Promise.all([
    prisma.teacherSubject.findMany({
      where: { subject: { schoolId: user.schoolId } },
      include: {
        teacher: { select: { id: true, fullName: true, email: true } },
        subject: true,
        group: { include: { grade: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.studentGroup.findMany({
      where: { group: { grade: { schoolId: user.schoolId } } },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        group: { include: { grade: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ teacherSubjects, studentGroups });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMINISTRADOR" && user.role !== "PROFESOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const type = body.type as string;

  if (type === "teacher") {
    if (user.role === "PROFESOR" && body.teacherId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const teacherId = String(body.teacherId || "");
    const subjectId = String(body.subjectId || "");
    const groupId = body.groupId || null;
    if (!teacherId || !subjectId) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    const row = await prisma.teacherSubject.create({
      data: { teacherId, subjectId, groupId },
    });
    return NextResponse.json(row, { status: 201 });
  }

  if (type === "student") {
    const studentId = String(body.studentId || "");
    const groupId = String(body.groupId || "");
    if (!studentId || !groupId) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    const row = await prisma.studentGroup.create({
      data: { studentId, groupId },
    });
    return NextResponse.json(row, { status: 201 });
  }

  return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if (!type || !id) return NextResponse.json({ error: "Parámetros requeridos" }, { status: 400 });
  if (type === "teacher") await prisma.teacherSubject.delete({ where: { id } });
  else if (type === "student") await prisma.studentGroup.delete({ where: { id } });
  else return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
