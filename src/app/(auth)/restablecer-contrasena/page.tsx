"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/security/password-policy";

type Tokens = { accessToken: string; refreshToken: string };
type Status = "checking" | "ready" | "invalid";

/** Cliente sin persistencia: no guarda la sesión de recuperación en cookies ni localStorage. */
function statelessClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function cleanUrl() {
  window.history.replaceState(null, "", window.location.pathname);
}

/**
 * Obtiene la sesión de recuperación a partir del enlace del correo. Soporta:
 *  - Flujo implícito (por defecto con {{ .ConfirmationURL }}): #access_token=...&refresh_token=...&type=recovery
 *  - token_hash:  ?token_hash=...&type=recovery  → verifyOtp
 *  - PKCE:        ?code=...                      → exchangeCodeForSession (mismo navegador)
 */
async function resolveRecoveryTokens(): Promise<{ tokens?: Tokens; error?: string }> {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  const urlError = hash.get("error_description") || query.get("error_description");
  if (urlError) return { error: "El enlace no es válido o ha expirado." };

  const at = hash.get("access_token");
  const rt = hash.get("refresh_token");
  if (at && rt) return { tokens: { accessToken: at, refreshToken: rt } };

  const tokenHash = query.get("token_hash");
  const type = query.get("type");
  if (tokenHash && (type === "recovery" || type === "email")) {
    const { data, error } = await statelessClient().auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (error || !data.session) return { error: "El enlace no es válido o ha expirado." };
    return { tokens: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token } };
  }

  const code = query.get("code");
  if (code) {
    const ssr = createSsrBrowserClient();
    // El cliente SSR puede haber hecho el intercambio automáticamente al iniciarse.
    let session = (await ssr.auth.getSession()).data.session;
    if (!session) {
      const { data } = await ssr.auth.exchangeCodeForSession(code);
      session = data.session;
    }
    if (!session) return { error: "El enlace no es válido, ha expirado o se abrió en otro navegador." };
    const tokens = { accessToken: session.access_token, refreshToken: session.refresh_token };
    // No dejar la sesión de recuperación guardada en cookies (el token sigue válido en memoria).
    await ssr.auth.signOut({ scope: "local" });
    return { tokens };
  }

  return { error: "Abre esta página desde el enlace que te enviamos por correo." };
}

export default function RestablecerContrasenaPage() {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<Status>("checking");
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    resolveRecoveryTokens()
      .then((r) => {
        cleanUrl();
        if (r.tokens) {
          setTokens(r.tokens);
          setStatus("ready");
        } else {
          setLinkError(r.error || "El enlace no es válido o ha expirado.");
          setStatus("invalid");
        }
      })
      .catch(() => {
        cleanUrl();
        setLinkError("El enlace no es válido o ha expirado.");
        setStatus("invalid");
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const pwError = validatePassword(password);
    if (pwError) return setError(pwError);
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    if (!tokens) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...tokens, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No se pudo actualizar la contraseña.");
        if (res.status === 401) setStatus("invalid");
        return;
      }
      setPassword("");
      setConfirm("");
      router.replace("/login?reset=ok");
    } catch {
      setError("No se pudo actualizar la contraseña. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Define tu contraseña</CardTitle>
          <CardDescription>Tigers LMS · Smart Academy Panama</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "checking" && <p className="text-center text-sm text-gray-600">Verificando enlace…</p>}

          {status === "invalid" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-600" data-testid="link-error">
                {linkError || "El enlace no es válido o ha expirado."}
              </p>
              <Link href="/olvide-contrasena" className="text-sm font-medium text-blue-700 hover:underline">
                Solicitar un nuevo enlace
              </Link>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-gray-500">
                Mínimo {MIN_PASSWORD_LENGTH} caracteres, con mayúsculas, minúsculas y números.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando…" : "Guardar contraseña"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
