"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

type User = { id: string; fullName: string; email: string };
type Subject = { id: string; name: string };
type Group = { id: string; name: string; grade: { name: string } };

export default function AsignacionesPage() {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<any[]>([]);
  const [studentGroups, setStudentGroups] = useState<any[]>([]);
  const [tab, setTab] = useState<"teacher" | "student">("teacher");

  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentGroupId, setStudentGroupId] = useState("");
  const [teacherNameQuery, setTeacherNameQuery] = useState("");
  const [studentNameQuery, setStudentNameQuery] = useState("");

  async function load() {
    const [t, s, sub, g, a] = await Promise.all([
      fetch("/api/usuarios?role=PROFESOR"),
      fetch("/api/usuarios?role=ALUMNO"),
      fetch("/api/asignaturas"),
      fetch("/api/grupos"),
      fetch("/api/asignaciones"),
    ]);
    setTeachers(await t.json());
    setStudents(await s.json());
    setSubjects(await sub.json());
    setGroups(await g.json());
    const asg = await a.json();
    setTeacherSubjects(asg.teacherSubjects || []);
    setStudentGroups(asg.studentGroups || []);
  }
  useEffect(() => {
    load();
  }, []);

  const filteredTeacherSubjects = useMemo(() => {
    const q = teacherNameQuery.trim().toLowerCase();
    if (!q) return teacherSubjects;
    return teacherSubjects.filter((row) =>
      String(row.teacher?.fullName || "")
        .toLowerCase()
        .includes(q)
    );
  }, [teacherSubjects, teacherNameQuery]);

  const filteredStudentGroups = useMemo(() => {
    const q = studentNameQuery.trim().toLowerCase();
    if (!q) return studentGroups;
    return studentGroups.filter((row) =>
      String(row.student?.fullName || "")
        .toLowerCase()
        .includes(q)
    );
  }, [studentGroups, studentNameQuery]);

  const availableStudents = useMemo(() => {
    const assignedIds = new Set(
      studentGroups.map((row) => String(row.studentId || row.student?.id || ""))
    );
    return students.filter((s) => !assignedIds.has(s.id));
  }, [students, studentGroups]);

  useEffect(() => {
    if (studentId && !availableStudents.some((s) => s.id === studentId)) {
      setStudentId("");
    }
  }, [availableStudents, studentId]);

  async function assignTeacher(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/asignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "teacher", teacherId, subjectId, groupId: groupId || null }),
    });
    load();
  }

  async function assignStudent(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/asignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "student", studentId, groupId: studentGroupId }),
    });
    load();
  }

  async function remove(type: string, id: string) {
    await fetch(`/api/asignaciones?type=${type}&id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Asignaciones</h1>
      <div className="flex gap-2">
        <Button variant={tab === "teacher" ? "default" : "outline"} onClick={() => setTab("teacher")}>
          Profesores → Asignaturas
        </Button>
        <Button variant={tab === "student" ? "default" : "outline"} onClick={() => setTab("student")}>
          Alumnos → Grupos
        </Button>
      </div>

      {tab === "teacher" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Asignar profesor</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={assignTeacher} className="grid gap-3 sm:grid-cols-4 sm:items-end">
                <div className="space-y-1">
                  <Label>Profesor</Label>
                  <Select value={teacherId} onValueChange={setTeacherId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.fullName}
                        </SelectItem>
                      ))}
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
                  <Label>Grupo (opcional)</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
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
                <Button type="submit" disabled={!teacherId || !subjectId}>
                  Asignar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Buscar profesores asignados</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="teacher-assign-filter" className="sr-only">
                Filtrar por nombre de profesor
              </Label>
              <Input
                id="teacher-assign-filter"
                placeholder="Filtrar por nombre del profesor…"
                value={teacherNameQuery}
                onChange={(e) => setTeacherNameQuery(e.target.value)}
              />
              <p className="mt-2 text-xs text-gray-500">
                {filteredTeacherSubjects.length} de {teacherSubjects.length} asignación
                {teacherSubjects.length === 1 ? "" : "es"}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-2">
            {filteredTeacherSubjects.map((row) => (
              <Card key={row.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <p className="text-sm">
                    <span className="font-medium">{row.teacher.fullName}</span> → {row.subject.name}
                    {row.group ? ` · ${row.group.grade.name} ${row.group.name}` : ""}
                  </p>
                  <Button variant="ghost" size="icon" onClick={() => remove("teacher", row.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {filteredTeacherSubjects.length === 0 && (
              <p className="text-sm text-gray-500">
                {teacherSubjects.length === 0
                  ? "No hay profesores asignados."
                  : "Ninguna asignación coincide con esa búsqueda."}
              </p>
            )}
          </div>
        </>
      )}

      {tab === "student" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Asignar alumno a grupo</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={assignStudent} className="grid gap-3 sm:grid-cols-3 sm:items-end">
                <div className="space-y-1">
                  <Label>Alumno</Label>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStudents.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-gray-500">
                          Todos los alumnos ya tienen grupo
                        </div>
                      ) : (
                        availableStudents.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.fullName}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {availableStudents.length === 0 && (
                    <p className="text-xs text-gray-500">No quedan alumnos sin asignar.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Grupo</Label>
                  <Select value={studentGroupId} onValueChange={setStudentGroupId}>
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
                <Button type="submit" disabled={!studentId || !studentGroupId}>
                  Asignar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Buscar alumnos asignados</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="student-assign-filter" className="sr-only">
                Filtrar por nombre de alumno
              </Label>
              <Input
                id="student-assign-filter"
                placeholder="Filtrar por nombre del alumno…"
                value={studentNameQuery}
                onChange={(e) => setStudentNameQuery(e.target.value)}
              />
              <p className="mt-2 text-xs text-gray-500">
                {filteredStudentGroups.length} de {studentGroups.length} asignación
                {studentGroups.length === 1 ? "" : "es"}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-2">
            {filteredStudentGroups.map((row) => (
              <Card key={row.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <p className="text-sm">
                    <span className="font-medium">{row.student.fullName}</span> → {row.group.grade.name}{" "}
                    {row.group.name}
                  </p>
                  <Button variant="ghost" size="icon" onClick={() => remove("student", row.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {filteredStudentGroups.length === 0 && (
              <p className="text-sm text-gray-500">
                {studentGroups.length === 0
                  ? "No hay alumnos asignados a grupos."
                  : "Ninguna asignación coincide con esa búsqueda."}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
