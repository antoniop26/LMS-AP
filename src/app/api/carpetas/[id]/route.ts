import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getFolderStatus } from "@/lib/material-folders";

const folderInclude = {
  subject: true,
  group: { include: { grade: true } },
  createdBy: { select: { id: true, fullName: true, role: true } },
  materials: {
    include: {
      uploadedBy: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  _count: { select: { materials: true } },
};

async function canAccessFolder(
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>,
  folder: { createdById: string; subjectId: string; groupId: string; subject: { schoolId: string } }
) {
  if (folder.subject.schoolId !== user.schoolId) return false;
  if (user.role === "ADMINISTRADOR") return true;
  if (user.role === "PROFESOR") {
    if (folder.createdById === user.id) return true;
    const assignment = await prisma.teacherSubject.findFirst({
      where: {
        teacherId: user.id,
        subjectId: folder.subjectId,
        OR: [{ groupId: folder.groupId }, { groupId: null }],
      },
    });
    return Boolean(assignment);
  }
  if (user.role === "ALUMNO") {
    const membership = await prisma.studentGroup.findFirst({
      where: { studentId: user.id, groupId: folder.groupId },
    });
    return Boolean(membership);
  }
  return false;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const folder = await prisma.materialFolder.findUnique({
    where: { id: params.id },
    include: folderInclude,
  });
  if (!folder) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (!(await canAccessFolder(user, folder))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Students only see teacher files in TEACHER_RESOURCES; in submissions they see all (or own?)
  // Product: teacher sees student uploads; students upload. For student view of submission folder,
  // showing all submissions in group is common for teachers only — students typically see own.
  let materials = folder.materials;
  if (user.role === "ALUMNO" && folder.kind === "STUDENT_SUBMISSIONS") {
    materials = materials.filter((m) => m.uploadedById === user.id);
  }

  return NextResponse.json({
    ...folder,
    materials,
    status: getFolderStatus(folder),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const folder = await prisma.materialFolder.findUnique({
    where: { id: params.id },
    include: { subject: true },
  });
  if (!folder) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (user.role !== "ADMINISTRADOR" && folder.createdById !== user.id) {
    return NextResponse.json({ error: "Solo el creador puede editar la carpeta" }, { status: 403 });
  }

  const body = await req.json();
  const data: {
    name?: string;
    description?: string | null;
    opensAt?: Date | null;
    closesAt?: Date | null;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
    data.name = name;
  }
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description) : null;
  }

  if (folder.kind === "STUDENT_SUBMISSIONS") {
    if (body.opensAt !== undefined) {
      data.opensAt = body.opensAt ? new Date(body.opensAt) : null;
    }
    if (body.closesAt !== undefined) {
      if (!body.closesAt) {
        return NextResponse.json({ error: "closesAt es obligatorio en carpetas de entrega" }, { status: 400 });
      }
      data.closesAt = new Date(body.closesAt);
    }
  }

  const nextOpens = data.opensAt !== undefined ? data.opensAt : folder.opensAt;
  const nextCloses = data.closesAt !== undefined ? data.closesAt : folder.closesAt;
  if (nextOpens && nextCloses && nextOpens >= nextCloses) {
    return NextResponse.json({ error: "La apertura debe ser anterior al cierre" }, { status: 400 });
  }

  const updated = await prisma.materialFolder.update({
    where: { id: params.id },
    data,
    include: folderInclude,
  });

  return NextResponse.json({ ...updated, status: getFolderStatus(updated) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const folder = await prisma.materialFolder.findUnique({ where: { id: params.id } });
  if (!folder) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (user.role !== "ADMINISTRADOR" && folder.createdById !== user.id) {
    return NextResponse.json({ error: "Solo el creador puede eliminar la carpeta" }, { status: 403 });
  }

  await prisma.materialFolder.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
