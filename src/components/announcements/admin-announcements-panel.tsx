"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadAnnouncement } from "@/lib/storage";
import {
  AnnouncementsFeed,
  type AnnouncementItem,
} from "@/components/announcements/announcements-feed";
import { ImageIcon, Trash2 } from "lucide-react";

type Kind = "MESSAGE" | "FLYER" | "LINK";

export function AdminAnnouncementsPanel() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [kind, setKind] = useState<Kind>("MESSAGE");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");

  async function load() {
    setListError("");
    try {
      const [me, list] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/anuncios"),
      ]);
      if (me.ok) {
        const meData = await me.json();
        setSchoolId(meData.schoolId || "");
      }
      if (!list.ok) throw new Error((await list.json()).error || "Error al cargar");
      setItems(await list.json());
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : "Error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setTitle("");
    setBody("");
    setLinkUrl("");
    setFile(null);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let fileMeta: {
        fileName?: string;
        filePath?: string;
        fileUrl?: string;
        mimeType?: string;
      } = {};

      if (kind === "FLYER") {
        if (!file) throw new Error("Seleccione un archivo (imagen o PDF)");
        if (!schoolId) throw new Error("No se pudo determinar el colegio");
        const uploaded = await uploadAnnouncement(file, schoolId);
        fileMeta = {
          fileName: file.name,
          filePath: uploaded.path,
          fileUrl: uploaded.publicUrl,
          mimeType: file.type || "application/octet-stream",
        };
      }

      const res = await fetch("/api/anuncios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          body: body || null,
          linkUrl: kind === "LINK" ? linkUrl : null,
          ...fileMeta,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error al publicar");
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este comunicado?")) return;
    const res = await fetch(`/api/anuncios/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo eliminar");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Comunicados</CardTitle>
          <p className="text-sm text-gray-500">
            Publique mensajes, flyers (imagen/PDF) o enlaces para toda la escuela.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ann-kind">Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                  <SelectTrigger id="ann-kind">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MESSAGE">Mensaje</SelectItem>
                    <SelectItem value="FLYER">Flyer (imagen/PDF)</SelectItem>
                    <SelectItem value="LINK">Enlace</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-title">Título</Label>
                <Input
                  id="ann-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Ej. Reunión de padres"
                />
              </div>
            </div>

            {(kind === "MESSAGE" || kind === "LINK" || kind === "FLYER") && (
              <div className="space-y-2">
                <Label htmlFor="ann-body">
                  {kind === "MESSAGE" ? "Mensaje" : "Nota (opcional)"}
                </Label>
                <Textarea
                  id="ann-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required={kind === "MESSAGE"}
                  placeholder={
                    kind === "MESSAGE"
                      ? "Escriba el comunicado…"
                      : "Texto adicional opcional…"
                  }
                  rows={4}
                />
              </div>
            )}

            {kind === "LINK" && (
              <div className="space-y-2">
                <Label htmlFor="ann-link">URL del enlace</Label>
                <Input
                  id="ann-link"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  required
                  placeholder="https://…"
                />
              </div>
            )}

            {kind === "FLYER" && (
              <div className="mx-auto w-full max-w-lg space-y-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 px-6 py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                  <ImageIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ann-file" className="text-base text-gray-900">
                    Publicar flyer
                  </Label>
                  <p className="text-sm text-gray-500">
                    Suba una imagen o PDF. Se mostrará centrado para profesores y alumnos.
                  </p>
                </div>
                <Input
                  id="ann-file"
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                  className="mx-auto max-w-sm cursor-pointer bg-white"
                />
                {file && (
                  <p className="truncate text-sm font-medium text-blue-800">
                    Archivo seleccionado: {file.name}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className={`text-sm text-red-600 ${kind === "FLYER" ? "text-center" : ""}`}>
                {error}
              </p>
            )}

            <div className={kind === "FLYER" ? "flex justify-center" : ""}>
              <Button type="submit" disabled={loading}>
                {loading ? "Publicando…" : "Publicar comunicado"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {listError && <p className="text-sm text-red-600">{listError}</p>}

      <div className="space-y-3">
        <AnnouncementsFeed
          title="Comunicados publicados"
          emptyMessage="Aún no hay comunicados."
          initialItems={items}
        />
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Administrar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{a.title}</p>
                    <p className="text-xs text-gray-500">
                      {a.kind === "MESSAGE" ? "Mensaje" : a.kind === "FLYER" ? "Flyer" : "Enlace"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(a.id)}
                    aria-label={`Eliminar ${a.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
