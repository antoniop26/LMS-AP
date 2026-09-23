import { PrismaClient } from "@prisma/client";

/**
 * Supabase session-mode pooler (port 5432) caps ~15 clients and saturates
 * quickly under Vercel serverless → EMAXCONNSESSION / Next.js Application error.
 * Prefer transaction pooler (6543) + pgbouncer + a single connection per isolate.
 */
function resolveDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    const isSupabasePooler = url.hostname.includes("pooler.supabase.com");

    if (isSupabasePooler && (url.port === "5432" || url.port === "")) {
      url.port = "6543";
      url.searchParams.set("pgbouncer", "true");
    }

    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }

    return url.toString();
  } catch {
    return raw;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
