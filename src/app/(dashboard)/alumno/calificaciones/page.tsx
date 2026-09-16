"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
          <Card key={a.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-gray-900">{a.test?.title}</p>
                <p className="text-sm text-gray-500">{a.test?.subject?.name}</p>
              </div>
              <div className="text-right">
                <Badge variant={a.status === "GRADED" ? "success" : "secondary"}>
                  {a.status === "GRADED" ? "Calificado" : "Pendiente"}
                </Badge>
                <p className="mt-1 text-lg font-bold text-blue-700">
                  {a.score != null ? `${a.score} / ${a.test?.maxScore ?? 100}` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        {attempts.length === 0 && <p className="text-sm text-gray-500">Aún no tiene calificaciones.</p>}
      </div>
    </div>
  );
}
