import { NextRequest, NextResponse } from "next/server";
import { clientIp, hitRateLimit } from "@/lib/security/rate-limit";
import { createStatelessAnonClient } from "@/lib/supabase/anon-server";

export const dynamic = "force-dynamic";

const GENERIC_OK =
  "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.";

function siteUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}

/**
 * Solicita el correo de recuperación. Respuesta siempre genérica (no revela
 * si el correo existe). Límite: 3 solicitudes por IP+correo cada 15 min y
 * 10 por IP por hora (además del límite de envío de correos de Supabase).
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
  }

  const ip = clientIp(req.headers);
  const retry = Math.max(
    hitRateLimit(`forgot:ip:${ip}`, 10, 60 * 60 * 1000),
    hitRateLimit(`forgot:pair:${ip}:${email}`, 3, 15 * 60 * 1000)
  );
  if (retry > 0) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Intente de nuevo en ${Math.ceil(retry / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }

  const supabase = createStatelessAnonClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl(req)}/restablecer-contrasena`,
  });
  if (error) console.error("forgot-password: resetPasswordForEmail falló:", error.status, error.message);

  return NextResponse.json({ ok: true, message: GENERIC_OK });
}
