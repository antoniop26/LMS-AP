"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

type Grade = { id: string; name: string };
type Subject = { id: string; name: string; code: string | null; grade: Grade | null; _count: { teacherSubjects: number } };

export default function AsignaturasPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const [g, s] = await Promise.all([fetch("/api/grados"), fetch("/api/asignaturas")]);
    setGrades(await g.json());
    setSubjects(await s.json());
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/asignaturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code: code || null, gradeId: gradeId || null }),
    });
    setName(""); setCode(""); setLoading(false); load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar asignatura?")) return;
    await fetch(`/api/asignaturas/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Asignaturas</h1>
      <Card>
        <CardHeader><CardTitle>Nueva asignatura</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Matemáticas" required />
            </div>
            <div className="space-y-1">
              <Label>Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAT" />
            </div>
            <div className="space-y-1">
              <Label>Grado (opcional)</Label>
              <Select value={gradeId} onValueChange={setGradeId}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading} className="sm:col-span-4 sm:w-fit">Crear</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {subjects.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-gray-900">{s.name} {s.code && <span className="text-gray-400">({s.code})</span>}</p>
                <p className="text-sm text-gray-500">{s.grade?.name || "Sin grado"} · {s._count.teacherSubjects} asignaciones</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
