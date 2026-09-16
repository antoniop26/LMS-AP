import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    include: { school: true },
  });

  return dbUser;
}

export async function requireUser(roles?: Role[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) {
    redirect(dashboardForRole(user.role));
  }
  return user;
}

export function dashboardForRole(role: Role) {
  switch (role) {
    case "ADMINISTRADOR":
      return "/admin";
    case "PROFESOR":
      return "/profesor";
    case "ALUMNO":
      return "/alumno";
    default:
      return "/login";
  }
}
