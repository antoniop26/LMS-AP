"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type GradeDraft = { points: string; feedback: string };

type RosterEntry = {
  student: { id: string; fullName: string; email: string };
  status: "ENVIADO" | "NO_ENVIADO";
  attempt: null | {
    id: string;
    status: string;
    score: number | null;
    submittedAt: string | null;
    answers: any[];
    student?: { id: string; fullName: string; email: string };
  };
};

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

function syncGradesFromRoster(roster: RosterEntry[]): Record<string, GradeDraft> {
  const next: Record<string, GradeDraft> = {};
  for (const entry of roster || []) {
    for (const a of entry.attempt?.answers || []) {
      next[a.id] = {
        points: a.grade?.points != null ? String(a.grade.points) : "",
        feedback: a.grade?.feedback || "",
      };
    }
  }
  return next;
}

export default function ExamenDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [test, setTest] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, GradeDraft>>({});
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const needsManual = useMemo(
    () => testNeedsManualGrading(test?.questions),
    [test?.questions]
  );

  const roster: RosterEntry[] = useMemo(() => {
    if (Array.isArray(test?.roster) && test.roster.length > 0) {
      return test.roster;
    }
    // Fallback from attempts if older API response without roster
    const attempts = Array.isArray(test?.attempts) ? test.attempts : [];
    return attempts.map((att: any) => ({
      student: att.student || { id: att.studentId, fullName: "Alumno", email: "" },
      status: "ENVIADO" as const,
      attempt: att,
    }));
  }, [test]);

  const selectedIndex = useMemo(() => {
    if (!selectedStudentId) return -1;
    return roster.findIndex((r) => r.student.id === selectedStudentId);
  }, [roster, selectedStudentId]);

  const selectedEntry = selectedIndex >= 0 ? roster[selectedIndex] : null;

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
    setGrades(syncGradesFromRoster(data.roster || []));
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

  function openStudent(studentId: string, status: "ENVIADO" | "NO_ENVIADO") {
    setMsg("");
    setError("");
    setEditingAttemptId(null);
    if (status === "NO_ENVIADO") {
      setSelectedStudentId(studentId);
      return;
    }
    setSelectedStudentId(studentId);
  }

  function goPrev() {
    if (roster.length === 0 || selectedIndex < 0) return;
    const next = (selectedIndex - 1 + roster.length) % roster.length;
    setEditingAttemptId(null);
    setMsg("");
    setSelectedStudentId(roster[next].student.id);
  }

  function goNext() {
    if (roster.length === 0 || selectedIndex < 0) return;
    const next = (selectedIndex + 1) % roster.length;
    setEditingAttemptId(null);
    setMsg("");
    setSelectedStudentId(roster[next].student.id);
  }

  function backToRoster() {
    setSelectedStudentId(null);
    setEditingAttemptId(null);
    setMsg("");
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

  const enviadoCount = roster.filter((r) => r.status === "ENVIADO").length;
  const noEnviadoCount = roster.length - enviadoCount;

  // —— Student detail view ——
  if (selectedEntry) {
    const att = selectedEntry.attempt;
    const isNoEnviado = selectedEntry.status === "NO_ENVIADO" || !att;
    const isEditing =
      !isNoEnviado &&
      needsManual &&
      (att!.status === "SUBMITTED" || editingAttemptId === att!.id);
    const showSave = needsManual && isEditing;

    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={backToRoster}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Volver al listado
          </button>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{test.title}</h1>
          <p className="text-gray-500">{test.subject?.name}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" variant="outline" onClick={goPrev} disabled={roster.length < 2}>
            ← Anterior
          </Button>
          <p className="text-sm text-gray-500">
            Alumno {selectedIndex + 1} de {roster.length}
          </p>
          <Button size="sm" variant="outline" onClick={goNext} disabled={roster.length < 2}>
            Siguiente →
          </Button>
        </div>

        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{selectedEntry.student.fullName}</CardTitle>
              <p className="text-sm text-gray-500">{selectedEntry.student.email}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isNoEnviado ? (
                <Badge variant="secondary">No enviado</Badge>
              ) : (
                <>
                  <Badge variant={att!.status === "GRADED" ? "success" : "secondary"}>
                    {statusLabel(att!.status, needsManual)}
                  </Badge>
                  <Badge variant="outline">Enviado</Badge>
                  {att!.score != null && (
                    <span className="font-semibold text-blue-700">
                      {att!.score}/{test.maxScore}
                    </span>
                  )}
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isNoEnviado ? (
              <p className="text-sm text-gray-600">
                Este alumno aún no ha enviado la prueba.
              </p>
            ) : (
              <>
                {(att!.answers || []).map((a: any) => {
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

                {needsManual && att!.status === "GRADED" && !isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingAttemptId(att!.id)}
                  >
                    Editar calificación
                  </Button>
                )}

                {showSave && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={savingId === att!.id}
                      onClick={() => gradeAttempt(att!.id, att!.answers || [])}
                    >
                      {savingId === att!.id ? "Guardando…" : "Guardar calificación"}
                    </Button>
                    {att!.status === "GRADED" && (
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // —— Roster list view ——
  return (
    <div className="space-y-6">
      <div>
        <Link href="/profesor/examenes" className="text-sm text-blue-600 hover:underline">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{test.title}</h1>
        <p className="text-gray-500">{test.subject?.name}</p>
        {test.group && (
          <p className="text-sm text-gray-500">
            Grupo: {test.group.grade?.name ? `${test.group.grade.name} · ` : ""}
            {test.group.name}
          </p>
        )}
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

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Alumnos del grupo</h2>
          <p className="text-sm text-gray-500">
            {enviadoCount} enviado{enviadoCount === 1 ? "" : "s"} · {noEnviadoCount} no
            enviado{noEnviadoCount === 1 ? "" : "s"}
          </p>
        </div>

        {roster.length === 0 && (
          <p className="text-sm text-gray-500">
            No hay alumnos asignados a este examen. Asigna un grupo al examen o matricula
            alumnos en los grupos de la asignatura.
          </p>
        )}

        <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {roster.map((entry) => {
            const enviado = entry.status === "ENVIADO";
            const att = entry.attempt;
            return (
              <button
                key={entry.student.id}
                type="button"
                onClick={() => openStudent(entry.student.id, entry.status)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50 ${
                  !enviado ? "opacity-80" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {entry.student.fullName}
                  </p>
                  <p className="truncate text-sm text-gray-500">{entry.student.email}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {enviado && att ? (
                    <>
                      <Badge variant={att.status === "GRADED" ? "success" : "secondary"}>
                        {statusLabel(att.status, needsManual)}
                      </Badge>
                      <Badge variant="default">Enviado</Badge>
                      {att.score != null && (
                        <span className="text-sm font-semibold text-blue-700">
                          {att.score}/{test.maxScore}
                        </span>
                      )}
                    </>
                  ) : (
                    <Badge variant="secondary">No enviado</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
