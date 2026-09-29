"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatScore, scorePercent } from "@/lib/test-points";

export default function CalificacionesPage() {
  const [attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/calificaciones").then((r) => r.json()).then(setAttempts);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Calificaciones</h1>
      <div className="grid gap-3">
        {attempts.map((a) => (
          <Link key={a.id} href={`/alumno/calificaciones/${a.id}`} className="block" data-testid="grade-row">
          <Card className="transition-colors hover:border-blue-300 hover:bg-blue-50/40">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-gray-900">{a.test?.title}</p>
                <p className="text-sm text-gray-500">{a.test?.subject?.name}</p>
                <p className="mt-1 text-sm font-medium text-blue-700">Ver revisión →</p>
              </div>
              <div className="text-right">
                <Badge variant={a.status === "GRADED" ? "success" : "secondary"}>
                  {a.status === "GRADED" ? "Calificado" : "Pendiente"}
                </Badge>
                <p className="mt-1 text-lg font-bold text-blue-700">
                  {a.score != null ? formatScore(a.score, a.test?.maxScore) : "—"}
                </p>
                {a.score != null && scorePercent(a.score, a.test?.maxScore) != null && (
                  <p className="text-xs text-gray-500">{scorePercent(a.score, a.test?.maxScore)}%</p>
                )}
              </div>
            </CardContent>
          </Card>
          </Link>
        ))}
        {attempts.length === 0 && <p className="text-sm text-gray-500">Aún no tiene calificaciones.</p>}
      </div>
    </div>
  );
}
