import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const subjectId = req.nextUrl.searchParams.get("subjectId");

  let where: Record<string, unknown> = { subject: { schoolId: user.schoolId } };

  if (user.role === "ALUMNO") {
    const memberships = await prisma.studentGroup.findMany({
      where: { studentId: user.id },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    where = {
      subject: { schoolId: user.schoolId },
      OR: [{ groupId: null }, { groupId: { in: groupIds } }],
    };
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
      ],
    };
  }

  if (subjectId) {
    where = { ...where, subjectId };
  }

  const materials = await prisma.material.findMany({
    where,
    include: {
      subject: true,
      group: { include: { grade: true } },
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
  const subjectId = String(body.subjectId || "");
  const groupId = body.groupId || null;
  const fileName = String(body.fileName || "");
  const filePath = String(body.filePath || "");
  const fileUrl = body.fileUrl || null;
  const mimeType = String(body.mimeType || "application/octet-stream");
  const fileSize = body.fileSize ? Number(body.fileSize) : null;

  if (!title || !subjectId || !fileName || !filePath) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const material = await prisma.material.create({
    data: {
      title,
      description,
      subjectId,
      groupId,
      fileName,
      filePath,
      fileUrl,
      mimeType,
      fileSize,
      uploadedById: user.id,
    },
  });

  return NextResponse.json(material, { status: 201 });
}
