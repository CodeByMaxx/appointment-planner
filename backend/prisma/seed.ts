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
      id: "demo-company",
      name: "Demo Company",
      email: "demo@example.com",
      timezone: "Europe/Vienna",
    },
  });

  await prisma.service.upsert({
    where: {
      id: "demo-service",
    },
    update: {},
    create: {
      id: "demo-service",
      companyId: company.id,
      name: "Beratungsgespräch",
      description: "Persönliches Beratungsgespräch",
      durationMinutes: 60,
    },
  });

  for (const weekday of [1, 2, 3, 4, 5]) {
    await prisma.availability.upsert({
      where: {
        id: `demo-availability-${weekday}`,
      },
      update: {},
      create: {
        id: `demo-availability-${weekday}`,
        companyId: company.id,
        weekday,
        startTime: "09:00",
        endTime: "17:00",
      },
    });
  }

  console.log("Demo data seeded:", company.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
