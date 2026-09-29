/**
 * Reglas compartidas de preguntas de examen: validación (crear y editar) y
 * auto-calificación (envío del alumno y recálculo tras editar preguntas).
 */
import type { QuestionType } from "@prisma/client";

export const QUESTION_TYPES = ["MULTIPLE_CHOICE", "SHORT_ANSWER", "LONG_ANSWER"] as const;

export type QuestionInput = {
  id?: string;
  prompt: string;
  type: QuestionType;
  points: number;
  correctText: string | null;
  options: { id?: string; text: string; isCorrect: boolean }[];
};

type Validation = { ok: true; questions: QuestionInput[] } | { ok: false; error: string };

/**
 * Valida y normaliza el arreglo de preguntas enviado por el cliente.
 * Reglas: al menos 1 pregunta; cada una con enunciado, tipo válido y puntos > 0;
 * opción múltiple con ≥ 2 opciones con texto y exactamente 1 correcta.
 */
export function validateQuestions(raw: unknown): Validation {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Agregue al menos una pregunta" };
  }
  const out: QuestionInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const q = raw[i] as Record<string, unknown> | null;
    const n = i + 1;
    if (!q || typeof q !== "object") return { ok: false, error: `Pregunta ${n} inválida` };
    const pts = q.points ?? 1;
    if (typeof pts !== "number" || !Number.isFinite(pts) || pts <= 0) {
      return { ok: false, error: "Cada pregunta debe valer un número de puntos mayor que 0" };
    }
    const prompt = String(q.prompt ?? "").trim();
    if (!prompt) return { ok: false, error: `La pregunta ${n} no tiene enunciado` };
    const type = String(q.type ?? "") as QuestionType;
    if (!(QUESTION_TYPES as readonly string[]).includes(type)) {
      return { ok: false, error: `Tipo de pregunta inválido en la pregunta ${n}` };
    }
    let options: QuestionInput["options"] = [];
    if (type === "MULTIPLE_CHOICE") {
      const rawOpts = Array.isArray(q.options) ? q.options : [];
      options = rawOpts.map((o: Record<string, unknown>) => ({
        ...(typeof o?.id === "string" && o.id ? { id: o.id } : {}),
        text: String(o?.text ?? "").trim(),
        isCorrect: Boolean(o?.isCorrect),
      }));
      if (options.length < 2) return { ok: false, error: `La pregunta ${n} necesita al menos 2 opciones` };
      if (options.some((o) => !o.text)) return { ok: false, error: `Hay opciones vacías en la pregunta ${n}` };
      if (options.filter((o) => o.isCorrect).length !== 1) {
        return { ok: false, error: `Marque exactamente una opción correcta en la pregunta ${n}` };
      }
    }
    const correctText =
      type === "SHORT_ANSWER" && typeof q.correctText === "string" && q.correctText.trim()
        ? q.correctText.trim()
        : null;
    out.push({
      ...(typeof q.id === "string" && q.id ? { id: q.id } : {}),
      prompt,
      type,
      points: pts,
      correctText,
      options,
    });
  }
  return { ok: true, questions: out };
}

type GradableQuestion = {
  type: QuestionType | string;
  points: number;
  correctText: string | null;
  options: { id: string; isCorrect: boolean }[];
};

/** Opción múltiple, o respuesta corta con respuesta correcta definida. */
export function isAutoGradable(q: { type: QuestionType | string; correctText?: string | null }): boolean {
  return q.type === "MULTIPLE_CHOICE" || (q.type === "SHORT_ANSWER" && !!q.correctText);
}

export function normalizeAnswerText(s: string): string {
  return s.trim().toLowerCase().replace(/[.,;:!?¡¿]+$/g, "").replace(/\s+/g, " ");
}

/** Califica automáticamente una respuesta; null si la pregunta es de calificación manual. */
export function autoGradeAnswer(
  q: GradableQuestion,
  ans: { optionId?: string | null; textAnswer?: string | null }
): { points: number; feedback: string } | null {
  if (!isAutoGradable(q)) return null;
  let isRight = false;
  if (q.type === "MULTIPLE_CHOICE") {
    const correct = q.options.find((o) => o.isCorrect);
    isRight = !!correct && ans.optionId === correct.id;
  } else {
    isRight = normalizeAnswerText(ans.textAnswer || "") === normalizeAnswerText(q.correctText || "");
  }
  return { points: isRight ? q.points : 0, feedback: isRight ? "Correcto" : "Incorrecto" };
}
