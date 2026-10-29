import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import species from "./champions-m-c.json";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must both be set.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await Promise.all(
    species.map(({ dex, name, types }) =>
      prisma.species.upsert({
        where: { dex },
        update: { name, types },
        create: { dex, name, types },
      }),
    ),
  );

  await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role: Role.ADMIN },
    create: {
      username,
      name: username,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.log(`Seeded ${species.length} species and ensured the admin account exists.`);
}

main()
  .catch((error: unknown) => {
    console.error("Prisma seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
