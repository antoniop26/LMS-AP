import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const attemptIncludeForTeacher = {
  student: { select: { id: true, fullName: true, email: true } },
  answers: {
    include: {
      grade: true,
      question: { include: { options: true } },
    },
  },
} as const;

function isEnviado(attempt: { status: string; submittedAt: Date | null } | null | undefined) {
  if (!attempt) return false;
  if (attempt.submittedAt != null) return true;
  return attempt.status === "SUBMITTED" || attempt.status === "GRADED";
}

function sortRoster(
  a: { status: "ENVIADO" | "NO_ENVIADO"; student: { fullName: string }; attempt: { status: string } | null },
  b: { status: "ENVIADO" | "NO_ENVIADO"; student: { fullName: string }; attempt: { status: string } | null }
) {
  // NO_ENVIADO last
  if (a.status !== b.status) {
    return a.status === "ENVIADO" ? -1 : 1;
  }
  if (a.status === "ENVIADO") {
    // SUBMITTED before GRADED
    const rank = (s: string | undefined) =>
      s === "SUBMITTED" ? 0 : s === "GRADED" ? 1 : 2;
    const d = rank(a.attempt?.status) - rank(b.attempt?.status);
    if (d !== 0) return d;
  }
  return a.student.fullName.localeCompare(b.student.fullName, "es", {
    sensitivity: "base",
  });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const isTeacherOrAdmin = user.role === "PROFESOR" || user.role === "ADMINISTRADOR";

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      subject: true,
      group: { include: { grade: true } },
      questions: {
        include: {
          options: {
            select: {
              id: true,
              text: true,
              order: true,
              isCorrect: user.role !== "ALUMNO",
            },
          },
        },
        orderBy: { order: "asc" },
      },
      attempts:
        user.role === "ALUMNO"
          ? { where: { studentId: user.id }, include: { answers: true } }
          : {
              where: { status: { in: ["SUBMITTED", "GRADED"] } },
              include: attemptIncludeForTeacher,
              orderBy: { submittedAt: "desc" },
            },
    },
  });

  if (!test) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (!isTeacherOrAdmin) {
    return NextResponse.json(test);
  }

  // Authorize: owner teacher or admin
  if (user.role === "PROFESOR" && test.creatorId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Resolve group IDs for roster students
  let groupIds: string[] = [];
  if (test.groupId) {
    groupIds = [test.groupId];
  } else if (user.role === "ADMINISTRADOR") {
    const schoolGroups = await prisma.group.findMany({
      where: { grade: { schoolId: user.schoolId } },
      select: { id: true },
    });
    groupIds = schoolGroups.map((g) => g.id);
  } else {
    // Teacher: groups linked via TeacherSubject for this subject (+ creator)
    const assignments = await prisma.teacherSubject.findMany({
      where: {
        teacherId: test.creatorId,
        subjectId: test.subjectId,
      },
      select: { groupId: true },
    });
    const linked = assignments
      .map((a) => a.groupId)
      .filter((id): id is string => Boolean(id));
    if (linked.length > 0) {
      groupIds = linked;
    } else {
      // Fallback: any group of the school with students if teacher has subject-wide assignment
      const schoolGroups = await prisma.group.findMany({
        where: { grade: { schoolId: user.schoolId } },
        select: { id: true },
      });
      groupIds = schoolGroups.map((g) => g.id);
    }
  }

  const memberships =
    groupIds.length === 0
      ? []
      : await prisma.studentGroup.findMany({
          where: {
            groupId: { in: groupIds },
            student: { role: "ALUMNO", schoolId: user.schoolId },
          },
          include: {
            student: { select: { id: true, fullName: true, email: true } },
          },
        });

  // Deduplicate students (may be in multiple groups when groupId is null)
  const studentMap = new Map<string, { id: string; fullName: string; email: string }>();
  for (const m of memberships) {
    if (!studentMap.has(m.student.id)) {
      studentMap.set(m.student.id, m.student);
    }
  }

  // Load all attempts for this test for roster students (including IN_PROGRESS)
  const studentIds = Array.from(studentMap.keys());
  const allAttempts =
    studentIds.length === 0
      ? []
      : await prisma.testAttempt.findMany({
          where: { testId: test.id, studentId: { in: studentIds } },
          include: attemptIncludeForTeacher,
        });

  const attemptByStudent = new Map(allAttempts.map((a) => [a.studentId, a]));

  const roster = Array.from(studentMap.values())
    .map((student) => {
      const attempt = attemptByStudent.get(student.id) ?? null;
      const enviado = isEnviado(attempt);
      return {
        student,
        status: (enviado ? "ENVIADO" : "NO_ENVIADO") as "ENVIADO" | "NO_ENVIADO",
        // Only expose attempt payload when enviado (matches grading UI needs)
        attempt: enviado && attempt
          ? {
              id: attempt.id,
              status: attempt.status,
              score: attempt.score,
              submittedAt: attempt.submittedAt,
              student: attempt.student,
              answers: attempt.answers,
            }
          : null,
      };
    })
    .sort(sortRoster);

  return NextResponse.json({ ...test, roster });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const data: {
    published?: boolean;
    title?: string;
    opensAt?: Date | null;
    closesAt?: Date | null;
  } = {};
  if (body.published !== undefined) data.published = Boolean(body.published);
  if (body.title) data.title = String(body.title);
  if ("opensAt" in body) data.opensAt = body.opensAt ? new Date(body.opensAt) : null;
  if ("closesAt" in body) data.closesAt = body.closesAt ? new Date(body.closesAt) : null;

  if (data.opensAt !== undefined || data.closesAt !== undefined) {
    const current = await prisma.test.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const opensAt = data.opensAt !== undefined ? data.opensAt : current.opensAt;
    const closesAt = data.closesAt !== undefined ? data.closesAt : current.closesAt;
    if (opensAt && closesAt && opensAt >= closesAt) {
      return NextResponse.json(
        { error: "La fecha de inicio debe ser anterior a la de finalización" },
        { status: 400 }
      );
    }
  }

  const test = await prisma.test.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(test);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "PROFESOR" && user.role !== "ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await prisma.test.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
