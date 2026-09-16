"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function AlumnoExamenesPage() {
  const [tests, setTests] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/examenes").then((r) => r.json()).then(setTests);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Exámenes</h1>
      <div className="grid gap-3">
        {tests.map((t) => {
          const attempt = t.attempts?.[0];
          const done = attempt && attempt.status !== "IN_PROGRESS";
          return (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-gray-900">{t.title}</p>
                  <p className="text-sm text-gray-500">{t.subject?.name} · {t._count?.questions || 0} preguntas</p>
                  {done && (
                    <Badge variant={attempt.status === "GRADED" ? "success" : "secondary"} className="mt-1">
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
                    <Button variant="outline" size="sm">Ver</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
        {tests.length === 0 && <p className="text-sm text-gray-500">No hay exámenes publicados.</p>}
      </div>
    </div>
  );
}
