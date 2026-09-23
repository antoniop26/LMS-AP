"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type GradeDraft = { points: string; feedback: string };

function answerLabel(a: any) {
  if (a.textAnswer) return a.textAnswer;
  if (a.optionId) {
    const opt = a.question?.options?.find((o: any) => o.id === a.optionId);
    return opt?.text || a.optionId;
  }
  return "—";
}

function questionIsAutoGradable(q: any) {
  if (!q) return false;
  if (q.type === "MULTIPLE_CHOICE") return true;
  if (q.type === "SHORT_ANSWER" && q.correctText) return true;
  return false;
}

function testNeedsManualGrading(questions: any[] | undefined) {
  return (questions || []).some((q) => !questionIsAutoGradable(q));
}

function statusLabel(status: string, needsManual: boolean) {
  if (status === "GRADED") {
    return needsManual ? "Calificado" : "Auto-calificado";
  }
  if (status === "SUBMITTED") return "Por calificar";
  return status;
}

export default function ExamenDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [test, setTest] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, GradeDraft>>({});
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const needsManual = useMemo(
    () => testNeedsManualGrading(test?.questions),
    [test?.questions]
  );

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/examenes/${id}`, { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTest(null);
      setError(data.error || "No se pudo cargar el examen. Vuelve a iniciar sesión.");
      return;
    }
    setTest(data);
    const next: Record<string, GradeDraft> = {};
    for (const att of data.attempts || []) {
      for (const a of att.answers || []) {
        next[a.id] = {
          points: a.grade?.points != null ? String(a.grade.points) : "",
          feedback: a.grade?.feedback || "",
        };
      }
    }
    setGrades(next);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function updateGrade(answerId: string, patch: Partial<GradeDraft>) {
    setGrades((g) => ({
      ...g,
      [answerId]: {
        points: patch.points ?? g[answerId]?.points ?? "",
        feedback: patch.feedback ?? g[answerId]?.feedback ?? "",
      },
    }));
  }

  async function gradeAttempt(attemptId: string, answers: any[]) {
    setMsg("");
    setError("");
    setSavingId(attemptId);
    try {
      const payload = answers.map((a) => {
        const draft = grades[a.id];
        const raw = draft?.points;
        const points =
          raw === undefined || raw === ""
            ? Number(a.grade?.points ?? 0)
            : Number(raw);
        return {
          answerId: a.id,
          points: Number.isFinite(points) ? points : 0,
          feedback: draft?.feedback ?? a.grade?.feedback ?? "",
        };
      });

      const res = await fetch(`/api/examenes/${id}/calificar`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, grades: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg("Calificación guardada");
        setEditingAttemptId(null);
        await load();
      } else {
        setError(data.error || "Error al calificar");
      }
    } catch {
      setError("No se pudo conectar con el servidor al calificar");
    } finally {
      setSavingId(null);
    }
  }

  if (error && !test) {
    return (
      <div className="space-y-3">
        <Link href="/profesor/examenes" className="text-sm text-blue-600 hover:underline">
          ← Volver
        </Link>
        <p className="text-sm text-red-600">{error}</p>
        <Button size="sm" variant="outline" onClick={load}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!test) return <p className="text-gray-500">Cargando…</p>;

  const attempts = Array.isArray(test.attempts) ? test.attempts : [];
  // Pending manual reviews first, then keep all graded attempts visible
  const orderedAttempts = [...attempts].sort((a, b) => {
    const rank = (s: string) => (s === "SUBMITTED" ? 0 : s === "GRADED" ? 1 : 2);
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""));
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/profesor/examenes" className="text-sm text-blue-600 hover:underline">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{test.title}</h1>
        <p className="text-gray-500">{test.subject?.name}</p>
        <p className="mt-1 text-sm text-gray-500">
          {needsManual
            ? "Este examen tiene preguntas de calificación manual. Revisa y guarda la nota de cada alumno."
            : "Este examen se califica automáticamente. Puedes consultar las respuestas; el alumno ya ve su nota."}
        </p>
      </div>
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Preguntas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {test.questions?.map((q: any, i: number) => (
            <div key={q.id} className="rounded-lg border border-gray-100 p-3">
              <p className="text-sm font-medium">
                {i + 1}. {q.prompt}{" "}
                <span className="text-gray-400">({q.points} pts)</span>
              </p>
              <p className="text-xs text-gray-500">
                {q.type}
                {questionIsAutoGradable(q) ? " · automática" : " · manual"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Intentos de alumnos</h2>
        {orderedAttempts.length === 0 && (
          <p className="text-sm text-gray-500">Nadie ha enviado aún.</p>
        )}
        {orderedAttempts.map((att: any) => {
          const isEditing =
            needsManual &&
            (att.status === "SUBMITTED" || editingAttemptId === att.id);
          const showSave = needsManual && isEditing;

          return (
            <Card key={att.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{att.student?.fullName}</CardTitle>
                  <p className="text-sm text-gray-500">{att.student?.email}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge variant={att.status === "GRADED" ? "success" : "secondary"}>
                    {statusLabel(att.status, needsManual)}
                  </Badge>
                  {att.score != null && (
                    <span className="font-semibold text-blue-700">
                      {att.score}/{test.maxScore}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(att.answers || []).map((a: any) => {
                  const auto = questionIsAutoGradable(a.question);
                  const canEditThis = showSave && !auto;

                  return (
                    <div key={a.id} className="rounded border border-gray-100 p-3 text-sm">
                      <p className="font-medium">{a.question?.prompt}</p>
                      <p className="mt-1 text-gray-600">Respuesta: {answerLabel(a)}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Máx. {a.question?.points ?? 0} pts
                        {auto ? " · automática" : " · manual"}
                      </p>
                      {canEditThis ? (
                        <div className="mt-2 flex gap-2">
                          <Input
                            className="w-24"
                            type="number"
                            min={0}
                            step="0.5"
                            max={a.question?.points ?? undefined}
                            placeholder="Pts"
                            value={grades[a.id]?.points ?? ""}
                            onChange={(e) => updateGrade(a.id, { points: e.target.value })}
                          />
                          <Input
                            placeholder="Retroalimentación"
                            value={grades[a.id]?.feedback ?? ""}
                            onChange={(e) => updateGrade(a.id, { feedback: e.target.value })}
                          />
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1 text-sm">
                          <p>
                            <span className="text-gray-500">Puntos: </span>
                            <span className="font-medium">
                              {a.grade?.points != null ? a.grade.points : "—"}
                              {" / "}
                              {a.question?.points ?? 0}
                            </span>
                          </p>
                          {a.grade?.feedback && (
                            <p className="text-gray-600">{a.grade.feedback}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {needsManual && att.status === "GRADED" && !isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingAttemptId(att.id)}
                  >
                    Editar calificación
                  </Button>
                )}

                {showSave && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={savingId === att.id}
                      onClick={() => gradeAttempt(att.id, att.answers || [])}
                    >
                      {savingId === att.id ? "Guardando…" : "Guardar calificación"}
                    </Button>
                    {att.status === "GRADED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingAttemptId(null)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                )}

                {!needsManual && (
                  <p className="text-xs text-gray-500">
                    Nota automática: el alumno ya puede verla en Calificaciones.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
