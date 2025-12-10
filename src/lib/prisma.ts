import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL");
}

// Allow self-signed certs (Supabase managed Postgres)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const dbUrl = new URL(connectionString);
dbUrl.searchParams.delete("sslmode");

const pool = new Pool({
  connectionString: dbUrl.toString(),
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

