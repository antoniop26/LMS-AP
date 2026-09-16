"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/utils";

type User = { id: string; fullName: string; email: string; role: string };

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ALUMNO");
  const [password, setPassword] = useState("demo1234");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

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
      <div className="grid gap-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">{u.fullName}</p>
                <p className="text-sm text-gray-500">{u.email}</p>
              </div>
              <Badge variant="secondary">{ROLE_LABELS[u.role] || u.role}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
