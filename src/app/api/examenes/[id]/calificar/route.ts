import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params: _params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const attemptId = String(body.attemptId || "");
  const grades: { answerId: string; points: number; feedback?: string }[] = body.grades || [];

  if (!attemptId) return NextResponse.json({ error: "attemptId requerido" }, { status: 400 });

  for (const g of grades) {
    await prisma.answerGrade.upsert({
      where: { answerId: g.answerId },
      create: {
        answerId: g.answerId,
        points: Number(g.points),
        feedback: g.feedback || null,
        gradedById: user.id,
      },
      update: {
        points: Number(g.points),
        feedback: g.feedback || null,
        gradedById: user.id,
      },
    });
  }

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: { include: { grade: true, question: true } },
      test: true,
    },
  });

  if (!attempt) return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });

  const earned = attempt.answers.reduce((s, a) => s + (a.grade?.points ?? 0), 0);
  const total = attempt.answers.reduce((s, a) => s + a.question.points, 0);
  const score = total > 0 ? (earned / total) * attempt.test.maxScore : 0;

  const updated = await prisma.testAttempt.update({
    where: { id: attemptId },
    data: { status: "GRADED", score: Math.round(score * 100) / 100 },
  });

  return NextResponse.json(updated);
}
