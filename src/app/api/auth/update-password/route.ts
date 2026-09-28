import { NextRequest, NextResponse } from "next/server";
import { validatePassword } from "@/lib/security/password-policy";
import { clientIp, hitRateLimit, registerLoginSuccess } from "@/lib/security/rate-limit";
import { createStatelessAnonClient } from "@/lib/supabase/anon-server";

export const dynamic = "force-dynamic";

const INVALID_LINK = "El enlace no es válido o ha expirado. Solicita uno nuevo.";

/**
 * Define una nueva contraseña a partir de la sesión de recuperación obtenida
 * del enlace del correo (access_token + refresh_token). La política de
 * contraseñas se valida aquí en el servidor. Tras actualizar, se revocan
 * todas las sesiones del usuario (incluida la de recuperación).
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const retry = hitRateLimit(`pwupdate:${ip}`, 10, 15 * 60 * 1000);
  if (retry > 0) {
    return NextResponse.json(
      { error: `Demasiados intentos. Intente de nuevo en ${Math.ceil(retry / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }

  let body: { accessToken?: unknown; refreshToken?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const accessToken = String(body.accessToken || "");
  const refreshToken = String(body.refreshToken || "");
  const password = String(body.password || "");
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: INVALID_LINK }, { status: 401 });
  }
  const pwError = validatePassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const supabase = createStatelessAnonClient();
  const { data: sess, error: sessError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessError || !sess.user) {
    return NextResponse.json({ error: INVALID_LINK }, { status: 401 });
  }

  const { error: upError } = await supabase.auth.updateUser({ password });
  if (upError) {
    const msg = /different from the old/i.test(upError.message)
      ? "La nueva contraseña debe ser distinta de la anterior."
      : /weak|short|characters/i.test(upError.message)
        ? "La contraseña no cumple la política de seguridad."
        : "No se pudo actualizar la contraseña. Solicita un nuevo enlace.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Cerrar la sesión de recuperación y cualquier otra sesión abierta del usuario.
  await supabase.auth.signOut({ scope: "global" });
  if (sess.user.email) registerLoginSuccess(ip, sess.user.email);

  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
