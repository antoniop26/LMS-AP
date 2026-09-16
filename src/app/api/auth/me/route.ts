import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    schoolId: user.schoolId,
    schoolName: user.school.name,
  });
}
