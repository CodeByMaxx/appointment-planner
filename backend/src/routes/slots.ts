import { FastifyInstance } from "fastify";
import prisma from "../lib/prisma";

function getWeekday(
  date: string,
  timeZone: string
): number | null {
  const selectedDate = new Date(`${date}T12:00:00Z`);

  if (Number.isNaN(selectedDate.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });

  const weekdayName = formatter.format(selectedDate);

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return weekdayMap[weekdayName] ?? null;
}

/**
 * Converts a local date/time in a specific IANA timezone
 * into the corresponding UTC Date.
 *
 * Example:
 * Europe/Vienna
 * 2026-09-21 09:00
 * -> 2026-09-21T07:00:00.000Z
 */
function createDateTime(
  date: string,
  time: string,
  timeZone: string
): Date {
  const [year, month, day] = date
    .split("-")
    .map(Number);

  const [hour, minute] = time
    .split(":")
    .map(Number);

  const desiredLocalAsUTC = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    0
  );

  let result = new Date(desiredLocalAsUTC);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  // A few iterations are enough to resolve the timezone offset.
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(result);

    const values: Record<string, string> = {};

    for (const part of parts) {
      values[part.type] = part.value;
    }

    const actualLocalAsUTC = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

    const difference =
      desiredLocalAsUTC - actualLocalAsUTC;

    if (difference === 0) {
      break;
    }

    result = new Date(
      result.getTime() + difference
    );
  }

  return result;
}

export default async function slotsRoutes(
  app: FastifyInstance
) {
  app.get<{
    Querystring: {
      companyId: string;
      serviceId: string;
      date: string;
    };
  }>("/slots", async (request, reply) => {
    const {
      companyId,
      serviceId,
      date,
    } = request.query;

    if (!companyId || !serviceId || !date) {
      return reply.status(400).send({
        error:
          "companyId, serviceId and date are required",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({
        error: "date must use YYYY-MM-DD format",
      });
    }

    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
      },
    });

    if (!company) {
      return reply.status(404).send({
        error: "Company not found",
      });
    }

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        companyId,
        active: true,
      },
    });

    if (!service) {
      return reply.status(404).send({
        error: "Service not found",
      });
    }

    const weekday = getWeekday(
      date,
      company.timezone
    );

    if (!weekday) {
      return reply.status(400).send({
        error: "Invalid date",
      });
    }

    const availabilities =
      await prisma.availability.findMany({
        where: {
          companyId,
          weekday,
        },
        orderBy: {
          startTime: "asc",
        },
      });

    if (availabilities.length === 0) {
      return [];
    }

    const dayStart = createDateTime(
      date,
      "00:00",
      company.timezone
    );

    const nextDay = new Date(dayStart);

    nextDay.setUTCDate(
      nextDay.getUTCDate() + 1
    );

    const appointments =
      await prisma.appointment.findMany({
        where: {
          companyId,
          startTime: {
            lt: nextDay,
          },
          endTime: {
            gt: dayStart,
          },
          status: {
            not: "CANCELLED",
          },
        },
      });

    const slots: Array<{
      startTime: string;
      endTime: string;
      available: boolean;
    }> = [];

    for (const availability of availabilities) {
      const availabilityStart =
        createDateTime(
          date,
          availability.startTime,
          company.timezone
        );

      const availabilityEnd =
        createDateTime(
          date,
          availability.endTime,
          company.timezone
        );

      const current = new Date(
        availabilityStart
      );

      while (true) {
        const slotStart = new Date(current);

        const slotEnd = new Date(current);

        slotEnd.setUTCMinutes(
          slotEnd.getUTCMinutes() +
            service.durationMinutes
        );

        if (slotEnd > availabilityEnd) {
          break;
        }

        const overlappingAppointment =
          appointments.some((appointment) => {
            return (
              slotStart < appointment.endTime &&
              slotEnd > appointment.startTime
            );
          });

        // Nur wirklich freie Slots zurückgeben.
        if (!overlappingAppointment) {
          slots.push({
            startTime:
              slotStart.toISOString(),

            endTime:
              slotEnd.toISOString(),

            available: true,
          });
        }

        current.setUTCMinutes(
          current.getUTCMinutes() +
            service.durationMinutes
        );
      }
    }

    return slots;
  });
}


