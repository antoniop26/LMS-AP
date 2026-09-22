export type ExamWindowReason = "not_open" | "closed" | null;

export function examWindowStatus(
  opensAt: Date | string | null | undefined,
  closesAt: Date | string | null | undefined,
  now = new Date()
): { open: boolean; reason: ExamWindowReason } {
  const openAt = opensAt ? new Date(opensAt) : null;
  const closeAt = closesAt ? new Date(closesAt) : null;
  if (openAt && now < openAt) return { open: false, reason: "not_open" };
  if (closeAt && now > closeAt) return { open: false, reason: "closed" };
  return { open: true, reason: null };
}

export function examWindowMessage(reason: ExamWindowReason): string {
  if (reason === "not_open") return "El examen aún no está disponible";
  if (reason === "closed") return "El plazo del examen ha finalizado";
  return "";
}
