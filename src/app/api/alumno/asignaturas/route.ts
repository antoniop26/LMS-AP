import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "ALUMNO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const memberships = await prisma.studentGroup.findMany({
    where: { studentId: user.id },
    select: { groupId: true, group: { select: { gradeId: true } } },
  });
  const groupIds = memberships.map((m) => m.groupId);
  const gradeIds = Array.from(new Set(memberships.map((m) => m.group.gradeId)));

  // Match existing /api/examenes visibility for students
  const examVisibility = {
    published: true as const,
    OR: [
      { groupId: null },
      ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
    ],
  };

  const orFilters: Record<string, unknown>[] = [
    { tests: { some: examVisibility } },
  ];
  if (gradeIds.length > 0) {
    orFilters.push({ gradeId: { in: gradeIds } });
  }
  if (groupIds.length > 0) {
    orFilters.push({ materialFolders: { some: { groupId: { in: groupIds } } } });
  }

  const subjects = await prisma.subject.findMany({
    where: {
      schoolId: user.schoolId,
      OR: orFilters,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      _count: {
        select: {
          materialFolders: { where: { groupId: { in: groupIds } } },
          tests: { where: examVisibility },
        },
      },
    },
  });

  return NextResponse.json(
    subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      materialsFolderCount: s._count.materialFolders,
      examsCount: s._count.tests,
    }))
  );
}
