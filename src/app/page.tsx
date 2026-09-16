import { redirect } from "next/navigation";
import { getSessionUser, dashboardForRole } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(dashboardForRole(user.role));
}
