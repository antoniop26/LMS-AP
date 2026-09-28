import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateTempPassword } from "@/lib/security/password";
import { createAdminClient } from "@/lib/security/supabase-admin";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const target = await prisma.user.findFirst({
    where: { id: params.id, schoolId: adminUser.schoolId },
    select: { id: true, email: true, fullName: true, supabaseId: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (target.supabaseId.startsWith("local-")) {
    return NextResponse.json(
      { error: "Este usuario no tiene cuenta Auth en Supabase" },
      { status: 400 }
    );
  }

  const temporaryPassword = generateTempPassword();

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(target.supabaseId, {
    password: temporaryPassword,
  });
  if (error) {
    return NextResponse.json({ error: error.message || "No se pudo actualizar la contraseña" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    userId: target.id,
    email: target.email,
    fullName: target.fullName,
    temporaryPassword,
    message: "Contraseña temporal generada. Compártala con el usuario de forma segura.",
  });
}
