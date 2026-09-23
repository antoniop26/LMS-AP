"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

type Grade = { id: string; name: string; level: number; _count: { groups: number; subjects: number } };

export default function GradosPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("1");
  const [loading, setLoading] = useState(false);
  const [nameQuery, setNameQuery] = useState("");

  async function load() {
    const res = await fetch("/api/grados");
    setGrades(await res.json());
  }

  useEffect(() => { load(); }, []);

  const filteredGrades = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (!q) return grades;
    return grades.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        String(g.level).includes(q)
    );
  }, [grades, nameQuery]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/grados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, level: Number(level) }),
    });
    setName("");
    setLoading(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este grado y sus grupos?")) return;
    await fetch(`/api/grados/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Grados</h1>
      <Card>
        <CardHeader><CardTitle>Nuevo grado</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="1° Primaria" required />
            </div>
            <div className="w-28 space-y-1">
              <Label>Nivel</Label>
              <Input type="number" value={level} onChange={(e) => setLevel(e.target.value)} min={1} />
            </div>
            <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Crear"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Buscar grados</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="grade-name-filter" className="sr-only">Buscar por nombre</Label>
          <Input
            id="grade-name-filter"
            placeholder="Filtrar por nombre o nivel…"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
          />
          <p className="mt-2 text-xs text-gray-500">
            {filteredGrades.length} de {grades.length} grado{grades.length === 1 ? "" : "s"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {filteredGrades.map((g) => (
          <Card key={g.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-gray-900">{g.name}</p>
                <p className="text-sm text-gray-500">Nivel {g.level} · {g._count.groups} grupos · {g._count.subjects} asignaturas</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(g.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {filteredGrades.length === 0 && (
          <p className="text-sm text-gray-500">
            {grades.length === 0 ? "Aún no hay grados." : "Ningún grado coincide con la búsqueda."}
          </p>
        )}
      </div>
    </div>
  );
}
