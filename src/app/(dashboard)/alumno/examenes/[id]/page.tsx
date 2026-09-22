"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { examWindowMessage, examWindowStatus } from "@/lib/exam-window";

export default function TomarExamenPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, { textAnswer?: string; optionId?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/examenes/${id}`).then((r) => r.json()).then(setTest);
  }, [id]);

  const attempt = test?.attempts?.[0];
  const done = attempt && attempt.status !== "IN_PROGRESS";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = Object.entries(answers).map(([questionId, val]) => ({
      questionId,
      ...val,
    }));
    const res = await fetch(`/api/examenes/${id}/intentar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error al enviar");
      setLoading(false);
      return;
    }
    router.push("/alumno/calificaciones");
    router.refresh();
  }

  if (!test) return <p className="text-gray-500">Cargando…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/alumno/examenes" className="text-sm text-blue-600 hover:underline">← Volver</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{test.title}</h1>
        <p className="text-gray-500">{test.description || test.subject?.name}</p>
        {(test.opensAt || test.closesAt) && (
          <p className="mt-1 text-sm text-gray-500">
            {test.opensAt ? `Abre ${new Date(test.opensAt).toLocaleString("es-PA")}` : "Sin inicio fijo"}
            {" · "}
            {test.closesAt ? `Cierra ${new Date(test.closesAt).toLocaleString("es-PA")}` : "Sin cierre fijo"}
          </p>
        )}
      </div>

      {done ? (
        <Card>
          <CardContent className="py-6">
            <p className="font-medium">Ya envió este examen.</p>
            <p className="text-sm text-gray-500 mt-1">Estado: {attempt.status}{attempt.score != null ? ` · Nota: ${attempt.score}/${test.maxScore}` : ""}</p>
          </CardContent>
        </Card>
      ) : (() => {
        const window = examWindowStatus(test.opensAt, test.closesAt);
        if (!window.open) {
          return (
            <Card>
              <CardContent className="py-6">
                <p className="font-medium">{examWindowMessage(window.reason)}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {window.reason === "not_open" && test.opensAt
                    ? `Disponible desde ${new Date(test.opensAt).toLocaleString("es-PA")}`
                    : ""}
                  {window.reason === "closed" && test.closesAt
                    ? `Cerró el ${new Date(test.closesAt).toLocaleString("es-PA")}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          );
        }
        return (
        <form onSubmit={submit} className="space-y-4">
          {test.questions?.map((q: any, i: number) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="text-base">{i + 1}. {q.prompt} <span className="text-gray-400 text-sm">({q.points} pts)</span></CardTitle>
              </CardHeader>
              <CardContent>
                {q.type === "MULTIPLE_CHOICE" && (
                  <div className="space-y-2">
                    {q.options?.map((o: any) => (
                      <label key={o.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={q.id}
                          required
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: { optionId: o.id } }))}
                        />
                        {o.text}
                      </label>
                    ))}
                  </div>
                )}
                {q.type === "SHORT_ANSWER" && (
                  <Input
                    required
                    placeholder="Su respuesta"
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: { textAnswer: e.target.value } }))}
                  />
                )}
                {q.type === "LONG_ANSWER" && (
                  <Textarea
                    required
                    rows={5}
                    placeholder="Escriba su respuesta"
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: { textAnswer: e.target.value } }))}
                  />
                )}
              </CardContent>
            </Card>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? "Enviando…" : "Enviar examen"}</Button>
        </form>
        );
      })()}
    </div>
  );
}
