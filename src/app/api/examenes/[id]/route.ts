import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      subject: true,
      group: { include: { grade: true } },
      questions: {
        include: {
          options: {
            select: {
              id: true,
              text: true,
              order: true,
              isCorrect: user.role !== "ALUMNO",
            },
          },
        },
        orderBy: { order: "asc" },
      },
      attempts:
        user.role === "ALUMNO"
          ? { where: { studentId: user.id }, include: { answers: true } }
          : {
              where: { status: { in: ["SUBMITTED", "GRADED"] } },
              include: {
                student: { select: { id: true, fullName: true, email: true } },
                answers: {
                  include: {
                    grade: true,
                    question: { include: { options: true } },
                  },
                },
              },
              orderBy: { submittedAt: "desc" },
            },
    },
  });

  if (!test) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(test);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const data: {
    published?: boolean;
    title?: string;
    opensAt?: Date | null;
    closesAt?: Date | null;
  } = {};
  if (body.published !== undefined) data.published = Boolean(body.published);
  if (body.title) data.title = String(body.title);
  if ("opensAt" in body) data.opensAt = body.opensAt ? new Date(body.opensAt) : null;
  if ("closesAt" in body) data.closesAt = body.closesAt ? new Date(body.closesAt) : null;

  if (data.opensAt !== undefined || data.closesAt !== undefined) {
    const current = await prisma.test.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const opensAt = data.opensAt !== undefined ? data.opensAt : current.opensAt;
    const closesAt = data.closesAt !== undefined ? data.closesAt : current.closesAt;
    if (opensAt && closesAt && opensAt >= closesAt) {
      return NextResponse.json(
        { error: "La fecha de inicio debe ser anterior a la de finalización" },
        { status: 400 }
      );
    }
  }

  const test = await prisma.test.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(test);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await prisma.test.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
