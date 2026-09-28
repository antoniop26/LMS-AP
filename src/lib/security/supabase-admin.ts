// Guardia: nunca debe ejecutarse en el navegador.
if (typeof window !== "undefined") throw new Error("supabase-admin es solo servidor");
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con SERVICE ROLE. SOLO servidor (import "server-only" hace fallar el
 * build si un componente cliente lo importa). Nunca exponer al navegador.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
