import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { examWindowMessage, examWindowStatus } from "@/lib/exam-window";
import { studentCanSeeTest } from "@/lib/security/authz";
import { roundPoints, sumQuestionPoints } from "@/lib/test-points";
import { autoGradeAnswer } from "@/lib/exam-questions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.role !== "ALUMNO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      subject: { select: { schoolId: true } },
      questions: { include: { options: true } },
    },
  });
  if (!test || !(await studentCanSeeTest(user, test))) {
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

    const auto = autoGradeAnswer(q, ans);
    if (auto) {
      autoScore += auto.points;
      await prisma.answerGrade.upsert({
        where: { answerId: answer.id },
        create: { answerId: answer.id, points: auto.points, feedback: auto.feedback },
        update: { points: auto.points, feedback: auto.feedback },
      });
    } else {
      needsManual = true;
    }
  }

  // La nota se guarda en puntos obtenidos (p. ej. 18 de 25), sin escalar a 100.
  const totalPoints = sumQuestionPoints(test.questions);
  if (test.maxScore !== totalPoints) {
    await prisma.test.update({ where: { id: test.id }, data: { maxScore: totalPoints } });
  }

  const updated = await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      status: needsManual ? "SUBMITTED" : "GRADED",
      score: needsManual ? null : roundPoints(autoScore),
      submittedAt: new Date(),
    },
    include: { answers: { include: { grade: true } } },
  });

  return NextResponse.json(updated);
}
