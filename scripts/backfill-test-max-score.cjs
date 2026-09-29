/**
 * Backfill: el puntaje máximo de cada examen pasa a ser la suma de los puntos de
 * sus preguntas (antes era 100 fijo) y las notas de intentos calificados se
 * guardan en puntos obtenidos (antes: (obtenidos / total) * 100).
 *
 * Uso:
 *   node scripts/backfill-test-max-score.cjs          # simulación (no escribe)
 *   node scripts/backfill-test-max-score.cjs --apply  # aplica los cambios
 *
 * Idempotente: se puede ejecutar varias veces. No imprime secretos.
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const APPLY = process.argv.includes("--apply");
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("pgbouncer", "true");
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

const round = (n) => Math.round(n * 100) / 100;

(async () => {
  const tests = await prisma.test.findMany({
    select: {
      id: true,
      title: true,
      maxScore: true,
      questions: { select: { points: true } },
      attempts: {
        where: { status: "GRADED" },
        select: { id: true, score: true, answers: { select: { grade: { select: { points: true } } } } },
      },
    },
  });

  let testsChanged = 0;
  let attemptsChanged = 0;
  for (const t of tests) {
    const total = round(t.questions.reduce((s, q) => s + (q.points || 0), 0));
    if (t.maxScore !== total) {
      console.log(`Examen ${t.id} "${t.title}": maxScore ${t.maxScore} -> ${total}`);
      testsChanged++;
      if (APPLY) await prisma.test.update({ where: { id: t.id }, data: { maxScore: total } });
    }
    for (const a of t.attempts) {
      const earned = round(a.answers.reduce((s, x) => s + (x.grade?.points || 0), 0));
      if (a.score !== earned) {
        console.log(`  Intento ${a.id}: score ${a.score} -> ${earned}/${total}`);
        attemptsChanged++;
        if (APPLY) await prisma.testAttempt.update({ where: { id: a.id }, data: { score: earned } });
      }
    }
  }

  if (APPLY) {
    // Alinear el default de la columna con prisma/schema.prisma (@default(0)).
    await prisma.$executeRawUnsafe('ALTER TABLE "Test" ALTER COLUMN "maxScore" SET DEFAULT 0');
  }

  console.log(
    `${APPLY ? "Aplicado" : "Simulación"}: ${testsChanged} examen(es) y ${attemptsChanged} intento(s) ${APPLY ? "actualizados" : "por actualizar"} de ${tests.length} examen(es).`
  );
})()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
