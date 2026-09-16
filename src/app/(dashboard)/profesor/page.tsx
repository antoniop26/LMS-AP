import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function ProfesorDashboard() {
  const user = await requireUser(["PROFESOR"]);
  const [assignments, materials, tests] = await Promise.all([
    prisma.teacherSubject.findMany({
      where: { teacherId: user.id },
      include: { subject: true, group: { include: { grade: true } } },
    }),
    prisma.material.count({ where: { uploadedById: user.id } }),
    prisma.test.count({ where: { creatorId: user.id } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel del profesor</h1>
        <p className="text-gray-500">Hola, {user.fullName}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-gray-500">Asignaturas</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{assignments.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-gray-500">Materiales</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{materials}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-gray-500">Exámenes</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{tests}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Mis asignaturas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {assignments.map((a) => (
            <p key={a.id} className="text-sm text-gray-700">
              {a.subject.name}{a.group ? ` · ${a.group.grade.name} ${a.group.name}` : ""}
            </p>
          ))}
          {assignments.length === 0 && <p className="text-sm text-gray-500">Sin asignaturas. Pida al admin que lo asigne.</p>}
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Link href="/profesor/materiales" className="text-blue-600 text-sm hover:underline">Subir materiales →</Link>
        <Link href="/profesor/examenes" className="text-blue-600 text-sm hover:underline">Crear exámenes →</Link>
      </div>
    </div>
  );
}
