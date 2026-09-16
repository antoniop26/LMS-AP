"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadMaterial } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { ExternalLink, FileUp } from "lucide-react";

export default function AlumnoMaterialesPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [me, m, s] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/materiales"),
      fetch("/api/asignaturas"),
    ]);
    const meData = await me.json();
    setSchoolId(meData.schoolId);
    setMaterials(await m.json());
    setSubjects(await s.json());
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !subjectId) return;
    setLoading(true);
    setError("");
    try {
      const uploaded = await uploadMaterial(file, schoolId, subjectId);
      const res = await fetch("/api/materiales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subjectId,
          fileName: file.name,
          filePath: uploaded.path,
          fileUrl: uploaded.publicUrl,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      setTitle(""); setFile(null); load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Materiales</h1>

      <Card>
        <CardHeader><CardTitle>Subir mi material</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Asignatura</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Archivo</Label>
              <Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading || !file || !subjectId}>
              <FileUp className="mr-2 h-4 w-4" />
              {loading ? "Subiendo…" : "Subir"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">Materiales disponibles</h2>
        {materials.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-gray-900">{m.title}</p>
                <p className="text-sm text-gray-500">
                  {m.subject?.name} · {m.uploadedBy?.fullName} · {m.fileName}
                  {m.fileSize ? ` · ${formatBytes(m.fileSize)}` : ""}
                </p>
              </div>
              {m.fileUrl && (
                <a href={m.fileUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm"><ExternalLink className="mr-2 h-4 w-4" />Abrir</Button>
                </a>
              )}
            </CardContent>
          </Card>
        ))}
        {materials.length === 0 && <p className="text-sm text-gray-500">No hay materiales todavía.</p>}
      </div>
    </div>
  );
}
