import { NextRequest, NextResponse } from "next/server";
import { AnnouncementKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const announcements = await prisma.announcement.findMany({
    where: { schoolId: user.schoolId, published: true },
    include: {
      createdBy: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(announcements);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "Solo el administrador puede publicar comunicados" }, { status: 403 });
  }

  const body = await req.json();
  const kindRaw = String(body.kind || "").toUpperCase();
  const title = String(body.title || "").trim();
  const note = body.body != null ? String(body.body).trim() || null : null;
  const linkUrl = body.linkUrl != null ? String(body.linkUrl).trim() || null : null;
  const fileName = body.fileName != null ? String(body.fileName) : null;
  const filePath = body.filePath != null ? String(body.filePath) : null;
  const fileUrl = body.fileUrl != null ? String(body.fileUrl) : null;
  const mimeType = body.mimeType != null ? String(body.mimeType) : null;

  if (!title) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  }

  if (!Object.values(AnnouncementKind).includes(kindRaw as AnnouncementKind)) {
    return NextResponse.json({ error: "Tipo de comunicado inválido" }, { status: 400 });
  }
  const kind = kindRaw as AnnouncementKind;

  if (kind === "MESSAGE" && !note) {
    return NextResponse.json({ error: "El mensaje requiere un texto" }, { status: 400 });
  }
  if (kind === "LINK") {
    if (!linkUrl) {
      return NextResponse.json({ error: "El enlace es obligatorio" }, { status: 400 });
    }
    try {
      const u = new URL(linkUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      return NextResponse.json({ error: "URL de enlace inválida" }, { status: 400 });
    }
  }
  if (kind === "FLYER") {
    if (!fileName || !filePath) {
      return NextResponse.json({ error: "Debe subir un archivo (imagen o PDF)" }, { status: 400 });
    }
  }

  const announcement = await prisma.announcement.create({
    data: {
      schoolId: user.schoolId,
      kind,
      title,
      body: note,
      linkUrl: kind === "LINK" ? linkUrl : null,
      fileName: kind === "FLYER" ? fileName : null,
      filePath: kind === "FLYER" ? filePath : null,
      fileUrl: kind === "FLYER" ? fileUrl : null,
      mimeType: kind === "FLYER" ? mimeType : null,
      createdById: user.id,
      published: true,
    },
    include: {
      createdBy: { select: { id: true, fullName: true, role: true } },
    },
  });

  return NextResponse.json(announcement, { status: 201 });
}
