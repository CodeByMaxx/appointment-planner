import { FastifyInstance } from "fastify";
import prisma from "../lib/prisma";
import { sendAppointmentEmails } from "../lib/email";

function getLocalParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    weekday: weekdayMap[values.weekday],
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

export default async function appointmentsRoutes(app: FastifyInstance) {
  // POST /appointments
  app.post<{
    Body: {
      companyId: string;
      serviceId: string;
      customerName: string;
      customerEmail: string;
      message?: string;
      startTime: string;
    };
  }>("/appointments", async (request, reply) => {
    const {
      companyId,
      serviceId,
      customerName,
      customerEmail,
      message,
      startTime,
    } = request.body;

    if (
      !companyId ||
      !serviceId ||
      !customerName ||
      !customerEmail ||
      !startTime
    ) {
      return reply.status(400).send({
        error:
          "companyId, serviceId, customerName, customerEmail and startTime are required",
      });
    }

    const start = new Date(startTime);

    if (Number.isNaN(start.getTime())) {
      return reply.status(400).send({
        error: "Invalid startTime",
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

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + service.durationMinutes);

    const localStart = getLocalParts(start, company.timezone);
    const localEnd = getLocalParts(end, company.timezone);

    const startMinutes =
      localStart.hour * 60 + localStart.minute;

    const endMinutes =
      localEnd.hour * 60 + localEnd.minute;

    const availabilities = await prisma.availability.findMany({
      where: {
        companyId,
        weekday: localStart.weekday,
      },
    });

    if (availabilities.length === 0) {
      return reply.status(409).send({
        error: "The company is not available on this day",
      });
    }

    const fitsAvailability = availabilities.some((availability) => {
      const [startHour, startMinute] = availability.startTime
        .split(":")
        .map(Number);

      const [endHour, endMinute] = availability.endTime
        .split(":")
        .map(Number);

      const availabilityStart =
        startHour * 60 + startMinute;

      const availabilityEnd =
        endHour * 60 + endMinute;

      return (
        startMinutes >= availabilityStart &&
        endMinutes <= availabilityEnd &&
        localStart.weekday === localEnd.weekday
      );
    });

    if (!fitsAvailability) {
      return reply.status(409).send({
        error:
          "The selected time is outside the company's availability",
      });
    }

    const overlappingAppointment =
      await prisma.appointment.findFirst({
        where: {
          companyId,
          status: {
            not: "CANCELLED",
          },
          startTime: {
            lt: end,
          },
          endTime: {
            gt: start,
          },
        },
      });

    if (overlappingAppointment) {
      return reply.status(409).send({
        error: "The selected time slot is no longer available",
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        companyId,
        serviceId,
        customerName,
        customerEmail,
        message,
        startTime: start,
        endTime: end,
        status: "CONFIRMED",
      },
    });

    // E-Mails nach erfolgreicher Buchung senden.
    // Ein Fehler beim E-Mail-Versand soll die Buchung nicht rückgängig machen.
    try {
      await sendAppointmentEmails({
        customerName: appointment.customerName,
        customerEmail: appointment.customerEmail,
        companyName: company.name,
        companyEmail: company.email,
        companyTimezone: company.timezone,
        serviceName: service.name,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      });

      app.log.info(
        {
          appointmentId: appointment.id,
          customerEmail: appointment.customerEmail,
          companyEmail: company.email,
        },
        "Appointment emails sent"
      );
    } catch (error) {
      app.log.error(
        {
          appointmentId: appointment.id,
          error,
        },
        "Appointment created, but email notification failed"
      );
    }

    return reply.status(201).send(appointment);
  });

  // GET /appointments?companyId=1
  app.get<{
    Querystring: {
      companyId: string;
    };
  }>("/appointments", async (request, reply) => {
    const { companyId } = request.query;

    if (!companyId) {
      return reply.status(400).send({
        error: "companyId is required",
      });
    }

    return prisma.appointment.findMany({
      where: {
        companyId,
      },
      include: {
        service: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });
  });

  // GET /appointments/:id
  app.get<{
    Params: {
      id: string;
    };
  }>("/appointments/:id", async (request, reply) => {
    const { id } = request.params;

    const appointment = await prisma.appointment.findUnique({
      where: {
        id,
      },
      include: {
        service: true,
      },
    });

    if (!appointment) {
      return reply.status(404).send({
        error: "Appointment not found",
      });
    }

    return appointment;
  });

  // PATCH /appointments/:id/cancel
  app.patch<{
    Params: {
      id: string;
    };
  }>("/appointments/:id/cancel", async (request, reply) => {
    const { id } = request.params;

    const appointment = await prisma.appointment.findUnique({
      where: {
        id,
      },
    });

    if (!appointment) {
      return reply.status(404).send({
        error: "Appointment not found",
      });
    }

    if (appointment.status === "CANCELLED") {
      return reply.status(409).send({
        error: "Appointment is already cancelled",
      });
    }

    const cancelledAppointment =
      await prisma.appointment.update({
        where: {
          id,
        },
        data: {
          status: "CANCELLED",
        },
      });

    return cancelledAppointment;
  });
}
