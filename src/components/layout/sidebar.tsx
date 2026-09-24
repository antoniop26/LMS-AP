"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Users,
  FolderOpen,
  ClipboardList,
  Award,
  LogOut,
  UserPlus,
} from "lucide-react";
import { cn, ROLE_LABELS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const NAV: Record<string, NavItem[]> = {
  ADMINISTRADOR: [
    { href: "/admin", label: "Panel", icon: LayoutDashboard },
    { href: "/admin/grados", label: "Grados", icon: GraduationCap },
    { href: "/admin/grupos", label: "Grupos", icon: Users },
    { href: "/admin/asignaturas", label: "Asignaturas", icon: BookOpen },
    { href: "/admin/asignaciones", label: "Asignaciones", icon: UserPlus },
    { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  ],
  PROFESOR: [
    { href: "/profesor", label: "Panel", icon: LayoutDashboard },
    { href: "/profesor/materiales", label: "Materiales", icon: FolderOpen },
    { href: "/profesor/examenes", label: "Exámenes", icon: ClipboardList },
  ],
  ALUMNO: [
    { href: "/alumno", label: "Panel", icon: LayoutDashboard },
    { href: "/alumno/materiales", label: "Materiales", icon: FolderOpen },
    { href: "/alumno/examenes", label: "Exámenes", icon: ClipboardList },
    { href: "/alumno/calificaciones", label: "Calificaciones", icon: Award },
  ],
};

export function Sidebar({
  role,
  fullName,
  schoolName,
}: {
  role: string;
  fullName: string;
  schoolName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV[role] || [];

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
        <Image
          src="/logo-tigers-icon.png"
          alt="Tigers LMS"
          width={40}
          height={34}
          className="h-10 w-auto object-contain shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{schoolName}</p>
          <p className="text-xs text-slate-400">Tigers LMS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const isRoot = item.href.match(/^\/(admin|profesor|alumno)$/);
          const isActive = isRoot ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <p className="truncate text-sm font-medium text-white">{fullName}</p>
        <p className="mb-3 text-xs text-slate-400">{ROLE_LABELS[role] || role}</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
