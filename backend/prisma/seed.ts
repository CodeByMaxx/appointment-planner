import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const companyId = process.env.COMPANY_ID;
  const companyName = process.env.COMPANY_NAME;
  const companyEmail = process.env.COMPANY_EMAIL;
  const companyTimezone = process.env.COMPANY_TIMEZONE;

  if (!companyId || !companyName || !companyEmail || !companyTimezone) {
    throw new Error("COMPANY_ID, COMPANY_NAME, COMPANY_EMAIL and COMPANY_TIMEZONE are required");
  }
  const company = await prisma.company.upsert({
    where: {
      email: companyEmail,
    },
    update: {},
    create: {
      id: companyId,
      name: companyName,
      email: companyEmail,
      timezone: companyTimezone,
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
