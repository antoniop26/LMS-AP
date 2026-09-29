/**
 * Puntaje de exámenes: el total de un examen es la suma de los puntos de sus
 * preguntas (no un valor fijo de 100). Las notas de los intentos se guardan en
 * puntos obtenidos (p. ej. 18 de 25), nunca escaladas.
 */

/** Redondea a 2 decimales evitando errores de coma flotante (0.1 + 0.2). */
export function roundPoints(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Suma de los puntos de las preguntas = puntaje máximo del examen. */
export function sumQuestionPoints(questions: { points?: number | null }[] | null | undefined): number {
  return roundPoints(
    (questions || []).reduce((s, q) => s + (Number.isFinite(Number(q?.points)) ? Number(q!.points) : 0), 0)
  );
}

/** Porcentaje obtenido sobre el total del examen (0–100, 1 decimal). */
export function scorePercent(score: number | null | undefined, total: number | null | undefined): number | null {
  if (score == null || !total || total <= 0) return null;
  return Math.round((score / total) * 1000) / 10;
}

/** Formato "18/25" (opcionalmente "18/25 (72%)"). */
export function formatScore(
  score: number | null | undefined,
  total: number | null | undefined,
  opts: { percent?: boolean } = {}
): string {
  if (score == null) return "—";
  const t = total ?? 0;
  const base = `${roundPoints(score)}/${roundPoints(t)}`;
  if (!opts.percent) return base;
  const pct = scorePercent(score, t);
  return pct == null ? base : `${base} (${pct}%)`;
}
