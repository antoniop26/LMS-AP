import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { dashboardForRole } from "@/lib/auth";
import {
  checkLoginAllowed,
  clientIp,
  registerLoginFailure,
  registerLoginSuccess,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// Mensaje genérico: no revela si el correo existe, está baneado o la clave es incorrecta.
const GENERIC_ERROR = "Correo o contraseña incorrectos.";

/**
 * Login en servidor con rate limiting: máx. 5 fallos por IP+email
 * (20 por IP) en 15 minutos → 429. Ver src/lib/security/rate-limit.ts.
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const password = String(body.password || "").slice(0, 200);
  if (!email || !password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const ip = clientIp(req.headers);
  const retryAfter = checkLoginAllowed(ip, email);
  if (retryAfter > 0) {
    return NextResponse.json(
      {
        error: `Demasiados intentos fallidos. Intente de nuevo en ${Math.ceil(retryAfter / 60)} min.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    registerLoginFailure(ip, email);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: data.user.id },
    select: { role: true },
  });
  if (!dbUser) {
    // Cuenta Auth sin perfil en el LMS: cerrar sesión y responder genérico.
    await supabase.auth.signOut();
    registerLoginFailure(ip, email);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  registerLoginSuccess(ip, email);
  return NextResponse.json({ ok: true, redirectTo: dashboardForRole(dbUser.role) });
}

export function GET() {
  return NextResponse.json(
    { maxFailures: LOGIN_MAX_FAILURES, windowMinutes: LOGIN_WINDOW_MS / 60000 },
    { status: 405 }
  );
}
