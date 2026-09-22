"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/utils";
import { KeyRound, Copy, Trash2 } from "lucide-react";

type User = { id: string; fullName: string; email: string; role: string };

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ALUMNO");
  const [password, setPassword] = useState("demo1234");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{
    fullName: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [resetError, setResetError] = useState("");

  async function load() {
    const res = await fetch("/api/usuarios");
    setUsers(await res.json());
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, role, password }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Error");
    else {
      setFullName(""); setEmail(""); setMsg("Usuario creado");
      load();
    }
    setLoading(false);
  }

  async function resetPassword(u: User) {
    if (!confirm(`¿Generar contraseña temporal para ${u.fullName}? La anterior dejará de funcionar.`)) return;
    setResettingId(u.id);
    setResetError("");
    setTempPasswordInfo(null);
    try {
      const res = await fetch(`/api/usuarios/${u.id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "No se pudo generar la contraseña");
        return;
      }
      setTempPasswordInfo({
        fullName: data.fullName,
        email: data.email,
        temporaryPassword: data.temporaryPassword,
      });
    } catch {
      setResetError("Error de red al generar la contraseña");
    } finally {
      setResettingId(null);
    }
  }

  async function removeUser(u: User) {
    if (!confirm(`¿Eliminar a ${u.fullName} (${u.email})? Esta acción no se puede deshacer.`)) return;
    setResetError("");
    const res = await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResetError(data.error || "No se pudo eliminar el usuario");
      return;
    }
    if (tempPasswordInfo?.email === u.email) setTempPasswordInfo(null);
    setMsg(`Usuario eliminado: ${u.fullName}`);
    load();
  }

    async function copyTemp() {
    if (!tempPasswordInfo) return;
    try {
      await navigator.clipboard.writeText(tempPasswordInfo.temporaryPassword);
      setMsg("Contraseña copiada al portapapeles");
    } catch {
      setMsg("No se pudo copiar; selecciónela manualmente");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
      <Card>
        <CardHeader><CardTitle>Crear usuario</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Nombre completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Correo</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Rol</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
                  <SelectItem value="PROFESOR">Profesor</SelectItem>
                  <SelectItem value="ALUMNO">Alumno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Contraseña temporal</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {msg && <p className="text-sm text-blue-700 sm:col-span-2">{msg}</p>}
            <Button type="submit" disabled={loading} className="sm:col-span-2 sm:w-fit">Crear usuario</Button>
          </form>
        </CardContent>
      </Card>

      {tempPasswordInfo && (
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base">Contraseña temporal generada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Para <span className="font-medium">{tempPasswordInfo.fullName}</span> ({tempPasswordInfo.email})
            </p>
            <p className="rounded-md bg-white px-3 py-2 font-mono text-base tracking-wide text-gray-900">
              {tempPasswordInfo.temporaryPassword}
            </p>
            <p className="text-gray-600">
              Compártala de forma segura. La contraseña anterior ya no funciona. El usuario puede entrar con esta y, si quiere, pedirle que la cambie más adelante.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={copyTemp}>
                <Copy className="mr-1 h-4 w-4" /> Copiar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setTempPasswordInfo(null)}>
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {resetError && <p className="text-sm text-red-600">{resetError}</p>}

      <div className="grid gap-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-gray-900">{u.fullName}</p>
                <p className="text-sm text-gray-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{ROLE_LABELS[u.role] || u.role}</Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={resettingId === u.id}
                  onClick={() => resetPassword(u)}
                >
                  <KeyRound className="mr-1 h-4 w-4" />
                  {resettingId === u.id ? "Generando…" : "Contraseña temporal"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Eliminar usuario"
                  onClick={() => removeUser(u)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
