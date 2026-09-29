"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatScore } from "@/lib/test-points";

type ReviewQuestion = {
  id: string;
  prompt: string;
  type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "LONG_ANSWER";
  points: number;
  manual: boolean;
  options: { id: string; text: string; isCorrect?: boolean }[];
  correctText?: string;
  answer: { textAnswer: string | null; optionId: string | null } | null;
  grade: { points: number; feedback: string | null } | null;
  pending: boolean;
};

type Review = {
  attempt: { id: string; status: "SUBMITTED" | "GRADED"; score: number | null; submittedAt: string | null };
  test: { id: string; title: string; subjectName: string; maxScore: number };
  earnedSoFar: number;
  pendingCount: number;
  questions: ReviewQuestion[];
};

export default function RevisionIntentoPage() {
  const params = useParams();
  const attemptId = params.attemptId as string;
  const [data, setData] = useState<Review | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/calificaciones/${attemptId}`, { credentials: "same-origin" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "No se pudo cargar la revisión");
        setData(body);
      })
      .catch((e) => setError(e.message || "No se pudo cargar la revisión"));
  }, [attemptId]);

  if (error) {
    return (
      <div className="space-y-3">
        <Link href="/alumno/calificaciones" className="text-sm text-blue-600 hover:underline">← Calificaciones</Link>
        <p className="text-sm text-red-600" data-testid="review-error">Revisión no disponible: {error}</p>
      </div>
    );
  }
  if (!data) return <p className="text-gray-500">Cargando…</p>;

  const graded = data.attempt.status === "GRADED";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/alumno/calificaciones" className="text-sm text-blue-600 hover:underline">← Calificaciones</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Revisión: {data.test.title}</h1>
        <p className="text-gray-500">{data.test.subjectName}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <Badge variant={graded ? "success" : "secondary"}>{graded ? "Calificado" : "Por calificar"}</Badge>
            {data.attempt.submittedAt && (
              <p className="mt-1 text-sm text-gray-500">
                Enviado el {new Date(data.attempt.submittedAt).toLocaleString("es-PA")}
              </p>
            )}
          </div>
          <div className="text-right" data-testid="review-total">
            {graded ? (
              <p className="text-2xl font-bold text-blue-700">
                {formatScore(data.attempt.score, data.test.maxScore, { percent: true })}
              </p>
            ) : (
              <>
                <p className="text-lg font-semibold text-gray-700">
                  Calificado hasta ahora: {formatScore(data.earnedSoFar, data.test.maxScore)}
                </p>
                <p className="text-sm text-amber-700">
                  {data.pendingCount} pregunta{data.pendingCount === 1 ? "" : "s"} pendiente{data.pendingCount === 1 ? "" : "s"} de calificar
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {data.questions.map((q, i) => {
          const picked = q.answer?.optionId ? q.options.find((o) => o.id === q.answer!.optionId) : null;
          const correctOpt = q.options.find((o) => o.isCorrect);
          return (
            <Card key={q.id} data-testid="review-question">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <CardTitle className="text-base">
                  {i + 1}. {q.prompt}
                </CardTitle>
                <span className="shrink-0 text-sm font-semibold" data-testid="review-question-points">
                  {q.pending ? (
                    <Badge variant="secondary">Pendiente · {q.points} pts</Badge>
                  ) : q.grade ? (
                    <span className={q.grade.points >= q.points ? "text-green-700" : "text-gray-800"}>
                      {q.grade.points}/{q.points} pts
                    </span>
                  ) : (
                    <span className="text-gray-500">{graded ? `0/${q.points} pts` : `—/${q.points} pts`}</span>
                  )}
                </span>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {q.type === "MULTIPLE_CHOICE" ? (
                  <ul className="space-y-1">
                    {q.options.map((o) => {
                      const isPicked = picked?.id === o.id;
                      const showCorrect = graded && o.isCorrect;
                      return (
                        <li
                          key={o.id}
                          className={`flex items-center gap-2 rounded px-2 py-1 ${
                            showCorrect ? "bg-green-50 text-green-800" : isPicked ? "bg-red-50 text-red-800" : "text-gray-600"
                          } ${isPicked && showCorrect ? "font-medium" : ""}`}
                        >
                          <span>{isPicked ? "●" : "○"}</span>
                          <span>{o.text}</span>
                          {isPicked && <span className="text-xs">(tu respuesta)</span>}
                          {showCorrect && <span className="text-xs">(correcta)</span>}
                        </li>
                      );
                    })}
                    {!picked && <li className="text-gray-500">Sin respuesta</li>}
                    {graded && picked && correctOpt && picked.id !== correctOpt.id && (
                      <li className="text-xs text-gray-500">Respuesta correcta: {correctOpt.text}</li>
                    )}
                  </ul>
                ) : (
                  <div>
                    <p className="text-gray-500">Tu respuesta:</p>
                    <p className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-gray-900">
                      {q.answer?.textAnswer || "Sin respuesta"}
                    </p>
                    {q.correctText && (
                      <p className="mt-1 text-xs text-gray-500">Respuesta esperada: {q.correctText}</p>
                    )}
                  </div>
                )}
                {q.grade?.feedback && (
                  <p className="rounded border-l-4 border-blue-300 bg-blue-50 p-2 text-gray-800" data-testid="review-feedback">
                    <span className="font-medium">Comentario: </span>
                    {q.grade.feedback}
                  </p>
                )}
                {q.pending && <p className="text-xs text-amber-700">El profesor aún no ha calificado esta respuesta.</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
