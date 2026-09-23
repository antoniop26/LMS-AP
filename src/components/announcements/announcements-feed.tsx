"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Image as ImageIcon, Link2, Megaphone } from "lucide-react";

export type AnnouncementItem = {
  id: string;
  kind: "MESSAGE" | "FLYER" | "LINK";
  title: string;
  body: string | null;
  linkUrl: string | null;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string; role: string };
};

const KIND_LABEL: Record<AnnouncementItem["kind"], string> = {
  MESSAGE: "Mensaje",
  FLYER: "Flyer",
  LINK: "Enlace",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-PA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function isImageMime(mime: string | null, fileName: string | null) {
  if (mime?.startsWith("image/")) return true;
  return !!fileName?.match(/\.(png|jpe?g|gif|webp)$/i);
}

type Props = {
  title?: string;
  emptyMessage?: string;
  /** When provided, skips client fetch and renders this list */
  initialItems?: AnnouncementItem[];
  className?: string;
};

export function AnnouncementsFeed({
  title = "Comunicados de la escuela",
  emptyMessage = "No hay comunicados publicados por ahora.",
  initialItems,
  className,
}: Props) {
  const [items, setItems] = useState<AnnouncementItem[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!initialItems);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/anuncios");
        if (!res.ok) throw new Error((await res.json()).error || "Error al cargar");
        const data = await res.json();
        if (!cancelled) setItems(data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialItems]);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Megaphone className="h-5 w-5 text-blue-600" />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-gray-500">Cargando comunicados…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        )}
        {items.map((a) => (
          <article
            key={a.id}
            className={
              a.kind === "FLYER"
                ? "rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-5 shadow-sm"
                : "rounded-lg border border-gray-200 bg-gray-50/60 p-4"
            }
          >
            {a.kind === "FLYER" ? (
              <div className="mb-3 flex flex-col items-center gap-2 text-center">
                <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                  {KIND_LABEL[a.kind]}
                </Badge>
                <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                <p className="text-xs text-gray-500">
                  {formatDate(a.createdAt)}
                  {a.createdBy ? ` · ${a.createdBy.fullName}` : ""}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                    {KIND_LABEL[a.kind]}
                  </Badge>
                  <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                </div>
                <p className="mb-2 text-xs text-gray-500">
                  {formatDate(a.createdAt)}
                  {a.createdBy ? ` · ${a.createdBy.fullName}` : ""}
                </p>
              </>
            )}

            {a.kind === "MESSAGE" && a.body && (
              <p className="whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>
            )}

            {a.kind === "LINK" && a.linkUrl && (
              <div className="space-y-1">
                {a.body && <p className="whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>}
                <a
                  href={a.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  <Link2 className="h-4 w-4" />
                  {a.linkUrl}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {a.kind === "FLYER" && (
              <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3">
                {a.body && (
                  <p className="w-full whitespace-pre-wrap text-center text-sm text-gray-700">
                    {a.body}
                  </p>
                )}
                {a.fileUrl && isImageMime(a.mimeType, a.fileName) ? (
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.fileUrl}
                      alt={a.title}
                      className="mx-auto max-h-[28rem] w-full rounded-lg border border-gray-200 bg-white object-contain shadow-sm"
                    />
                  </a>
                ) : a.fileUrl ? (
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50"
                  >
                    <FileText className="h-5 w-5" />
                    {a.fileName || "Abrir PDF"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="inline-flex items-center gap-1 text-sm text-gray-500">
                    <ImageIcon className="h-4 w-4" /> Archivo no disponible
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
