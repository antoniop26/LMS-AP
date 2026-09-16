import { Sidebar } from "./sidebar";

export function DashboardShell({
  children,
  role,
  fullName,
  schoolName,
  title,
}: {
  children: React.ReactNode;
  role: string;
  fullName: string;
  schoolName: string;
  title?: string;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role={role} fullName={fullName} schoolName={schoolName} />
      </div>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="md:hidden mb-2">
            <Sidebar role={role} fullName={fullName} schoolName={schoolName} />
          </div>
          {title && <h1 className="text-xl font-semibold text-gray-900">{title}</h1>}
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
