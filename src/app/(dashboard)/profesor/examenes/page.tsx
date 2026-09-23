"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { examWindowStatus } from "@/lib/exam-window";

type Q = {
  prompt: string;
  type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "LONG_ANSWER";
  points: number;
  correctText?: string;
  options: { text: string; isCorrect: boolean }[];
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProfesorExamenesPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [published, setPublished] = useState(true);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [questions, setQuestions] = useState<Q[]>([
    { prompt: "", type: "MULTIPLE_CHOICE", points: 1, options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] },
  ]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOpensAt, setEditOpensAt] = useState("");
  const [editClosesAt, setEditClosesAt] = useState("");
  const [savingWindow, setSavingWindow] = useState(false);

  async function load() {
    const [t, s, g] = await Promise.all([
      fetch("/api/examenes"),
      fetch("/api/asignaturas"),
      fetch("/api/grupos"),
    ]);
    setTests(await t.json());
    setSubjects(await s.json());
    setGroups(await g.json());
  }
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { subject: any; group: any | null; tests: any[] }>();
    for (const t of tests) {
      if (!t || !t.subject) continue;
      const key = `${t.subjectId}:${t.groupId || "all"}`;
      if (!map.has(key)) {
        map.set(key, { subject: t.subject, group: t.group || null, tests: [] });
      }
      map.get(key)!.tests.push(t);
    }
    return Array.from(map.values()).sort((a, b) => {
      const an = `${a.subject?.name || ""} ${a.group?.grade?.name || ""} ${a.group?.name || ""}`;
      const bn = `${b.subject?.name || ""} ${b.group?.grade?.name || ""} ${b.group?.name || ""}`;
      return an.localeCompare(bn, "es");
    });
  }, [tests]);

  function groupHeading(block: { subject: any; group: any | null }) {
    if (block.group) {
      return `${block.subject.name} · ${block.group.grade.name} ${block.group.name}`;
    }
    return `${block.subject.name} · Todos los grupos`;
  }

  function windowBadge(t: any) {
    if (!t.published) return <Badge variant="secondary">Borrador</Badge>;
    const window = examWindowStatus(t.opensAt, t.closesAt);
    if (!window.open && window.reason === "not_open") {
      return <Badge variant="outline">Próxima</Badge>;
    }
    if (!window.open && window.reason === "closed") {
      return <Badge variant="secondary">Cerrada</Badge>;
    }
    if (!t.opensAt && !t.closesAt) {
      return <Badge variant="secondary">Sin plazo</Badge>;
    }
    return <Badge variant="success">Abierta</Badge>;
  }

  function updateQ(i: number, patch: Partial<Q>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/examenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        subjectId,
        groupId: groupId || null,
        published,
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        questions,
      }),
    });
    setShowForm(false);
    setTitle("");
    setDescription("");
    setOpensAt("");
    setClosesAt("");
    setQuestions([{ prompt: "", type: "MULTIPLE_CHOICE", points: 1, options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] }]);
    setLoading(false);
    load();
  }

  async function togglePublish(id: string, current: boolean) {
    await fetch(`/api/examenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !current }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar examen?")) return;
    await fetch(`/api/examenes/${id}`, { method: "DELETE" });
    load();
  }

  function startEditWindow(t: any) {
    setEditingId(t.id);
    setEditOpensAt(toLocalInput(t.opensAt));
    setEditClosesAt(toLocalInput(t.closesAt));
  }

  async function saveWindow(id: string) {
    setSavingWindow(true);
    await fetch(`/api/examenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opensAt: editOpensAt ? new Date(editOpensAt).toISOString() : null,
        closesAt: editClosesAt ? new Date(editClosesAt).toISOString() : null,
      }),
    });
    setEditingId(null);
    setSavingWindow(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Exámenes</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? "Cancelar" : "Nuevo examen"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Crear examen en línea</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Descripción</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Asignatura</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Grupo (opcional)</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>{groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.grade.name} {g.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Disponible desde</Label>
                  <Input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Disponible hasta</Label>
                  <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                </div>
                <p className="text-xs text-gray-500 sm:col-span-2">
                  Opcional. Si deja vacío un lado, no hay límite en esa fecha.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Preguntas</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setQuestions((q) => [...q, { prompt: "", type: "SHORT_ANSWER", points: 1, options: [] }])}>
                    Añadir pregunta
                  </Button>
                </div>
                {questions.map((q, i) => (
                  <Card key={i} className="border-dashed">
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex gap-2">
                        <Select value={q.type} onValueChange={(v: any) => updateQ(i, { type: v, options: v === "MULTIPLE_CHOICE" ? [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] : [] })}>
                          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MULTIPLE_CHOICE">Opción múltiple</SelectItem>
                            <SelectItem value="SHORT_ANSWER">Respuesta corta</SelectItem>
                            <SelectItem value="LONG_ANSWER">Respuesta larga</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="number" className="w-24" value={q.points} onChange={(e) => updateQ(i, { points: Number(e.target.value) })} min={0.5} step={0.5} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <Textarea placeholder="Enunciado de la pregunta" value={q.prompt} onChange={(e) => updateQ(i, { prompt: e.target.value })} required />
                      {q.type === "MULTIPLE_CHOICE" && (
                        <div className="space-y-2">
                          {q.options.map((o, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${i}`}
                                checked={o.isCorrect}
                                onChange={() => updateQ(i, { options: q.options.map((opt, idx) => ({ ...opt, isCorrect: idx === oi })) })}
                              />
                              <Input
                                placeholder={`Opción ${oi + 1}`}
                                value={o.text}
                                onChange={(e) => {
                                  const options = [...q.options];
                                  options[oi] = { ...options[oi], text: e.target.value };
                                  updateQ(i, { options });
                                }}
                                required
                              />
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" onClick={() => updateQ(i, { options: [...q.options, { text: "", isCorrect: false }] })}>
                            + Opción
                          </Button>
                        </div>
                      )}
                      {q.type === "SHORT_ANSWER" && (
                        <Input placeholder="Respuesta correcta (auto-califica)" value={q.correctText || ""} onChange={(e) => updateQ(i, { correctText: e.target.value })} />
                      )}
                      {q.type === "LONG_ANSWER" && (
                        <p className="text-xs text-gray-500">Se califica manualmente por el profesor.</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                Publicar inmediatamente
              </label>
              <Button type="submit" disabled={loading || !subjectId || !title}>Crear examen</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {grouped.map((block) => (
          <div key={`${block.subject.id}:${block.group?.id || "all"}`} className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-800">
              {groupHeading(block)}
            </h2>
            <div className="grid gap-3">
              {block.tests.map((t) => (
                <Card key={t.id}>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">{t.title}</p>
                          {windowBadge(t)}
                        </div>
                        <p className="text-sm text-gray-500">
                          {t._count?.questions || 0} pregunta{(t._count?.questions || 0) === 1 ? "" : "s"}
                          {" · "}
                          {t._count?.attempts || 0} intento{(t._count?.attempts || 0) === 1 ? "" : "s"}
                          {t.opensAt
                            ? ` · Abre ${new Date(t.opensAt).toLocaleString("es-PA")}`
                            : ""}
                          {t.closesAt
                            ? ` · Cierra ${new Date(t.closesAt).toLocaleString("es-PA")}`
                            : ""}
                        </p>
                        {t.description && (
                          <p className="mt-1 text-sm text-gray-600">{t.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link href={`/profesor/examenes/${t.id}`}>
                          <Button variant="outline" size="sm">Ver / Calificar</Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => (editingId === t.id ? setEditingId(null) : startEditWindow(t))}>
                          {editingId === t.id ? "Cancelar plazos" : "Editar plazos"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => togglePublish(t.id, t.published)}>
                          {t.published ? "Ocultar" : "Publicar"}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    {editingId === t.id && (
                      <div className="grid gap-3 rounded-md border border-dashed border-gray-200 p-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Disponible desde</Label>
                          <Input type="datetime-local" value={editOpensAt} onChange={(e) => setEditOpensAt(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Disponible hasta</Label>
                          <Input type="datetime-local" value={editClosesAt} onChange={(e) => setEditClosesAt(e.target.value)} />
                        </div>
                        <div className="sm:col-span-2">
                          <Button size="sm" disabled={savingWindow} onClick={() => saveWindow(t.id)}>
                            {savingWindow ? "Guardando…" : "Guardar plazos"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {tests.length === 0 && (
          <p className="text-sm text-gray-500">Aún no hay exámenes. Cree uno para asignarlo a una asignatura y grupo.</p>
        )}
      </div>
    </div>
  );
}
