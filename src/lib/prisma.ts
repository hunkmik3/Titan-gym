import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}

// Allow self-signed certs (Supabase managed Postgres)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

