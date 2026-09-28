import { randomBytes } from "crypto";

export const MIN_PASSWORD_LENGTH = 10;

/** Contraseña ≥10 caracteres con mayúscula, minúscula y número; bloquea claves demo conocidas. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 72) return "La contraseña no puede superar 72 caracteres.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "La contraseña debe incluir mayúsculas, minúsculas y números.";
  }
  const lower = password.toLowerCase();
  if (["demo1234", "password", "contraseña", "12345678", "tigers", "colegio"].some((w) => lower.includes(w))) {
    return "La contraseña es demasiado común. Elija otra.";
  }
  return null;
}

/** Contraseña temporal legible (sin caracteres ambiguos), ~70 bits de entropía. */
export function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  // Garantizar complejidad
  return `Tg-${out}-${2 + (bytes[0] % 8)}`;
}
