import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { generateTempPassword, validatePassword } from "@/lib/security/password";
import { createAdminClient } from "@/lib/security/supabase-admin";

const ROLES: Role[] = ["ADMINISTRADOR", "PROFESOR", "ALUMNO"];

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  // Alumnos no pueden listar usuarios (evita enumerar correos de compañeros).
  if (user.role === "ALUMNO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const roleParam = req.nextUrl.searchParams.get("role");
  const role = roleParam && ROLES.includes(roleParam as Role) ? (roleParam as Role) : null;
  const users = await prisma.user.findMany({
    where: {
      schoolId: user.schoolId,
      ...(role ? { role } : {}),
    },
    select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim();
  const role = body.role as Role;
  // Si no se envía contraseña, se genera una temporal fuerte.
  const provided = typeof body.password === "string" ? body.password.trim() : "";
  const generated = !provided;
  const password = provided || generateTempPassword();

  if (!email || !fullName || !ROLES.includes(role)) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }
  const pwError = validatePassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || "Error Auth" }, { status: 400 });
  }

  const dbUser = await prisma.user.create({
    data: {
      supabaseId: authData.user.id,
      email,
      fullName,
      role,
      schoolId: user.schoolId,
    },
  });

  return NextResponse.json(
    { ...dbUser, ...(generated ? { temporaryPassword: password } : {}) },
    { status: 201 }
  );
}
