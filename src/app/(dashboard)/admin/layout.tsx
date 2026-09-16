import { requireUser } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ADMINISTRADOR"]);
  return (
    <DashboardShell
      role={user.role}
      fullName={user.fullName}
      schoolName={user.school.name}
    >
      {children}
    </DashboardShell>
  );
}
