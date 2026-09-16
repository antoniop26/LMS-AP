import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AlumnoDashboard() {
  const user = await requireUser(["ALUMNO"]);
  const groups = await prisma.studentGroup.findMany({
    where: { studentId: user.id },
    include: { group: { include: { grade: true } } },
  });
  const groupIds = groups.map((g) => g.groupId);

  const [materials, tests, attempts] = await Promise.all([
    prisma.material.count({
      where: {
        subject: { schoolId: user.schoolId },
        OR: [{ groupId: null }, { groupId: { in: groupIds } }],
      },
    }),
    prisma.test.count({
      where: {
        published: true,
        subject: { schoolId: user.schoolId },
        OR: [{ groupId: null }, { groupId: { in: groupIds } }],
      },
    }),
    prisma.testAttempt.count({ where: { studentId: user.id, status: { in: ["SUBMITTED", "GRADED"] } } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel del alumno</h1>
        <p className="text-gray-500">Hola, {user.fullName}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-gray-500">Materiales</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{materials}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-gray-500">Exámenes</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{tests}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-gray-500">Entregados</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{attempts}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Mis grupos</CardTitle></CardHeader>
        <CardContent>
          {groups.map((g) => (
            <p key={g.id} className="text-sm text-gray-700">{g.group.grade.name} — Grupo {g.group.name}</p>
          ))}
          {groups.length === 0 && <p className="text-sm text-gray-500">Aún no está asignado a un grupo.</p>}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/alumno/materiales" className="text-blue-600 hover:underline">Ver / subir materiales →</Link>
        <Link href="/alumno/examenes" className="text-blue-600 hover:underline">Presentar exámenes →</Link>
        <Link href="/alumno/calificaciones" className="text-blue-600 hover:underline">Ver calificaciones →</Link>
      </div>
    </div>
  );
}
