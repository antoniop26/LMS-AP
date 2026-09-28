import { randomBytes } from "crypto";

export { MIN_PASSWORD_LENGTH, validatePassword } from "./password-policy";

/** Contraseña temporal legible (sin caracteres ambiguos), ~70 bits de entropía. */
export function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  // Garantizar complejidad
  return `Tg-${out}-${2 + (bytes[0] % 8)}`;
}
