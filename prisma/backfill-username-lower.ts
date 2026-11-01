import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { username: { not: null }, usernameLower: null },
    select: { id: true, username: true },
  });

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { usernameLower: user.username!.toLowerCase() },
    });
  }

  console.log(`Backfilled usernameLower for ${users.length} users.`);
}

main()
  .catch((error: unknown) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
