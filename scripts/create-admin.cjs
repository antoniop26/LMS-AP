/**
 * Crea (o corrige) un administrador real del colegio, idempotente.
 * - Supabase Auth: usuario confirmado con contraseña aleatoria que nadie conoce
 *   (el usuario define la suya con "¿Olvidaste tu contraseña?" / correo de recuperación).
 * - Prisma: perfil User con rol ADMINISTRADOR en el mismo colegio que --ref (por defecto admin@colegio.demo).
 *
 * Uso: node scripts/create-admin.cjs --email=x@y.com --name="Nombre" [--ref=admin@colegio.demo]
 * No imprime ni guarda contraseñas.
 */
require("dotenv").config();
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { PrismaClient } = require("@prisma/client");

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3);
const email = arg("email").trim().toLowerCase();
const fullName = arg("name").trim();
const ref = (arg("ref") || "admin@colegio.demo").trim().toLowerCase();

function throwawayPassword() {
  return "Xx9-" + crypto.randomBytes(32).toString("base64url") + "-Aa1";
}

(async () => {
  if (!email || !fullName) throw new Error("Faltan --email y --name");
  const prisma = new PrismaClient();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: require("ws") },
  });
  try {
    const refUser = await prisma.user.findUnique({ where: { email: ref }, select: { schoolId: true, school: { select: { name: true } } } });
    if (!refUser) throw new Error(`No existe el usuario de referencia ${ref}`);

    // Buscar usuario Auth existente
    let authUser = null;
    for (let page = 1; page < 50 && !authUser; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      authUser = data.users.find((u) => (u.email || "").toLowerCase() === email) || null;
      if (data.users.length < 200) break;
    }
    if (authUser) {
      console.log("Auth: ya existía (no se cambia la contraseña).");
      if (!authUser.email_confirmed_at) {
        const { error } = await admin.auth.admin.updateUserById(authUser.id, { email_confirm: true });
        if (error) throw error;
        console.log("Auth: email confirmado.");
      }
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: throwawayPassword(),
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "ADMINISTRADOR" },
      });
      if (error || !data.user) throw error || new Error("Error Auth");
      authUser = data.user;
      console.log("Auth: creado (contraseña aleatoria desconocida).");
    }

    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { supabaseId: authUser.id }] } });
    const dbUser = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { supabaseId: authUser.id, email, role: "ADMINISTRADOR", schoolId: refUser.schoolId, fullName },
        })
      : await prisma.user.create({
          data: { supabaseId: authUser.id, email, fullName, role: "ADMINISTRADOR", schoolId: refUser.schoolId },
        });
    console.log(`Perfil: ${existing ? "actualizado" : "creado"} rol=${dbUser.role} colegio="${refUser.school.name}" mismoColegioQueRef=${dbUser.schoolId === refUser.schoolId} vinculoAuth=${dbUser.supabaseId === authUser.id}`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
