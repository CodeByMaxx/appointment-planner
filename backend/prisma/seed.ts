import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: {
      email: "demo@example.com",
    },
    update: {},
    create: {
      name: "Demo Company",
      email: "demo@example.com",
      timezone: "Europe/Vienna",
    },
  });

  console.log("Demo company:", company);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
