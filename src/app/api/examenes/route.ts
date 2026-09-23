import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { QuestionType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const subjectId = req.nextUrl.searchParams.get("subjectId");

  if (user.role === "ALUMNO") {
    const memberships = await prisma.studentGroup.findMany({
      where: { studentId: user.id },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    const tests = await prisma.test.findMany({
      where: {
        published: true,
        subject: { schoolId: user.schoolId },
        OR: [{ groupId: null }, { groupId: { in: groupIds } }],
        ...(subjectId ? { subjectId } : {}),
      },
      include: {
        subject: true,
        group: { include: { grade: true } },
        _count: { select: { questions: true } },
        attempts: { where: { studentId: user.id } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tests);
  }

  const tests = await prisma.test.findMany({
    where: {
      ...(user.role === "PROFESOR"
        ? { creatorId: user.id }
        : { subject: { schoolId: user.schoolId } }),
      ...(subjectId ? { subjectId } : {}),
    },
    include: {
      subject: true,
      group: { include: { grade: true } },
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tests);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const title = String(body.title || "").trim();
  const description = body.description ? String(body.description) : null;
  const subjectId = String(body.subjectId || "");
  const groupId = body.groupId || null;
  const published = Boolean(body.published);
  const maxScore = Number(body.maxScore) || 100;
  const questions = Array.isArray(body.questions) ? body.questions : [];
  const opensAt = body.opensAt ? new Date(body.opensAt) : null;
  const closesAt = body.closesAt ? new Date(body.closesAt) : null;

  if (!title || !subjectId) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }
  if (opensAt && closesAt && opensAt >= closesAt) {
    return NextResponse.json(
      { error: "La fecha de inicio debe ser anterior a la de finalización" },
      { status: 400 }
    );
  }

  const test = await prisma.test.create({
    data: {
      title,
      description,
      subjectId,
      groupId,
      published,
      maxScore,
      opensAt,
      closesAt,
      creatorId: user.id,
      questions: {
        create: questions.map((q: {
          prompt: string;
          type: QuestionType;
          points?: number;
          order?: number;
          correctText?: string;
          options?: { text: string; isCorrect?: boolean; order?: number }[];
        }, idx: number) => ({
          prompt: q.prompt,
          type: q.type,
          points: q.points ?? 1,
          order: q.order ?? idx,
          correctText: q.correctText || null,
          options: q.options
            ? {
                create: q.options.map((o, oi) => ({
                  text: o.text,
                  isCorrect: Boolean(o.isCorrect),
                  order: o.order ?? oi,
                })),
              }
            : undefined,
        })),
      },
    },
    include: { questions: { include: { options: true } } },
  });

  return NextResponse.json(test, { status: 201 });
}
