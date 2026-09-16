"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

type Grade = { id: string; name: string };
type Group = { id: string; name: string; grade: Grade; _count: { students: number } };

export default function GruposPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const [g, gr] = await Promise.all([fetch("/api/grados"), fetch("/api/grupos")]);
    setGrades(await g.json());
    setGroups(await gr.json());
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/grupos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, gradeId }),
    });
    setName("");
    setLoading(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar grupo?")) return;
    await fetch(`/api/grupos/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Grupos por grado</h1>
      <Card>
        <CardHeader><CardTitle>Nuevo grupo</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label>Grado</Label>
              <Select value={gradeId} onValueChange={setGradeId}>
                <SelectTrigger><SelectValue placeholder="Seleccione grado" /></SelectTrigger>
                <SelectContent>
                  {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label>Nombre del grupo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="A" required />
            </div>
            <Button type="submit" disabled={loading || !gradeId}>Crear</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {groups.map((g) => (
          <Card key={g.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-gray-900">{g.grade.name} — Grupo {g.name}</p>
                <p className="text-sm text-gray-500">{g._count.students} alumnos</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(g.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
