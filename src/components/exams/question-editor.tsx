"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { sumQuestionPoints } from "@/lib/test-points";

export type EditableQuestion = {
  /** Clave local estable para React (no se envía al servidor). */
  key: string;
  /** Id en BD si la pregunta ya existe (edición). */
  id?: string;
  prompt: string;
  type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "LONG_ANSWER";
  points: number;
  correctText?: string;
  options: { id?: string; text: string; isCorrect: boolean }[];
};

let keySeq = 0;
export function newQuestionKey() {
  keySeq += 1;
  return `q-${Date.now().toString(36)}-${keySeq}`;
}

export function blankQuestion(type: EditableQuestion["type"] = "MULTIPLE_CHOICE"): EditableQuestion {
  return {
    key: newQuestionKey(),
    prompt: "",
    type,
    points: 1,
    options: type === "MULTIPLE_CHOICE" ? [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] : [],
  };
}

/** Convierte preguntas del API (vista profesor) al formato del editor. */
export function toEditable(questions: any[]): EditableQuestion[] {
  return (questions || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((q) => ({
      key: newQuestionKey(),
      id: q.id,
      prompt: q.prompt ?? "",
      type: q.type,
      points: Number(q.points) || 0,
      correctText: q.correctText ?? "",
      options: (q.options || [])
        .slice()
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((o: any) => ({ id: o.id, text: o.text ?? "", isCorrect: Boolean(o.isCorrect) })),
    }));
}

/** Payload para el API (sin la clave local). */
export function toPayload(questions: EditableQuestion[]) {
  return questions.map(({ key: _key, ...q }) => ({
    ...q,
    correctText: q.type === "SHORT_ANSWER" ? q.correctText || null : null,
    options: q.type === "MULTIPLE_CHOICE" ? q.options : [],
  }));
}

export function QuestionEditor({
  questions,
  onChange,
}: {
  questions: EditableQuestion[];
  onChange: (next: EditableQuestion[]) => void;
}) {
  const totalPoints = sumQuestionPoints(questions);

  function updateQ(i: number, patch: Partial<EditableQuestion>) {
    onChange(questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = questions.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function changeType(i: number, type: EditableQuestion["type"]) {
    const q = questions[i];
    if (q.type === type) return;
    updateQ(i, {
      type,
      options:
        type === "MULTIPLE_CHOICE"
          ? q.options.length >= 2
            ? q.options
            : [{ text: "", isCorrect: true }, { text: "", isCorrect: false }]
          : q.options,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Preguntas</h3>
          <p className="text-sm font-semibold text-blue-700" data-testid="exam-total-points">
            Total: {totalPoints} {totalPoints === 1 ? "punto" : "puntos"}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...questions, blankQuestion("SHORT_ANSWER")])}>
          Añadir pregunta
        </Button>
      </div>
      {questions.length === 0 && (
        <p className="text-sm text-red-600">Agregue al menos una pregunta.</p>
      )}
      {questions.map((q, i) => (
        <Card key={q.key} className="border-dashed" data-testid="question-card">
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-500">{i + 1}.</span>
              <Select value={q.type} onValueChange={(v: any) => changeType(i, v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MULTIPLE_CHOICE">Opción múltiple</SelectItem>
                  <SelectItem value="SHORT_ANSWER">Respuesta corta</SelectItem>
                  <SelectItem value="LONG_ANSWER">Respuesta larga</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="w-24"
                value={q.points}
                onChange={(e) => updateQ(i, { points: e.target.value === "" ? 0 : Number(e.target.value) })}
                min={0.5}
                step={0.5}
                required
                aria-label="Puntos"
              />
              <span className="text-xs text-gray-500">pts</span>
              <div className="ml-auto flex gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Bajar" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Eliminar pregunta" onClick={() => onChange(questions.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
            <Textarea placeholder="Enunciado de la pregunta" value={q.prompt} onChange={(e) => updateQ(i, { prompt: e.target.value })} required />
            {q.type === "MULTIPLE_CHOICE" && (
              <div className="space-y-2">
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.key}`}
                      aria-label={`Correcta ${oi + 1}`}
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Quitar opción"
                      disabled={q.options.length <= 2}
                      onClick={() => {
                        let options = q.options.filter((_, idx) => idx !== oi);
                        if (!options.some((x) => x.isCorrect) && options.length) {
                          options = options.map((x, idx) => ({ ...x, isCorrect: idx === 0 }));
                        }
                        updateQ(i, { options });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </Button>
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
  );
}
