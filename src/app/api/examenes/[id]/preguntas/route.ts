import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { staffCanManageTest } from "@/lib/security/authz";
import { autoGradeAnswer, isAutoGradable, validateQuestions } from "@/lib/exam-questions";
import { roundPoints, sumQuestionPoints } from "@/lib/test-points";

/**
 * PUT /api/examenes/:id/preguntas — reemplaza el conjunto de preguntas del examen.
 *
 * Body: { questions: [{ id?, prompt, type, points, correctText?, options: [{ id?, text, isCorrect }] }],
 *         confirmRecalc?: boolean }
 *
 * - Preguntas con `id` se actualizan en su lugar (sus respuestas se conservan);
 *   las que no vienen se eliminan (sus respuestas salen de la nota); las nuevas se crean.
 * - maxScore = suma de puntos de las preguntas.
 * - Si ya hay intentos, se exige confirmRecalc=true y se recalculan todas las notas:
 *   · preguntas automáticas: se re-califican con la nueva respuesta correcta y puntos;
 *   · preguntas manuales: se conserva la nota del profesor, recortada a los nuevos puntos;
 *     si la pregunta pasó de automática a manual, la respuesta queda pendiente de calificar;
 *   · preguntas nuevas: los intentos ya enviados no tienen respuesta y cuentan 0
 *     (igual que una pregunta sin responder).
 * Todo se guarda en una sola transacción.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const existing = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      subject: { select: { schoolId: true } },
      questions: { include: { options: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!staffCanManageTest(user, existing)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { questions?: unknown; confirmRecalc?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const validation = validateQuestions(body.questions);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const questions = validation.questions;

  // Los ids enviados deben pertenecer a este examen (y las opciones, a su pregunta).
  const oldById = new Map(existing.questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  for (const q of questions) {
    if (!q.id) continue;
    const old = oldById.get(q.id);
    if (!old || seen.has(q.id)) {
      return NextResponse.json({ error: "Pregunta inválida para este examen" }, { status: 400 });
    }
    seen.add(q.id);
    const oldOptIds = new Set(old.options.map((o) => o.id));
    const seenOpts = new Set<string>();
    for (const o of q.options) {
      if (!o.id) continue;
      if (!oldOptIds.has(o.id) || seenOpts.has(o.id)) {
        return NextResponse.json({ error: "Opción inválida para esta pregunta" }, { status: 400 });
      }
      seenOpts.add(o.id);
    }
  }

  const attemptCount = await prisma.testAttempt.count({ where: { testId: existing.id } });
  if (attemptCount > 0 && body.confirmRecalc !== true) {
    return NextResponse.json(
      {
        error: `${attemptCount} alumno${attemptCount === 1 ? " ya respondió" : "s ya respondieron"}; confirme para recalcular sus notas.`,
        requiresConfirmation: true,
        attemptCount,
      },
      { status: 409 }
    );
  }

  const wasAuto = new Map(existing.questions.map((q) => [q.id, isAutoGradable(q)]));
  const maxScore = sumQuestionPoints(questions);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1) Eliminar preguntas quitadas (cascade: respuestas y notas).
        const removedIds = existing.questions.filter((q) => !seen.has(q.id)).map((q) => q.id);
        if (removedIds.length) {
          await tx.question.deleteMany({ where: { id: { in: removedIds }, testId: existing.id } });
        }

        // 2) Actualizar en su lugar / crear.
        for (let idx = 0; idx < questions.length; idx++) {
          const q = questions[idx];
          const data = {
            prompt: q.prompt,
            type: q.type,
            points: q.points,
            order: idx,
            correctText: q.correctText,
          };
          if (q.id) {
            await tx.question.update({ where: { id: q.id }, data });
            const keepOptIds = q.options.filter((o) => o.id).map((o) => o.id as string);
            await tx.option.deleteMany({
              where: { questionId: q.id, ...(keepOptIds.length ? { id: { notIn: keepOptIds } } : {}) },
            });
            for (let oi = 0; oi < q.options.length; oi++) {
              const o = q.options[oi];
              if (o.id) {
                await tx.option.update({
                  where: { id: o.id },
                  data: { text: o.text, isCorrect: o.isCorrect, order: oi },
                });
              } else {
                await tx.option.create({
                  data: { questionId: q.id, text: o.text, isCorrect: o.isCorrect, order: oi },
                });
              }
            }
          } else {
            await tx.question.create({
              data: {
                ...data,
                testId: existing.id,
                options: q.options.length
                  ? { create: q.options.map((o, oi) => ({ text: o.text, isCorrect: o.isCorrect, order: oi })) }
                  : undefined,
              },
            });
          }
        }

        await tx.test.update({ where: { id: existing.id }, data: { maxScore } });

        // 3) Recalcular intentos enviados.
        const newQuestions = await tx.question.findMany({
          where: { testId: existing.id },
          include: { options: true },
        });
        const qById = new Map(newQuestions.map((q) => [q.id, q]));
        const attempts = await tx.testAttempt.findMany({
          where: { testId: existing.id, status: { in: ["SUBMITTED", "GRADED"] } },
          include: { answers: { include: { grade: true } } },
        });

        let recalculated = 0;
        for (const att of attempts) {
          let earned = 0;
          let pending = false;
          for (const ans of att.answers) {
            const q = qById.get(ans.questionId);
            if (!q) continue; // pregunta eliminada (ya borrada por cascade)
            const auto = autoGradeAnswer(q, ans);
            if (auto) {
              earned += auto.points;
              if (!ans.grade || ans.grade.points !== auto.points || ans.grade.feedback !== auto.feedback) {
                await tx.answerGrade.upsert({
                  where: { answerId: ans.id },
                  create: { answerId: ans.id, points: auto.points, feedback: auto.feedback },
                  update: { points: auto.points, feedback: auto.feedback },
                });
              }
            } else if (!ans.grade) {
              pending = true;
            } else if (wasAuto.get(q.id)) {
              // Pasó de automática a manual: la nota automática ya no aplica.
              await tx.answerGrade.delete({ where: { answerId: ans.id } });
              pending = true;
            } else if (ans.grade.points > q.points) {
              await tx.answerGrade.update({ where: { answerId: ans.id }, data: { points: q.points } });
              earned += q.points;
            } else {
              earned += ans.grade.points;
            }
          }
          await tx.testAttempt.update({
            where: { id: att.id },
            data: {
              status: pending ? "SUBMITTED" : "GRADED",
              score: pending ? null : roundPoints(earned),
            },
          });
          recalculated++;
        }
        return { recalculated };
      },
      { timeout: 60000, maxWait: 15000 }
    );

    const test = await prisma.test.findUnique({
      where: { id: existing.id },
      include: { questions: { include: { options: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
    });
    return NextResponse.json({ test, attemptCount, recalculated: result.recalculated });
  } catch (err) {
    console.error("[preguntas PUT]", err);
    return NextResponse.json({ error: "No se pudieron guardar las preguntas" }, { status: 500 });
  }
}
