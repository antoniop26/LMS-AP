"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type TestRow = {
  id: string;
  title: string;
  subject?: { name: string };
  _count?: { questions: number };
  attempts?: { status: string; score: number | null }[];
};

export default function AlumnoExamenesAsignaturaPage() {
  const params = useParams();
  const subjectId = params.subjectId as string;

  const [tests, setTests] = useState<TestRow[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/examenes?subjectId=${encodeURIComponent(subjectId)}`).then((r) => r.json()),
      fetch("/api/alumno/asignaturas").then((r) => r.json()),
    ])
      .then(([testsData, subjectsData]) => {
        setTests(Array.isArray(testsData) ? testsData : []);
        if (Array.isArray(subjectsData)) {
          const match = subjectsData.find((s: { id: string }) => s.id === subjectId);
          if (match) setSubjectName(match.name);
          else if (testsData?.[0]?.subject?.name) setSubjectName(testsData[0].subject.name);
        } else if (testsData?.[0]?.subject?.name) {
          setSubjectName(testsData[0].subject.name);
        }
      })
      .finally(() => setLoading(false));
  }, [subjectId]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/alumno/examenes"
          className="mb-2 inline-block text-sm font-medium text-blue-700 hover:underline"
        >
          ← Exámenes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {subjectName || "Asignatura"}
        </h1>
        <p className="text-sm text-gray-600">Exámenes publicados de esta asignatura.</p>
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando exámenes…</p>}

      <div className="grid gap-3">
        {!loading &&
          tests.map((t) => {
            const attempt = t.attempts?.[0];
            const done = attempt && attempt.status !== "IN_PROGRESS";
            return (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-gray-900">{t.title}</p>
                    <p className="text-sm text-gray-500">
                      {t._count?.questions || 0} preguntas
                    </p>
                    {done && (
                      <Badge
                        variant={attempt.status === "GRADED" ? "success" : "secondary"}
                        className="mt-1"
                      >
                        {attempt.status === "GRADED" ? `Nota: ${attempt.score}` : "Enviado"}
                      </Badge>
                    )}
                  </div>
                  {!done ? (
                    <Link href={`/alumno/examenes/${t.id}`}>
                      <Button size="sm">Presentar</Button>
                    </Link>
                  ) : (
                    <Link href={`/alumno/examenes/${t.id}`}>
                      <Button variant="outline" size="sm">
                        Ver
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        {!loading && tests.length === 0 && (
          <p className="text-sm text-gray-500">No hay exámenes publicados para esta asignatura.</p>
        )}
      </div>
    </div>
  );
}
