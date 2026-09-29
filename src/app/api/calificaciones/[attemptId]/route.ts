import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isAutoGradable } from "@/lib/exam-questions";
import { sumQuestionPoints } from "@/lib/test-points";

export const dynamic = "force-dynamic";

/**
 * GET /api/calificaciones/:attemptId — revisión de solo lectura del intento PROPIO del alumno.
 *
 * - Solo el alumno dueño del intento; cualquier otro usuario recibe 404 (no se revela
 *   si el intento existe). Profesores/admin usan sus vistas existentes del examen.
 * - Solo intentos enviados (SUBMITTED/GRADED); un intento en curso no se revisa.
 * - Las respuestas correctas (opción correcta / respuesta esperada) solo se incluyen
 *   cuando el intento está calificado (GRADED).
 */
export async function GET(_req: NextRequest, { params }: { params: { attemptId: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "ALUMNO") {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: params.attemptId },
    include: {
      test: {
        select: {
          id: true,
          title: true,
          subject: { select: { name: true, schoolId: true } },
          questions: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              prompt: true,
              type: true,
              points: true,
              order: true,
              correctText: true,
              options: { orderBy: { order: "asc" }, select: { id: true, text: true, isCorrect: true } },
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          textAnswer: true,
          optionId: true,
          grade: { select: { points: true, feedback: true } },
        },
      },
    },
  });

  if (
    !attempt ||
    attempt.studentId !== user.id ||
    attempt.test.subject.schoolId !== user.schoolId ||
    (attempt.status !== "SUBMITTED" && attempt.status !== "GRADED")
  ) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const graded = attempt.status === "GRADED";
  const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const questions = attempt.test.questions.map((q) => {
    const ans = answerByQuestion.get(q.id) ?? null;
    const auto = isAutoGradable(q);
    // Pendiente: pregunta manual respondida, aún sin nota del profesor.
    const pending = !!ans && !ans.grade && !auto && !graded;
    return {
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      points: q.points,
      manual: !auto,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        ...(graded ? { isCorrect: o.isCorrect } : {}),
      })),
      ...(graded && q.type === "SHORT_ANSWER" && q.correctText ? { correctText: q.correctText } : {}),
      answer: ans ? { textAnswer: ans.textAnswer, optionId: ans.optionId } : null,
      grade: ans?.grade ? { points: ans.grade.points, feedback: ans.grade.feedback } : null,
      pending,
    };
  });

  const earnedSoFar = questions.reduce((s, q) => s + (q.grade?.points ?? 0), 0);

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      status: attempt.status,
      score: attempt.score,
      submittedAt: attempt.submittedAt,
    },
    test: {
      id: attempt.test.id,
      title: attempt.test.title,
      subjectName: attempt.test.subject.name,
      maxScore: sumQuestionPoints(attempt.test.questions),
    },
    earnedSoFar: Math.round(earnedSoFar * 100) / 100,
    pendingCount: questions.filter((q) => q.pending).length,
    questions,
  });
}
