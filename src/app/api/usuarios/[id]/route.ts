import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (params.id === adminUser.id) {
    return NextResponse.json(
      { error: "No puede eliminarse a sí mismo" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { id: params.id, schoolId: adminUser.schoolId },
    select: { id: true, email: true, supabaseId: true, fullName: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!target.supabaseId.startsWith("local-")) {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error } = await admin.auth.admin.deleteUser(target.supabaseId);
    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo eliminar en Auth" },
        { status: 400 }
      );
    }
  }

  await prisma.user.delete({ where: { id: target.id } });

  return NextResponse.json({ ok: true, id: target.id, email: target.email });
}
