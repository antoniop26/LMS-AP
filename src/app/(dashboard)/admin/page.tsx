import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap, Users, ClipboardList } from "lucide-react";
import Link from "next/link";
import { AdminAnnouncementsPanel } from "@/components/announcements/admin-announcements-panel";

export default async function AdminDashboard() {
  const user = await requireUser(["ADMINISTRADOR"]);
  const [grades, groups, subjects, teachers, students, tests] = await Promise.all([
    prisma.grade.count({ where: { schoolId: user.schoolId } }),
    prisma.group.count({ where: { grade: { schoolId: user.schoolId } } }),
    prisma.subject.count({ where: { schoolId: user.schoolId } }),
    prisma.user.count({ where: { schoolId: user.schoolId, role: "PROFESOR" } }),
    prisma.user.count({ where: { schoolId: user.schoolId, role: "ALUMNO" } }),
    prisma.test.count({ where: { subject: { schoolId: user.schoolId } } }),
  ]);

  const stats = [
    { label: "Grados", value: grades, href: "/admin/grados", icon: GraduationCap },
    { label: "Grupos", value: groups, href: "/admin/grupos", icon: Users },
    { label: "Asignaturas", value: subjects, href: "/admin/asignaturas", icon: BookOpen },
    { label: "Profesores", value: teachers, href: "/admin/usuarios", icon: Users },
    { label: "Alumnos", value: students, href: "/admin/usuarios", icon: Users },
    { label: "Exámenes", value: tests, href: "/admin/asignaciones", icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
        <p className="text-gray-500">Bienvenido/a, {user.fullName}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="transition hover:border-blue-300 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">{s.label}</CardTitle>
                  <Icon className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <AdminAnnouncementsPanel />
    </div>
  );
}
