"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError("Correo o contraseña incorrectos.");
        return;
      }
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data?.role === "ADMINISTRADOR") router.push("/admin");
      else if (data?.role === "PROFESOR") router.push("/profesor");
      else if (data?.role === "ALUMNO") router.push("/alumno");
      else router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex items-center justify-center">
            <Image
              src="/logo-tigers-icon.png"
              alt="Tigers LMS"
              width={88}
              height={75}
              className="h-20 w-auto object-contain"
              priority
            />
          </div>
          <CardTitle>Smart Academy Panama</CardTitle>
          <CardDescription>Inicie sesión en Tigers LMS</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@colegio.demo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Iniciar sesión"}
            </Button>
          </form>
          <div className="mt-6 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-800 mb-1">Cuentas demo</p>
            <p>admin@colegio.demo / demo1234</p>
            <p>profesor@colegio.demo / demo1234</p>
            <p>alumno@colegio.demo / demo1234</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
