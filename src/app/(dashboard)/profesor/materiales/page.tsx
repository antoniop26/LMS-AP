"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadMaterial } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { FileUp, ExternalLink, Trash2 } from "lucide-react";

type Subject = { id: string; name: string };
type Group = { id: string; name: string; grade: { name: string } };
type Material = {
  id: string; title: string; description: string | null; fileName: string;
  fileUrl: string | null; filePath: string; mimeType: string; fileSize: number | null;
  subject: Subject; group: Group | null;
};

export default function ProfesorMaterialesPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [me, sub, g, m] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/asignaturas"),
      fetch("/api/grupos"),
      fetch("/api/materiales"),
    ]);
    const meData = await me.json();
    setSchoolId(meData.schoolId);
    setSubjects(await sub.json());
    setGroups(await g.json());
    setMaterials(await m.json());
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !subjectId || !schoolId) return;
    setLoading(true);
    setError("");
    try {
      const uploaded = await uploadMaterial(file, schoolId, subjectId);
      const res = await fetch("/api/materiales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          subjectId,
          groupId: groupId || null,
          fileName: file.name,
          filePath: uploaded.path,
          fileUrl: uploaded.publicUrl,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      setTitle(""); setDescription(""); setFile(null);
      load();
    } catch (err: any) {
      setError(err.message || "Error al subir");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar material?")) return;
    await fetch(`/api/materiales/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Materiales</h1>
      <Card>
        <CardHeader><CardTitle>Subir archivo</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Asignatura</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Grupo (opcional)</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.grade.name} {g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Archivo (PDF, imágenes, docs)</Label>
              <Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading || !file || !subjectId}>
              <FileUp className="mr-2 h-4 w-4" />
              {loading ? "Subiendo…" : "Subir material"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {materials.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-gray-900">{m.title}</p>
                <p className="text-sm text-gray-500">{m.subject.name} · {m.fileName}{m.fileSize ? ` · ${formatBytes(m.fileSize)}` : ""}</p>
              </div>
              <div className="flex gap-1">
                {m.fileUrl && (
                  <a href={m.fileUrl} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                  </a>
                )}
                <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
