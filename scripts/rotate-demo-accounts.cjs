/**
 * Rota las contraseñas de las cuentas demo históricas a claves aleatorias
 * fuertes y (opcionalmente) las banea en Supabase Auth.
 *
 * Uso: node scripts/rotate-demo-accounts.cjs [--ban=profesor,alumno] [--ban-all]
 * Escribe las nuevas claves SOLO en .pilot-credentials.local (gitignored).
 */
require("dotenv").config();
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const DEMO = ["admin@colegio.demo", "profesor@colegio.demo", "alumno@colegio.demo"];
const args = process.argv.slice(2);
const banAll = args.includes("--ban-all");
const banArg = (args.find((a) => a.startsWith("--ban=")) || "").slice(6);
const banSet = new Set(banArg ? banArg.split(",").map((x) => `${x.trim()}@colegio.demo`) : []);

function strongPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const b = crypto.randomBytes(24);
  let s = "";
  for (let i = 0; i < 24; i++) s += alphabet[b[i] % alphabet.length];
  return `Pl-${s}-9x`;
}

(async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: require("ws") },
  });
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const lines = [
    "# Credenciales del piloto — generado " + new Date().toISOString(),
    "# NO COMMITEAR. Cambiar/crear usuarios reales desde /admin/usuarios.",
    "",
  ];
  for (const email of DEMO) {
    const u = data.users.find((x) => x.email === email);
    if (!u) {
      lines.push(`${email}  (no existe)`);
      continue;
    }
    const password = strongPassword();
    const ban = banAll || banSet.has(email);
    const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
      password,
      ban_duration: ban ? "876000h" : "none",
    });
    if (upErr) throw upErr;
    lines.push(`${email}  password=${password}  estado=${ban ? "BANEADA (no puede entrar)" : "activa"}`);
    console.log(`${email}: rotada${ban ? " + baneada" : ""}`);
  }
  fs.writeFileSync(".pilot-credentials.local", lines.join("\n") + "\n", { mode: 0o600 });
  console.log("Claves guardadas en .pilot-credentials.local (gitignored)");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
