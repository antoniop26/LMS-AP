import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const attemptId = String(body.attemptId || "");
    const grades: { answerId: string; points: number; feedback?: string }[] = Array.isArray(body.grades)
      ? body.grades
      : [];

    if (!attemptId) {
      return NextResponse.json({ error: "attemptId requerido" }, { status: 400 });
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: { include: { question: true } },
        test: true,
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    }

    if (attempt.testId !== params.id) {
      return NextResponse.json({ error: "El intento no pertenece a este examen" }, { status: 400 });
    }

    if (user.role === "PROFESOR" && attempt.test.creatorId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const answerIds = new Set(attempt.answers.map((a) => a.id));
    const questionPointsByAnswer = new Map(
      attempt.answers.map((a) => [a.id, a.question.points] as const)
    );

    for (const g of grades) {
      const answerId = String(g.answerId || "");
      if (!answerIds.has(answerId)) {
        return NextResponse.json({ error: `Respuesta inválida: ${answerId}` }, { status: 400 });
      }

      const points = Number(g.points);
      if (!Number.isFinite(points) || points < 0) {
        return NextResponse.json({ error: "Los puntos deben ser un número válido (≥ 0)" }, { status: 400 });
      }

      const maxPoints = questionPointsByAnswer.get(answerId) ?? 0;
      if (points > maxPoints) {
        return NextResponse.json(
          { error: `Los puntos no pueden superar ${maxPoints} en una de las respuestas` },
          { status: 400 }
        );
      }

      await prisma.answerGrade.upsert({
        where: { answerId },
        create: {
          answerId,
          points,
          feedback: g.feedback ? String(g.feedback) : null,
          gradedById: user.id,
        },
        update: {
          points,
          feedback: g.feedback ? String(g.feedback) : null,
          gradedById: user.id,
        },
      });
    }

    const graded = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: { include: { grade: true, question: true } },
        test: true,
      },
    });

    if (!graded) {
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    }

    // Score over the full exam (missing answers count as 0)
    const totalQuestionPoints = await prisma.question.aggregate({
      where: { testId: graded.testId },
      _sum: { points: true },
    });
    const total = totalQuestionPoints._sum.points ?? 0;
    const earned = graded.answers.reduce((s, a) => s + (a.grade?.points ?? 0), 0);
    const score = total > 0 ? (earned / total) * graded.test.maxScore : 0;

    const updated = await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: "GRADED",
        score: Math.round(score * 100) / 100,
        submittedAt: graded.submittedAt ?? new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[calificar]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al calificar" },
      { status: 500 }
    );
  }
}
