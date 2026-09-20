"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ChevronRight, ClipboardList } from "lucide-react";

type SubjectCard = {
  id: string;
  name: string;
  code: string | null;
  materialsFolderCount: number;
  examsCount: number;
};

export default function AlumnoExamenesHubPage() {
  const [subjects, setSubjects] = useState<SubjectCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/alumno/asignaturas")
      .then((r) => r.json())
      .then((data) => {
        setSubjects(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Exámenes</h1>
        <p className="text-sm text-gray-600">
          Seleccione una asignatura para ver sus exámenes.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando asignaturas…</p>}

      {!loading && subjects.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">
              No hay asignaturas asignadas a sus grupos.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s) => (
          <Link key={s.id} href={`/alumno/examenes/asignatura/${s.id}`}>
            <Card className="h-full transition-colors hover:border-blue-300 hover:bg-blue-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="flex items-center gap-2 text-blue-900">
                    <ClipboardList className="h-5 w-5 shrink-0 text-blue-600" />
                    {s.name}
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  {s.code ? `${s.code} · ` : ""}
                  {s.examsCount} {s.examsCount === 1 ? "examen" : "exámenes"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
