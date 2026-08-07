import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL || "";
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const adapter = new PrismaPg({
    connectionString: url,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
    max: isLocal ? 20 : 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    maxUses: 5000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
