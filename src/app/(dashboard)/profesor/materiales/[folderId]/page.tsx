"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilePicker } from "@/components/ui/file-picker";
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

type RosterEntry = {
  student: { id: string; fullName: string; email?: string };
  status: "ENVIADO" | "NO_ENVIADO";
  materials: Material[];
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
  roster?: RosterEntry[];
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
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const [me, f] = await Promise.all([
      fetch("/api/auth/me", { credentials: "same-origin" }),
      fetch(`/api/carpetas/${folderId}`, { credentials: "same-origin" }),
    ]);
    const meData = await me.json().catch(() => ({}));
    setSchoolId(meData.schoolId || "");
    if (f.ok) {
      setFolder(await f.json());
    } else {
      const data = await f.json().catch(() => ({}));
      setFolder(null);
      setLoadError(data.error || "No se pudo cargar la carpeta.");
    }
  }, [folderId]);

  useEffect(() => {
    if (folderId) load();
  }, [folderId, load]);

  const roster: RosterEntry[] = useMemo(() => {
    if (Array.isArray(folder?.roster)) return folder.roster;
    return [];
  }, [folder]);

  const selectedIndex = useMemo(() => {
    if (!selectedStudentId) return -1;
    return roster.findIndex((r) => r.student.id === selectedStudentId);
  }, [roster, selectedStudentId]);

  const selectedEntry = selectedIndex >= 0 ? roster[selectedIndex] : null;

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

  function openStudent(studentId: string) {
    setSelectedStudentId(studentId);
  }

  function goPrev() {
    if (roster.length === 0 || selectedIndex < 0) return;
    const next = (selectedIndex - 1 + roster.length) % roster.length;
    setSelectedStudentId(roster[next].student.id);
  }

  function goNext() {
    if (roster.length === 0 || selectedIndex < 0) return;
    const next = (selectedIndex + 1) % roster.length;
    setSelectedStudentId(roster[next].student.id);
  }

  function backToRoster() {
    setSelectedStudentId(null);
  }

  if (loadError && !folder) {
    return (
      <div className="space-y-3">
        <Link href="/profesor/materiales" className="inline-flex items-center text-sm text-blue-700 hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a carpetas
        </Link>
        <p className="text-sm text-red-600">{loadError}</p>
        <Button size="sm" variant="outline" onClick={load}>
          Reintentar
        </Button>
      </div>
    );
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
  const isSubmissions = folder.kind === "STUDENT_SUBMISSIONS";

  // —— Student detail view (submissions) ——
  if (isSubmissions && selectedEntry) {
    const isNoEnviado = selectedEntry.status === "NO_ENVIADO";
    const studentMaterials = selectedEntry.materials || [];

    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={backToRoster}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Volver al listado
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
            <Badge variant={folder.status === "abierta" ? "success" : "outline"}>
              {folder.status === "abierta"
                ? "Abierta"
                : folder.status === "proxima"
                  ? "Próxima"
                  : "Cerrada"}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {folder.subject.name} · {folder.group.grade.name} {folder.group.name}
            {folder.closesAt
              ? ` · Plazo hasta ${new Date(folder.closesAt).toLocaleString("es-PA")}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" variant="outline" onClick={goPrev} disabled={roster.length < 2}>
            ← Anterior
          </Button>
          <p className="text-sm text-gray-500">
            Alumno {selectedIndex + 1} de {roster.length}
          </p>
          <Button size="sm" variant="outline" onClick={goNext} disabled={roster.length < 2}>
            Siguiente →
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{selectedEntry.student.fullName}</CardTitle>
              {selectedEntry.student.email && (
                <p className="text-sm text-gray-500">{selectedEntry.student.email}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isNoEnviado ? (
                <Badge variant="secondary">No enviado</Badge>
              ) : (
                <Badge variant="default">Enviado</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isNoEnviado ? (
              <p className="text-sm text-gray-600">
                Este alumno aún no ha entregado.
              </p>
            ) : (
              studentMaterials.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded border border-gray-100 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{m.title}</p>
                    <p className="truncate text-gray-500">
                      {m.fileName}
                      {m.fileSize != null ? ` · ${formatBytes(m.fileSize)}` : ""}
                      {" · "}
                      {new Date(m.createdAt).toLocaleString("es-PA")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
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
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const enviadoCount = roster.filter((r) => r.status === "ENVIADO").length;
  const noEnviadoCount = roster.length - enviadoCount;

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
                <Label htmlFor="profesor-archivo">Archivo</Label>
                <FilePicker
                  id="profesor-archivo"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt"
                  value={file}
                  onFileChange={setFile}
                  required
                  disabled={loading}
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

      {isResources && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Archivos</h2>
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
            <p className="text-sm text-gray-500">No hay archivos en esta carpeta.</p>
          )}
        </div>
      )}

      {isSubmissions && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Alumnos del grupo</h2>
            <p className="text-sm text-gray-500">
              {enviadoCount} enviado{enviadoCount === 1 ? "" : "s"} · {noEnviadoCount} no
              enviado{noEnviadoCount === 1 ? "" : "s"}
            </p>
          </div>

          {roster.length === 0 && (
            <p className="text-sm text-gray-500">
              No hay alumnos asignados a este grupo. Matricula alumnos en el grupo de la
              asignatura.
            </p>
          )}

          <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {roster.map((entry) => {
              const enviado = entry.status === "ENVIADO";
              return (
                <button
                  key={entry.student.id}
                  type="button"
                  onClick={() => openStudent(entry.student.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50 ${
                    !enviado ? "opacity-80" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">
                      {entry.student.fullName}
                    </p>
                    {entry.student.email && (
                      <p className="truncate text-sm text-gray-500">{entry.student.email}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {enviado ? (
                      <Badge variant="default">Enviado</Badge>
                    ) : (
                      <Badge variant="secondary">No enviado</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
