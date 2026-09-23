import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { examWindowMessage, examWindowStatus } from "@/lib/exam-window";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.role !== "ALUMNO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: { questions: { include: { options: true } } },
  });
  if (!test || !test.published) {
    return NextResponse.json({ error: "Examen no disponible" }, { status: 404 });
  }

  const window = examWindowStatus(test.opensAt, test.closesAt);
  if (!window.open) {
    return NextResponse.json({ error: examWindowMessage(window.reason) }, { status: 403 });
  }

  const existing = await prisma.testAttempt.findUnique({
    where: { testId_studentId: { testId: params.id, studentId: user.id } },
  });
  if (existing && existing.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Ya envió este examen" }, { status: 400 });
  }

  const body = await req.json();
  const answers: { questionId: string; textAnswer?: string; optionId?: string }[] =
    Array.isArray(body.answers) ? body.answers : [];

  const attempt =
    existing ||
    (await prisma.testAttempt.create({
      data: { testId: params.id, studentId: user.id, status: "IN_PROGRESS" },
    }));

  let autoScore = 0;
  let needsManual = false;

  for (const q of test.questions) {
    const ans = answers.find((a) => a.questionId === q.id);
    if (!ans) continue;

    const answer = await prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: q.id } },
      create: {
        attemptId: attempt.id,
        questionId: q.id,
        textAnswer: ans.textAnswer || null,
        optionId: ans.optionId || null,
      },
      update: {
        textAnswer: ans.textAnswer || null,
        optionId: ans.optionId || null,
      },
    });

    if (q.type === "MULTIPLE_CHOICE") {
      const correct = q.options.find((o) => o.isCorrect);
      const isRight = correct && ans.optionId === correct.id;
      const points = isRight ? q.points : 0;
      autoScore += points;
      await prisma.answerGrade.upsert({
        where: { answerId: answer.id },
        create: { answerId: answer.id, points, feedback: isRight ? "Correcto" : "Incorrecto" },
        update: { points, feedback: isRight ? "Correcto" : "Incorrecto" },
      });
    } else if (q.type === "SHORT_ANSWER" && q.correctText) {
      const normalize = (s: string) =>
        s.trim().toLowerCase().replace(/[.,;:!?¡¿]+$/g, "").replace(/\s+/g, " ");
      const isRight = normalize(ans.textAnswer || "") === normalize(q.correctText);
      const points = isRight ? q.points : 0;
      autoScore += points;
      await prisma.answerGrade.upsert({
        where: { answerId: answer.id },
        create: { answerId: answer.id, points, feedback: isRight ? "Correcto" : "Incorrecto" },
        update: { points, feedback: isRight ? "Correcto" : "Incorrecto" },
      });
    } else {
      needsManual = true;
    }
  }

  const totalPoints = test.questions.reduce((s, q) => s + q.points, 0);
  const score = totalPoints > 0 ? (autoScore / totalPoints) * test.maxScore : 0;

  const updated = await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      status: needsManual ? "SUBMITTED" : "GRADED",
      score: needsManual ? null : Math.round(score * 100) / 100,
      submittedAt: new Date(),
    },
    include: { answers: { include: { grade: true } } },
  });

  return NextResponse.json(updated);
}
