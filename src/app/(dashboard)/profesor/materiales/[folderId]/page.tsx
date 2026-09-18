"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { uploadMaterial } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { ArrowLeft, ExternalLink, FileUp, Trash2 } from "lucide-react";

type Material = {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileUrl: string | null;
  fileSize: number | null;
  uploadedBy: { id: string; fullName: string; role: string };
  createdAt: string;
};

type Folder = {
  id: string;
  name: string;
  description: string | null;
  kind: "TEACHER_RESOURCES" | "STUDENT_SUBMISSIONS";
  subjectId: string;
  opensAt: string | null;
  closesAt: string | null;
  status: string;
  subject: { id: string; name: string };
  group: { id: string; name: string; grade: { name: string } };
  materials: Material[];
};

export default function ProfesorCarpetaDetallePage() {
  const params = useParams();
  const folderId = String(params.folderId || "");
  const [folder, setFolder] = useState<Folder | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [me, f] = await Promise.all([
      fetch("/api/auth/me"),
      fetch(`/api/carpetas/${folderId}`),
    ]);
    const meData = await me.json();
    setSchoolId(meData.schoolId);
    if (f.ok) setFolder(await f.json());
    else setFolder(null);
  }
  useEffect(() => {
    if (folderId) load();
  }, [folderId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !folder || !schoolId) return;
    setLoading(true);
    setError("");
    try {
      const uploaded = await uploadMaterial(file, schoolId, folder.subjectId, folder.id);
      const res = await fetch("/api/materiales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          folderId: folder.id,
          subjectId: folder.subjectId,
          fileName: file.name,
          filePath: uploaded.path,
          fileUrl: uploaded.publicUrl,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error al guardar");
      setTitle("");
      setDescription("");
      setFile(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar archivo?")) return;
    await fetch(`/api/materiales/${id}`, { method: "DELETE" });
    load();
  }

  if (!folder) {
    return (
      <div className="space-y-4">
        <Link href="/profesor/materiales" className="inline-flex items-center text-sm text-blue-700 hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a carpetas
        </Link>
        <p className="text-sm text-gray-500">Cargando carpeta…</p>
      </div>
    );
  }

  const isResources = folder.kind === "TEACHER_RESOURCES";

  return (
    <div className="space-y-6">
      <Link href="/profesor/materiales" className="inline-flex items-center text-sm text-blue-700 hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" /> Volver a carpetas
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
          <Badge variant={isResources ? "secondary" : folder.status === "abierta" ? "success" : "outline"}>
            {isResources
              ? "Recursos"
              : folder.status === "abierta"
                ? "Abierta"
                : folder.status === "proxima"
                  ? "Próxima"
                  : "Cerrada"}
          </Badge>
        </div>
        <p className="text-sm text-gray-500">
          {folder.subject.name} · {folder.group.grade.name} {folder.group.name}
          {!isResources && folder.closesAt
            ? ` · Plazo hasta ${new Date(folder.closesAt).toLocaleString("es-PA")}`
            : ""}
        </p>
        {folder.description && <p className="mt-1 text-sm text-gray-600">{folder.description}</p>}
      </div>

      {isResources && (
        <Card>
          <CardHeader>
            <CardTitle>Subir archivo a esta carpeta</CardTitle>
          </CardHeader>
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
              <div className="space-y-1">
                <Label>Archivo</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading || !file}>
                <FileUp className="mr-2 h-4 w-4" />
                {loading ? "Subiendo…" : "Subir"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {isResources ? "Archivos" : "Entregas de alumnos"}
        </h2>
        {folder.materials.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-gray-900">{m.title}</p>
                <p className="text-sm text-gray-500">
                  {m.uploadedBy.fullName} · {m.fileName}
                  {m.fileSize ? ` · ${formatBytes(m.fileSize)}` : ""} ·{" "}
                  {new Date(m.createdAt).toLocaleString("es-PA")}
                </p>
              </div>
              <div className="flex gap-1">
                {m.fileUrl && (
                  <a href={m.fileUrl} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                )}
                <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {folder.materials.length === 0 && (
          <p className="text-sm text-gray-500">
            {isResources ? "No hay archivos en esta carpeta." : "Aún no hay entregas."}
          </p>
        )}
      </div>
    </div>
  );
}
