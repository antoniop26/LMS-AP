import { MaterialFolderKind } from "@prisma/client";

export type FolderWindow = {
  opensAt: Date | null;
  closesAt: Date | null;
  kind: MaterialFolderKind;
};

/** Whether a student may upload into a STUDENT_SUBMISSIONS folder now. */
export function isSubmissionWindowOpen(folder: FolderWindow, now = new Date()): boolean {
  if (folder.kind !== "STUDENT_SUBMISSIONS") return false;
  if (!folder.closesAt) return false;
  const opens = folder.opensAt ?? null;
  if (opens && now < opens) return false;
  if (now > folder.closesAt) return false;
  return true;
}

export type FolderStatus = "abierta" | "cerrada" | "proxima" | "recursos";

export function getFolderStatus(folder: FolderWindow, now = new Date()): FolderStatus {
  if (folder.kind === "TEACHER_RESOURCES") return "recursos";
  if (!folder.closesAt) return "cerrada";
  const opens = folder.opensAt;
  if (opens && now < opens) return "proxima";
  if (now > folder.closesAt) return "cerrada";
  return "abierta";
}

export function folderStatusLabel(status: FolderStatus): string {
  switch (status) {
    case "abierta":
      return "Abierta";
    case "cerrada":
      return "Cerrada";
    case "proxima":
      return "Próxima";
    case "recursos":
      return "Recursos del profesor";
  }
}
