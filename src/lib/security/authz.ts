import { prisma } from "@/lib/prisma";
import type { getSessionUser } from "@/lib/auth";

/**
 * Autorización centralizada. Las APIs usan Prisma con el rol `postgres`
 * (que ignora RLS), por eso TODA ruta debe filtrar por usuario/rol/propiedad.
 */
export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export async function studentGroupIds(userId: string): Promise<string[]> {
  const rows = await prisma.studentGroup.findMany({
    where: { studentId: userId },
    select: { groupId: true },
  });
  return rows.map((r) => r.groupId);
}

export async function teacherTeaches(
  teacherId: string,
  subjectId: string,
  groupId: string | null
): Promise<boolean> {
  const row = await prisma.teacherSubject.findFirst({
    where: {
      teacherId,
      subjectId,
      ...(groupId ? { OR: [{ groupId }, { groupId: null }] } : {}),
    },
    select: { id: true },
  });
  return Boolean(row);
}

/** ¿Puede el alumno ver este examen? (publicado, su colegio y su grupo). */
export async function studentCanSeeTest(
  user: SessionUser,
  test: { published: boolean; groupId: string | null; subject: { schoolId: string } }
): Promise<boolean> {
  if (!test.published) return false;
  if (test.subject.schoolId !== user.schoolId) return false;
  if (!test.groupId) return true;
  const groups = await studentGroupIds(user.id);
  return groups.includes(test.groupId);
}

/** ¿Puede profesor/admin gestionar este examen? */
export function staffCanManageTest(
  user: SessionUser,
  test: { creatorId: string; subject: { schoolId: string } }
): boolean {
  if (test.subject.schoolId !== user.schoolId) return false;
  if (user.role === "ADMINISTRADOR") return true;
  return user.role === "PROFESOR" && test.creatorId === user.id;
}

type MaterialForAuthz = {
  uploadedById: string;
  subjectId: string;
  groupId: string | null;
  subject: { schoolId: string };
  folder: { kind: string; groupId: string; createdById: string } | null;
};

/** ¿Puede el usuario ver/descargar este material? */
export async function canViewMaterial(user: SessionUser, m: MaterialForAuthz): Promise<boolean> {
  if (m.subject.schoolId !== user.schoolId) return false;
  if (m.uploadedById === user.id) return true;
  if (user.role === "ADMINISTRADOR") return true;
  if (user.role === "PROFESOR") {
    if (m.folder?.createdById === user.id) return true;
    return teacherTeaches(user.id, m.subjectId, m.folder?.groupId ?? m.groupId);
  }
  // ALUMNO: nunca entregas de otros alumnos
  if (m.folder?.kind === "STUDENT_SUBMISSIONS") return false;
  const groupId = m.folder?.groupId ?? m.groupId;
  if (!groupId) return true;
  const groups = await studentGroupIds(user.id);
  return groups.includes(groupId);
}

/** URL interna autenticada para descargar archivos (bucket privado). */
export function materialFileUrl(id: string) {
  return `/api/archivos/material/${id}`;
}
export function announcementFileUrl(id: string) {
  return `/api/archivos/anuncio/${id}`;
}

export function withMaterialUrl<T extends { id: string; fileUrl?: string | null; filePath?: string | null }>(
  m: T
): T {
  return { ...m, fileUrl: m.filePath ? materialFileUrl(m.id) : m.fileUrl ?? null };
}
