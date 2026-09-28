import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

/**
 * Cliente Supabase con anon key, SIN cookies ni persistencia (solo servidor).
 * flowType "implicit": los enlaces de recuperación vuelven con
 * #access_token=...&type=recovery y funcionan aunque se abran en otro dispositivo.
 */
export function createStatelessAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false, flowType: "implicit" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtime: { transport: WebSocket as any },
  });
}
