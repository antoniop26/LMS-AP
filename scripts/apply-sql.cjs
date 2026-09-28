/**
 * Aplica un archivo SQL contra DATABASE_URL (usa la conexión de Prisma).
 * Uso: node scripts/apply-sql.cjs prisma/sql/001_pilot_rls_hardening.sql
 * Requiere DIRECT_URL (5432) o DATABASE_URL en .env. No imprime secretos.
 */
require("dotenv").config();
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/apply-sql.cjs <archivo.sql>");
  process.exit(1);
}
const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: raw } } });
const sql = fs.readFileSync(file, "utf8");

prisma
  .$transaction(async (tx) => {
    for (const s of splitSql(sql)) await tx.$executeRawUnsafe(s);
  }, { timeout: 60000 })
  .then(() => console.log(`OK: ${file} aplicado`))
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/** Divide SQL en sentencias respetando bloques $$ ... $$ y comentarios. */
function splitSql(text) {
  const out = [];
  let cur = "";
  let inDollar = null;
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inDollar && (trimmed.startsWith("--") || trimmed === "")) continue;
    cur += line + "\n";
    const tags = line.match(/\$[a-zA-Z_]*\$/g) || [];
    for (const t of tags) {
      if (!inDollar) inDollar = t;
      else if (t === inDollar) inDollar = null;
    }
    if (!inDollar && trimmed.endsWith(";")) {
      const s = cur.trim().replace(/;$/, "");
      if (!/^(BEGIN|COMMIT)$/i.test(s)) out.push(s);
      cur = "";
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
