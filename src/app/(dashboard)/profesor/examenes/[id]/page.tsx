"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function ExamenDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [test, setTest] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, { points: string; feedback: string }>>({});
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch(`/api/examenes/${id}`);
    const data = await res.json();
    setTest(data);
  }
  useEffect(() => { load(); }, [id]);

  async function gradeAttempt(attemptId: string, answers: any[]) {
    setMsg("");
    const payload = answers.map((a) => ({
      answerId: a.id,
      points: Number(grades[a.id]?.points ?? a.grade?.points ?? 0),
      feedback: grades[a.id]?.feedback ?? a.grade?.feedback ?? "",
    }));
    const res = await fetch(`/api/examenes/${id}/calificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, grades: payload }),
    });
    if (res.ok) {
      setMsg("Calificación guardada");
      load();
    } else {
      setMsg("Error al calificar");
    }
  }

  if (!test) return <p className="text-gray-500">Cargando…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/profesor/examenes" className="text-sm text-blue-600 hover:underline">← Volver</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{test.title}</h1>
        <p className="text-gray-500">{test.subject?.name}</p>
      </div>
      {msg && <p className="text-sm text-blue-700">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Preguntas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {test.questions?.map((q: any, i: number) => (
            <div key={q.id} className="rounded-lg border border-gray-100 p-3">
              <p className="font-medium text-sm">{i + 1}. {q.prompt} <span className="text-gray-400">({q.points} pts)</span></p>
              <p className="text-xs text-gray-500">{q.type}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Intentos de alumnos</h2>
        {(test.attempts || []).length === 0 && <p className="text-sm text-gray-500">Nadie ha enviado aún.</p>}
        {(test.attempts || []).map((att: any) => (
          <Card key={att.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{att.student?.fullName}</CardTitle>
                <p className="text-sm text-gray-500">{att.student?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={att.status === "GRADED" ? "success" : "secondary"}>{att.status}</Badge>
                {att.score != null && <span className="font-semibold text-blue-700">{att.score}/{test.maxScore}</span>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {att.answers?.map((a: any) => (
                <div key={a.id} className="rounded border border-gray-100 p-3 text-sm">
                  <p className="font-medium">{a.question?.prompt}</p>
                  <p className="text-gray-600 mt-1">Respuesta: {a.textAnswer || a.optionId || "—"}</p>
                  <div className="mt-2 flex gap-2">
                    <Input
                      className="w-24"
                      type="number"
                      placeholder="Pts"
                      defaultValue={a.grade?.points ?? ""}
                      onChange={(e) => setGrades((g) => ({ ...g, [a.id]: { ...g[a.id], points: e.target.value, feedback: g[a.id]?.feedback || "" } }))}
                    />
                    <Input
                      placeholder="Retroalimentación"
                      defaultValue={a.grade?.feedback ?? ""}
                      onChange={(e) => setGrades((g) => ({ ...g, [a.id]: { ...g[a.id], feedback: e.target.value, points: g[a.id]?.points || String(a.grade?.points ?? 0) } }))}
                    />
                  </div>
                </div>
              ))}
              <Button size="sm" onClick={() => gradeAttempt(att.id, att.answers || [])}>Guardar calificación</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
