import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

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
  // Solo admin: un profesor no puede autoasignarse grupos/asignaturas.
  if (!user || user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const type = body.type as string;

  if (type === "teacher") {
    const teacherId = String(body.teacherId || "");
    const subjectId = String(body.subjectId || "");
    const groupId = body.groupId || null;
    if (!teacherId || !subjectId) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    const [t, s, g] = await Promise.all([
      prisma.user.findFirst({ where: { id: teacherId, schoolId: user.schoolId, role: "PROFESOR" } }),
      prisma.subject.findFirst({ where: { id: subjectId, schoolId: user.schoolId } }),
      groupId
        ? prisma.group.findFirst({ where: { id: String(groupId), grade: { schoolId: user.schoolId } } })
        : Promise.resolve(true),
    ]);
    if (!t || !s || !g) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
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
    const [st, gr] = await Promise.all([
      prisma.user.findFirst({ where: { id: studentId, schoolId: user.schoolId, role: "ALUMNO" } }),
      prisma.group.findFirst({ where: { id: groupId, grade: { schoolId: user.schoolId } } }),
    ]);
    if (!st || !gr) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
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
  if (type === "teacher") {
    const r = await prisma.teacherSubject.deleteMany({
      where: { id, subject: { schoolId: user.schoolId } },
    });
    if (r.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  } else if (type === "student") {
    const r = await prisma.studentGroup.deleteMany({
      where: { id, group: { grade: { schoolId: user.schoolId } } },
    });
    if (r.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  } else return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
