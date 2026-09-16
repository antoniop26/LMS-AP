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
      group: true,
      questions: {
        include: {
          options: {
            select: {
              id: true,
              text: true,
              order: true,
              // Hide correct answers from students until graded view
              isCorrect: user.role !== "ALUMNO",
            },
          },
        },
        orderBy: { order: "asc" },
      },
      attempts: user.role === "ALUMNO" ? { where: { studentId: user.id }, include: { answers: true } } : {
        include: {
          student: { select: { id: true, fullName: true, email: true } },
          answers: { include: { grade: true, question: true } },
        },
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
  const test = await prisma.test.update({
    where: { id: params.id },
    data: {
      ...(body.published !== undefined ? { published: Boolean(body.published) } : {}),
      ...(body.title ? { title: String(body.title) } : {}),
    },
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
