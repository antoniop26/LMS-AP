import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isSubmissionWindowOpen } from "@/lib/material-folders";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const subjectId = req.nextUrl.searchParams.get("subjectId");
  const folderId = req.nextUrl.searchParams.get("folderId");

  let where: Record<string, unknown> = { subject: { schoolId: user.schoolId } };

  if (user.role === "ALUMNO") {
    const memberships = await prisma.studentGroup.findMany({
      where: { studentId: user.id },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);

    if (folderId) {
      const folder = await prisma.materialFolder.findUnique({ where: { id: folderId } });
      if (!folder || !groupIds.includes(folder.groupId)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      where = { folderId };
      if (folder.kind === "STUDENT_SUBMISSIONS") {
        where = { folderId, uploadedById: user.id };
      }
    } else {
      // Legacy + teacher resources for their groups; hide other students' submissions
      where = {
        subject: { schoolId: user.schoolId },
        OR: [
          { folderId: null, OR: [{ groupId: null }, { groupId: { in: groupIds } }] },
          {
            folder: {
              groupId: { in: groupIds },
              kind: "TEACHER_RESOURCES",
            },
          },
          {
            folder: {
              groupId: { in: groupIds },
              kind: "STUDENT_SUBMISSIONS",
            },
            uploadedById: user.id,
          },
        ],
      };
    }
  } else if (user.role === "PROFESOR") {
    const assignments = await prisma.teacherSubject.findMany({
      where: { teacherId: user.id },
      select: { subjectId: true },
    });
    const subjectIds = assignments.map((a) => a.subjectId);
    where = {
      OR: [
        { uploadedById: user.id },
        { subjectId: { in: subjectIds } },
        { folder: { createdById: user.id } },
      ],
    };
    if (folderId) {
      where = { ...where, folderId };
    }
  } else if (folderId) {
    where = { ...where, folderId };
  }

  if (subjectId) {
    where = { ...where, subjectId };
  }

  const materials = await prisma.material.findMany({
    where,
    include: {
      subject: true,
      group: { include: { grade: true } },
      folder: true,
      uploadedBy: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(materials);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ALUMNO" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const title = String(body.title || "").trim();
  const description = body.description ? String(body.description) : null;
  let subjectId = String(body.subjectId || "");
  let groupId = body.groupId || null;
  const folderId = body.folderId ? String(body.folderId) : null;
  const fileName = String(body.fileName || "");
  const filePath = String(body.filePath || "");
  const fileUrl = body.fileUrl || null;
  const mimeType = String(body.mimeType || "application/octet-stream");
  const fileSize = body.fileSize ? Number(body.fileSize) : null;

  if (!title || !fileName || !filePath) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  if (folderId) {
    const folder = await prisma.materialFolder.findUnique({
      where: { id: folderId },
      include: { subject: true },
    });
    if (!folder) {
      return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
    }
    if (folder.subject.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    subjectId = folder.subjectId;
    groupId = folder.groupId;

    if (folder.kind === "TEACHER_RESOURCES") {
      if (user.role === "ALUMNO") {
        return NextResponse.json(
          { error: "Los alumnos no pueden subir a carpetas de recursos del profesor" },
          { status: 403 }
        );
      }
      if (user.role === "PROFESOR") {
        const ownsOrTeaches =
          folder.createdById === user.id ||
          (await prisma.teacherSubject.findFirst({
            where: {
              teacherId: user.id,
              subjectId: folder.subjectId,
              OR: [{ groupId: folder.groupId }, { groupId: null }],
            },
          }));
        if (!ownsOrTeaches) {
          return NextResponse.json({ error: "No autorizado para esta carpeta" }, { status: 403 });
        }
      }
    } else if (folder.kind === "STUDENT_SUBMISSIONS") {
      if (user.role === "ALUMNO") {
        const membership = await prisma.studentGroup.findFirst({
          where: { studentId: user.id, groupId: folder.groupId },
        });
        if (!membership) {
          return NextResponse.json({ error: "No pertenece a este grupo" }, { status: 403 });
        }
        if (!isSubmissionWindowOpen(folder)) {
          return NextResponse.json(
            { error: "La carpeta de entrega no está abierta en este momento" },
            { status: 403 }
          );
        }
      } else if (user.role === "PROFESOR") {
        // Teachers may optionally add files to submission folders they own
        if (folder.createdById !== user.id) {
          const teaches = await prisma.teacherSubject.findFirst({
            where: {
              teacherId: user.id,
              subjectId: folder.subjectId,
              OR: [{ groupId: folder.groupId }, { groupId: null }],
            },
          });
          if (!teaches) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
          }
        }
      }
    }
  } else {
    // Legacy path without folder — teachers/admins only (students must use submission folders)
    if (!subjectId) {
      return NextResponse.json({ error: "Asignatura o carpeta requerida" }, { status: 400 });
    }
    if (user.role === "ALUMNO") {
      return NextResponse.json(
        { error: "Debe subir a una carpeta de entregas abierta" },
        { status: 400 }
      );
    }
  }

  const material = await prisma.material.create({
    data: {
      title,
      description,
      subjectId,
      groupId,
      folderId,
      fileName,
      filePath,
      fileUrl,
      mimeType,
      fileSize,
      uploadedById: user.id,
    },
    include: {
      subject: true,
      group: { include: { grade: true } },
      folder: true,
      uploadedBy: { select: { id: true, fullName: true, role: true } },
    },
  });

  return NextResponse.json(material, { status: 201 });
}
