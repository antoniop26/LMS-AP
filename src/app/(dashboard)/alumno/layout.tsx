import { requireUser } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function AlumnoLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ALUMNO"]);
  return (
    <DashboardShell role={user.role} fullName={user.fullName} schoolName={user.school.name}>
      {children}
    </DashboardShell>
  );
}
