import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Cierre de sesión en servidor: revoca el refresh token en Supabase y
 * borra las cookies sb-* de sesión en la respuesta.
 */
export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
