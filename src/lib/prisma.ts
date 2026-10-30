import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function withPoolDefaults(connectionString: string): string {
  const url = new URL(connectionString);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "5");
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "10");
  }
  return url.toString();
}

const databaseUrl = process.env.DATABASE_URL;
const prismaOptions = databaseUrl
  ? { datasources: { db: { url: withPoolDefaults(databaseUrl) } } }
  : undefined;

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
