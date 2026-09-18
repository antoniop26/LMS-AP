import { NextRequest, NextResponse } from "next/server";
import { MaterialFolderKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getFolderStatus } from "@/lib/material-folders";

const folderInclude = {
  subject: true,
  group: { include: { grade: true } },
  createdBy: { select: { id: true, fullName: true, role: true } },
  _count: { select: { materials: true } },
} as const;

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const subjectId = req.nextUrl.searchParams.get("subjectId");
  const groupId = req.nextUrl.searchParams.get("groupId");
  const kind = req.nextUrl.searchParams.get("kind") as MaterialFolderKind | null;

  let where: Record<string, unknown> = {
    subject: { schoolId: user.schoolId },
  };

  if (user.role === "ALUMNO") {
    const memberships = await prisma.studentGroup.findMany({
      where: { studentId: user.id },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    where = { ...where, groupId: { in: groupIds } };
  } else if (user.role === "PROFESOR") {
    const assignments = await prisma.teacherSubject.findMany({
      where: { teacherId: user.id },
      select: { subjectId: true, groupId: true },
    });
    const subjectIds = Array.from(new Set(assignments.map((a) => a.subjectId)));
    where = {
      OR: [
        { createdById: user.id },
        { subjectId: { in: subjectIds } },
      ],
    };
  }

  if (subjectId) where = { ...where, subjectId };
  if (groupId) where = { ...where, groupId };
  if (kind === "TEACHER_RESOURCES" || kind === "STUDENT_SUBMISSIONS") {
    where = { ...where, kind };
  }

  const folders = await prisma.materialFolder.findMany({
    where,
    include: folderInclude,
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  return NextResponse.json(
    folders.map((f) => ({
      ...f,
      status: getFolderStatus(f, now),
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body.name || "").trim();
  const description = body.description ? String(body.description) : null;
  const kind = body.kind as MaterialFolderKind;
  const subjectId = String(body.subjectId || "");
  const groupId = String(body.groupId || "");
  const opensAt = body.opensAt ? new Date(body.opensAt) : null;
  const closesAt = body.closesAt ? new Date(body.closesAt) : null;

  if (!name || !subjectId || !groupId) {
    return NextResponse.json({ error: "Nombre, asignatura y grupo son obligatorios" }, { status: 400 });
  }
  if (kind !== "TEACHER_RESOURCES" && kind !== "STUDENT_SUBMISSIONS") {
    return NextResponse.json({ error: "Tipo de carpeta inválido" }, { status: 400 });
  }
  if (kind === "STUDENT_SUBMISSIONS" && !closesAt) {
    return NextResponse.json(
      { error: "Las carpetas de entrega requieren fecha de cierre (closesAt)" },
      { status: 400 }
    );
  }
  if (opensAt && closesAt && opensAt >= closesAt) {
    return NextResponse.json({ error: "La apertura debe ser anterior al cierre" }, { status: 400 });
  }

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId: user.schoolId },
  });
  if (!subject) {
    return NextResponse.json({ error: "Asignatura no encontrada" }, { status: 404 });
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, grade: { schoolId: user.schoolId } },
  });
  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  if (user.role === "PROFESOR") {
    const assignment = await prisma.teacherSubject.findFirst({
      where: {
        teacherId: user.id,
        subjectId,
        OR: [{ groupId }, { groupId: null }],
      },
    });
    if (!assignment) {
      return NextResponse.json(
        { error: "No tiene asignación para esa asignatura/grupo" },
        { status: 403 }
      );
    }
  }

  const folder = await prisma.materialFolder.create({
    data: {
      name,
      description,
      kind,
      subjectId,
      groupId,
      createdById: user.id,
      opensAt: kind === "STUDENT_SUBMISSIONS" ? opensAt : null,
      closesAt: kind === "STUDENT_SUBMISSIONS" ? closesAt : null,
    },
    include: folderInclude,
  });

  return NextResponse.json(
    { ...folder, status: getFolderStatus(folder) },
    { status: 201 }
  );
}
