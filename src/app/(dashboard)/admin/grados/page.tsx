"use client";

import { useEffect, useState } from "react";
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

  async function load() {
    const res = await fetch("/api/grados");
    setGrades(await res.json());
  }

  useEffect(() => { load(); }, []);

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
      <div className="grid gap-3">
        {grades.map((g) => (
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
        {grades.length === 0 && <p className="text-sm text-gray-500">Aún no hay grados.</p>}
      </div>
    </div>
  );
}
