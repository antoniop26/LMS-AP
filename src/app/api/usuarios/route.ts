import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const role = req.nextUrl.searchParams.get("role") as Role | null;
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
  const password = String(body.password || "demo1234");

  if (!email || !fullName || !role) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

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

  return NextResponse.json(dbUser, { status: 201 });
}
