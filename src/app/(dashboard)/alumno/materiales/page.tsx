"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { uploadMaterial } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { Download, ExternalLink, FileUp, FolderOpen } from "lucide-react";

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
  _count: { materials: number };
};

type Material = {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string | null;
  fileSize: number | null;
  folderId: string | null;
  uploadedBy?: { fullName: string };
  subject?: { name: string };
};

export default function AlumnoMaterialesPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [materialsByFolder, setMaterialsByFolder] = useState<Record<string, Material[]>>({});
  const [schoolId, setSchoolId] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [me, f] = await Promise.all([fetch("/api/auth/me"), fetch("/api/carpetas")]);
    const meData = await me.json();
    setSchoolId(meData.schoolId);
    const folderList: Folder[] = await f.json();
    setFolders(folderList);

    const entries = await Promise.all(
      folderList.map(async (folder) => {
        const res = await fetch(`/api/materiales?folderId=${folder.id}`);
        const mats = res.ok ? await res.json() : [];
        return [folder.id, mats] as const;
      })
    );
    setMaterialsByFolder(Object.fromEntries(entries));
  }
  useEffect(() => {
    load();
  }, []);

  const resourceFolders = useMemo(
    () => folders.filter((f) => f.kind === "TEACHER_RESOURCES"),
    [folders]
  );
  const submissionFolders = useMemo(
    () => folders.filter((f) => f.kind === "STUDENT_SUBMISSIONS"),
    [folders]
  );
  const selected = folders.find((f) => f.id === selectedFolderId) || null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selected || selected.status !== "abierta") return;
    setLoading(true);
    setError("");
    try {
      const uploaded = await uploadMaterial(file, schoolId, selected.subjectId, selected.id);
      const res = await fetch("/api/materiales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          folderId: selected.id,
          subjectId: selected.subjectId,
          fileName: file.name,
          filePath: uploaded.path,
          fileUrl: uploaded.publicUrl,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      setTitle("");
      setFile(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function statusBadge(status: string) {
    if (status === "abierta") return <Badge variant="success">Abierta</Badge>;
    if (status === "proxima") return <Badge variant="outline">Próxima</Badge>;
    return <Badge variant="secondary">Cerrada</Badge>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Materiales</h1>
        <p className="text-sm text-gray-600">
          Descargue recursos del profesor y entregue trabajos en carpetas abiertas.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-blue-800">Recursos del profesor</h2>
        {resourceFolders.map((f) => (
          <Card key={f.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <FolderOpen className="h-4 w-4 text-blue-600" />
                {f.name}
                <span className="text-sm font-normal text-gray-500">
                  {f.subject.name} · {f.group.grade.name} {f.group.name}
                </span>
              </CardTitle>
              {f.description && <p className="text-sm text-gray-600">{f.description}</p>}
            </CardHeader>
            <CardContent className="grid gap-2">
              {(materialsByFolder[f.id] || []).map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.title}</p>
                    <p className="text-xs text-gray-500">
                      {m.fileName}
                      {m.fileSize ? ` · ${formatBytes(m.fileSize)}` : ""}
                    </p>
                  </div>
                  {m.fileUrl && (
                    <a href={m.fileUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Descargar
                      </Button>
                    </a>
                  )}
                </div>
              ))}
              {(materialsByFolder[f.id] || []).length === 0 && (
                <p className="text-sm text-gray-500">Sin archivos todavía.</p>
              )}
            </CardContent>
          </Card>
        ))}
        {resourceFolders.length === 0 && (
          <p className="text-sm text-gray-500">No hay carpetas de recursos para sus grupos.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-blue-800">Entregas</h2>
        {submissionFolders.map((f) => (
          <Card key={f.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{f.name}</p>
                    {statusBadge(f.status)}
                  </div>
                  <p className="text-sm text-gray-500">
                    {f.subject.name} · {f.group.grade.name} {f.group.name}
                    {f.closesAt ? ` · Cierra ${new Date(f.closesAt).toLocaleString("es-PA")}` : ""}
                    {f.opensAt ? ` · Abre ${new Date(f.opensAt).toLocaleString("es-PA")}` : ""}
                  </p>
                  {f.description && <p className="mt-1 text-sm text-gray-600">{f.description}</p>}
                </div>
                {f.status === "abierta" && (
                  <Button
                    variant={selectedFolderId === f.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFolderId(selectedFolderId === f.id ? null : f.id)}
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    {selectedFolderId === f.id ? "Cancelar" : "Entregar"}
                  </Button>
                )}
              </div>

              {(materialsByFolder[f.id] || []).length > 0 && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mis entregas</p>
                  {(materialsByFolder[f.id] || []).map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span>
                        {m.title} · {m.fileName}
                        {m.fileSize ? ` · ${formatBytes(m.fileSize)}` : ""}
                      </span>
                      {m.fileUrl && (
                        <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                          <ExternalLink className="inline h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedFolderId === f.id && f.status === "abierta" && (
                <form onSubmit={submit} className="grid gap-3 rounded-md border border-blue-100 bg-blue-50/40 p-3">
                  <div className="space-y-1">
                    <Label>Título</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Archivo</Label>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button type="submit" disabled={loading || !file}>
                    <FileUp className="mr-2 h-4 w-4" />
                    {loading ? "Subiendo…" : "Enviar entrega"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
        {submissionFolders.length === 0 && (
          <p className="text-sm text-gray-500">No hay carpetas de entrega asignadas.</p>
        )}
      </section>
    </div>
  );
}
