import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  PROFESOR: "Profesor",
  ALUMNO: "Alumno",
};

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Opción múltiple",
  SHORT_ANSWER: "Respuesta corta",
  LONG_ANSWER: "Respuesta larga",
};
