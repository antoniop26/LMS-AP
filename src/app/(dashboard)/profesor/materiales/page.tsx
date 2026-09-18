"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FolderPlus, FolderOpen, Trash2 } from "lucide-react";

type Subject = { id: string; name: string };
type Group = { id: string; name: string; grade: { name: string } };
type Folder = {
  id: string;
  name: string;
  description: string | null;
  kind: "TEACHER_RESOURCES" | "STUDENT_SUBMISSIONS";
  subjectId: string;
  groupId: string;
  opensAt: string | null;
  closesAt: string | null;
  status: string;
  subject: Subject;
  group: Group;
  _count: { materials: number };
};

export default function ProfesorMaterialesPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"TEACHER_RESOURCES" | "STUDENT_SUBMISSIONS">("TEACHER_RESOURCES");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [sub, g, f] = await Promise.all([
      fetch("/api/asignaturas"),
      fetch("/api/grupos"),
      fetch("/api/carpetas"),
    ]);
    setSubjects(await sub.json());
    setGroups(await g.json());
    setFolders(await f.json());
  }
  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { subject: Subject; group: Group; folders: Folder[] }>();
    for (const f of folders) {
      const key = `${f.subjectId}:${f.groupId}`;
      if (!map.has(key)) {
        map.set(key, { subject: f.subject, group: f.group, folders: [] });
      }
      map.get(key)!.folders.push(f);
    }
    return Array.from(map.values());
  }, [folders]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !groupId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/carpetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          kind,
          subjectId,
          groupId,
          opensAt: kind === "STUDENT_SUBMISSIONS" && opensAt ? new Date(opensAt).toISOString() : null,
          closesAt: kind === "STUDENT_SUBMISSIONS" && closesAt ? new Date(closesAt).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al crear carpeta");
      }
      setName("");
      setDescription("");
      setOpensAt("");
      setClosesAt("");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function removeFolder(id: string) {
    if (!confirm("¿Eliminar carpeta y todos sus archivos?")) return;
    await fetch(`/api/carpetas/${id}`, { method: "DELETE" });
    load();
  }

  function kindLabel(k: Folder["kind"]) {
    return k === "TEACHER_RESOURCES" ? "Recursos del profesor" : "Entregas de alumnos";
  }

  function statusBadge(f: Folder) {
    if (f.kind === "TEACHER_RESOURCES") {
      return <Badge variant="secondary">Sin plazo</Badge>;
    }
    if (f.status === "abierta") return <Badge variant="success">Abierta</Badge>;
    if (f.status === "proxima") return <Badge variant="outline">Próxima</Badge>;
    return <Badge variant="secondary">Cerrada</Badge>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Materiales</h1>
      <p className="text-sm text-gray-600">
        Organice archivos en carpetas por asignatura y grupo. Use carpetas de recursos para material
        descargable, o carpetas de entregas con plazo para que los alumnos suban trabajos.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Crear carpeta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Unidad 1 — Fracciones" />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => setKind(v as "TEACHER_RESOURCES" | "STUDENT_SUBMISSIONS")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEACHER_RESOURCES">Recursos del profesor</SelectItem>
                    <SelectItem value="STUDENT_SUBMISSIONS">Entregas de alumnos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Asignatura</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Grupo</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.grade.name} {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {kind === "STUDENT_SUBMISSIONS" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Abre (opcional)</Label>
                  <Input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Cierra (obligatorio)</Label>
                  <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading || !subjectId || !groupId || !name}>
              <FolderPlus className="mr-2 h-4 w-4" />
              {loading ? "Creando…" : "Crear carpeta"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {grouped.map((block) => (
          <div key={`${block.subject.id}:${block.group.id}`} className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-800">
              {block.subject.name} · {block.group.grade.name} {block.group.name}
            </h2>
            <div className="grid gap-3">
              {block.folders.map((f) => (
                <Card key={f.id}>
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900">{f.name}</p>
                        {statusBadge(f)}
                      </div>
                      <p className="text-sm text-gray-500">
                        {kindLabel(f.kind)} · {f._count.materials} archivo{f._count.materials === 1 ? "" : "s"}
                        {f.kind === "STUDENT_SUBMISSIONS" && f.closesAt
                          ? ` · Cierra ${new Date(f.closesAt).toLocaleString("es-PA")}`
                          : ""}
                      </p>
                      {f.description && <p className="mt-1 text-sm text-gray-600">{f.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Link href={`/profesor/materiales/${f.id}`}>
                        <Button variant="outline" size="sm">
                          <FolderOpen className="mr-2 h-4 w-4" />
                          Abrir
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => removeFolder(f.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {folders.length === 0 && (
          <p className="text-sm text-gray-500">Aún no hay carpetas. Cree una para organizar materiales.</p>
        )}
      </div>
    </div>
  );
}
