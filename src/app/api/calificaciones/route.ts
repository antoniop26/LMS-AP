import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (user.role === "ALUMNO") {
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId: user.id, status: { in: ["SUBMITTED", "GRADED"] } },
      include: {
        test: { include: { subject: true } },
      },
      orderBy: { submittedAt: "desc" },
    });
    return NextResponse.json(attempts);
  }

  const attempts = await prisma.testAttempt.findMany({
    where: {
      test: {
        ...(user.role === "PROFESOR" ? { creatorId: user.id } : { subject: { schoolId: user.schoolId } }),
      },
    },
    include: {
      student: { select: { id: true, fullName: true, email: true } },
      test: { include: { subject: true } },
    },
    orderBy: { submittedAt: "desc" },
  });
  return NextResponse.json(attempts);
}
