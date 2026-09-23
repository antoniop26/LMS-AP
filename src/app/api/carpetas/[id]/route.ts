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

  // Students only see their own uploads in STUDENT_SUBMISSIONS folders.
  let materials = folder.materials;
  if (user.role === "ALUMNO" && folder.kind === "STUDENT_SUBMISSIONS") {
    materials = materials.filter((m) => m.uploadedById === user.id);
  }

  const isTeacherOrAdmin = user.role === "PROFESOR" || user.role === "ADMINISTRADOR";

  // Teacher/admin roster for submission folders (mirror exam roster).
  if (isTeacherOrAdmin && folder.kind === "STUDENT_SUBMISSIONS") {
    const memberships = await prisma.studentGroup.findMany({
      where: {
        groupId: folder.groupId,
        student: { role: "ALUMNO", schoolId: user.schoolId },
      },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
      },
    });

    const studentMap = new Map<string, { id: string; fullName: string; email: string }>();
    for (const m of memberships) {
      if (!studentMap.has(m.student.id)) {
        studentMap.set(m.student.id, m.student);
      }
    }

    const materialsByStudent = new Map<string, typeof materials>();
    for (const mat of materials) {
      const uploaderId = mat.uploadedById;
      const uploaderRole = mat.uploadedBy?.role;
      // Count uploads from students (or anyone in the group roster)
      if (uploaderRole === "ALUMNO" || studentMap.has(uploaderId)) {
        const list = materialsByStudent.get(uploaderId) ?? [];
        list.push(mat);
        materialsByStudent.set(uploaderId, list);
      }
    }

    const roster = Array.from(studentMap.values())
      .map((student) => {
        const studentMaterials = materialsByStudent.get(student.id) ?? [];
        // materials already ordered by createdAt desc from folderInclude
        const status = (studentMaterials.length > 0 ? "ENVIADO" : "NO_ENVIADO") as
          | "ENVIADO"
          | "NO_ENVIADO";
        return {
          student,
          status,
          materials: studentMaterials,
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "ENVIADO" ? -1 : 1;
        }
        return a.student.fullName.localeCompare(b.student.fullName, "es", {
          sensitivity: "base",
        });
      });

    return NextResponse.json({
      ...folder,
      materials,
      roster,
      status: getFolderStatus(folder),
    });
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
