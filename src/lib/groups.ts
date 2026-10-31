import { prisma } from "@/lib/prisma";

export const CORE_GROUP_NAME = "7DS";

// The core group is created lazily so existing databases need no data migration.
export async function ensureCoreGroup() {
  const existing = await prisma.group.findFirst({ where: { isCore: true } });
  if (existing) return existing;
  return prisma.group.upsert({
    where: { name: CORE_GROUP_NAME },
    update: { isCore: true },
    create: { name: CORE_GROUP_NAME, isCore: true },
  });
}
